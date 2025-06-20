import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import type { z } from 'zod';

import type { PromptService } from './prompt-service.js';
import { workflowSchema } from './schemas.js';
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
  runWorkflow(workflow: Workflow): Promise<RunWorkflowResult>;
}

export class WorkflowServiceImpl implements WorkflowService {
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
   * @param stepRunners Map of step type to StepRunner instance
   * @returns RunWorkflowResult with outputs and success status
   */
  public async runWorkflowSteps(
    workflow: Workflow,
    stepRunners: Record<string, StepRunner>,
  ): Promise<RunWorkflowResult> {
    const context: WorkflowContext = {};
    const outputs: Record<string, unknown> = {};

    for (const step of workflow.steps) {
      const runner = stepRunners[step.type];
      if (!runner) {
        return {
          message: `No StepRunner for step type: ${step.type}`,
          outputs,
          success: false,
        };
      }
      const result = await runner.runStep(step, context);
      if (!result.success) {
        return {
          message: `Step ${step.id} failed: ${result.error}`,
          outputs,
          success: false,
        };
      }
      // Store output in context under the step's output key (if defined)
      if ('output' in step && typeof step.output === 'string') {
        context[step.output] = result.output;
        outputs[step.output] = result.output;
      }
    }
    return {
      message: 'Workflow completed successfully',
      outputs,
      success: true,
    };
  }

  public async runWorkflow(workflow: Workflow): Promise<RunWorkflowResult> {
    // For MVP, require caller to provide stepRunners externally or use stubs
    // Example usage:
    // const result = await workflowService.runWorkflowSteps(workflow, { prompt: ..., shell: ..., http: ... });
    return {
      message: 'runWorkflow: Please use runWorkflowSteps with stepRunners (MVP)',
      outputs: {},
      success: false,
    };
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
 * StepRunner for 'shell' steps (MVP: uses child_process.exec, TODO: sandboxing)
 */
export class ShellRunner implements StepRunner {
  /**
   * Run a 'shell' step: execute the command with a timeout, capture output
   * Warn if not running in a sandbox (TODO: Docker exec, no root)
   * @param step
   * @param context
   */
  public async runStep(step: unknown, context: WorkflowContext): Promise<StepResult> {
    // TODO: Implement sandboxing (e.g., Docker exec, no root)
    if (!process.env.SHELL_SANDBOXED) {
      console.warn(
        '[SECURITY WARNING] ShellRunner is not sandboxed! This is unsafe for production.',
      );
    }
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
    try {
      const { stdout, stderr } = await execAsync(command, { timeout: 60000 }); // 60s timeout
      if (stderr) {
        return { error: stderr, success: false };
      }
      return { output: stdout, success: true };
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
    const { method, url, body, headers, auth } = step as { method: string; url: string; body?: unknown; headers?: Record<string, string>; auth?: { username: string; password: string } };
    // Support headers, auth, advanced options
    const fetchHeaders: Record<string, string> = { 'Content-Type': 'application/json', ...(headers || {}) };
    let fetchOptions: any = { method, headers: fetchHeaders };
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
