import type { z } from 'zod';
import type { StorageAdapter, WorkflowExecutionState } from './interfaces.js';
import type { PromptService } from './prompt-service.js';
import { workflowSchema } from './schemas.js';
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
export declare class WorkflowServiceImpl implements WorkflowService {
    private storageAdapter;
    private promptService;
    constructor(storageAdapter: StorageAdapter, promptService: PromptService);
    parseWorkflow(data: unknown): Workflow;
    validateWorkflow(data: unknown): boolean;
    /**
     * Run all steps in a workflow, updating the shared context after each step
     * @param workflow The workflow to run
     * @param state
     * @param stepRunners Map of step type to StepRunner instance
     * @returns RunWorkflowResult with outputs and success status
     */
    runWorkflowSteps(workflow: Workflow, state: WorkflowExecutionState, stepRunners: Record<string, StepRunner>): Promise<RunWorkflowResult>;
    private runSingleStep;
    private findNextStep;
    runWorkflow(workflow: Workflow, initialContext?: WorkflowContext): Promise<RunWorkflowResult>;
    /**
     * Helper to load a workflow definition by ID (assumes promptService or storageAdapter can provide it)
     * @param workflowId
     */
    private getWorkflowById;
    /**
     * Resume a paused workflow from a human-approval step.
     * @param executionId The workflow execution ID
     * @param input The input provided by the human
     * @returns RunWorkflowResult
     */
    resumeWorkflow(executionId: string, input: unknown): Promise<RunWorkflowResult>;
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
/**
 * StepRunner for 'prompt' steps
 */
export declare class PromptRunner implements StepRunner {
    private promptService;
    /**
     * @param promptService Instance of PromptService to use for prompt operations
     */
    constructor(promptService: PromptService);
    /**
     * Run a 'prompt' step with per-step timeout (default 60s, overridable via step.timeout)
     * @param step
     * @param context
     */
    runStep(step: unknown, context: WorkflowContext): Promise<StepResult>;
    private _runStep;
}
/**
 * StepRunner for 'shell' steps.
 *
 * - If SHELL_SANDBOX_IMAGE is set, runs the command inside a Docker container using that image.
 *   Example: SHELL_SANDBOX_IMAGE=ubuntu
 *   The command will be run as: docker run --rm <image> sh -c "<command>"
 * - If not set, falls back to child_process.exec with a security warning (unsafe for production).
 */
export declare class ShellRunner implements StepRunner {
    /**
     * Run a 'shell' step: execute the command with a timeout, capture output
     * Uses Docker for sandboxing if SHELL_SANDBOX_IMAGE is set.
     * @param step
     * @param context
     */
    runStep(step: unknown, context: WorkflowContext): Promise<StepResult>;
}
/**
 * StepRunner for 'http' steps (MVP: uses fetch, TODO: headers/auth/advanced)
 */
export declare class HttpRunner implements StepRunner {
    /**
     * Run an 'http' step with per-step timeout (default 60s, overridable via step.timeout)
     * @param step
     * @param context
     */
    runStep(step: unknown, context: WorkflowContext): Promise<StepResult>;
    private _runStep;
}
/**
 * Returns a function to check and update workflow concurrency for a user.
 * Returns true if allowed, false if limit exceeded.
 */
export declare function getWorkflowRateLimiter(): (userId: string) => boolean;
/**
 *
 * @param userId
 */
export declare function releaseWorkflowSlot(userId: string): void;
/**
 * Appends a workflow audit event to the log file.
 * @param event { userId, workflowId, eventType, details }
 * @param event.userId
 * @param event.workflowId
 * @param event.eventType
 * @param event.details
 */
export declare function auditLogWorkflowEvent(event: {
    userId: string;
    workflowId: string;
    eventType: string;
    details?: unknown;
}): void;
