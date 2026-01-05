import * as flatbuffers from 'flatbuffers';
import pino from 'pino';
import { PromptLayer, Domain } from '@sparesparrow/mcp-fbs';
import {
  CognitivePrompt,
  ProjectContext,
  EpisodeMemory,
  ProblemSignature,
  InvestigationStep,
  SolutionPattern
} from '@sparesparrow/mcp-fbs';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development' ? {
    target: 'pino-pretty',
    options: {
      colorize: true
    }
  } : undefined
});

export interface PromptQuery {
  name?: string;
  category?: string;
  tags?: string[];
  layer?: PromptLayer;
  domain?: Domain;
  limit?: number;
}

export interface PromptData {
  name: string;
  description: string;
  content: string;
  arguments?: Array<{
    name: string;
    description: string;
    required?: boolean;
  }>;
  layer: PromptLayer;
  domain: Domain;
  tags: string[];
  abstractionLevel?: number;
  isTemplate?: boolean;
  metadata?: Record<string, any>;
}

export interface EpisodeData {
  name: string;
  problem_signature: {
    symptoms: string[];
    context_fingerprint: string;
    error_patterns: string[];
    affected_components: string[];
  };
  context: {
    project_type: string;
    domain: string;
  };
  investigation_path: Array<{
    step_number: number;
    action: string;
    tool_used?: string;
    findings: string;
    led_to_solution: boolean;
  }>;
  solution: {
    description: string;
    implementation_steps: string[];
    success: boolean;
  };
  success: boolean;
  cognitive_load: number;
  tags: string[];
}

export class McpPromptsClient {
  private baseUrl: string;
  private useFlatBuffers: boolean;

  constructor(baseUrl: string = process.env.MCP_PROMPTS_URL || 'http://localhost:3000') {
    this.baseUrl = baseUrl;
    this.useFlatBuffers = process.env.USE_FLATBUFFERS !== 'false';
  }

  /**
   * Get a prompt by name
   */
  async getPrompt(name: string): Promise<PromptData | null> {
    try {
      logger.debug(`Fetching prompt: ${name}`);

      if (this.useFlatBuffers) {
        return await this.getPromptFlatBuffers(name);
      } else {
        return await this.getPromptJSON(name);
      }
    } catch (error) {
      logger.error(`Failed to get prompt ${name}:`, error);
      return null;
    }
  }

  /**
   * Search prompts with filters
   */
  async searchPrompts(query: PromptQuery): Promise<PromptData[]> {
    try {
      logger.debug('Searching prompts', query);

      if (this.useFlatBuffers) {
        return await this.searchPromptsFlatBuffers(query);
      } else {
        return await this.searchPromptsJSON(query);
      }
    } catch (error) {
      logger.error('Failed to search prompts:', error);
      return [];
    }
  }

  /**
   * Create a new prompt
   */
  async createPrompt(prompt: Omit<PromptData, 'name'> & { name: string }): Promise<boolean> {
    try {
      logger.info(`Creating prompt: ${prompt.name}`);

      if (this.useFlatBuffers) {
        return await this.createPromptFlatBuffers(prompt);
      } else {
        return await this.createPromptJSON(prompt);
      }
    } catch (error) {
      logger.error(`Failed to create prompt ${prompt.name}:`, error);
      return false;
    }
  }

  /**
   * Capture an episode of problem-solving experience
   */
  async captureEpisode(episode: EpisodeData): Promise<boolean> {
    try {
      logger.info(`Capturing episode: ${episode.name}`);

      if (this.useFlatBuffers) {
        return await this.captureEpisodeFlatBuffers(episode);
      } else {
        return await this.captureEpisodeJSON(episode);
      }
    } catch (error) {
      logger.error(`Failed to capture episode ${episode.name}:`, error);
      return false;
    }
  }

  /**
   * Search episodes by symptoms or context
   */
  async searchEpisodes(query: {
    symptoms?: string[];
    context_fingerprint?: string;
    limit?: number;
  }): Promise<EpisodeData[]> {
    try {
      logger.debug('Searching episodes', query);

      if (this.useFlatBuffers) {
        return await this.searchEpisodesFlatBuffers(query);
      } else {
        return await this.searchEpisodesJSON(query);
      }
    } catch (error) {
      logger.error('Failed to search episodes:', error);
      return [];
    }
  }

  // FlatBuffers implementations
  private async getPromptFlatBuffers(name: string): Promise<PromptData | null> {
    // TODO: Implement FlatBuffers prompt retrieval
    // For now, fall back to JSON
    return await this.getPromptJSON(name);
  }

  private async searchPromptsFlatBuffers(query: PromptQuery): Promise<PromptData[]> {
    // TODO: Implement FlatBuffers prompt search
    // For now, fall back to JSON
    return await this.searchPromptsJSON(query);
  }

  private async createPromptFlatBuffers(prompt: PromptData): Promise<boolean> {
    // TODO: Implement FlatBuffers prompt creation
    // For now, fall back to JSON
    return await this.createPromptJSON(prompt);
  }

  private async captureEpisodeFlatBuffers(episode: EpisodeData): Promise<boolean> {
    // TODO: Implement FlatBuffers episode capture
    // For now, fall back to JSON
    return await this.captureEpisodeJSON(episode);
  }

