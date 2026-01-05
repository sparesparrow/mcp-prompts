import pino from 'pino';
import { PromptLayer, Domain } from '@sparesparrow/mcp-fbs';
const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    transport: process.env.NODE_ENV === 'development' ? {
        target: 'pino-pretty',
        options: {
            colorize: true
        }
    } : undefined
});
export class McpPromptsClient {
    constructor(baseUrl = process.env.MCP_PROMPTS_URL || 'http://localhost:3000') {
        this.baseUrl = baseUrl;
        this.useFlatBuffers = process.env.USE_FLATBUFFERS !== 'false';
    }
    /**
     * Get a prompt by name
     */
    async getPrompt(name) {
        try {
            logger.debug(`Fetching prompt: ${name}`);
            if (this.useFlatBuffers) {
                return await this.getPromptFlatBuffers(name);
            }
            else {
                return await this.getPromptJSON(name);
            }
        }
        catch (error) {
            logger.error(`Failed to get prompt ${name}:`, error);
            return null;
        }
    }
    /**
     * Search prompts with filters
     */
    async searchPrompts(query) {
        try {
            logger.debug('Searching prompts', query);
            if (this.useFlatBuffers) {
                return await this.searchPromptsFlatBuffers(query);
            }
            else {
                return await this.searchPromptsJSON(query);
            }
        }
        catch (error) {
            logger.error('Failed to search prompts:', error);
            return [];
        }
    }
    /**
     * Create a new prompt
     */
    async createPrompt(prompt) {
        try {
            logger.info(`Creating prompt: ${prompt.name}`);
            if (this.useFlatBuffers) {
                return await this.createPromptFlatBuffers(prompt);
            }
            else {
                return await this.createPromptJSON(prompt);
            }
        }
        catch (error) {
            logger.error(`Failed to create prompt ${prompt.name}:`, error);
            return false;
        }
    }
    /**
     * Capture an episode of problem-solving experience
     */
    async captureEpisode(episode) {
        try {
            logger.info(`Capturing episode: ${episode.name}`);
            if (this.useFlatBuffers) {
                return await this.captureEpisodeFlatBuffers(episode);
            }
            else {
                return await this.captureEpisodeJSON(episode);
            }
        }
        catch (error) {
            logger.error(`Failed to capture episode ${episode.name}:`, error);
            return false;
        }
    }
    /**
     * Search episodes by symptoms or context
     */
    async searchEpisodes(query) {
        try {
            logger.debug('Searching episodes', query);
            if (this.useFlatBuffers) {
                return await this.searchEpisodesFlatBuffers(query);
            }
            else {
                return await this.searchEpisodesJSON(query);
            }
        }
        catch (error) {
            logger.error('Failed to search episodes:', error);
            return [];
        }
    }
    // FlatBuffers implementations
    async getPromptFlatBuffers(name) {
        // TODO: Implement FlatBuffers prompt retrieval
        // For now, fall back to JSON
        return await this.getPromptJSON(name);
    }
    async searchPromptsFlatBuffers(query) {
        // TODO: Implement FlatBuffers prompt search
        // For now, fall back to JSON
        return await this.searchPromptsJSON(query);
    }
    async createPromptFlatBuffers(prompt) {
        // TODO: Implement FlatBuffers prompt creation
        // For now, fall back to JSON
        return await this.createPromptJSON(prompt);
    }
    async captureEpisodeFlatBuffers(episode) {
        // TODO: Implement FlatBuffers episode capture
        // For now, fall back to JSON
        return await this.captureEpisodeJSON(episode);
    }
    async searchEpisodesFlatBuffers(query) {
        // TODO: Implement FlatBuffers episode search
        // For now, fall back to JSON
        return await this.searchEpisodesJSON(query);
    }
    // JSON implementations (fallback)
    async getPromptJSON(name) {
        const response = await fetch(`${this.baseUrl}/v1/prompts/${encodeURIComponent(name)}`);
        if (!response.ok) {
            if (response.status === 404)
                return null;
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();
        return this.convertJSONToPromptData(data);
    }
    async searchPromptsJSON(query) {
        const params = new URLSearchParams();
        if (query.category)
            params.append('category', query.category);
        if (query.tags)
            params.append('tags', query.tags.join(','));
        if (query.layer !== undefined)
            params.append('layer', query.layer.toString());
        if (query.domain !== undefined)
            params.append('domain', query.domain.toString());
        if (query.limit)
            params.append('limit', query.limit.toString());
        const response = await fetch(`${this.baseUrl}/v1/prompts?${params}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();
        return data.prompts.map((p) => this.convertJSONToPromptData(p));
    }
    async createPromptJSON(prompt) {
        const response = await fetch(`${this.baseUrl}/v1/prompts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(prompt),
        });
        return response.ok;
    }
    async captureEpisodeJSON(episode) {
        // Episodes are stored as prompts with episodic layer
        const prompt = {
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
    async searchEpisodesJSON(query) {
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
            }
            catch {
                return null;
            }
        })
            .filter(Boolean);
    }
    // Utility methods
    convertJSONToPromptData(data) {
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
    async getToolConfiguration(toolName, context) {
        const configPrompts = await this.searchPrompts({
            tags: [toolName, 'configuration'],
            layer: PromptLayer.Procedural,
            limit: 5
        });
        if (configPrompts.length === 0)
            return null;
        // TODO: Rank by context similarity
        // For now, return the first one
        return configPrompts[0];
    }
    /**
     * Query for interpretation prompts for tool results
     */
    async getResultInterpretationPrompt(toolName, resultType = 'general') {
        const interpPrompts = await this.searchPrompts({
            tags: [toolName, 'interpretation', resultType],
            layer: PromptLayer.Procedural,
            limit: 3
        });
        if (interpPrompts.length === 0)
            return null;
        return interpPrompts[0];
    }
    /**
     * Store successful tool configuration as new knowledge
     */
    async storeSuccessfulConfiguration(toolName, config, successMetrics) {
        const promptName = `${toolName}-config-${Date.now()}`;
        const prompt = {
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
    async findSimilarExperiences(currentContext, toolName, limit = 5) {
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
//# sourceMappingURL=mcp-prompts-client.js.map