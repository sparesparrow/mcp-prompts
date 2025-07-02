import { v4 as uuidv4 } from 'uuid';
import type { Prompt, PromptSequence } from '@core/types/manual-exports.js';

import { PromptService } from './prompt-service.js';

export interface GetSequenceWithPromptsResult {
  sequence: PromptSequence;
  prompts: Prompt[];
}

/**
 * Application port for managing prompt sequences
 */
export interface ISequenceApplication {
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

  /**
   * Get a sequence by ID
   * @param id The ID of the sequence
   * @returns The sequence or null
   */
  getSequence(id: string): Promise<PromptSequence | null>;

  /**
   * Execute a sequence by ID with variables
   * @param id The ID of the sequence
   * @param variables Optional variables for execution
   * @returns The result of execution
   */
  executeSequence(id: string, variables?: Record<string, any>): Promise<any>;
}

/**
 * Repository port for sequence persistence
 */
export interface ISequenceRepository {
  getSequence(id: string): Promise<PromptSequence | null>;
  saveSequence(sequence: PromptSequence): Promise<PromptSequence>;
  deleteSequence(id: string): Promise<void>;
}

export class SequenceApplication implements ISequenceApplication {
  private storage: ISequenceRepository;

  public constructor(storage: ISequenceRepository) {
    this.storage = storage;
  }

  public async getSequenceWithPrompts(id: string): Promise<GetSequenceWithPromptsResult> {
    const sequence = await this.storage.getSequence(id);
    if (!sequence) {
      throw new Error(`Sequence with id ${id} not found`);
    }

    const prompts = await Promise.all(
      sequence.promptIds.map((promptId: string) => (this.storage as any).getPrompt(promptId)),
    );

    const foundPrompts = prompts.filter((p: Prompt | null): p is Prompt => p !== null);

    if (foundPrompts.length !== sequence.promptIds.length) {
      console.warn(`Some prompts for sequence ${id} were not found.`);
    }

    return {
      prompts: foundPrompts,
      sequence,
    };
  }

  public async createSequence(data: Partial<PromptSequence>): Promise<PromptSequence> {
    if (!data.name || !data.promptIds) {
      throw new Error('Missing required fields: name and promptIds');
    }

    const now = new Date().toISOString();
    const newSequence: PromptSequence = {
      createdAt: now,
      description: data.description,
      id: data.id || uuidv4(),
      metadata: data.metadata,
      name: data.name,
      promptIds: data.promptIds,
      updatedAt: now,
    };

    return this.storage.saveSequence(newSequence);
  }

  public async deleteSequence(id: string): Promise<void> {
    await this.storage.deleteSequence(id);
  }

  public async getSequence(id: string): Promise<PromptSequence | null> {
    return this.storage.getSequence(id);
  }

  public async executeSequence(id: string, variables?: Record<string, any>): Promise<any> {
    // Stub implementation: just return the sequence and variables for now
    const sequence = await this.getSequence(id);
    if (!sequence) throw new Error('Sequence not found');
    return { sequence, variables };
  }
}