  private async searchEpisodesFlatBuffers(query: any): Promise<EpisodeData[]> {
    // TODO: Implement FlatBuffers episode search
    // For now, fall back to JSON
    return await this.searchEpisodesJSON(query);
  }

  // JSON implementations (fallback)
  private async getPromptJSON(name: string): Promise<PromptData | null> {
    const response = await fetch(`${this.baseUrl}/v1/prompts/${encodeURIComponent(name)}`);

    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return this.convertJSONToPromptData(data);
  }

  private async searchPromptsJSON(query: PromptQuery): Promise<PromptData[]> {
    const params = new URLSearchParams();

    if (query.category) params.append('category', query.category);
    if (query.tags) params.append('tags', query.tags.join(','));
    if (query.layer !== undefined) params.append('layer', query.layer.toString());
    if (query.domain !== undefined) params.append('domain', query.domain.toString());
    if (query.limit) params.append('limit', query.limit.toString());

    const response = await fetch(`${this.baseUrl}/v1/prompts?${params}`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data.prompts.map((p: any) => this.convertJSONToPromptData(p));
  }

  private async createPromptJSON(prompt: PromptData): Promise<boolean> {
    const response = await fetch(`${this.baseUrl}/v1/prompts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(prompt),
    });

    return response.ok;
  }

  private async captureEpisodeJSON(episode: EpisodeData): Promise<boolean> {
    // Episodes are stored as prompts with episodic layer
    const prompt: PromptData = {
      name: episode.name,
      description: `Episode: ${episode.problem_signature.symptoms.join(', ')}`,
      content: JSON.stringify(episode, null, 2),
      layer: PromptLayer.Episodic,
      domain: Domain.SoftwareDevelopment,
      tags: ['episode', ...episode.tags],
      metadata: {
        episode_type: 'problem_solving',
        success: episode.success,
        cognitive_load: episode.cognitive_load
      }
    };

    return await this.createPromptJSON(prompt);
  }

  private async searchEpisodesJSON(query: any): Promise<EpisodeData[]> {
    // Search for episodic prompts
    const prompts = await this.searchPromptsJSON({
      layer: PromptLayer.Episodic,
      tags: ['episode'],
      limit: query.limit || 10
    });

    return prompts
      .map(p => {
        try {
          const episode = JSON.parse(p.content);
          return episode;
        } catch {
          return null;
        }
      })
      .filter(Boolean) as EpisodeData[];
  }

  // Utility methods
  private convertJSONToPromptData(data: any): PromptData {
    return {
      name: data.name,
      description: data.description,
      content: data.content,
      arguments: data.arguments,
      layer: data.metadata?.layer || PromptLayer.Unknown,
      domain: data.metadata?.domain || Domain.General,
      tags: data.tags || [],
      abstractionLevel: data.metadata?.abstractionLevel,
      isTemplate: data.isTemplate,
      metadata: data.metadata
    };
  }

  /**
   * Query for tool configuration prompts
   */
  async getToolConfiguration(toolName: string, context?: Record<string, any>): Promise<PromptData | null> {
    const configPrompts = await this.searchPrompts({
      tags: [toolName, 'configuration'],
      layer: PromptLayer.Procedural,
      limit: 5
    });

    if (configPrompts.length === 0) return null;

    // TODO: Rank by context similarity
    // For now, return the first one
    return configPrompts[0];
  }

  /**
   * Query for interpretation prompts for tool results
   */
  async getResultInterpretationPrompt(toolName: string, resultType: string = 'general'): Promise<PromptData | null> {
    const interpPrompts = await this.searchPrompts({
      tags: [toolName, 'interpretation', resultType],
      layer: PromptLayer.Procedural,
      limit: 3
    });

    if (interpPrompts.length === 0) return null;

    return interpPrompts[0];
  }

  /**
   * Store successful tool configuration as new knowledge
   */
  async storeSuccessfulConfiguration(
    toolName: string,
    config: Record<string, any>,
    successMetrics: Record<string, any>
  ): Promise<boolean> {
    const promptName = `${toolName}-config-${Date.now()}`;

    const prompt: PromptData = {
      name: promptName,
      description: `Successful ${toolName} configuration`,
      content: `## ${toolName} Configuration

\`\`\`json
${JSON.stringify(config, null, 2)}
\`\`\`

### Success Metrics
${Object.entries(successMetrics).map(([k, v]) => `- ${k}: ${v}`).join('\n')}

### Generated
${new Date().toISOString()}
`,
      layer: PromptLayer.Procedural,
      domain: Domain.SoftwareDevelopment,
      tags: [toolName, 'configuration', 'successful'],
      metadata: {
        tool: toolName,
        success_metrics: successMetrics,
        generated_at: new Date().toISOString()
      }
    };

    return await this.createPrompt(prompt);
  }

  /**
   * Query for similar past experiences
   */
  async findSimilarExperiences(
    currentContext: Record<string, any>,
    toolName?: string,
    limit: number = 5
  ): Promise<EpisodeData[]> {
    // Search for episodes with similar context
    const episodes = await this.searchEpisodes({
      limit: limit * 2 // Get more to filter
    });

    // TODO: Implement similarity scoring based on context
    // For now, filter by tool if specified
    const filtered = toolName
      ? episodes.filter(e => e.tags.includes(toolName))
      : episodes;

    return filtered.slice(0, limit);
  }
}