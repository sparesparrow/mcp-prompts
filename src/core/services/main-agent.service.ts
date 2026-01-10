#!/usr/bin/env node

import { IPromptRepository } from '../ports/prompt-repository.interface';
import { IEventBus } from '../ports/event-bus.interface';
import { Prompt } from '../entities/prompt.entity';
import { PromptEvent } from '../events/prompt.event';
import { ValidationError, NotFoundError } from '../errors/custom-errors';
import { SubagentService } from './subagent.service';

/**
 * Configuration for a main agent including its subagents
 */
export interface MainAgentConfiguration {
  mainAgent: Prompt;
  subagents: Prompt[];
  mcpServers: string[];
  estimatedCost: number;
  estimatedTime: number; // in minutes
}

/**
 * Service for managing main agent templates
 */
export class MainAgentService {
  constructor(
    private promptRepository: IPromptRepository,
    private subagentService: SubagentService,
    private eventBus: IEventBus
  ) {}

  /**
   * Get all main agent templates
   */
  async listMainAgents(limit?: number): Promise<Prompt[]> {
    const mainAgents = await this.promptRepository.findMainAgents(undefined, limit);

    await this.eventBus.publish(new PromptEvent('main_agents_listed', 'system', new Date(), {
      count: mainAgents.length
    }));

    return mainAgents;
  }

  /**
   * Get a main agent template by ID
   */
  async getMainAgent(id: string): Promise<Prompt> {
    if (!id || typeof id !== 'string' || id.trim() === '') {
      throw new ValidationError('Main agent ID is required and must be a non-empty string');
    }

    const mainAgent = await this.promptRepository.findById(id);

    if (!mainAgent) {
      throw new NotFoundError(`Main agent with ID ${id} not found`);
    }

    if (!mainAgent.isMainAgent()) {
      throw new ValidationError(`Prompt ${id} is not a main agent template`);
    }

    await this.eventBus.publish(new PromptEvent('main_agent_accessed', mainAgent.id, new Date(), {
      projectTypes: mainAgent.agentConfig?.compatibleWith
    }));

    return mainAgent;
  }

  /**
   * Get main agent template for a specific project type
   */
  async getMainAgentForProjectType(projectType: string): Promise<Prompt | null> {
    if (!projectType || typeof projectType !== 'string' || projectType.trim() === '') {
      throw new ValidationError('Project type is required and must be a non-empty string');
    }

    const mainAgents = await this.promptRepository.findMainAgents(projectType, 1);

    if (mainAgents.length === 0) {
      return null;
    }

    await this.eventBus.publish(new PromptEvent('main_agent_accessed', mainAgents[0].id, new Date(), {
      projectType
    }));

    return mainAgents[0];
  }

  /**
   * Get full configuration for a main agent including all subagents
   */
  async getFullConfiguration(mainAgentId: string): Promise<MainAgentConfiguration> {
    const mainAgent = await this.getMainAgent(mainAgentId);

    // Get subagent IDs from main agent config
    const subagentIds = mainAgent.agentConfig?.subagents || [];

    // Fetch all subagents
    const subagents: Prompt[] = [];
    for (const subagentId of subagentIds) {
      try {
        const subagent = await this.subagentService.getSubagent(subagentId);
        subagents.push(subagent);
      } catch (error) {
        console.warn(`Subagent ${subagentId} not found, skipping`);
      }
    }

    // Collect all MCP servers
    const mcpServersSet = new Set<string>();
    if (mainAgent.agentConfig?.mcpServers) {
      mainAgent.agentConfig.mcpServers.forEach(s => mcpServersSet.add(s));
    }
    subagents.forEach(subagent => {
      if (subagent.agentConfig?.mcpServers) {
        subagent.agentConfig.mcpServers.forEach(s => mcpServersSet.add(s));
      }
    });

    // Estimate cost and time
    const estimatedCost = this.estimateTotalCost(mainAgent, subagents);
    const estimatedTime = this.estimateExecutionTime(subagents);

    return {
      mainAgent,
      subagents,
      mcpServers: Array.from(mcpServersSet),
      estimatedCost,
      estimatedTime
    };
  }

  /**
   * Get subagents for a main agent
   */
  async getSubagents(mainAgentId: string): Promise<Prompt[]> {
    const config = await this.getFullConfiguration(mainAgentId);
    return config.subagents;
  }

  /**
   * Validate subagent configuration for a main agent
   */
  async validateSubagentConfiguration(mainAgentId: string): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const mainAgent = await this.getMainAgent(mainAgentId);
      const subagentIds = mainAgent.agentConfig?.subagents || [];

      if (subagentIds.length === 0) {
        warnings.push('Main agent has no subagents configured');
      }

