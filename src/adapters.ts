/**
 * Consolidated Adapters Module
 * Contains all storage adapters in a single file
 */

import { 
  Prompt, 
  StorageAdapter, 
  ListPromptsOptions, 
  ServerConfig, 
  MutablePrompt,
  MutablePromptFactory,
  PromptFormat, 
  PromptConversionOptions,
  MdcFormatOptions,
  PgaiFormatOptions,
  TemplateFormatOptions,
  PromptSequence
} from './interfaces.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import pg from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { Client } from '@elastic/elasticsearch';

/**
 * FileAdapter Implementation
 * Stores prompts as individual JSON files in a directory
 */
export class FileAdapter implements StorageAdapter {
  private promptsDir: string;
  private sequencesDir: string;
  private connected: boolean = false;
  private prompts: Map<string, Prompt> = new Map();

  constructor(promptsDir: string) {
    this.promptsDir = promptsDir;
    this.sequencesDir = path.join(promptsDir, 'sequences');
  }

  async connect(): Promise<void> {
    try {
      await fs.mkdir(this.promptsDir, { recursive: true });
      await fs.mkdir(this.sequencesDir, { recursive: true });
      this.connected = true;
      console.error(`File storage connected: ${this.promptsDir}`);
    } catch (error: any) {
      console.error("Error connecting to file storage:", error);
      throw new Error(`Failed to connect to file storage: ${error.message}`);
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    console.error("File storage disconnected");
  }

  async savePrompt(prompt: Prompt): Promise<Prompt> {
    if (!this.connected) {
      throw new Error("File storage not connected");
    }

    try {
      await fs.writeFile(
        path.join(this.promptsDir, `${prompt.id}.json`),
        JSON.stringify(prompt, null, 2)
      );
      return prompt;
    } catch (error: any) {
      console.error("Error saving prompt to file:", error);
      throw error;
    }
  }

  async getPrompt(id: string): Promise<Prompt | null> {
    if (!this.connected) {
      throw new Error("File storage not connected");
    }

    try {
      const content = await fs.readFile(path.join(this.promptsDir, `${id}.json`), "utf-8");
      return JSON.parse(content);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return null;
      }
      console.error(`Error getting prompt ${id} from file:`, error);
      throw error;
    }
  }

  async updatePrompt(id: string, prompt: Prompt): Promise<Prompt> {
    if (!this.connected) {
      throw new Error("File storage not connected");
    }

    try {
      await fs.writeFile(
        path.join(this.promptsDir, `${id}.json`),
        JSON.stringify(prompt, null, 2)
      );
      return prompt;
    } catch (error: any) {
      console.error(`Error updating prompt ${id} in file:`, error);
      throw error;
    }
  }

  async deletePrompt(id: string): Promise<void> {
    if (!this.connected) {
      throw new Error("File storage not connected");
    }
    try {
      await fs.unlink(path.join(this.promptsDir, `${id}.json`));
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // no return value
      }
        console.error(`Error deleting prompt ${id} from file:`, error);
        throw error;
    }
  }

  async getSequence(id: string): Promise<PromptSequence | null> {
    if (!this.connected) {
      throw new Error("File storage not connected");
    }

    try {
      const content = await fs.readFile(path.join(this.sequencesDir, `${id}.json`), "utf-8");
      return JSON.parse(content);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return null;
      }
      console.error(`Error getting sequence ${id} from file:`, error);
      throw error;
    }
  }

  async saveSequence(sequence: PromptSequence): Promise<PromptSequence> {
    if (!this.connected) {
      throw new Error("File storage not connected");
    }

    try {
      await fs.writeFile(
        path.join(this.sequencesDir, `${sequence.id}.json`),
        JSON.stringify(sequence, null, 2)
      );
      return sequence;
    } catch (error: any) {
      console.error("Error saving sequence to file:", error);
      throw error;
    }
  }

  async deleteSequence(id: string): Promise<void> {
    if (!this.connected) {
      throw new Error("File storage not connected");
    }

    try {
      await fs.unlink(path.join(this.sequencesDir, `${id}.json`));
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        console.error(`Error deleting sequence ${id} from file:`, error);
        throw error;
      }
    }
  }

  async listPrompts(options?: ListPromptsOptions): Promise<Prompt[]> {
    if (!this.connected) {
      throw new Error("File storage not connected");
    }

    try {
      const files = await fs.readdir(this.promptsDir);
      const prompts: Prompt[] = [];
      
      for (const file of files) {
        if (file.endsWith(".json")) {
          try {
            const content = await fs.readFile(path.join(this.promptsDir, file), "utf-8");
            prompts.push(JSON.parse(content));
          } catch (error: any) {
            console.error(`Error reading prompt file ${file}:`, error);
          }
        }
      }
      
      return this.filterPrompts(prompts, options);
    } catch (error: any) {
      console.error("Error listing prompts from file:", error);
      throw error;
    }
  }

  private filterPrompts(prompts: Prompt[], options?: ListPromptsOptions): Prompt[] {
    if (!options) {
      return prompts;
    }

    let filtered = prompts;

    if (options.isTemplate !== undefined) {
      filtered = filtered.filter(p => p.isTemplate === options.isTemplate);
    }

    if (options.category) {
      filtered = filtered.filter(p => p.category === options.category);
    }

    if (options.tags && options.tags.length > 0) {
      filtered = filtered.filter(p => {
        if (!p.tags) return false;
        return options.tags!.every(tag => p.tags!.includes(tag));
      });
    }

    return filtered;
  }

  async getAllPrompts(): Promise<Prompt[]> {
    if (!this.connected) {
      throw new Error("File storage not connected");
    }
    return Array.from(this.prompts.values());
  }

  async isConnected(): Promise<boolean> {
    return this.connected;
  }
}

