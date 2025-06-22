import { exec } from 'child_process';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import type { z } from 'zod';

import { AppError } from './errors.js';
import type { StorageAdapter, WorkflowExecutionState } from './interfaces.js';
import type { PromptService } from './prompt-service.js';
import { workflowSchema } from './schemas.js';
import { getSseManager } from './sse';
// If using Node <18, uncomment the following line:
// import fetch from 'node-fetch';

const execAsync = promisify(exec);

/**
 * Types for Workflow Engine
 */
export type Workflow = z.infer<typeof workflowSchema>;

/**
 * Result of running a workflow (MVP placeholder)
 */
export interface RunWorkflowResult {
  success: boolean;
  message: string;
  outputs?: Record<string, unknown>;
  paused?: boolean;
  prompt?: string;
  stepId?: string;
  executionId?: string;
}

/**
 * Service for parsing, validating, and orchestrating workflows
 */
export interface WorkflowService {
  /**
   * Parse and validate a workflow object
   * @param data The workflow definition (object)
   * @returns The parsed Workflow object
   * @throws {Error} If validation fails
   */
  parseWorkflow(data: unknown): Workflow;

  /**
   * Validate a workflow object (returns true/false)
   * @param data The workflow definition (object)
   * @returns True if valid, false otherwise
   */
  validateWorkflow(data: unknown): boolean;

  /**
   * Run a workflow (MVP: stub implementation)
   * @param workflow The workflow to run
   * @returns Result of the workflow run
   */
  runWorkflow(workflow: Workflow, initialContext?: WorkflowContext): Promise<RunWorkflowResult>;
  resumeWorkflow(executionId: string, input: unknown): Promise<RunWorkflowResult>;
}

export class WorkflowServiceImpl implements WorkflowService {
  private storageAdapter: StorageAdapter;
  private promptService: PromptService;

  public constructor(storageAdapter: StorageAdapter, promptService: PromptService) {
    this.storageAdapter = storageAdapter;
    this.promptService = promptService;
  }

  public parseWorkflow(data: unknown): Workflow {
    const result = workflowSchema.safeParse(data);
    if (!result.success) {
      throw new Error('Invalid workflow: ' + JSON.stringify(result.error.format(), null, 2));
    }
    return result.data;
  }

  public validateWorkflow(data: unknown): boolean {
    return workflowSchema.safeParse(data).success;
  }

