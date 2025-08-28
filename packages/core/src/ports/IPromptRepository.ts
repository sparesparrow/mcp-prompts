// Secondary port: IPromptRepository
import { 
  Prompt, 
  ListPromptsOptions, 
  WorkflowExecutionState, 
  PromptSequence 
} from '@sparesparrow/mcp-prompts-contracts';

export interface IPromptRepository {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean | Promise<boolean>;
  savePrompt(prompt: Prompt): Promise<Prompt>;
  getPrompt(id: string, version?: number): Promise<Prompt | null>;
  listPromptVersions(id: string): Promise<number[]>;
  updatePrompt(id: string, version: number, prompt: Partial<Prompt>): Promise<Prompt>;
  deletePrompt(id: string, version?: number): Promise<boolean>;
  listPrompts(options?: ListPromptsOptions, allVersions?: boolean): Promise<Prompt[]>;
  clearAll?(): Promise<void>;
  backup?(): Promise<string>;
  restore?(backupId: string): Promise<void>;
  listBackups?(): Promise<string[]>;
  getSequence(id: string): Promise<PromptSequence | null>;
  saveSequence(sequence: PromptSequence): Promise<PromptSequence>;
  deleteSequence(id: string): Promise<void>;
  healthCheck?(): Promise<boolean>;
  saveWorkflowState(state: WorkflowExecutionState): Promise<void>;
  getWorkflowState(executionId: string): Promise<WorkflowExecutionState | null>;
  listWorkflowStates(workflowId: string): Promise<WorkflowExecutionState[]>;
}
