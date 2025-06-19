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

  async deletePrompt(id: string): Promise<boolean> {
    if (!this.connected) {
      throw new Error("File storage not connected");
    }
    try {
      await fs.unlink(path.join(this.promptsDir, `${id}.json`));
      return true;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return false;
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

  async deletePrompt(id: string): Promise<boolean> {
    if (!this.connected) {
      throw new Error("Memory storage not connected");
    }
    return this.prompts.delete(id);
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
 * Stores prompts in a PostgreSQL database
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

  async savePrompt(prompt: Prompt): Promise<Prompt> {
    if (!this.connected) {
      throw new Error("PostgreSQL storage not connected");
    }

    const client = await this.pool.connect();
    try {
      await client.query(`
        INSERT INTO prompts (
          id, name, description, content, is_template, variables, tags,
          category, metadata, created_at, updated_at, version
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        prompt.id,
        prompt.name,
        prompt.description || null,
        prompt.content,
        prompt.isTemplate || false,
        prompt.variables ? JSON.stringify(prompt.variables) : null,
        prompt.tags || null,
        prompt.category || null,
        prompt.metadata ? JSON.stringify(prompt.metadata) : null,
        prompt.createdAt,
        prompt.updatedAt,
        prompt.version
      ]);
      
      return prompt;
    } catch (error) {
      console.error("Error saving prompt to PostgreSQL:", error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getPrompt(id: string): Promise<Prompt | null> {
    if (!this.connected) {
      throw new Error("PostgreSQL storage not connected");
    }

    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        SELECT * FROM prompts WHERE id = $1
      `, [id]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.rowToPrompt(result.rows[0]);
    } catch (error) {
      console.error(`Error getting prompt ${id} from PostgreSQL:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  async updatePrompt(id: string, prompt: Prompt): Promise<Prompt> {
    if (!this.connected) {
      throw new Error("PostgreSQL storage not connected");
    }

    const client = await this.pool.connect();
    try {
      await client.query(`
        UPDATE prompts SET
          name = $1,
          description = $2,
          content = $3,
          is_template = $4,
          variables = $5,
          tags = $6,
          category = $7,
          updated_at = $8,
          version = $9,
          metadata = $10
        WHERE id = $11
      `, [
        prompt.name,
        prompt.description || null,
        prompt.content,
        prompt.isTemplate || false,
        prompt.variables ? JSON.stringify(prompt.variables) : null,
        prompt.tags || null,
        prompt.category || null,
        prompt.updatedAt,
        prompt.version,
        prompt.metadata ? JSON.stringify(prompt.metadata) : null,
        id
      ]);
      
      return prompt;
    } catch (error) {
      console.error(`Error updating prompt ${id} in PostgreSQL:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  async deletePrompt(id: string): Promise<boolean> {
    if (!this.connected) {
      throw new Error("PostgreSQL storage not connected");
    }
    const result = await this.pool.query('DELETE FROM prompts WHERE id = $1', [id]);
    return result.rowCount > 0;
  }

  async listPrompts(options?: ListPromptsOptions): Promise<Prompt[]> {
    if (!this.connected) {
      throw new Error("PostgreSQL storage not connected");
    }

    const client = await this.pool.connect();
    try {
      let query = 'SELECT * FROM prompts';
      const params: any[] = [];
      const conditions: string[] = [];

      if (options) {
        if (options.isTemplate !== undefined) {
          conditions.push('is_template = $' + (params.length + 1));
          params.push(options.isTemplate);
        }

        if (options.category) {
          conditions.push('category = $' + (params.length + 1));
          params.push(options.category);
        }

        if (options.tags && options.tags.length > 0) {
          conditions.push('tags @> $' + (params.length + 1));
          params.push(options.tags);
        }

        if (conditions.length > 0) {
          query += ' WHERE ' + conditions.join(' AND ');
        }
      }

      const result = await client.query(query, params);
      return result.rows.map(row => this.rowToPrompt(row));
    } catch (error) {
      console.error("Error listing prompts from PostgreSQL:", error);
      throw error;
    } finally {
      client.release();
    }
  }

  private rowToPrompt(row: any): Prompt {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      content: row.content,
      isTemplate: row.is_template,
      variables: row.variables ? JSON.parse(row.variables) : undefined,
      tags: row.tags,
      category: row.category,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      version: row.version
    };
  }

  async getAllPrompts(): Promise<Prompt[]> {
    if (!this.connected) {
      throw new Error("PostgreSQL storage not connected");
    }

    const client = await this.pool.connect();
    try {
      const result = await client.query('SELECT * FROM prompts');
      return result.rows.map(row => this.rowToPrompt(row));
    } catch (error) {
      console.error("Error getting all prompts from PostgreSQL:", error);
      throw error;
    } finally {
      client.release();
    }
  }

  async isConnected(): Promise<boolean> {
    return this.connected;
  }

  async getSequence(id: string): Promise<PromptSequence | null> {
    return Promise.reject(new Error("Method not implemented."));
  }

  async saveSequence(sequence: PromptSequence): Promise<PromptSequence> {
    return Promise.reject(new Error("Method not implemented."));
  }

  async deleteSequence(id: string): Promise<void> {
    return Promise.reject(new Error("Method not implemented."));
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

  async deletePrompt(id: string): Promise<boolean> {
    if (!this.connected) {
      throw new Error("MDC storage not connected");
    }
    const filePath = this.getFilePath(id);
    try {
      await fs.unlink(filePath);
      return true;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return false;
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

export interface StorageConfig {
  type: 'file' | 'memory' | 'postgres' | 'mdc';
  promptsDir?: string;
  backupsDir?: string;
  postgres?: pg.PoolConfig;
  mdcRulesDir?: string;
}

export function createStorageAdapter(config: StorageConfig): StorageAdapter {
  switch (config.type) {
    case 'file':
      return new FileAdapter(config.promptsDir || './prompts');
    case 'memory':
      return new MemoryAdapter();
    case 'postgres':
      if (!config.postgres) throw new Error('Missing postgres config');
      return new PostgresAdapter(config.postgres);
    case 'mdc':
      return new MdcAdapter(config.mdcRulesDir || './.cursor/rules');
    default:
      throw new Error(`Unknown storage type: ${config.type}`);
  }
} 