/**
 * MemoryAdapter Implementation
 * Stores prompts in memory (volatile storage)
 */
export class MemoryAdapter implements StorageAdapter {
  private prompts: Map<string, Prompt> = new Map();
  private sequences: Map<string, PromptSequence> = new Map();
  private connected: boolean = false;

  async connect(): Promise<void> {
    this.connected = true;
    console.error("Memory storage connected");
  }

  async disconnect(): Promise<void> {
    this.prompts.clear();
    this.sequences.clear();
    this.connected = false;
    console.error("Memory storage disconnected");
  }

  async savePrompt(prompt: Prompt): Promise<Prompt> {
    if (!this.connected) {
      throw new Error("Memory storage not connected");
    }

    this.prompts.set(prompt.id, prompt);
    return prompt;
  }

  async getPrompt(id: string): Promise<Prompt | null> {
    if (!this.connected) {
      throw new Error("Memory storage not connected");
    }

    return this.prompts.get(id) || null;
  }

  async getSequence(id: string): Promise<PromptSequence | null> {
    if (!this.connected) {
      throw new Error("Memory storage not connected");
    }
    return this.sequences.get(id) || null;
  }

  async saveSequence(sequence: PromptSequence): Promise<PromptSequence> {
    if (!this.connected) {
      throw new Error("Memory storage not connected");
    }
    this.sequences.set(sequence.id, sequence);
    return sequence;
  }

  async deleteSequence(id: string): Promise<void> {
    if (!this.connected) {
      throw new Error("Memory storage not connected");
    }
    this.sequences.delete(id);
  }

  async updatePrompt(id: string, prompt: Prompt): Promise<Prompt> {
    if (!this.connected) {
      throw new Error("Memory storage not connected");
    }

    this.prompts.set(id, prompt);
    return prompt;
  }

  async deletePrompt(id: string): Promise<void> {
    if (!this.connected) {
      throw new Error("Memory storage not connected");
    }
    this.prompts.delete(id);
  }

  async listPrompts(options?: ListPromptsOptions): Promise<Prompt[]> {
    if (!this.connected) {
      throw new Error("Memory storage not connected");
    }

    const prompts = Array.from(this.prompts.values());
    return this.filterPrompts(prompts, options);
  }

  private filterPrompts(prompts: Prompt[], options?: ListPromptsOptions): Prompt[] {
    if (!options) {
      return prompts;
    }

    let filtered = prompts;

    if (options.isTemplate !== undefined) {
      filtered = filtered.filter(p => p.isTemplate === options.isTemplate);
    }

    if (options.category) {
      filtered = filtered.filter(p => p.category === options.category);
    }

    if (options.tags && options.tags.length > 0) {
      filtered = filtered.filter(p => {
        if (!p.tags) return false;
        return options.tags!.every(tag => p.tags!.includes(tag));
      });
    }

    return filtered;
  }

