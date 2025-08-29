import type { ApplyTemplateResult, Prompt } from '@core/types/manual-exports.js';
import type { CreatePromptParams, ListPromptsOptions, UpdatePromptParams, TemplateFormatOptions, IPromptRepository, IPromptApplication, ITemplatingEngine } from '../packages/core/src/interfaces.js';
export declare class PromptService implements IPromptApplication {
    private storage;
    private templatingEngine;
    private promptCache;
    constructor(storage: IPromptRepository, templatingEngine: ITemplatingEngine);
    private initializeTemplateEngine;
    initialize(): Promise<void>;
    /**
     * Create a new prompt.
     * A version number will be automatically assigned.
     * If an ID is provided and it already exists, this will create a new version of that prompt.
     * If no ID is provided, a new one will be generated from the name.
     */
    createPrompt(promptData: CreatePromptParams): Promise<Prompt>;
    private generateId;
    /**
     * Get a prompt by ID. If version is not specified, gets the latest version.
     * Caches prompts for performance.
     */
    getPrompt(id: string, version?: number): Promise<Prompt | null>;
    /**
     * Update a prompt. A new version is created.
     */
    updatePrompt(id: string, version: number, args: Omit<UpdatePromptParams, 'id' | 'version'>): Promise<Prompt>;
    /**
     * Delete a specific version of a prompt, or all versions if version is omitted.
     */
    deletePrompt(id: string, version?: number): Promise<boolean>;
    /**
     * List prompts (latest version only by default, or all versions if specified).
     */
    listPrompts(args: ListPromptsOptions, allVersions?: boolean): Promise<Prompt[]>;
    /**
     * List all versions for a prompt ID.
     */
    listPromptVersions(id: string): Promise<number[]>;
    /**
     * Apply a template prompt by ID and version (latest if not specified).
     */
    applyTemplate(id: string, variables: Record<string, any>, version?: number, options?: TemplateFormatOptions): Promise<ApplyTemplateResult>;
    /**
     * Clears all registered Handlebars partials to avoid pollution between calls.
     */
    private clearPartials;
    /**
     * Recursively finds and registers partials, detecting cycles.
     * @param templateContent The content to scan.
     * @param registeredPartials A set of already registered partials to avoid re-registering.
     * @param callStack A set representing the current recursion path to detect cycles.
     */
    private registerPartialsRecursive;
    /**
     * Format a prompt according to the MCP prompts/get protocol
     * @param prompt The prompt to format
     * @param variables Optional variables to apply for templates
     * @returns Formatted prompt for MCP protocol
     */
    formatMcpPrompt(prompt: Prompt, variables?: Record<string, string>): {
        description: string;
        messages: Array<{
            role: string;
            content: {
                type: string;
                text: string;
            };
        }>;
    };
    /**
     * Format a list of prompts according to the MCP prompts/list protocol
     * @param prompts Array of prompts to format
     * @returns Formatted prompts list for MCP protocol
     */
    formatMcpPromptsList(prompts: Prompt[]): {
        prompts: Array<{
            name: string;
            description: string;
            arguments?: Array<{
                name: string;
                description?: string;
                required?: boolean;
            }>;
        }>;
    };
    private processTemplate;
    addPrompt(data: Partial<Prompt>): Promise<Prompt>;
    getStorage(): IPromptRepository;
    /**
     * Bulk create prompts. Returns an array of results (success or error per prompt).
     */
    createPromptsBulk(argsArray: CreatePromptParams[]): Promise<Array<{
        success: boolean;
        id?: string;
        error?: string;
    }>>;
    /**
     * Bulk delete prompts. Returns an array of results (success or error per id).
     */
    deletePromptsBulk(ids: string[]): Promise<Array<{
        success: boolean;
        id: string;
        error?: string;
    }>>;
    /**
     * Invalidate prompt and prompt list caches after mutation.
     */
    private invalidatePromptCache;
}
