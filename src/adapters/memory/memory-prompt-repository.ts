import { IPromptRepository } from '../../core/ports/prompt-repository.interface';
import { Prompt } from '../../core/entities/prompt.entity';

export class MemoryPromptRepository implements IPromptRepository {
  private prompts: Map<string, Prompt> = new Map();

  async save(prompt: Prompt): Promise<void> {
    this.prompts.set(`${prompt.id}:${prompt.version}`, prompt);
  }

  async findById(id: string, version?: string): Promise<Prompt | null> {
    const key = version ? `${id}:${version}` : `${id}:latest`;
    if (version) {
      return this.prompts.get(key) || null;
    }

    // Find latest version
    const versions = Array.from(this.prompts.keys())
      .filter(k => k.startsWith(`${id}:`))
      .map(k => k.split(':')[1]);

    if (versions.length === 0) {
      return null;
    }

    const latestVersion = versions.sort().pop()!;
    return this.prompts.get(`${id}:${latestVersion}`) || null;
  }

  async findByCategory(category: string, limit?: number): Promise<Prompt[]> {
    const prompts = Array.from(this.prompts.values())
      .filter(p => p.category === category)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    return limit ? prompts.slice(0, limit) : prompts;
  }

  async findLatestVersions(limit: number = 50): Promise<Prompt[]> {
    return Array.from(this.prompts.values())
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, limit);
  }

  async search(query: string, category?: string): Promise<Prompt[]> {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.prompts.values()).filter(prompt => {
      if (category && prompt.category !== category) {
        return false;
      }

      return (
        prompt.name.toLowerCase().includes(lowerQuery) ||
        prompt.description.toLowerCase().includes(lowerQuery) ||
        prompt.template.toLowerCase().includes(lowerQuery) ||
        (prompt.tags && prompt.tags.some(tag => tag.toLowerCase().includes(lowerQuery)))
      );
    });
  }

  async update(id: string, version: string, updates: Partial<Prompt>): Promise<void> {
    const existing = await this.findById(id, version);
    if (!existing) {
      throw new Error(`Prompt ${id} version ${version} not found`);
    }

    const updated = new Prompt(
      existing.id,
      updates.name || existing.name,
      updates.description || existing.description,
      updates.template || existing.template,
      updates.category || existing.category,
      updates.tags || existing.tags,
      updates.variables || existing.variables,
      updates.version || existing.version,
      existing.createdAt,
      new Date(),
      existing.isLatest,
      existing.metadata,
      updates.accessLevel || existing.accessLevel,
      updates.authorId || existing.authorId
    );

    await this.save(updated);
  }

  async delete(id: string, version?: string): Promise<void> {
    if (version) {
      this.prompts.delete(`${id}:${version}`);
    } else {
      // Delete all versions
      const keysToDelete = Array.from(this.prompts.keys()).filter(k => k.startsWith(`${id}:`));
      keysToDelete.forEach(key => this.prompts.delete(key));
    }
  }

  async getVersions(id: string): Promise<string[]> {
    return Array.from(this.prompts.keys())
      .filter(k => k.startsWith(`${id}:`))
      .map(k => k.split(':')[1])
      .sort();
  }

  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details?: any }> {
    return { status: 'healthy' };
  }

  // Stub implementations for new agent methods
  async findByType(type: string, limit?: number): Promise<Prompt[]> {
    return Array.from(this.prompts.values())
      .filter(p => p.promptType === type)
      .slice(0, limit || 50);
  }

  async findSubagents(filter?: any, limit?: number): Promise<Prompt[]> {
    let agents = Array.from(this.prompts.values())
      .filter(p => p.promptType === 'subagent_registry');

    if (filter) {
      if (filter.category) {
        agents = agents.filter(p => p.category === filter.category);
      }
      if (filter.tags) {
        agents = agents.filter(p => filter.tags.some((tag: string) => p.tags.includes(tag)));
      }
      if (filter.model) {
        agents = agents.filter(p => p.agentConfig?.model === filter.model);
      }
    }

    return agents.slice(0, limit || 50);
  }

  async findMainAgents(projectType?: string, limit?: number): Promise<Prompt[]> {
    let agents = Array.from(this.prompts.values())
      .filter(p => p.promptType === 'main_agent_template');

    if (projectType) {
      agents = agents.filter(p =>
        p.agentConfig?.compatibleWith?.includes(projectType) ||
        p.id.includes(projectType) ||
        p.category === projectType
      );
    }

    return agents.slice(0, limit || 50);
  }

  async findProjectTemplates(limit?: number): Promise<Prompt[]> {
    return Array.from(this.prompts.values())
      .filter(p => p.promptType === 'project_orchestration_template')
      .slice(0, limit || 50);
  }

  async getSubagentCategories(): Promise<string[]> {
    const categories = Array.from(this.prompts.values())
      .filter(p => p.promptType === 'subagent_registry')
      .map(p => p.category)
      .filter((cat, index, arr) => arr.indexOf(cat) === index);
    return categories;
  }

  async getAgentModels(): Promise<any[]> {
    const models = Array.from(this.prompts.values())
      .filter(p => p.agentConfig?.model)
      .map(p => p.agentConfig!.model)
      .filter((model, index, arr) => arr.indexOf(model) === index);
    return models;
  }

  async updateExecutionStats(id: string, executionCount: number, successRate: number, lastExecutedAt: Date): Promise<void> {
    const prompt = Array.from(this.prompts.values()).find(p => p.id === id);
    if (prompt && prompt.agentConfig) {
      prompt.agentConfig.executionCount = executionCount;
      prompt.agentConfig.successRate = successRate;
      prompt.agentConfig.lastExecutedAt = lastExecutedAt;
    }
  }
}