  /**
   * Run all steps in a workflow, updating the shared context after each step
   * @param workflow The workflow to run
   * @param state
   * @param stepRunners Map of step type to StepRunner instance
   * @returns RunWorkflowResult with outputs and success status
   */
  public async runWorkflowSteps(
    workflow: Workflow,
    state: WorkflowExecutionState,
    stepRunners: Record<string, StepRunner>,
  ): Promise<RunWorkflowResult> {
    const context: WorkflowContext = state.context;
    let currentStepId: string | undefined = state.currentStepId;
    const sseManager = getSseManager();

    try {
      while (currentStepId) {
        const step = workflow.steps.find(s => s.id === currentStepId);
        if (!step) {
          state.status = 'failed';
          state.updatedAt = new Date().toISOString();
          await this.storageAdapter.saveWorkflowState(state);
          // Broadcast step_failed event
          sseManager.broadcast({
            context,
            error: `Step not found: ${currentStepId}`,
            event: 'step_failed',
            executionId: state.executionId,
            stepId: currentStepId,
            workflowId: state.workflowId,
          });
          return { message: `Step not found: ${currentStepId}`, success: false };
        }

        // Broadcast step_started event
        sseManager.broadcast({
          context,
          event: 'step_started',
          executionId: state.executionId,
          stepId: step.id,
          workflowId: state.workflowId,
        });

        // Handle human-approval step: pause and wait for input
        if (step.type === 'human-approval') {
          state.status = 'paused';
          state.currentStepId = currentStepId;
          state.updatedAt = new Date().toISOString();
          await this.storageAdapter.saveWorkflowState(state);
          return {
            executionId: state.executionId,
            message: 'Workflow paused for human approval',
            paused: true,
            prompt: step.prompt,
            stepId: step.id,
            success: false,
          };
        }

        // Handle parallel steps
        if (step.type === 'parallel') {
          const parallelSteps = (step as any).steps as Workflow['steps'];
          try {
            const results = await Promise.all(
              parallelSteps.map(subStep => this.runSingleStep(subStep, context, stepRunners)),
            );

            const failedStepResult = results.find(r => !r.success);
            if (failedStepResult) {
              if (step.onFailure) {
                currentStepId = step.onFailure;
              } else {
                state.status = 'failed';
                state.updatedAt = new Date().toISOString();
                await this.storageAdapter.saveWorkflowState(state);
                // Broadcast step_failed event
                sseManager.broadcast({
                  context,
                  error: `Parallel step failed: ${failedStepResult.error}`,
                  event: 'step_failed',
                  executionId: state.executionId,
                  stepId: step.id,
                  workflowId: state.workflowId,
                });
                return {
                  message: `Parallel step failed: ${failedStepResult.error}`,
                  success: false,
                };
              }
            } else {
              results.forEach((result, index) => {
                const subStep = parallelSteps[index];
                if (result.success && 'output' in subStep && typeof subStep.output === 'string') {
                  context[subStep.output] = result.output;
                }
              });
              currentStepId = step.onSuccess ?? this.findNextStep(workflow, currentStepId);
            }
          } catch (e) {
            state.status = 'failed';
            state.updatedAt = new Date().toISOString();
            await this.storageAdapter.saveWorkflowState(state);
            // Broadcast step_failed event
            sseManager.broadcast({
              context,
              error: `Error in parallel step ${step.id}: ${e}`,
              event: 'step_failed',
              executionId: state.executionId,
              stepId: step.id,
              workflowId: state.workflowId,
            });
            return { message: `Error in parallel step ${step.id}: ${e}`, success: false };
          }
        } else {
          const result = await this.runSingleStep(step, context, stepRunners);
          state.history.push({
            error: result.error,
            executedAt: new Date().toISOString(),
            output: result.output,
            stepId: step.id,
            success: result.success,
          });

          // Broadcast step_completed event
          sseManager.broadcast({
            context,
            error: result.error,
            event: 'step_completed',
            executionId: state.executionId,
            output: result.output,
            stepId: step.id,
            success: result.success,
            workflowId: state.workflowId,
          });

          if (result.success) {
            currentStepId =
              'onSuccess' in step && step.onSuccess
                ? step.onSuccess
                : this.findNextStep(workflow, currentStepId);
          } else {
            if ('errorPolicy' in step && step.errorPolicy === 'continue') {
              currentStepId =
                'onFailure' in step && step.onFailure
                  ? step.onFailure
                  : this.findNextStep(workflow, currentStepId);
            } else {
              state.status = 'failed';
              state.updatedAt = new Date().toISOString();
              state.currentStepId = currentStepId;
              await this.storageAdapter.saveWorkflowState(state);
              // Broadcast step_failed event
              sseManager.broadcast({
                context,
                error: result.error,
                event: 'step_failed',
                executionId: state.executionId,
                stepId: step.id,
                workflowId: state.workflowId,
              });
              return { message: `Step ${step.id} failed: ${result.error}`, success: false };
            }
          }
        }

        state.currentStepId = currentStepId;
        state.updatedAt = new Date().toISOString();
        await this.storageAdapter.saveWorkflowState(state);
      }

      // If the loop completes, the workflow is successful
      state.status = 'completed';
      state.updatedAt = new Date().toISOString();
      state.currentStepId = undefined;
      await this.storageAdapter.saveWorkflowState(state);

      sseManager.broadcast({
        context,
        event: 'workflow_completed',
        executionId: state.executionId,
        workflowId: state.workflowId,
      });

      return {
        message: 'Workflow completed successfully',
        outputs: context,
        success: true,
      };
    } catch (err: unknown) {
      // Catch any unexpected errors during workflow execution
      state.status = 'failed';
      state.updatedAt = new Date().toISOString();
      // currentStepId is preserved from the last loop iteration
      await this.storageAdapter.saveWorkflowState(state);

      const errorMessage = err instanceof Error ? err.message : String(err);
      sseManager.broadcast({
        context,
        error: errorMessage,
        event: 'workflow_failed',
        executionId: state.executionId,
        stepId: currentStepId,
        workflowId: state.workflowId,
      });

      console.error(
        `Workflow ${state.workflowId} failed during execution ${state.executionId}`,
        err,
      );
      // Since runWorkflow doesn't await, we shouldn't re-throw, just return a failure
      return {
        message: `Workflow failed: ${errorMessage}`,
        success: false,
      };
    }
  }

