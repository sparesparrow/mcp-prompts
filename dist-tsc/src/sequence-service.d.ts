import type { Prompt, PromptSequence, StorageAdapter } from './interfaces.js';
export interface GetSequenceWithPromptsResult {
    sequence: PromptSequence;
    prompts: Prompt[];
}
/**
 * Service for managing prompt sequences
 */
export interface SequenceService {
    /**
     * Get a sequence by ID, including all its prompts
     * @param id The ID of the sequence
     * @returns The sequence and the full prompt objects
     */
    getSequenceWithPrompts(id: string): Promise<GetSequenceWithPromptsResult>;
    /**
     * Create a new prompt sequence
     * @param data Partial data for the new sequence
     * @returns The created sequence
     */
    createSequence(data: Partial<PromptSequence>): Promise<PromptSequence>;
    /**
     * Delete a prompt sequence
     * @param id The ID of the sequence to delete
     */
    deleteSequence(id: string): Promise<void>;
}
export declare class SequenceServiceImpl implements SequenceService {
    private storage;
    constructor(storage: StorageAdapter);
    getSequenceWithPrompts(id: string): Promise<GetSequenceWithPromptsResult>;
    createSequence(data: Partial<PromptSequence>): Promise<PromptSequence>;
    deleteSequence(id: string): Promise<void>;
}
