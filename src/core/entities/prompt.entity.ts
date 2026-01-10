/**
 * Prompt types - used as discriminator for different prompt usages
 */
export type PromptType =
  | 'standard'
  | 'subagent_registry'
  | 'main_agent_template'
  | 'project_orchestration_template';

/**
 * Claude model options for agent execution
 */
export type ClaudeModel =
  | 'claude-opus'
  | 'claude-sonnet'
  | 'claude-haiku';

/**
 * Agent configuration for subagents and main agents
 */
export interface AgentConfig {
  model?: ClaudeModel;
  systemPrompt?: string;
  tools?: string[];
  mcpServers?: string[];
  subagents?: string[];
  compatibleWith?: string[];
  sourceUrl?: string;
  executionCount?: number;
  successRate?: number;
  lastExecutedAt?: Date;
}

export class Prompt {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly description: string,
    public readonly template: string,
    public readonly category: string,
    public readonly tags: string[] = [],
    public readonly variables: string[] = [],
    public readonly version: string = 'latest',
    public readonly createdAt: Date = new Date(),
    public readonly updatedAt: Date = new Date(),
    public readonly isLatest: boolean = true,
    public readonly metadata: Record<string, any> = {},
    public readonly accessLevel: string = 'public',
    public readonly authorId?: string,
    // NEW: Agent orchestration fields
    public readonly promptType: PromptType = 'standard',
    public readonly agentConfig?: AgentConfig
  ) {}

  public toJSON(): any {
    const base = {
      id: this.id,
      name: this.name,
      description: this.description,
      template: this.template,
      category: this.category,
      tags: this.tags,
      variables: this.variables,
      version: this.version,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
      isLatest: this.isLatest,
      metadata: this.metadata,
      accessLevel: this.accessLevel,
      authorId: this.authorId,
      promptType: this.promptType
    };

    // Include agent config if present
    if (this.agentConfig) {
      return {
        ...base,
        agentConfig: {
          ...this.agentConfig,
          lastExecutedAt: this.agentConfig.lastExecutedAt?.toISOString()
        }
      };
    }

    return base;
  }

  /**
   * Check if this prompt is a subagent definition
   */
  public isSubagent(): boolean {
    return this.promptType === 'subagent_registry';
  }

  /**
   * Check if this prompt is a main agent template
   */
  public isMainAgent(): boolean {
    return this.promptType === 'main_agent_template';
  }

  /**
   * Check if this prompt is a project orchestration template
   */
  public isProjectTemplate(): boolean {
    return this.promptType === 'project_orchestration_template';
  }

  /**
   * Get the model to use for this agent (if applicable)
   */
  public getModel(): ClaudeModel | undefined {
    return this.agentConfig?.model;
  }

  /**
   * Get the system prompt for this agent (if applicable)
   */
  public getSystemPrompt(): string | undefined {
    return this.agentConfig?.systemPrompt;
  }
}