  private async runSingleStep(
    step: any,
    context: WorkflowContext,
    stepRunners: Record<string, StepRunner>,
  ): Promise<StepResult> {
    // 1. Evaluate condition
    if (step.condition) {
      try {
        const conditionResult = new Function('context', `return ${step.condition}`)(context);
        if (!conditionResult) {
          return { output: null, success: true }; // Condition not met, but not a failure
        }
      } catch (e) {
        return { error: `Condition evaluation failed for step ${step.id}: ${e}`, success: false };
      }
    }

    // 2. Execute step
    const runner = stepRunners[step.type];
    if (!runner) {
      return { error: `No runner for step type: ${step.type}`, success: false };
    }

    const result = await runner.runStep(step, context);

    // 3. Update context if step was successful
    if (result.success && 'output' in step && typeof step.output === 'string') {
      context[step.output] = result.output;
    }

    return result;
  }

  private findNextStep(workflow: Workflow, currentStepId: string): string | undefined {
    const currentIndex = workflow.steps.findIndex(s => s.id === currentStepId);
    return workflow.steps[currentIndex + 1]?.id;
  }

  public async runWorkflow(
    workflow: Workflow,
    initialContext: WorkflowContext = {},
  ): Promise<RunWorkflowResult> {
    const userId = initialContext.userId as string || 'anonymous';
    const rateLimiter = getWorkflowRateLimiter();

    if (!rateLimiter(userId)) {
      throw new AppError('Rate limit exceeded', 429, 'RATE_LIMIT_EXCEEDED');
    }

    try {
      const stepRunners: Record<string, StepRunner> = {
        http: new HttpRunner(),
        prompt: new PromptRunner(this.promptService),
        shell: new ShellRunner(),
      };

      const executionId = randomUUID();
      const initialState: WorkflowExecutionState = {
        context: { ...workflow.variables, ...initialContext },
        createdAt: new Date().toISOString(),
        currentStepId: workflow.steps[0]?.id,
        executionId,
        history: [],
        status: 'running',
        updatedAt: new Date().toISOString(),
        version: workflow.version,
        workflowId: workflow.id,
      };

      await this.storageAdapter.saveWorkflowState(initialState);
      return this.runWorkflowSteps(workflow, initialState, stepRunners);
    } finally {
      releaseWorkflowSlot(userId);
    }
  }

  /**
   * Helper to load a workflow definition by ID (assumes promptService or storageAdapter can provide it)
   * @param workflowId
   */
  private async getWorkflowById(workflowId: string): Promise<Workflow | null> {
    // Try to load from storageAdapter if method exists
    if (typeof (this.storageAdapter as any).getWorkflow === 'function') {
      return await (this.storageAdapter as any).getWorkflow(workflowId);
    }
    // Otherwise, not implemented
    return null;
  }

  /**
   * Resume a paused workflow from a human-approval step.
   * @param executionId The workflow execution ID
   * @param input The input provided by the human
   * @returns RunWorkflowResult
   */
  public async resumeWorkflow(executionId: string, input: unknown): Promise<RunWorkflowResult> {
    // Load the paused state
    const state = await this.storageAdapter.getWorkflowState(executionId);
    if (!state) {
      return { message: 'Workflow execution not found', success: false };
    }
    if (state.status !== 'paused' || !state.currentStepId) {
      return { message: 'Workflow is not paused or missing current step', success: false };
    }
    // Load the workflow definition
    const workflow = await this.getWorkflowById(state.workflowId);
    if (!workflow) {
      return { message: 'Workflow definition not found', success: false };
    }
    const step: any = workflow.steps.find((s: any) => s.id === state.currentStepId);
    if (!step || step.type !== 'human-approval') {
      return { message: 'Current step is not a human-approval step', success: false };
    }
    // Inject input into context under the step's output key
    state.context[step.output] = input;
    state.status = 'running';
    state.updatedAt = new Date().toISOString();
    // Advance to onSuccess or next step
    let nextStepId = step.onSuccess ?? this.findNextStep(workflow, step.id);
    state.currentStepId = nextStepId;
    await this.storageAdapter.saveWorkflowState(state);
    // Prepare step runners
    const stepRunners: Record<string, StepRunner> = {
      http: new HttpRunner(),
      prompt: new PromptRunner(this.promptService),
      shell: new ShellRunner(),
    };
    // Continue execution from the next step
    return this.runWorkflowSteps(workflow, state, stepRunners);
  }
}

