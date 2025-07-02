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
exports.FileAdapter = void 0;
exports.atomicWriteFile = atomicWriteFile;
const fsp = __importStar(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const crypto_1 = require("crypto");
const proper_lockfile_1 = __importDefault(require("proper-lockfile"));
const zod_1 = require("zod");
const schemas_1 = require("@core/schemas");
const errors_1 = require("@core/errors");
async function atomicWriteFile(filePath, data) {
    const dir = path_1.default.dirname(filePath);
    const tempFile = path_1.default.join(dir, `${path_1.default.basename(filePath)}.${(0, crypto_1.randomUUID)()}.tmp`);
    await fsp.writeFile(tempFile, data);
    const fd = await fsp.open(tempFile, 'r+');
    await fd.sync();
    await fd.close();
    await fsp.rename(tempFile, filePath);
}
function sanitizePromptMetadata(prompt) {
    if ('metadata' in prompt && prompt.metadata === null) {
        return { ...prompt, metadata: undefined };
    }
    return prompt;
}
class FileAdapter {
    promptsDir;
    sequencesDir;
    workflowStatesDir;
    connected = false;
    promptIndexPath;
    constructor(options) {
        this.promptsDir = options.promptsDir;
        this.sequencesDir = path_1.default.join(options.promptsDir, 'sequences');
        this.workflowStatesDir = path_1.default.join(options.promptsDir, 'workflow-states');
        this.promptIndexPath = path_1.default.join(this.promptsDir, 'index.json');
    }
    // Helper to read the prompt index (latest version metadata for each prompt)
    async readPromptIndex() {
        try {
            const content = await fsp.readFile(this.promptIndexPath, 'utf-8');
            return JSON.parse(content);
        }
        catch (e) {
            if (e.code === 'ENOENT')
                return {};
            throw e;
        }
    }
    // Helper to write the prompt index
    async writePromptIndex(index) {
        await atomicWriteFile(this.promptIndexPath, JSON.stringify(index, null, 2));
    }
    // Helper to update or add an entry in the index
    async updatePromptIndexEntry(id, metadata) {
        const index = await this.readPromptIndex();
        index[id] = metadata;
        await this.writePromptIndex(index);
    }
    // Helper to remove an entry from the index
    async removePromptIndexEntry(id) {
        const index = await this.readPromptIndex();
        if (index[id]) {
            delete index[id];
            await this.writePromptIndex(index);
        }
    }
    async withLock(filePath, fn) {
        let release;
        try {
            try {
                // Using a stale timeout to prevent indefinite locks.
                // realpath: false is important because the lock target file may not exist.
                release = await proper_lockfile_1.default.lock(filePath, {
                    realpath: false,
                    retries: 3,
                    stale: 20000,
                });
            }
            catch (error) {
                // If locking fails, throw a custom error.
                throw new errors_1.LockError(`Could not acquire lock for ${path_1.default.basename(filePath)}: ${error.message}`, filePath);
            }
            return await fn();
        }
        finally {
            // Ensure the lock is always released.
            if (release) {
                await release();
            }
        }
    }
    async isConnected() {
        return this.connected;
    }
    async connect() {
        try {
            await fsp.mkdir(this.promptsDir, { recursive: true });
            await fsp.mkdir(this.sequencesDir, { recursive: true });
            await fsp.mkdir(this.workflowStatesDir, { recursive: true });
            // Validate existing prompts on startup
            const files = await fsp.readdir(this.promptsDir);
            for (const file of files) {
                if (file.endsWith('.json') && file !== 'index.json') {
                    const filePath = path_1.default.join(this.promptsDir, file);
                    try {
                        const content = await fsp.readFile(filePath, 'utf-8');
                        const prompt = JSON.parse(content);
                        schemas_1.promptSchemas.full.parse(prompt);
                    }
                    catch (error) {
                        if (error instanceof zod_1.z.ZodError) {
                            console.warn(`Validation failed for ${file}: ${error.message}`);
                        }
                        else {
                            console.error(`Error reading or parsing ${file}:`, error);
                        }
                    }
                }
            }
            // Ensure index.json exists and is valid
            try {
                await this.readPromptIndex();
            }
            catch (e) {
                // If index is corrupt, reset it
                await this.writePromptIndex({});
            }
            this.connected = true;
        }
        catch (error) {
            console.error('Error connecting to file storage:', error);
            if (error instanceof Error) {
                throw new Error(`Failed to connect to file storage: ${error.message}`);
            }
            throw new Error('Failed to connect to file storage');
        }
    }
    async disconnect() {
        this.connected = false;
    }
    getPromptFileName(id, version) {
        return path_1.default.join(this.promptsDir, `${id}-v${version}.json`);
    }
    generateId(name) {
        return name.toLowerCase().replace(/\s+/g, '-');
    }
    async savePrompt(promptData) {
        if (!this.connected) {
            throw new Error('File storage not connected');
        }
        const parsedData = schemas_1.promptSchemas.create.parse(promptData);
        const id = this.generateId(parsedData.name);
        const idLockPath = path_1.default.join(this.promptsDir, `${id}.lock`);
        return this.withLock(idLockPath, async () => {
            const versions = await this.listPromptVersions(id);
            const newVersion = versions.length > 0 ? Math.max(...versions) + 1 : 1;
            const promptWithDefaults = {
                id,
                version: newVersion,
                ...parsedData,
                variables: parsedData.variables ?? undefined,
                tags: parsedData.tags ?? undefined,
                metadata: parsedData.metadata ?? undefined,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };
            schemas_1.promptSchemas.full.parse(promptWithDefaults);
            const promptFilePath = this.getPromptFileName(id, newVersion);
            await atomicWriteFile(promptFilePath, JSON.stringify(promptWithDefaults, null, 2));
            // Update index with latest version metadata
            await this.updatePromptIndexEntry(id, {
                id: promptWithDefaults.id,
                name: promptWithDefaults.name,
                version: promptWithDefaults.version,
                createdAt: promptWithDefaults.createdAt,
                updatedAt: promptWithDefaults.updatedAt,
                isTemplate: promptWithDefaults.isTemplate,
                description: promptWithDefaults.description,
                category: promptWithDefaults.category,
                tags: promptWithDefaults.tags,
            });
            return sanitizePromptMetadata(promptWithDefaults);
        });
    }
    async getPrompt(id, version) {
        if (!this.connected)
            throw new Error('File storage not connected');
        let versionToFetch = version;
        if (versionToFetch === undefined) {
            const versions = await this.listPromptVersions(id);
            if (versions.length === 0)
                return null;
            versionToFetch = Math.max(...versions);
        }
        try {
            const content = await fsp.readFile(this.getPromptFileName(id, versionToFetch), 'utf-8');
            const prompt = JSON.parse(content);
            return sanitizePromptMetadata(schemas_1.promptSchemas.full.parse(prompt));
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                console.warn(`Validation failed for prompt ${id} v${versionToFetch}: ${error.message}`);
                return null;
            }
            if (error instanceof Error && error.code === 'ENOENT') {
                return null;
            }
            throw error;
        }
    }
    async listPromptVersions(id) {
        if (!this.connected)
            throw new Error('File storage not connected');
        const files = (await fsp.readdir(this.promptsDir)).filter(f => f.startsWith(`${id}-v`) && f.endsWith('.json'));
        return files
            .map(f => {
            const match = f.match(/-v(\d+)\.json$/);
            return match ? parseInt(match[1], 10) : null;
        })
            .filter((v) => v !== null)
            .sort((a, b) => a - b);
    }
    async updatePrompt(id, version, prompt) {
        if (!this.connected)
            throw new Error('File storage not connected');
        const filePath = this.getPromptFileName(id, version);
        const idLockPath = path_1.default.join(this.promptsDir, `${id}.lock`);
        return this.withLock(idLockPath, async () => {
            let existing;
            try {
                existing = JSON.parse(await fsp.readFile(filePath, 'utf-8'));
            }
            catch {
                throw new Error(`Prompt ${id} v${version} not found`);
            }
            const updated = {
                ...existing,
                ...prompt,
                updatedAt: new Date().toISOString(),
            };
            schemas_1.promptSchemas.full.parse(updated);
            await atomicWriteFile(filePath, JSON.stringify(updated, null, 2));
            // If this is the latest version, update the index
            const versions = await this.listPromptVersions(id);
            if (version === Math.max(...versions)) {
                await this.updatePromptIndexEntry(id, {
                    id: updated.id,
                    name: updated.name,
                    version: updated.version,
                    createdAt: updated.createdAt,
                    updatedAt: updated.updatedAt,
                    isTemplate: updated.isTemplate,
                    description: updated.description,
                    category: updated.category,
                    tags: updated.tags,
                });
            }
            return sanitizePromptMetadata(updated);
        });
    }
    async deletePrompt(id, version) {
        if (!this.connected)
            throw new Error('File storage not connected');
        const idLockPath = path_1.default.join(this.promptsDir, `${id}.lock`);
        return this.withLock(idLockPath, async () => {
            if (version) {
                const filePath = this.getPromptFileName(id, version);
                try {
                    await fsp.unlink(filePath);
                    // If this was the latest version, update the index
                    const versions = await this.listPromptVersions(id);
                    if (versions.length === 0) {
                        // No versions left, remove from index
                        await this.removePromptIndexEntry(id);
                    }
                    else if (version === Math.max(...versions, version)) {
                        // Deleted the latest, update index to new latest
                        const latestVersion = Math.max(...versions);
                        const latestPrompt = await this.getPrompt(id, latestVersion);
                        if (latestPrompt) {
                            await this.updatePromptIndexEntry(id, {
                                id: latestPrompt.id,
                                name: latestPrompt.name,
                                version: latestPrompt.version,
                                createdAt: latestPrompt.createdAt,
                                updatedAt: latestPrompt.updatedAt,
                                isTemplate: latestPrompt.isTemplate,
                                description: latestPrompt.description,
                                category: latestPrompt.category,
                                tags: latestPrompt.tags,
                            });
                        }
                    }
                    return true;
                }
                catch {
                    return false;
                }
            }
            else {
                // Delete all versions
                const versions = await this.listPromptVersions(id);
                let deleted = false;
                for (const v of versions) {
                    const filePath = this.getPromptFileName(id, v);
                    try {
                        await fsp.unlink(filePath);
                        deleted = true;
                    }
                    catch { }
                }
                await this.removePromptIndexEntry(id);
                return deleted;
            }
        });
    }
    async listPrompts(options, allVersions = false) {
        if (!this.connected) {
            throw new Error('File storage not connected');
        }
        if (allVersions) {
            // Fallback to old behavior for allVersions (full scan)
            const allPromptFiles = await fsp.readdir(this.promptsDir);
            let prompts = [];
            for (const file of allPromptFiles) {
                if (file.endsWith('.json') && file !== 'index.json') {
                    const filePath = path_1.default.join(this.promptsDir, file);
                    try {
                        const content = await fsp.readFile(filePath, 'utf-8');
                        const data = JSON.parse(content);
                        const validation = schemas_1.promptSchemas.full.safeParse(data);
                        if (validation.success) {
                            prompts.push(validation.data);
                        }
                    }
                    catch (e) {
                        // Ignore malformed files
                    }
                }
            }
            return prompts;
        }
        // Use index for latest version only
        const index = await this.readPromptIndex();
        let prompts = Object.values(index).map((meta) => ({
            ...meta,
            content: '', // content will be loaded only if needed
        }));
        // Filtering (except content search)
        if (options) {
            if (options.isTemplate !== undefined) {
                prompts = prompts.filter(p => p.isTemplate === options.isTemplate);
            }
            if (options.category) {
                prompts = prompts.filter(p => p.category === options.category);
            }
            if (options.tags && options.tags.length > 0) {
                prompts = prompts.filter(p => options.tags?.every(tag => p.tags?.includes(tag)));
            }
            if (options.search) {
                const search = options.search.toLowerCase();
                // First filter by name/description
                let filtered = prompts.filter(p => p.name.toLowerCase().includes(search) ||
                    (p.description?.toLowerCase().includes(search)));
                // For others, load full prompt file and check content
                const missing = prompts.filter(p => !p.name.toLowerCase().includes(search) &&
                    !(p.description?.toLowerCase().includes(search)));
                for (const p of missing) {
                    try {
                        const fullPrompt = await this.getPrompt(p.id, p.version);
                        if (fullPrompt && fullPrompt.content.toLowerCase().includes(search)) {
                            filtered.push(fullPrompt);
                        }
                    }
                    catch { }
                }
                prompts = filtered;
            }
        }
        // Sorting
        if (options?.sort) {
            prompts.sort((a, b) => {
                const fieldA = a[options.sort];
                const fieldB = b[options.sort];
                if (fieldA < fieldB)
                    return options.order === 'desc' ? 1 : -1;
                if (fieldA > fieldB)
                    return options.order === 'desc' ? -1 : 1;
                return 0;
            });
        }
        return prompts.map(p => sanitizePromptMetadata(p));
    }
    async getSequence(id) {
        const sequencePath = path_1.default.join(this.sequencesDir, `${id}.json`);
        try {
            const content = await fsp.readFile(sequencePath, 'utf-8');
            return schemas_1.workflowSchema.parse(JSON.parse(content));
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                return null;
            }
            throw error;
        }
    }
    async saveSequence(sequence) {
        const sequencePath = path_1.default.join(this.sequencesDir, `${sequence.id}.json`);
        await this.withLock(sequencePath, () => atomicWriteFile(sequencePath, JSON.stringify(sequence, null, 2)));
        return sequence;
    }
    async deleteSequence(id) {
        const sequencePath = path_1.default.join(this.sequencesDir, `${id}.json`);
        try {
            await this.withLock(sequencePath, () => fsp.unlink(sequencePath));
        }
        catch (error) {
            if (error.code !== 'ENOENT') {
                throw error;
            }
        }
    }
    async saveWorkflowState(state) {
        const statePath = path_1.default.join(this.workflowStatesDir, `${state.executionId}.json`);
        await this.withLock(statePath, () => atomicWriteFile(statePath, JSON.stringify(state, null, 2)));
    }
    async getWorkflowState(executionId) {
        const statePath = path_1.default.join(this.workflowStatesDir, `${executionId}.json`);
        try {
            const content = await fsp.readFile(statePath, 'utf-8');
            const state = JSON.parse(content);
            schemas_1.workflowSchema.parse(state);
            return state;
        }
        catch (error) {
            if (error instanceof Error && error.code === 'ENOENT') {
                return null;
            }
            throw error;
        }
    }
    async listWorkflowStates(workflowId) {
        const states = [];
        const files = await fsp.readdir(this.workflowStatesDir);
        for (const file of files) {
            if (file.endsWith('.json')) {
                const content = await fsp.readFile(path_1.default.join(this.workflowStatesDir, file), 'utf-8');
                const state = JSON.parse(content);
                if (state.workflowId === workflowId) {
                    states.push(state);
                }
            }
        }
        return states;
    }
    async healthCheck() {
        return this.connected;
    }
}
exports.FileAdapter = FileAdapter;
