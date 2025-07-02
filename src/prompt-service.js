"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PromptService = void 0;
const handlebars_1 = __importDefault(require("handlebars"));
const Prompts = __importStar(require("./prompts.js"));
const errors_js_1 = require("./errors.js");
const utils_js_1 = require("./utils.js");
function validateTemplateVariables(prompt) {
    if (!prompt.isTemplate) {
        if (prompt.variables && prompt.variables.length > 0) {
            throw new errors_js_1.ValidationError('Variables can only be defined for templates.', [
                { path: ['variables'], message: 'Variables can only be defined for templates.' },
            ]);
        }
        return;
    }
    const templateVariables = new Set((prompt.content.match(/{{(.*?)}}/g) || []).map((v) => v.replace(/{{|}}/g, '').trim()));
    const declaredVariables = new Set(prompt.variables?.map((v) => (typeof v === 'string' ? v : v.name)));
    if (templateVariables.size !== declaredVariables.size) {
        throw new errors_js_1.ValidationError('The variables in the template content and the variables field do not match.');
    }
    for (const v of Array.from(templateVariables)) {
        if (!declaredVariables.has(v)) {
            throw new errors_js_1.ValidationError(`Variable '${v}' is used in the template but not declared in the variables field.`);
        }
    }
}
function sanitizePromptMetadata(prompt) {
    if ('metadata' in prompt && prompt.metadata === null) {
        return { ...prompt, metadata: undefined };
    }
    return prompt;
}
class PromptService {
    storage;
    templatingEngine;
    promptCache = new Map();
    constructor(storage, templatingEngine) {
        this.storage = storage;
        this.templatingEngine = templatingEngine;
        this.initializeTemplateEngine();
    }
    initializeTemplateEngine() {
        for (const key in utils_js_1.templateHelpers) {
            if (Object.prototype.hasOwnProperty.call(utils_js_1.templateHelpers, key)) {
                handlebars_1.default.registerHelper(key, utils_js_1.templateHelpers[key]);
            }
        }
    }
    async initialize() {
        await this.storage.connect();
        // Load default prompts if storage is empty
        const existingPrompts = await this.listPrompts({});
        if (existingPrompts.length === 0) {
            await Promise.all(Object.values(Prompts.defaultPrompts).map(prompt => this.createPrompt(prompt)));
        }
    }
    /**
     * Create a new prompt.
     * A version number will be automatically assigned.
     * If an ID is provided and it already exists, this will create a new version of that prompt.
     * If no ID is provided, a new one will be generated from the name.
     */
    async createPrompt(promptData) {
        const base = {
            id: promptData.id ?? this.generateId(promptData.name),
            name: promptData.name,
            content: promptData.content,
            isTemplate: Boolean(promptData.isTemplate),
            description: promptData.description,
            category: promptData.category,
            tags: promptData.tags,
            variables: promptData.variables,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            version: 1
        };
        const data = promptData.metadata !== null && promptData.metadata !== undefined
            ? { ...base, metadata: promptData.metadata }
            : base;
        if (!data.name || !data.content) {
            throw new Error('Name and content are required fields');
        }
        const prompt = await this.storage.savePrompt(data);
        await this.invalidatePromptCache(prompt.id);
        return sanitizePromptMetadata(prompt);
    }
    generateId(name) {
        return name
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .slice(0, 50);
    }
    /**
     * Get a prompt by ID. If version is not specified, gets the latest version.
     * Caches prompts for performance.
     */
    async getPrompt(id, version) {
        const cacheKey = version ? `${id}:v${version}` : `${id}:latest`;
        if (this.promptCache.has(cacheKey)) {
            return sanitizePromptMetadata(this.promptCache.get(cacheKey));
        }
        const prompt = await this.storage.getPrompt(id, version);
        if (prompt) {
            this.promptCache.set(cacheKey, prompt);
            // If we fetched latest, also cache it with its specific version number
            if (!version) {
                this.promptCache.set(`${id}:v${prompt.version}`, prompt);
            }
            return sanitizePromptMetadata(prompt);
        }
        return null;
    }
    /**
     * Update a prompt. A new version is created.
     */
    async updatePrompt(id, version, args) {
        if ('metadata' in args && args.metadata === null) {
            delete args.metadata;
        }
        const existingPrompt = await this.getPrompt(id, version);
        if (!existingPrompt) {
            throw new errors_js_1.NotFoundError(`Prompt not found: ${id} v${version}`);
        }
        const base = {
            ...existingPrompt,
            ...args,
            id,
            version,
            updatedAt: new Date().toISOString(),
        };
        let updatedPromptData;
        if ('metadata' in args && args.metadata !== null && args.metadata !== undefined) {
            updatedPromptData = { ...base, metadata: args.metadata };
        }
        else {
            const { metadata, ...rest } = base;
            updatedPromptData = rest;
        }
        validateTemplateVariables({
            content: updatedPromptData.content,
            isTemplate: updatedPromptData.isTemplate ?? false,
            variables: updatedPromptData.variables ?? [],
        });
        const result = await this.storage.updatePrompt(id, version, updatedPromptData);
        await this.invalidatePromptCache(id);
        return sanitizePromptMetadata(result);
    }
    /**
     * Delete a specific version of a prompt, or all versions if version is omitted.
     */
    async deletePrompt(id, version) {
        const deleted = await this.storage.deletePrompt(id, version);
        if (deleted) {
            await this.invalidatePromptCache(id);
        }
        return deleted;
    }
    /**
     * List prompts (latest version only by default, or all versions if specified).
     */
    async listPrompts(args, allVersions = false) {
        const prompts = await this.storage.listPrompts(args, allVersions);
        return prompts.map(sanitizePromptMetadata);
    }
    /**
     * List all versions for a prompt ID.
     */
    async listPromptVersions(id) {
        return this.storage.listPromptVersions(id);
    }
    /**
     * Apply a template prompt by ID and version (latest if not specified).
     */
    async applyTemplate(id, variables, version, options) {
        const prompt = await this.getPrompt(id, version);
        if (!prompt) {
            throw new errors_js_1.NotFoundError(`Template prompt not found: ${id} v${version ?? 'latest'}`);
        }
        if (!prompt.isTemplate) {
            throw new Error(`Prompt is not a template: ${id}`);
        }
        try {
            // Recursively find and register partials, starting the call stack with the root prompt
            await this.registerPartialsRecursive(prompt.content, new Set(), new Set([prompt.id]));
            const content = this.processTemplate(prompt.content, variables, options);
            // Check for any remaining template variables
            const remaining = content.match(/{{[^}]+}}/g);
            const missingVariables = remaining
                ? remaining.map(v => v.replace(/{{|}}/g, '').trim())
                : undefined;
            return {
                appliedVariables: variables,
                content,
                missingVariables,
                originalPrompt: prompt,
            };
        }
        finally {
            this.clearPartials();
        }
    }
    /**
     * Clears all registered Handlebars partials to avoid pollution between calls.
     */
    clearPartials() {
        for (const partialName in handlebars_1.default.partials) {
            // istanbul ignore else
            if (Object.prototype.hasOwnProperty.call(handlebars_1.default.partials, partialName)) {
                handlebars_1.default.unregisterPartial(partialName);
            }
        }
    }
    /**
     * Recursively finds and registers partials, detecting cycles.
     * @param templateContent The content to scan.
     * @param registeredPartials A set of already registered partials to avoid re-registering.
     * @param callStack A set representing the current recursion path to detect cycles.
     */
    async registerPartialsRecursive(templateContent, registeredPartials, callStack) {
        const partialRegex = /{{\s*>\s*([\w-]+)\s*}}/g;
        let match;
        // Create a list of unique partials to fetch from this template
        const partialsToScan = new Set();
        while ((match = partialRegex.exec(templateContent)) !== null) {
            partialsToScan.add(match[1]);
        }
        for (const partialId of partialsToScan) {
            if (callStack.has(partialId)) {
                throw new Error(`Recursive partial detected: ${Array.from(callStack).join(' -> ')} -> ${partialId}`);
            }
            // Only process if it hasn't been registered globally yet
            if (!registeredPartials.has(partialId)) {
                const partialPrompt = await this.getPrompt(partialId);
                if (partialPrompt) {
                    handlebars_1.default.registerPartial(partialId, partialPrompt.content);
                    registeredPartials.add(partialId);
                    // Add to call stack for this path and recurse
                    callStack.add(partialId);
                    await this.registerPartialsRecursive(partialPrompt.content, registeredPartials, callStack);
                    // Remove from call stack after returning from this path
                    callStack.delete(partialId);
                }
                else {
                    console.warn(`Partial prompt with id '${partialId}' not found.`);
                    handlebars_1.default.registerPartial(partialId, '');
                }
            }
        }
    }
    /**
     * Format a prompt according to the MCP prompts/get protocol
     * @param prompt The prompt to format
     * @param variables Optional variables to apply for templates
     * @returns Formatted prompt for MCP protocol
     */
    formatMcpPrompt(prompt, variables) {
        // Apply template variables if provided and this is a template
        let content = prompt.content;
        if (prompt.isTemplate && variables) {
            content = this.processTemplate(content, variables);
        }
        return {
            description: prompt.description || '',
            messages: [
                {
                    content: {
                        text: content,
                        type: 'text',
                    },
                    role: 'system',
                },
            ],
        };
    }
    /**
     * Format a list of prompts according to the MCP prompts/list protocol
     * @param prompts Array of prompts to format
     * @returns Formatted prompts list for MCP protocol
     */
    formatMcpPromptsList(prompts) {
        return {
            prompts: prompts.map(prompt => {
                // For template prompts, extract variables information
                const args = prompt.isTemplate && prompt.variables?.length
                    ? prompt.variables.map((variable) => {
                        // Handle both string variables and complex variable objects
                        if (typeof variable === 'string') {
                            return { name: variable };
                        }
                        else {
                            return {
                                description: variable.description,
                                name: variable.name,
                                required: variable.required,
                            };
                        }
                    })
                    : undefined;
                return {
                    description: prompt.description || '',
                    name: prompt.id,
                    ...(args && { arguments: args }),
                };
            }),
        };
    }
    processTemplate(template, variables, options) {
        try {
            let delimiters;
            if (options?.delimiterStyle) {
                switch (options.delimiterStyle) {
                    case 'curly':
                        delimiters = ['{', '}'];
                        break;
                    case 'double_curly':
                        delimiters = ['{{', '}}'];
                        break;
                    case 'dollar':
                        delimiters = ['${', '}'];
                        break;
                    case 'percent':
                        delimiters = ['%{', '}'];
                        break;
                }
            }
            const compiled = handlebars_1.default.compile(template, {
                strict: true,
                preventIndent: true,
                ...(delimiters ? { delimiters } : {}),
            });
            return compiled(variables);
        }
        catch (e) {
            throw new Error(`Template compilation failed: ${e.message}`);
        }
    }
    // Alias for interface compatibility
    async addPrompt(data) {
        const prompt = await this.createPrompt(data);
        return sanitizePromptMetadata(prompt);
    }
    getStorage() {
        return this.storage;
    }
    /**
     * Bulk create prompts. Returns an array of results (success or error per prompt).
     */
    async createPromptsBulk(argsArray) {
        const results = await Promise.all(argsArray.map(async (args) => {
            try {
                const newPrompt = await this.createPrompt(args);
                return { success: true, id: newPrompt.id };
            }
            catch (e) {
                return { success: false, id: args.name, error: e.message };
            }
        }));
        return results;
    }
    /**
     * Bulk delete prompts. Returns an array of results (success or error per id).
     */
    async deletePromptsBulk(ids) {
        const results = await Promise.all(ids.map(async (id) => {
            try {
                const deleted = await this.deletePrompt(id);
                if (deleted) {
                    return { success: true, id };
                }
                else {
                    return { success: false, id, error: 'Prompt not found' };
                }
            }
            catch (e) {
                return { success: false, id, error: e.message };
            }
        }));
        return results;
    }
    /**
     * Invalidate prompt and prompt list caches after mutation.
     */
    async invalidatePromptCache(id) {
        this.promptCache.delete(id);
        this.promptCache.delete(`${id}:latest`);
    }
}
exports.PromptService = PromptService;