/**
 * Shared context for workflow execution (MVP: simple key-value store)
 */
export type WorkflowContext = Record<string, unknown>;

/**
 * Result of running a workflow step
 */
export interface StepResult {
  success: boolean;
  output?: unknown;
  error?: string;
}

/**
 * Strategy interface for running a workflow step
 */
export interface StepRunner {
  /**
   * Run a workflow step
   * @param step The step definition (from workflow.steps[])
   * @param context The shared workflow context
   * @returns StepResult (MVP: placeholder)
   */
  runStep(step: unknown, context: WorkflowContext): Promise<StepResult>;
}

// Helper for per-step timeout
/**
 *
 * @param promise
 * @param ms
 */
async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Step timed out after ${ms}ms`)), ms);
    promise
      .then(result => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch(err => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

/**
 * StepRunner for 'prompt' steps
 */
export class PromptRunner implements StepRunner {
  private promptService: PromptService;

  /**
   * @param promptService Instance of PromptService to use for prompt operations
   */
  public constructor(promptService: PromptService) {
    this.promptService = promptService;
  }

  /**
   * Run a 'prompt' step with per-step timeout (default 60s, overridable via step.timeout)
   * @param step
   * @param context
   */
  public async runStep(step: unknown, context: WorkflowContext): Promise<StepResult> {
    const timeoutMs = typeof (step as any).timeout === 'number' ? (step as any).timeout : 60000;
    return withTimeout(this._runStep(step, context), timeoutMs);
  }

  private async _runStep(step: unknown, context: WorkflowContext): Promise<StepResult> {
    // Basic type check for MVP
    if (
      typeof step !== 'object' ||
      step === null ||
      (step as any).type !== 'prompt' ||
      typeof (step as any).promptId !== 'string' ||
      typeof (step as any).input !== 'object'
    ) {
      return { error: 'Invalid prompt step structure', success: false };
    }
    const { promptId, input } = step as { promptId: string; input: Record<string, unknown> };
    // Resolve variables, supporting {{context.key}} references
    const resolvedVars: Record<string, string> = {};
    for (const [key, value] of Object.entries(input)) {
      if (typeof value === 'string' && value.startsWith('{{') && value.endsWith('}}')) {
        const ref = value.slice(2, -2).trim();
        if (ref.startsWith('context.')) {
          const ctxKey = ref.slice('context.'.length);
          resolvedVars[key] = String(context[ctxKey] ?? '');
        } else {
          resolvedVars[key] = value;
        }
      } else {
        resolvedVars[key] = String(value);
      }
    }
    try {
      const result = await this.promptService.applyTemplate(promptId, resolvedVars);
      return { output: result.content, success: true };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { error: errorMessage, success: false };
    }
  }
}

/**
 * StepRunner for 'shell' steps.
 *
 * - If SHELL_SANDBOX_IMAGE is set, runs the command inside a Docker container using that image.
 *   Example: SHELL_SANDBOX_IMAGE=ubuntu
 *   The command will be run as: docker run --rm <image> sh -c "<command>"
 * - If not set, falls back to child_process.exec with a security warning (unsafe for production).
 */
export class ShellRunner implements StepRunner {
  /**
   * Run a 'shell' step: execute the command with a timeout, capture output
   * Uses Docker for sandboxing if SHELL_SANDBOX_IMAGE is set.
   * @param step
   * @param context
   */
  public async runStep(step: unknown, context: WorkflowContext): Promise<StepResult> {
    // Basic type check for MVP
    if (
      typeof step !== 'object' ||
      step === null ||
      (step as any).type !== 'shell' ||
      typeof (step as any).command !== 'string'
    ) {
      return { error: 'Invalid shell step structure', success: false };
    }
    const { command } = step as { command: string };
    const sandboxImage = process.env.SHELL_SANDBOX_IMAGE;
    try {
      if (sandboxImage) {
        // Run the command inside a Docker container
        const dockerCmd = `docker run --rm ${sandboxImage} sh -c ${JSON.stringify(command)}`;
        const { stdout, stderr } = await execAsync(dockerCmd, { timeout: 60000 });
        if (stderr) {
          return { error: stderr, success: false };
        }
        return { output: stdout, success: true };
      } else {
        // Fallback: warn and run unsandboxed
        console.warn(
          '[SECURITY WARNING] ShellRunner is not sandboxed! This is unsafe for production. Set SHELL_SANDBOX_IMAGE to enable Docker-based sandboxing.',
        );
        const { stdout, stderr } = await execAsync(command, { timeout: 60000 }); // 60s timeout
        if (stderr) {
          return { error: stderr, success: false };
        }
        return { output: stdout, success: true };
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { error: errorMessage, success: false };
    }
  }
}

/**
 * StepRunner for 'http' steps (MVP: uses fetch, TODO: headers/auth/advanced)
 */
export class HttpRunner implements StepRunner {
  /**
   * Run an 'http' step with per-step timeout (default 60s, overridable via step.timeout)
   * @param step
   * @param context
   */
  public async runStep(step: unknown, context: WorkflowContext): Promise<StepResult> {
    const timeoutMs = typeof (step as any).timeout === 'number' ? (step as any).timeout : 60000;
    return withTimeout(this._runStep(step, context), timeoutMs);
  }

  private async _runStep(step: unknown, context: WorkflowContext): Promise<StepResult> {
    // Basic type check for MVP
    if (
      typeof step !== 'object' ||
      step === null ||
      (step as any).type !== 'http' ||
      typeof (step as any).method !== 'string' ||
      typeof (step as any).url !== 'string'
    ) {
      return { error: 'Invalid http step structure', success: false };
    }
    const { method, url, body, headers, auth } = step as {
      method: string;
      url: string;
      body?: unknown;
      headers?: Record<string, string>;
      auth?: { username: string; password: string };
    };
    // Support headers, auth, advanced options
    const fetchHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(headers || {}),
    };
    let fetchOptions: any = { headers: fetchHeaders, method };
    if (body) fetchOptions.body = JSON.stringify(body);
    if (auth && auth.username && auth.password) {
      const encoded = Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
      fetchOptions.headers['Authorization'] = `Basic ${encoded}`;
    }
    try {
      const response = await fetch(url, fetchOptions);
      const text = await response.text();
      if (!response.ok) {
        return { error: `HTTP ${response.status}: ${text}`, success: false };
      }
      return { output: text, success: true };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { error: errorMessage, success: false };
    }
  }
}

// --- Rate Limiter ---
const workflowConcurrency: Record<string, number> = {};
const MAX_CONCURRENT_WORKFLOWS = Number(process.env.WORKFLOW_MAX_CONCURRENT) || 3;

/**
 * Returns a function to check and update workflow concurrency for a user.
 * Returns true if allowed, false if limit exceeded.
 */
export function getWorkflowRateLimiter() {
  return (userId: string): boolean => {
    if (!workflowConcurrency[userId]) workflowConcurrency[userId] = 0;
    console.debug(`[RateLimiter] Before: userId=${userId}, count=${workflowConcurrency[userId]}`);
    // Atomic check and increment
    const currentCount = workflowConcurrency[userId];
    if (currentCount >= MAX_CONCURRENT_WORKFLOWS) {
      console.debug(`[RateLimiter] LIMIT EXCEEDED: userId=${userId}, count=${currentCount}`);
      return false;
    }
    workflowConcurrency[userId] = currentCount + 1;
    console.debug(
      `[RateLimiter] After increment: userId=${userId}, count=${workflowConcurrency[userId]}`,
    );
    return true;
  };
}

/**
 *
 * @param userId
 */
export function releaseWorkflowSlot(userId: string) {
  if (workflowConcurrency[userId]) workflowConcurrency[userId]--;
  console.debug(
    `[RateLimiter] After release: userId=${userId}, count=${workflowConcurrency[userId]}`,
  );
}

// --- Audit Logger ---
const auditLogPath = path.join(process.cwd(), 'logs', 'workflow-audit.log');

/**
 * Appends a workflow audit event to the log file.
 * @param event { userId, workflowId, eventType, details }
 * @param event.userId
 * @param event.workflowId
 * @param event.eventType
 * @param event.details
 */
export function auditLogWorkflowEvent(event: {
  userId: string;
  workflowId: string;
  eventType: string;
  details?: unknown;
}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    ...event,
  };
  fs.mkdirSync(path.dirname(auditLogPath), { recursive: true });
  fs.appendFileSync(auditLogPath, JSON.stringify(logEntry) + '\n');
}
