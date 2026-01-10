import * as fs from 'fs/promises';
import * as path from 'path';
import { IPromptRepository, SubagentFilter } from '../../core/ports/prompt-repository.interface';
import { Prompt, PromptType, ClaudeModel, AgentConfig } from '../../core/entities/prompt.entity';

interface PromptData {
  id: string;
  name: string;
  description: string;
  template: string;
  category: string;
  tags?: string[];
  variables?: string[];
  version: string;
  createdAt: string;
  updatedAt: string;
  isLatest: boolean;
  metadata: Record<string, any>;
  accessLevel: string;
  authorId?: string;
  // NEW: Agent orchestration fields
  promptType?: PromptType;
  agentConfig?: AgentConfig;
}

export class FilePromptRepository implements IPromptRepository {
  constructor(private promptsDir: string) {}

  async save(prompt: Prompt): Promise<void> {
    const filePath = path.join(this.promptsDir, `${prompt.id}.json`);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(prompt, null, 2));
  }

  async findById(id: string, version?: string): Promise<Prompt | null> {
    try {
      // Try direct path first (for top-level files)
      let filePath = path.join(this.promptsDir, `${id}.json`);
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const data = JSON.parse(content);

        // If version is specified, check if it matches
        if (version && data.version !== version) {
          return null;
        }

        return this.parsePromptData(data);
      } catch (err) {
        // If not found at root level, search in subdirectories
      }

      // Search in subdirectories (for nested prompts like subagents/explorer)
      const files = await this.scanDirectory(this.promptsDir);
      for (const filePath of files) {
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const data = JSON.parse(content);

          if (data.id === id) {
            // If version is specified, check if it matches
            if (version && data.version !== version) {
              continue;
            }
            return this.parsePromptData(data);
          }
        } catch (err) {
          // Skip malformed files
        }
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Parse prompt data into a Prompt entity
   */
  private parsePromptData(data: any): Prompt {
    const createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
    const updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();

    return new Prompt(
      data.id,
      data.name,
      data.description || '',
      data.content || data.template || data.system_prompt || '',
      data.category || 'general',
      Array.isArray(data.tags) ? data.tags : [],
      Array.isArray(data.variables) ? data.variables : [],
      data.version || 'latest',
      createdAt,
      updatedAt,
      data.isLatest !== false,
      data.metadata || {},
      data.accessLevel || 'public',
      data.authorId,
      (data.promptType as PromptType) || data.type as PromptType || 'standard',
      data.agentConfig || (data.model ? {
        model: data.model as ClaudeModel,
        systemPrompt: data.system_prompt || data.content,
        tools: data.tools,
        mcpServers: data.mcp_servers || data.mcpServers,
        subagents: data.subagents,
        compatibleWith: data.compatible_with || data.compatibleWith,
        sourceUrl: data.source_url,
        executionCount: data.agent_execution_count || 0,
        successRate: data.agent_success_rate,
        lastExecutedAt: data.agent_last_executed_at ? new Date(data.agent_last_executed_at) : undefined
      } : undefined)
    );
  }

  async findByCategory(category: string, limit?: number): Promise<Prompt[]> {
    const allPrompts = await this.findLatestVersions(limit || 100);
    return allPrompts.filter(p => p.category === category);
  }

  async findLatestVersions(limit: number = 50): Promise<Prompt[]> {
    try {
      const files = await fs.readdir(this.promptsDir);
      const prompts: Prompt[] = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
        try {
          const content = await fs.readFile(path.join(this.promptsDir, file), 'utf-8');
          const data = JSON.parse(content);

          // Create proper Prompt instance with safe date parsing
          const createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
          const updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();

          // Ensure dates are valid
          if (isNaN(createdAt.getTime())) {
            console.warn(`Invalid createdAt date for prompt ${data.id}, using current date`);
          }
          if (isNaN(updatedAt.getTime())) {
            console.warn(`Invalid updatedAt date for prompt ${data.id}, using current date`);
          }

          const prompt = new Prompt(
            data.id,
            data.name,
            data.description || '',
            data.template || data.system_prompt || '', // Support both template and system_prompt
            data.category || 'general',
            Array.isArray(data.tags) ? data.tags : [],
            Array.isArray(data.variables) ? data.variables : [],
            data.version || 'latest',
            createdAt,
            updatedAt,
            data.isLatest !== false, // default to true
            data.metadata || {},
            data.accessLevel || 'public',
            data.authorId,
            // NEW: Agent orchestration fields
            (data.promptType as PromptType) || data.type as PromptType || 'standard',
            data.agentConfig || (data.model ? {
              model: data.model as ClaudeModel,
              systemPrompt: data.system_prompt,
              tools: data.tools,
              mcpServers: data.mcp_servers,
              subagents: data.subagents,
              compatibleWith: data.compatible_with,
              sourceUrl: data.source_url,
              executionCount: data.agent_execution_count || 0,
              successRate: data.agent_success_rate,
              lastExecutedAt: data.agent_last_executed_at ? new Date(data.agent_last_executed_at) : undefined
            } : undefined)
          );
          prompts.push(prompt);
        } catch (error) {
          // Skip invalid files
          console.warn(`Skipping invalid prompt file: ${file}`);
        }
        }
      }

      // Sort by updatedAt descending and limit
      return prompts
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, limit);
    } catch (error) {
      return [];
    }
  }

  async search(query: string, category?: string): Promise<Prompt[]> {
    const allPrompts = await this.findLatestVersions(1000);
    const lowerQuery = query.toLowerCase();

    return allPrompts.filter(prompt => {
      if (category && prompt.category !== category) {
        return false;
      }

      return (
        prompt.name.toLowerCase().includes(lowerQuery) ||
        (prompt.description && prompt.description.toLowerCase().includes(lowerQuery)) ||
        (prompt.template && prompt.template.toLowerCase().includes(lowerQuery)) ||
        (prompt.tags && prompt.tags.some(tag => tag && tag.toLowerCase().includes(lowerQuery)))
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
    const filePath = path.join(this.promptsDir, `${id}.json`);

    try {
      await fs.unlink(filePath);
    } catch (error) {
      if ((error as any).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  async getVersions(id: string): Promise<string[]> {
    const prompt = await this.findById(id);
    return prompt ? [prompt.version] : [];
  }

  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details?: any }> {
    try {
      await fs.access(this.promptsDir);
      return { status: 'healthy' };
    } catch (error) {
      return { status: 'unhealthy', details: error };
    }
  }

  // NEW: Agent orchestration methods

  async findByType(type: PromptType, limit?: number): Promise<Prompt[]> {
    const allPrompts = await this.findLatestVersions(limit || 1000);
    return allPrompts.filter(p => p.promptType === type);
  }

  async findSubagents(filter?: SubagentFilter, limit?: number): Promise<Prompt[]> {
    let prompts = await this.findByType('subagent_registry', limit);

    if (!filter) {
      return prompts;
    }

    // Apply category filter
    if (filter.category) {
      prompts = prompts.filter(p => p.category === filter.category);
    }

    // Apply tags filter (prompt must have ALL specified tags)
    if (filter.tags && filter.tags.length > 0) {
      prompts = prompts.filter(p =>
        filter.tags!.every(tag => p.tags.includes(tag))
      );
    }

    // Apply model filter
    if (filter.model) {
      prompts = prompts.filter(p => p.getModel() === filter.model);
    }

    // Apply compatibleWith filter
    if (filter.compatibleWith) {
      prompts = prompts.filter(p =>
        p.agentConfig?.compatibleWith?.includes(filter.compatibleWith!)
      );
    }

    return prompts;
  }

  async findMainAgents(projectType?: string, limit?: number): Promise<Prompt[]> {
    let prompts = await this.findByType('main_agent_template', limit);

    if (projectType) {
      prompts = prompts.filter(p =>
        p.agentConfig?.compatibleWith?.includes(projectType) ||
        p.id.includes(projectType) ||
        p.category === projectType
      );
    }

    return prompts;
  }

  async findProjectTemplates(limit?: number): Promise<Prompt[]> {
    return this.findByType('project_orchestration_template', limit);
  }

  async getSubagentCategories(): Promise<string[]> {
    const subagents = await this.findSubagents();
    const categories = new Set(subagents.map(s => s.category));
    return Array.from(categories).sort();
  }

  async getAgentModels(): Promise<ClaudeModel[]> {
    const agents = await this.findLatestVersions(10000);
    const models = new Set<ClaudeModel>();

    agents.forEach(agent => {
      const model = agent.getModel();
      if (model) {
        models.add(model);
      }
    });

    return Array.from(models);
  }

  async updateExecutionStats(
    id: string,
    executionCount: number,
    successRate: number,
    lastExecutedAt: Date
  ): Promise<void> {
    const prompt = await this.findById(id);
    if (!prompt || !prompt.agentConfig) {
      throw new Error(`Agent ${id} not found or not an agent prompt`);
    }

    // Create updated prompt with new execution stats
    const updated = new Prompt(
      prompt.id,
      prompt.name,
      prompt.description,
      prompt.template,
      prompt.category,
      prompt.tags,
      prompt.variables,
      prompt.version,
      prompt.createdAt,
      new Date(),
      prompt.isLatest,
      prompt.metadata,
      prompt.accessLevel,
      prompt.authorId,
      prompt.promptType,
      {
        ...prompt.agentConfig,
        executionCount,
        successRate,
        lastExecutedAt
      }
    );

    await this.save(updated);
  }

  /**
   * Helper: Recursively scan directories for prompt files
   */
  private async scanDirectory(dir: string): Promise<string[]> {
    const files: string[] = [];

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          const subFiles = await this.scanDirectory(fullPath);
          files.push(...subFiles);
        } else if (entry.isFile() && entry.name.endsWith('.json') && entry.name !== 'index.json') {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Directory doesn't exist or not accessible
      console.warn(`Could not scan directory ${dir}:`, error);
    }

    return files;
  }

  /**
   * Override findLatestVersions to scan subdirectories (for subagents organized by category)
   */
  async findLatestVersions(limit: number = 50): Promise<Prompt[]> {
    try {
      const files = await this.scanDirectory(this.promptsDir);
      const prompts: Prompt[] = [];

      for (const filePath of files) {
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const data = JSON.parse(content);

          // Create proper Prompt instance with safe date parsing
          const createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
          const updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();

          // Ensure dates are valid
          if (isNaN(createdAt.getTime())) {
            console.warn(`Invalid createdAt date for prompt ${data.id}, using current date`);
          }
          if (isNaN(updatedAt.getTime())) {
            console.warn(`Invalid updatedAt date for prompt ${data.id}, using current date`);
          }

          const prompt = new Prompt(
            data.id,
            data.name,
            data.description || '',
            data.template || data.system_prompt || '',
            data.category || 'general',
            Array.isArray(data.tags) ? data.tags : [],
            Array.isArray(data.variables) ? data.variables : [],
            data.version || 'latest',
            createdAt,
            updatedAt,
            data.isLatest !== false,
            data.metadata || {},
            data.accessLevel || 'public',
            data.authorId,
            (data.promptType as PromptType) || data.type as PromptType || 'standard',
            data.agentConfig || (data.model ? {
              model: data.model as ClaudeModel,
              systemPrompt: data.system_prompt,
              tools: data.tools,
              mcpServers: data.mcp_servers,
              subagents: data.subagents,
              compatibleWith: data.compatible_with,
              sourceUrl: data.source_url,
              executionCount: data.agent_execution_count || 0,
              successRate: data.agent_success_rate,
              lastExecutedAt: data.agent_last_executed_at ? new Date(data.agent_last_executed_at) : undefined
            } : undefined)
          );
          prompts.push(prompt);
        } catch (error) {
          console.warn(`Skipping invalid prompt file: ${filePath}`);
        }
      }

      // Sort by updatedAt descending and limit
      return prompts
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, limit);
    } catch (error) {
      return [];
    }
  }
}