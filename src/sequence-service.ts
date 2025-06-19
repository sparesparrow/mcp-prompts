import { Prompt, PromptSequence, StorageAdapter } from "./interfaces.js";
import { v4 as uuidv4 } from 'uuid';

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

export class SequenceServiceImpl implements SequenceService {
  private storage: StorageAdapter;

  constructor(storage: StorageAdapter) {
    this.storage = storage;
  }

  async getSequenceWithPrompts(id: string): Promise<GetSequenceWithPromptsResult> {
    const sequence = await this.storage.getSequence(id);
    if (!sequence) {
      throw new Error(`Sequence with id ${id} not found`);
    }

    const prompts = await Promise.all(
      sequence.promptIds.map(promptId => this.storage.getPrompt(promptId))
    );

    const foundPrompts = prompts.filter((p): p is Prompt => p !== null);
    
    if (foundPrompts.length !== sequence.promptIds.length) {
        console.warn(`Some prompts for sequence ${id} were not found.`);
    }

    return {
      sequence,
      prompts: foundPrompts,
    };
  }

  async createSequence(data: Partial<PromptSequence>): Promise<PromptSequence> {
    if (!data.name || !data.promptIds) {
      throw new Error("Missing required fields: name and promptIds");
    }

    const now = new Date().toISOString();
    const newSequence: PromptSequence = {
      id: data.id || uuidv4(),
      name: data.name,
      description: data.description,
      promptIds: data.promptIds,
      createdAt: now,
      updatedAt: now,
      metadata: data.metadata,
    };

    return this.storage.saveSequence(newSequence);
  }

  async deleteSequence(id: string): Promise<void> {
    await this.storage.deleteSequence(id);
  }
} 