import type { Prompt, PromptSequence, WorkflowExecutionState, ListPromptsOptions } from '@core/interfaces';
import type { IPromptRepository, ISequenceRepository, IWorkflowRepository } from '@core/ports/IPromptRepository';

function sanitizePromptMetadata<T extends { metadata?: any }>(prompt: T): T {
  if ('metadata' in prompt && prompt.metadata === null) {
    return { ...prompt, metadata: undefined };
  }
  return prompt;
}

export class MemoryAdapter implements IPromptRepository, ISequenceRepository, IWorkflowRepository {
  private prompts = new Map<string, Map<number, Prompt>>();
  private sequences = new Map<string, PromptSequence>();
  private workflowStates = new Map<string, WorkflowExecutionState>();
  private connected = false;

  public constructor() {
    this.connected = false;
  }

  public async connect(): Promise<void> {
    this.connected = true;
  }

  public async disconnect(): Promise<void> {
    this.connected = false;
  }

  public async isConnected(): Promise<boolean> {
    return this.connected;
  }

  public async healthCheck(): Promise<boolean> {
    return this.connected;
  }

  public async clearAll(): Promise<void> {
    this.prompts.clear();
    this.sequences.clear();
    this.workflowStates.clear();
  }

  public async listPrompts(options?: ListPromptsOptions, allVersions = false): Promise<Prompt[]> {
    let all: Prompt[] = [];
    for (const versions of this.prompts.values()) {
      for (const prompt of versions.values()) {
        all.push(prompt);
      }
    }

    // Filter
    if (options) {
      all = all.filter(p => {
        if (options.isTemplate !== undefined && p.isTemplate !== options.isTemplate) return false;
        if (options.category && p.category !== options.category) return false;
        if (options.tags) {
          if (!p.tags || !options.tags.every(t => p.tags?.includes(t))) return false;
        }
        if (options.search) {
          const searchTerm = options.search.toLowerCase();
          const inName = p.name.toLowerCase().includes(searchTerm);
          const inContent = p.content.toLowerCase().includes(searchTerm);
          const inDescription = p.description?.toLowerCase().includes(searchTerm);
          if (!inName && !inContent && !inDescription) return false;
        }
        return true;
      });
    }

    // Sort
    if (options?.sort) {
      all.sort((a, b) => {
        const fieldA = a[options.sort as keyof Prompt];
        const fieldB = b[options.sort as keyof Prompt];
        if (fieldA === undefined || fieldB === undefined) return 0;
        if (fieldA < fieldB) return options.order === 'desc' ? 1 : -1;
        if (fieldA > fieldB) return options.order === 'desc' ? -1 : 1;
        return 0;
      });
    }

    if (!allVersions) {
      const latestVersions = new Map<string, Prompt>();
      for (const p of all) {
        if (
          !latestVersions.has(p.id) ||
          (latestVersions.get(p.id)?.version ?? 0) < (p.version ?? 0)
        ) {
          latestVersions.set(p.id, p);
        }
      }
      all = Array.from(latestVersions.values());
    }

    // Paginate
    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? all.length;
    return all.slice(offset, offset + limit);
  }

  public async getPrompt(id: string, version?: number): Promise<Prompt | null> {
    const versions = this.prompts.get(id);
    if (!versions) {
      return null;
    }

    if (version === undefined) {
      // get latest version
      const latestVersion = Math.max(...versions.keys());
      return versions.get(latestVersion) ?? null;
    }

    return versions.get(version) ?? null;
  }

  public async savePrompt(promptData: Prompt): Promise<Prompt> {
    if (!this.connected) {
      throw new Error('Memory storage not connected');
    }
    let versions = this.prompts.get(promptData.id);
    if (!versions) {
      versions = new Map<number, Prompt>();
      this.prompts.set(promptData.id, versions);
    }
    versions.set(promptData.version as number, promptData);
    return sanitizePromptMetadata(promptData);
  }

  public async updatePrompt(
    id: string,
    version: number,
    promptData: Partial<Prompt>,
  ): Promise<Prompt> {
    const existing = await this.getPrompt(id, version);
    if (!existing) {
      throw new Error(`Prompt with id ${id} and version ${version} not found`);
    }

    const updatedPrompt: Prompt = {
      ...existing,
      ...promptData,
      id,
      version,
      updatedAt: new Date().toISOString(),
    };

    const promptVersions = this.prompts.get(id);
    promptVersions?.set(version, updatedPrompt);

    return sanitizePromptMetadata(updatedPrompt);
  }

  public async deletePrompt(id: string, version?: number): Promise<boolean> {
    const versions = this.prompts.get(id);
    if (!versions) {
      return false;
    }
    if (version !== undefined) {
      if (!versions.has(version)) {
        return false;
      }
      versions.delete(version);
      if (versions.size === 0) {
        this.prompts.delete(id);
      }
    } else {
      this.prompts.delete(id);
    }
    return true;
  }

  public async listPromptVersions(id: string): Promise<number[]> {
    const versions = this.prompts.get(id);
    if (!versions) {
      return [];
    }
    return Array.from(versions.keys()).sort((a, b) => a - b);
  }

  public async getSequence(id: string): Promise<PromptSequence | null> {
    return this.sequences.get(id) ?? null;
  }

  public async saveSequence(sequence: PromptSequence): Promise<PromptSequence> {
    this.sequences.set(sequence.id, sequence);
    return sequence;
  }

  public async deleteSequence(id: string): Promise<void> {
    this.sequences.delete(id);
  }

  public async saveWorkflowState(state: WorkflowExecutionState): Promise<void> {
    this.workflowStates.set(state.executionId, state);
  }

  public async getWorkflowState(executionId: string): Promise<WorkflowExecutionState | null> {
    return this.workflowStates.get(executionId) ?? null;
  }

  public async listWorkflowStates(workflowId: string): Promise<WorkflowExecutionState[]> {
    const states: WorkflowExecutionState[] = [];
    for (const state of this.workflowStates.values()) {
      if (state.workflowId === workflowId) {
        states.push(state);
      }
    }
    return states;
  }
} 