  async isConnected(): Promise<boolean> {
    return this.connected;
  }

  async getAllPrompts(): Promise<Prompt[]> {
    if (!this.connected) {
      throw new Error("Memory storage not connected");
    }
    return Array.from(this.prompts.values());
  }
}

/**
 * PostgresAdapter Implementation
 * Stores prompts in a normalized PostgreSQL schema (see docker/postgres/init/01-init.sql)
 */
export class PostgresAdapter implements StorageAdapter {
  private pool: pg.Pool;
  private connected: boolean = false;

  constructor(config: pg.PoolConfig) {
    this.pool = new pg.Pool(config);
  }

  async connect(): Promise<void> {
    try {
      await this.pool.query('SELECT NOW()');
      this.connected = true;
      console.error("PostgreSQL storage connected");
    } catch (error: any) {
      console.error("Error connecting to PostgreSQL:", error);
      throw new Error(`Failed to connect to PostgreSQL: ${error.message}`);
    }
  }

  async disconnect(): Promise<void> {
    await this.pool.end();
    this.connected = false;
    console.error("PostgreSQL storage disconnected");
  }

  // Helper: Get or create tag IDs for a list of tag names
  private async getOrCreateTagIds(tagNames: string[]): Promise<number[]> {
    const client = await this.pool.connect();
    try {
      const tagIds: number[] = [];
      for (const name of tagNames) {
        // Try to get existing tag
        const res = await client.query('SELECT id FROM mcp_prompts.tags WHERE name = $1', [name]);
        if (res.rows.length > 0) {
          tagIds.push(res.rows[0].id);
        } else {
          // Insert new tag
          const insert = await client.query('INSERT INTO mcp_prompts.tags (name) VALUES ($1) RETURNING id', [name]);
          tagIds.push(insert.rows[0].id);
        }
      }
      return tagIds;
    } finally {
      client.release();
    }
  }

