import { Prompt, PromptType, ClaudeModel } from '../entities/prompt.entity';

/**
 * Filter options for subagent queries
 */
export interface SubagentFilter {
  category?: string;
  tags?: string[];
  model?: ClaudeModel;
  compatibleWith?: string;
}

export interface IPromptRepository {
  save(prompt: Prompt): Promise<void>;
  findById(id: string, version?: string): Promise<Prompt | null>;
  findByCategory(category: string, limit?: number): Promise<Prompt[]>;
  findLatestVersions(limit?: number): Promise<Prompt[]>;
  search(query: string, category?: string): Promise<Prompt[]>;
  update(id: string, version: string, updates: Partial<Prompt>): Promise<void>;
  delete(id: string, version?: string): Promise<void>;
  getVersions(id: string): Promise<string[]>;
  healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details?: any }>;

  // NEW: Agent orchestration methods

  /**
   * Find prompts by prompt type
   */
  findByType(type: PromptType, limit?: number): Promise<Prompt[]>;

  /**
   * Find subagents with optional filtering
   */
  findSubagents(filter?: SubagentFilter, limit?: number): Promise<Prompt[]>;

  /**
   * Find main agent templates, optionally by project type
   */
  findMainAgents(projectType?: string, limit?: number): Promise<Prompt[]>;

  /**
   * Find project orchestration templates
   */
  findProjectTemplates(limit?: number): Promise<Prompt[]>;

  /**
   * Get all available subagent categories
   */
  getSubagentCategories(): Promise<string[]>;

  /**
   * Get all available models used by agents
   */
  getAgentModels(): Promise<ClaudeModel[]>;

  /**
   * Update execution statistics for an agent
   */
  updateExecutionStats(
    id: string,
    executionCount: number,
    successRate: number,
    lastExecutedAt: Date
  ): Promise<void>;
}