      // Check if all subagents exist
      for (const subagentId of subagentIds) {
        try {
          await this.subagentService.getSubagent(subagentId);
        } catch (error) {
          errors.push(`Subagent ${subagentId} not found`);
        }
      }

      // Check if main agent has compatible project types
      if (!mainAgent.agentConfig?.compatibleWith || mainAgent.agentConfig.compatibleWith.length === 0) {
        warnings.push('Main agent has no compatible project types specified');
      }

      // Check if main agent has system prompt
      if (!mainAgent.getSystemPrompt()) {
        errors.push('Main agent has no system prompt');
      }

    } catch (error) {
      if (error instanceof Error) {
        errors.push(error.message);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Generate system prompt for main agent with context
   */
  async generateSystemPrompt(mainAgentId: string, customContext?: string): Promise<string> {
    const config = await this.getFullConfiguration(mainAgentId);
    const mainAgent = config.mainAgent;

    let systemPrompt = mainAgent.getSystemPrompt() || '';

    // Add subagent context
    if (config.subagents.length > 0) {
      systemPrompt += '\n\n## Available Subagents\n\n';
      systemPrompt += 'You have access to the following specialized subagents:\n\n';

      config.subagents.forEach(subagent => {
        systemPrompt += `- **${subagent.name}** (${subagent.id}): ${subagent.description}\n`;
        systemPrompt += `  - Model: ${subagent.getModel()}\n`;
        systemPrompt += `  - Category: ${subagent.category}\n\n`;
      });
    }

    // Add MCP server context
    if (config.mcpServers.length > 0) {
      systemPrompt += '\n## Available MCP Servers\n\n';
      systemPrompt += config.mcpServers.join(', ') + '\n\n';
    }

    // Add custom context if provided
    if (customContext) {
      systemPrompt += '\n## Project Context\n\n';
      systemPrompt += customContext + '\n\n';
    }

    return systemPrompt;
  }

  /**
   * Get execution preview (dry-run)
   */
  async getExecutionPreview(mainAgentId: string, projectType?: string): Promise<{
    mainAgent: {
      id: string;
      name: string;
      model: string;
    };
    subagents: Array<{
      id: string;
      name: string;
      category: string;
      model: string;
    }>;
    estimatedCost: number;
    estimatedTime: number;
    mcpServers: string[];
  }> {
    const config = await this.getFullConfiguration(mainAgentId);

    return {
      mainAgent: {
        id: config.mainAgent.id,
        name: config.mainAgent.name,
        model: config.mainAgent.getModel() || 'claude-opus'
      },
      subagents: config.subagents.map(s => ({
        id: s.id,
        name: s.name,
        category: s.category,
        model: s.getModel() || 'claude-sonnet'
      })),
      estimatedCost: config.estimatedCost,
      estimatedTime: config.estimatedTime,
      mcpServers: config.mcpServers
    };
  }

  /**
   * Estimate total cost for main agent + all subagents
   */
  private estimateTotalCost(mainAgent: Prompt, subagents: Prompt[]): number {
    // Main agent cost (Opus is expensive)
    const mainAgentTokens = this.estimateTokens(mainAgent);
    const opusCostPerToken = 15 / 1_000_000; // $15 per 1M input tokens
    const mainAgentCost = mainAgentTokens * opusCostPerToken;

    // Subagents cost
    let subagentsCost = 0;
    subagents.forEach(subagent => {
      const tokens = this.estimateTokens(subagent);
      const model = subagent.getModel() || 'claude-sonnet';

      const pricing = {
        'claude-opus': 15,
        'claude-sonnet': 3,
        'claude-haiku': 0.25
      };

      const costPerToken = pricing[model] / 1_000_000;
      subagentsCost += tokens * costPerToken;
    });

    return mainAgentCost + subagentsCost;
  }

  /**
   * Estimate execution time based on number and complexity of subagents
   */
  private estimateExecutionTime(subagents: Prompt[]): number {
    // Assume each subagent takes 2-5 minutes depending on model
    let totalMinutes = 0;

    subagents.forEach(subagent => {
      const model = subagent.getModel() || 'claude-sonnet';

      const timePerModel = {
        'claude-opus': 5,    // 5 minutes for complex analysis
        'claude-sonnet': 3,  // 3 minutes for normal work
        'claude-haiku': 1    // 1 minute for fast tasks
      };

      totalMinutes += timePerModel[model];
    });

    // Add main agent coordination time
    totalMinutes += 5;

    return totalMinutes;
  }

  /**
   * Estimate tokens for a prompt
   */
  private estimateTokens(prompt: Prompt): number {
    const systemPrompt = prompt.getSystemPrompt() || '';
    const inputTokens = Math.ceil(systemPrompt.length / 4);
    const outputTokens = Math.ceil(inputTokens * 0.5);
    return inputTokens + outputTokens;
  }
}