  // Helper: Set tags for a prompt (replace all)
  private async setPromptTags(promptId: number, tagNames: string[]): Promise<void> {
    const client = await this.pool.connect();
    try {
      // Remove old tags
      await client.query('DELETE FROM mcp_prompts.prompt_tags WHERE prompt_id = $1', [promptId]);
      if (tagNames.length === 0) return;
      const tagIds = await this.getOrCreateTagIds(tagNames);
      for (const tagId of tagIds) {
        await client.query('INSERT INTO mcp_prompts.prompt_tags (prompt_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [promptId, tagId]);
      }
    } finally {
      client.release();
    }
  }

  // Helper: Set template variables for a prompt (replace all)
  private async setTemplateVariables(promptId: number, variables: string[] | undefined): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('DELETE FROM mcp_prompts.template_variables WHERE prompt_id = $1', [promptId]);
      if (!variables || variables.length === 0) return;
      for (const name of variables) {
        await client.query('INSERT INTO mcp_prompts.template_variables (prompt_id, name) VALUES ($1, $2) ON CONFLICT DO NOTHING', [promptId, name]);
      }
    } finally {
      client.release();
    }
  }

  // Helper: Get tags for a prompt
  private async getTagsForPrompt(promptId: number): Promise<string[]> {
    const res = await this.pool.query(
      `SELECT t.name FROM mcp_prompts.tags t
       JOIN mcp_prompts.prompt_tags pt ON t.id = pt.tag_id
       WHERE pt.prompt_id = $1`, [promptId]
    );
    return res.rows.map(r => r.name);
  }

  // Helper: Get template variables for a prompt
  private async getVariablesForPrompt(promptId: number): Promise<string[]> {
    const res = await this.pool.query(
      `SELECT name FROM mcp_prompts.template_variables WHERE prompt_id = $1`, [promptId]
    );
    return res.rows.map(r => r.name);
  }

  // Helper: Get prompt by name (for unique constraint)
  private async getPromptIdByName(name: string): Promise<number | null> {
    const res = await this.pool.query('SELECT id FROM mcp_prompts.prompts WHERE name = $1', [name]);
    return res.rows.length > 0 ? res.rows[0].id : null;
  }

  // Helper: Extract variable names from Prompt.variables (string[] | TemplateVariable[] | undefined)
  private extractVariableNames(variables: string[] | { name: string }[] | undefined): string[] {
    if (!variables) return [];
    if (typeof variables[0] === 'string') return variables as string[];
    return (variables as { name: string }[]).map(v => v.name);
  }

  // Save (insert or update) prompt
  async savePrompt(prompt: Prompt): Promise<Prompt> {
    if (!this.connected) throw new Error("PostgreSQL storage not connected");
    const client = await this.pool.connect();
    try {
      // Check if prompt exists (by name)
      let promptId = await this.getPromptIdByName(prompt.name);
      let res;
      if (promptId !== null) {
        // Update
        res = await client.query(
          `UPDATE mcp_prompts.prompts SET
            description = $1,
            content = $2,
            is_template = $3,
            metadata = $4,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $5 RETURNING *`,
          [prompt.description, prompt.content, prompt.isTemplate || false, JSON.stringify(prompt.metadata || {}), promptId]
        );
      } else {
        // Insert
        res = await client.query(
          `INSERT INTO mcp_prompts.prompts (name, description, content, is_template, metadata)
           VALUES ($1, $2, $3, $4, $5) RETURNING *`,
          [prompt.name, prompt.description, prompt.content, prompt.isTemplate || false, JSON.stringify(prompt.metadata || {})]
        );
        promptId = res.rows[0].id;
      }
      if (promptId === null) throw new Error('Failed to get prompt ID after save');
      // Set tags and variables
      await this.setPromptTags(promptId, prompt.tags || []);
      await this.setTemplateVariables(promptId, this.extractVariableNames(prompt.variables));
      // Return full prompt
      return await this.getPromptById(promptId);
    } catch (error) {
      console.error("Error saving prompt to PostgreSQL:", error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Get prompt by ID (internal helper)
  private async getPromptById(id: number): Promise<Prompt> {
    const res = await this.pool.query('SELECT * FROM mcp_prompts.prompts WHERE id = $1', [id]);
    if (res.rows.length === 0) throw new Error(`Prompt with id ${id} not found`);
    const row = res.rows[0];
    const tags = await this.getTagsForPrompt(id);
    const variables = await this.getVariablesForPrompt(id);
    return {
      id: row.id.toString(),
      name: row.name,
      description: row.description,
      content: row.content,
      isTemplate: row.is_template,
      tags,
      variables,
      metadata: row.metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      version: row.version || 1
    };
  }

  // Get prompt by name (public API)
  async getPrompt(idOrName: string): Promise<Prompt | null> {
    if (!this.connected) throw new Error("PostgreSQL storage not connected");
    // Try by numeric ID first
    let idNum = parseInt(idOrName, 10);
    let prompt: Prompt | null = null;
    if (!isNaN(idNum)) {
      try {
        prompt = await this.getPromptById(idNum);
      } catch {
        prompt = null;
      }
    }
    if (!prompt) {
      // Try by name
      const promptId = await this.getPromptIdByName(idOrName);
      if (promptId) {
        prompt = await this.getPromptById(promptId);
      }
    }
    return prompt;
  }

  // Update prompt (by name or ID)
  async updatePrompt(idOrName: string, prompt: Prompt): Promise<Prompt> {
    if (!this.connected) throw new Error("PostgreSQL storage not connected");
    let promptId = parseInt(idOrName, 10);
    if (isNaN(promptId)) {
      promptId = await this.getPromptIdByName(idOrName) || 0;
    }
    if (!promptId) throw new Error(`Prompt not found: ${idOrName}`);
    // SavePrompt will update if exists
    return this.savePrompt({ ...prompt, id: promptId.toString() });
  }

  // Delete prompt
  async deletePrompt(idOrName: string): Promise<void> {
    if (!this.connected) throw new Error("PostgreSQL storage not connected");
    let promptId = parseInt(idOrName, 10);
    if (isNaN(promptId)) {
      const foundId = await this.getPromptIdByName(idOrName);
      if (!foundId) throw new Error(`Prompt not found: ${idOrName}`);
      promptId = foundId;
    }
    if (!promptId) throw new Error(`Prompt not found: ${idOrName}`);
    await this.pool.query('DELETE FROM mcp_prompts.prompts WHERE id = $1', [promptId]);
  }

  // List prompts (optionally filter by isTemplate, tags, etc.)
  async listPrompts(options?: ListPromptsOptions): Promise<Prompt[]> {
    if (!this.connected) throw new Error("PostgreSQL storage not connected");
    let query = 'SELECT * FROM mcp_prompts.prompts_with_tags';
    const params: any[] = [];
    const conditions: string[] = [];
    if (options) {
      if (options.isTemplate !== undefined) {
        conditions.push('is_template = $' + (params.length + 1));
        params.push(options.isTemplate);
      }
      if (options.tags && options.tags.length > 0) {
        conditions.push('tags @> $' + (params.length + 1));
        params.push(JSON.stringify(options.tags));
      }
    }
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    const res = await this.pool.query(query, params);
    // For each row, fetch variables
    const prompts: Prompt[] = [];
    for (const row of res.rows) {
      const variables = await this.getVariablesForPrompt(row.id);
      prompts.push({
        id: row.id.toString(),
        name: row.name,
        description: row.description,
        content: row.content,
        isTemplate: row.is_template,
        tags: row.tags,
        variables,
        metadata: row.metadata,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        version: row.version || 1
      });
    }
    return prompts;
  }

  async isConnected(): Promise<boolean> {
    return this.connected;
  }

  // Sequence methods (not implemented)
  async getSequence(id: string): Promise<PromptSequence | null> {
    return Promise.reject(new Error("Method not implemented."));
  }
  async saveSequence(sequence: PromptSequence): Promise<PromptSequence> {
    return Promise.reject(new Error("Method not implemented."));
  }
  async deleteSequence(id: string): Promise<void> {
    return Promise.reject(new Error("Method not implemented."));
  }

  // Test helper: clear all data (truncate tables)
  async clearAll(): Promise<void> {
    if (!this.connected) throw new Error("PostgreSQL storage not connected");
    const client = await this.pool.connect();
    try {
      await client.query('TRUNCATE mcp_prompts.prompt_tags, mcp_prompts.template_variables, mcp_prompts.tags, mcp_prompts.prompts RESTART IDENTITY CASCADE');
    } finally {
      client.release();
    }
  }

  // Return all prompts (required by StorageAdapter interface)
  async getAllPrompts(): Promise<Prompt[]> {
    return this.listPrompts();
  }
}

/**
 * MdcAdapter Implementation (Cursor Rules)
 * Stores prompts as .mdc files in a directory using Markdown frontmatter
 */
export class MdcAdapter implements StorageAdapter {
  private rulesDir: string;
  private connected = false;

  constructor(rulesDir: string) {
    this.rulesDir = rulesDir;
  }

  async connect(): Promise<void> {
    await fs.mkdir(this.rulesDir, { recursive: true });
    this.connected = true;
    console.error(`MDC storage connected: ${this.rulesDir}`);
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    console.error('MDC storage disconnected');
  }

  async isConnected(): Promise<boolean> {
    return this.connected;
  }

  private getFilePath(id: string): string {
    return path.join(this.rulesDir, `${id}.mdc`);
  }

  async savePrompt(prompt: Prompt, overwrite = false): Promise<Prompt> {
    if (!this.connected) throw new Error('MDC adapter not connected');
    const id = prompt.id || this.generateId(prompt.name);
    prompt.id = id;
    if (!overwrite) {
      const existing = await this.getPrompt(id);
      if (existing) throw new Error(`Prompt with id '${id}' already exists`);
    }
    const mdcContent = this.promptToMdc(prompt);
    await fs.writeFile(this.getFilePath(id), mdcContent, 'utf8');
    return prompt;
  }

  async getPrompt(id: string): Promise<Prompt | null> {
    if (!this.connected) throw new Error('MDC adapter not connected');
    try {
      const mdcContent = await fs.readFile(this.getFilePath(id), 'utf8');
      return this.mdcToPrompt(id, mdcContent);
    } catch (error: any) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
  }

  async updatePrompt(id: string, prompt: Prompt): Promise<Prompt> {
    if (!this.connected) throw new Error('MDC adapter not connected');
    const existing = await this.getPrompt(id);
    if (!existing) throw new Error(`Prompt not found: ${id}`);
    const updated: Prompt = { ...existing, ...prompt, id, updatedAt: new Date().toISOString() };
    await this.savePrompt(updated, true);
    return updated;
  }

  async deletePrompt(id: string): Promise<void> {
    if (!this.connected) {
      throw new Error("MDC storage not connected");
    }
    const filePath = this.getFilePath(id);
    try {
      await fs.unlink(filePath);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // no return value
      }
      throw error;
    }
  }

  async listPrompts(options?: ListPromptsOptions): Promise<Prompt[]> {
    if (!this.connected) throw new Error('MDC adapter not connected');
    const files = await fs.readdir(this.rulesDir);
    const prompts: Prompt[] = [];
    for (const file of files) {
      if (file.endsWith('.mdc')) {
        const id = path.basename(file, '.mdc');
        try {
          const prompt = await this.getPrompt(id);
          if (prompt) prompts.push(prompt);
        } catch (error) {
          console.error(`Error reading prompt ${id}:`, error);
        }
      }
    }
    return this.filterPrompts(prompts, options);
  }

  async getAllPrompts(): Promise<Prompt[]> {
    return this.listPrompts();
  }

  // Sequence support: not implemented for MDC, return null/empty
  async getSequence(_id: string): Promise<PromptSequence | null> {
    return null;
  }
  async saveSequence(_sequence: PromptSequence): Promise<PromptSequence> {
    throw new Error('Sequences not supported in MDC adapter');
  }
  async deleteSequence(_id: string): Promise<void> {
    throw new Error('Sequences not supported in MDC adapter');
  }

  private filterPrompts(prompts: Prompt[], options?: ListPromptsOptions): Prompt[] {
    if (!options) return prompts;
    let filtered = prompts;
    if (options.isTemplate !== undefined) {
      filtered = filtered.filter(p => p.isTemplate === options.isTemplate);
    }
    if (options.tags && options.tags.length > 0) {
      filtered = filtered.filter(p => p.tags && options.tags!.every(tag => p.tags!.includes(tag)));
    }
    if (options.category) {
      filtered = filtered.filter(p => p.category === options.category);
    }
    if (options.search) {
      const term = options.search.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(term) ||
        (p.description && p.description.toLowerCase().includes(term)) ||
        p.content.toLowerCase().includes(term)
      );
    }
    return filtered;
  }

  private promptToMdc(prompt: Prompt): string {
    let mdc = '---\n';
    mdc += `description: ${prompt.description || ''}\n`;
    if (prompt.tags && prompt.tags.length > 0) {
      const globs = this.extractGlobsFromTags(prompt.tags);
      if (globs.length > 0) {
        mdc += `globs: ${JSON.stringify(globs)}\n`;
      }
    }
    mdc += '---\n\n';
    mdc += `# ${prompt.name}\n\n`;
    mdc += prompt.content;
    if (prompt.isTemplate && prompt.variables && prompt.variables.length > 0) {
      mdc += '\n\n## Variables\n\n';
      for (const variable of prompt.variables) {
        mdc += `- \`${variable}\`\n`;
      }
    }
    return mdc;
  }

  private mdcToPrompt(id: string, mdcContent: string): Prompt {
    const frontmatterMatch = mdcContent.match(/---\n([\s\S]*?)\n---/);
    const frontmatter = frontmatterMatch ? frontmatterMatch[1] : '';
    const descriptionMatch = frontmatter.match(/description: (.*)/);
    const description = descriptionMatch ? descriptionMatch[1].trim() : '';
    const globsMatch = frontmatter.match(/globs: (\[.*\])/);
    const globs = globsMatch ? JSON.parse(globsMatch[1]) : [];
    const tags = globs.map((glob: string) => `glob:${glob}`);
    const titleMatch = mdcContent.match(/# (.*)/);
    const name = titleMatch ? titleMatch[1].trim() : id;
    const content = mdcContent.replace(/---\n[\s\S]*?\n---\n\n# .*\n\n/, '');
    const variables = this.extractVariablesFromContent(content);
    return {
      id,
      name,
      description,
      content,
      tags,
      isTemplate: variables.length > 0,
      variables,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  private extractGlobsFromTags(tags: string[]): string[] {
    return tags.filter(tag => tag.startsWith('glob:')).map(tag => tag.replace('glob:', ''));
  }

  private extractVariablesFromContent(content: string): string[] {
    const varSection = content.match(/## Variables\n\n([\s\S]*?)(\n\n|$)/);
    if (!varSection) return [];
    const varContent = varSection[1];
    return varContent.split('\n').map(line => {
      const match = line.match(/- `([^`]+)`/);
      return match ? match[1] : null;
    }).filter(Boolean) as string[];
  }

  private generateId(name: string): string {
    const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    return base || uuidv4();
  }
}

/**
 * ElasticSearch Adapter Implementation
 * Stores prompts in ElasticSearch with support for k-NN search
 */
export class ElasticSearchAdapter implements StorageAdapter {
  private client: Client;
  private index: string;
  private connected: boolean = false;
  private sequenceIndex: string;

  constructor(config: {
    node: string;
    auth?: { username: string; password: string };
    index?: string;
    sequenceIndex?: string;
  }) {
    this.client = new Client({
      node: config.node,
      auth: config.auth,
    });
    this.index = config.index || 'prompts';
    this.sequenceIndex = config.sequenceIndex || 'prompt-sequences';
  }

  async connect(): Promise<void> {
    try {
      // Check if indices exist, create if not
      const promptsExists = await this.client.indices.exists({ index: this.index });
      if (!promptsExists) {
        await this.client.indices.create({
          index: this.index,
          mappings: {
            properties: {
              id: { type: 'keyword' },
              name: { type: 'text' },
              description: { type: 'text' },
              content: { type: 'text' },
              isTemplate: { type: 'boolean' },
              variables: { type: 'keyword' },
              tags: { type: 'keyword' },
              category: { type: 'keyword' },
              createdAt: { type: 'date' },
              updatedAt: { type: 'date' },
              version: { type: 'integer' },
              metadata: { type: 'object' }
            }
          }
        });
      }

      const sequencesExists = await this.client.indices.exists({ index: this.sequenceIndex });
      if (!sequencesExists) {
        await this.client.indices.create({
          index: this.sequenceIndex,
          mappings: {
            properties: {
              id: { type: 'keyword' },
              name: { type: 'text' },
              description: { type: 'text' },
              promptIds: { type: 'keyword' },
              createdAt: { type: 'date' },
              updatedAt: { type: 'date' },
              metadata: { type: 'object' }
            }
          }
        });
      }

      this.connected = true;
      console.error(`ElasticSearch storage connected: ${this.index}`);
    } catch (error: any) {
      console.error("Error connecting to ElasticSearch:", error);
      throw new Error(`Failed to connect to ElasticSearch: ${error.message}`);
    }
  }

  async disconnect(): Promise<void> {
    await this.client.close();
    this.connected = false;
    console.error("ElasticSearch storage disconnected");
  }

  async isConnected(): Promise<boolean> {
    return this.connected;
  }

  async savePrompt(prompt: Prompt): Promise<Prompt> {
    if (!this.connected) {
      throw new Error("ElasticSearch storage not connected");
    }

    try {
      await this.client.index({
        index: this.index,
        id: prompt.id,
        document: prompt,
        refresh: true
      });
      return prompt;
    } catch (error: any) {
      console.error("Error saving prompt to ElasticSearch:", error);
      throw error;
    }
  }

  async getPrompt(id: string): Promise<Prompt | null> {
    if (!this.connected) {
      throw new Error("ElasticSearch storage not connected");
    }

    try {
      const response = await this.client.get({
        index: this.index,
        id: id
      });
      return response._source as Prompt;
    } catch (error: any) {
      if (error.statusCode === 404) {
        return null;
      }
      console.error(`Error getting prompt ${id} from ElasticSearch:`, error);
      throw error;
    }
  }

  async updatePrompt(id: string, prompt: Prompt): Promise<Prompt> {
    if (!this.connected) {
      throw new Error("ElasticSearch storage not connected");
    }

    try {
      await this.client.update({
        index: this.index,
        id: id,
        doc: prompt,
        refresh: true
      });
      return prompt;
    } catch (error: any) {
      console.error(`Error updating prompt ${id} in ElasticSearch:`, error);
      throw error;
    }
  }

  async deletePrompt(id: string): Promise<void> {
    if (!this.connected) {
      throw new Error("ElasticSearch storage not connected");
    }

    try {
      const response = await this.client.delete({
        index: this.index,
        id: id,
        refresh: true
      });
    } catch (error: any) {
      if (error.statusCode === 404) {
        // no return value
      }
      console.error(`Error deleting prompt ${id} from ElasticSearch:`, error);
      throw error;
    }
  }

  async listPrompts(options?: ListPromptsOptions): Promise<Prompt[]> {
    if (!this.connected) {
      throw new Error("ElasticSearch storage not connected");
    }

    try {
      const query: any = {
        bool: {
          must: []
        }
      };

      if (options?.isTemplate !== undefined) {
        query.bool.must.push({ term: { isTemplate: options.isTemplate } });
      }

      if (options?.category) {
        query.bool.must.push({ term: { category: options.category } });
      }

      if (options?.tags && options.tags.length > 0) {
        query.bool.must.push({ terms: { tags: options.tags } });
      }

      if (options?.search) {
        query.bool.must.push({
          multi_match: {
            query: options.search,
            fields: ['name^2', 'description', 'content']
          }
        });
      }

      const response = await this.client.search({
        index: this.index,
        query,
        sort: options?.sort ? [
          { [options.sort]: { order: options.order || 'asc' } }
        ] : undefined,
        from: options?.offset || 0,
        size: options?.limit || 10
      });

      return response.hits.hits.map(hit => hit._source as Prompt);
    } catch (error: any) {
      console.error("Error listing prompts from ElasticSearch:", error);
      throw error;
    }
  }

  async getAllPrompts(): Promise<Prompt[]> {
    return this.listPrompts({ limit: 10000 });
  }

  async getSequence(id: string): Promise<PromptSequence | null> {
    if (!this.connected) {
      throw new Error("ElasticSearch storage not connected");
    }

    try {
      const response = await this.client.get({
        index: this.sequenceIndex,
        id: id
      });
      return response._source as PromptSequence;
    } catch (error: any) {
      if (error.statusCode === 404) {
        return null;
      }
      console.error(`Error getting sequence ${id} from ElasticSearch:`, error);
      throw error;
    }
  }

  async saveSequence(sequence: PromptSequence): Promise<PromptSequence> {
    if (!this.connected) {
      throw new Error("ElasticSearch storage not connected");
    }

    try {
      await this.client.index({
        index: this.sequenceIndex,
        id: sequence.id,
        document: sequence,
        refresh: true
      });
      return sequence;
    } catch (error: any) {
      console.error("Error saving sequence to ElasticSearch:", error);
      throw error;
    }
  }

  async deleteSequence(id: string): Promise<void> {
    if (!this.connected) {
      throw new Error("ElasticSearch storage not connected");
    }

    try {
      await this.client.delete({
        index: this.sequenceIndex,
        id: id,
        refresh: true
      });
    } catch (error: any) {
      if (error.statusCode !== 404) {
        console.error(`Error deleting sequence ${id} from ElasticSearch:`, error);
        throw error;
      }
    }
  }
}

export interface StorageConfig {
  type: 'file' | 'memory' | 'postgres' | 'mdc' | 'elasticsearch';
  promptsDir?: string;
  backupsDir?: string;
  postgres?: pg.PoolConfig;
  mdcRulesDir?: string;
  elasticsearch?: {
    node: string;
    auth?: {
      username: string;
      password: string;
    };
    index?: string;
    sequenceIndex?: string;
  };
}

export function createStorageAdapter(config: StorageConfig): StorageAdapter {
  switch (config.type) {
    case 'file':
      if (!config.promptsDir) {
        throw new Error('promptsDir is required for file storage');
      }
      return new FileAdapter(config.promptsDir);
    case 'memory':
      return new MemoryAdapter();
    case 'postgres':
      if (!config.postgres) {
        throw new Error('postgres config is required for postgres storage');
      }
      return new PostgresAdapter(config.postgres);
    case 'mdc':
      if (!config.mdcRulesDir) {
        throw new Error('mdcRulesDir is required for MDC storage');
      }
      return new MdcAdapter(config.mdcRulesDir);
    case 'elasticsearch':
      if (!config.elasticsearch) {
        throw new Error('elasticsearch config is required for elasticsearch storage');
      }
      return new ElasticSearchAdapter(config.elasticsearch);
    default:
      throw new Error(`Unknown storage type: ${config.type}`);
  }
} 