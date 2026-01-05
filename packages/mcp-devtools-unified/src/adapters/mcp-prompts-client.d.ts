import { PromptLayer, Domain } from '@sparesparrow/mcp-fbs';
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
export declare class McpPromptsClient {
    private baseUrl;
    private useFlatBuffers;
    constructor(baseUrl?: string);
    /**
     * Get a prompt by name
     */
    getPrompt(name: string): Promise<PromptData | null>;
    /**
     * Search prompts with filters
     */
    searchPrompts(query: PromptQuery): Promise<PromptData[]>;
    /**
     * Create a new prompt
     */
    createPrompt(prompt: Omit<PromptData, 'name'> & {
        name: string;
    }): Promise<boolean>;
    /**
     * Capture an episode of problem-solving experience
     */
    captureEpisode(episode: EpisodeData): Promise<boolean>;
    /**
     * Search episodes by symptoms or context
     */
    searchEpisodes(query: {
        symptoms?: string[];
        context_fingerprint?: string;
        limit?: number;
    }): Promise<EpisodeData[]>;
    private getPromptFlatBuffers;
    private searchPromptsFlatBuffers;
    private createPromptFlatBuffers;
    private captureEpisodeFlatBuffers;
    private searchEpisodesFlatBuffers;
    private getPromptJSON;
    private searchPromptsJSON;
    private createPromptJSON;
    private captureEpisodeJSON;
    private searchEpisodesJSON;
    private convertJSONToPromptData;
    /**
     * Query for tool configuration prompts
     */
    getToolConfiguration(toolName: string, context?: Record<string, any>): Promise<PromptData | null>;
    /**
     * Query for interpretation prompts for tool results
     */
    getResultInterpretationPrompt(toolName: string, resultType?: string): Promise<PromptData | null>;
    /**
     * Store successful tool configuration as new knowledge
     */
    storeSuccessfulConfiguration(toolName: string, config: Record<string, any>, successMetrics: Record<string, any>): Promise<boolean>;
    /**
     * Query for similar past experiences
     */
    findSimilarExperiences(currentContext: Record<string, any>, toolName?: string, limit?: number): Promise<EpisodeData[]>;
}
//# sourceMappingURL=mcp-prompts-client.d.ts.map