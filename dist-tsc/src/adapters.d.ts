/**
 * Consolidated Adapters Module
 * Contains all storage adapters in a single file
 */
import type { pino } from 'pino';
import pg from 'pg';
import { z } from 'zod';
import { type ListPromptsOptions, type McpConfig, type Prompt, type PromptSequence, type StorageAdapter, type WorkflowExecutionState } from './interfaces.js';
export declare function adapterFactory(config: McpConfig, logger: pino.Logger): StorageAdapter;
export type { StorageAdapter };
export declare class ValidationError extends Error {
    issues: z.ZodIssue[];
    constructor(message: string, issues: z.ZodIssue[]);
}
/**
 * FileAdapter Implementation
 * Stores prompts as individual JSON files in a directory
 */
export declare class FileAdapter implements StorageAdapter {
    private promptsDir;
    private sequencesDir;
    private workflowStatesDir;
    private connected;
    constructor(options: {
        promptsDir: string;
    });
    private withLock;
    isConnected(): Promise<boolean>;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    private getPromptFileName;
    private generateId;
    savePrompt(promptData: Omit<Prompt, 'id' | 'version' | 'createdAt' | 'updatedAt'>): Promise<Prompt>;
    getPrompt(id: string, version?: number): Promise<Prompt | null>;
    listPromptVersions(id: string): Promise<number[]>;
    updatePrompt(id: string, version: number, prompt: Partial<Prompt>): Promise<Prompt>;
    deletePrompt(id: string, version?: number): Promise<boolean>;
    listPrompts(options?: ListPromptsOptions, allVersions?: boolean): Promise<Prompt[]>;
    getSequence(id: string): Promise<PromptSequence | null>;
    saveSequence(sequence: PromptSequence): Promise<PromptSequence>;
    deleteSequence(id: string): Promise<void>;
    saveWorkflowState(state: WorkflowExecutionState): Promise<void>;
    getWorkflowState(executionId: string): Promise<WorkflowExecutionState | null>;
    listWorkflowStates(workflowId: string): Promise<WorkflowExecutionState[]>;
    healthCheck(): Promise<boolean>;
}
/**
 * MemoryAdapter Implementation
 * In-memory storage for prompts, useful for testing and development
 */
export declare class MemoryAdapter implements StorageAdapter {
    private prompts;
    private sequences;
    private workflowStates;
    private connected;
    constructor();
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    isConnected(): Promise<boolean>;
    healthCheck(): Promise<boolean>;
    clearAll(): Promise<void>;
    listPrompts(options?: ListPromptsOptions, allVersions?: boolean): Promise<Prompt[]>;
    getPrompt(id: string, version?: number): Promise<Prompt | null>;
    savePrompt(promptData: Prompt): Promise<Prompt>;
    updatePrompt(id: string, version: number, promptData: Partial<Prompt>): Promise<Prompt>;
    deletePrompt(id: string, version?: number): Promise<boolean>;
    listPromptVersions(id: string): Promise<number[]>;
    getSequence(id: string): Promise<PromptSequence | null>;
    saveSequence(sequence: PromptSequence): Promise<PromptSequence>;
    deleteSequence(id: string): Promise<void>;
    saveWorkflowState(state: WorkflowExecutionState): Promise<void>;
    getWorkflowState(executionId: string): Promise<WorkflowExecutionState | null>;
    listWorkflowStates(workflowId: string): Promise<WorkflowExecutionState[]>;
}
/**
 * PostgresAdapter Implementation
 * Stores prompts in a PostgreSQL database
 */
export declare class PostgresAdapter implements StorageAdapter {
    private pool;
    private connected;
    private config;
    private maxRetries;
    private retryDelay;
    constructor(config: pg.PoolConfig);
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    private getOrCreateTagIds;
    private setPromptTags;
    private setTemplateVariables;
    private getTagsForPrompt;
    private getVariablesForPrompt;
    private getPromptIdByName;
    private extractVariableNames;
    savePrompt(prompt: Prompt): Promise<Prompt>;
    private getPromptById;
    getPrompt(idOrName: string, version?: number): Promise<Prompt | null>;
    updatePrompt(id: string, version: number, prompt: Partial<Prompt>): Promise<Prompt>;
    deletePrompt(idOrName: string, version?: number): Promise<boolean>;
    listPrompts(options?: ListPromptsOptions, allVersions?: boolean): Promise<Prompt[]>;
    listPromptVersions(id: string): Promise<number[]>;
    getSequence(id: string): Promise<PromptSequence | null>;
    saveSequence(sequence: PromptSequence): Promise<PromptSequence>;
    deleteSequence(id: string): Promise<void>;
    healthCheck(): Promise<boolean>;
    private generateId;
    isConnected(): Promise<boolean>;
    saveWorkflowState(state: WorkflowExecutionState): Promise<void>;
    getWorkflowState(executionId: string): Promise<WorkflowExecutionState | null>;
    listWorkflowStates(workflowId: string): Promise<WorkflowExecutionState[]>;
}
