import type { Prompt, PromptSequence, WorkflowExecutionState, ListPromptsOptions } from '@core/interfaces';
import type { IPromptRepository, ISequenceRepository, IWorkflowRepository } from '@core/ports/IPromptRepository';
export declare function atomicWriteFile(filePath: string, data: string): Promise<void>;
export declare class FileAdapter implements IPromptRepository, ISequenceRepository, IWorkflowRepository {
    private promptsDir;
    private sequencesDir;
    private workflowStatesDir;
    private connected;
    private promptIndexPath;
    constructor(options: {
        promptsDir: string;
    });
    private readPromptIndex;
    private writePromptIndex;
    private updatePromptIndexEntry;
    private removePromptIndexEntry;
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
