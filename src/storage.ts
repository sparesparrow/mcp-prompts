/**
 * MCP Prompts Server Storage
 * This file contains implementations for different storage providers
 */

import fs from 'fs/promises';
import path from 'path';
import { Config, Prompt, ListPromptOptions, PromptStorage, extractVariables } from './core';

// Use optional import for pg to avoid requiring it when not using PGAI
let Pool: any;
try {
  // This will be properly typed when pg is installed
  const pg = require('pg');
  Pool = pg.Pool;
} catch (error) {
  // Will be handled during runtime if trying to use PGAI without pg installed
  Pool = null;
}

/**
 * Interface for PGAI client
 */
interface PgAIClient {
  /**
   * Create embeddings for text
   */
  createEmbeddings(texts: string[]): Promise<number[][]>;
  
  /**
   * Initialize vector storage
   */
  initVectorStorage(tableName: string, schema?: string): Promise<void>;
}

/**
 * File-based storage provider
 */
export class FileStorageProvider implements PromptStorage {
  private baseDir: string;
  
  /**
   * Create a new file storage provider
   * @param baseDir Directory to store prompt files
   */
  constructor(baseDir: string) {
    this.baseDir = baseDir;
  }
  
  /**
   * Get a prompt by its ID
   * @param id The ID of the prompt to retrieve
   * @returns The prompt or null if not found
   */
  async getPrompt(id: string): Promise<Prompt | null> {
    try {
      const filePath = this.getFilePath(id);
      const content = await fs.readFile(filePath, 'utf-8');
      const prompt = JSON.parse(content) as Prompt;
      
      // Convert date strings to Date objects
      if (typeof prompt.createdAt === 'string') {
        prompt.createdAt = new Date(prompt.createdAt);
      }
      
      if (typeof prompt.updatedAt === 'string') {
        prompt.updatedAt = new Date(prompt.updatedAt);
      }
      
      return prompt;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }
  
  /**
   * List all prompts with optional filtering
   * @param options Optional filtering options
   * @returns Array of prompts
   */
  async listPrompts(options?: ListPromptOptions): Promise<Prompt[]> {
    try {
      await fs.mkdir(this.baseDir, { recursive: true });
      
      const files = await fs.readdir(this.baseDir);
      const promptFiles = files.filter(file => file.endsWith('.json'));
      
      const prompts: Prompt[] = [];
      
      for (const file of promptFiles) {
        try {
          const filePath = path.join(this.baseDir, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const prompt = JSON.parse(content) as Prompt;
          
          // Convert date strings to Date objects
          if (typeof prompt.createdAt === 'string') {
            prompt.createdAt = new Date(prompt.createdAt);
          }
          
          if (typeof prompt.updatedAt === 'string') {
            prompt.updatedAt = new Date(prompt.updatedAt);
          }
          
          prompts.push(prompt);
        } catch (error) {
          console.error(`Error reading prompt file ${file}:`, error);
        }
      }
      
      // Apply filters if provided
      return this.filterPrompts(prompts, options);
    } catch (error) {
      console.error('Error listing prompts:', error);
      return [];
    }
  }
  
  /**
   * Add or update a prompt
   * @param prompt The prompt to add or update
   * @returns The added prompt
   */
  async addPrompt(prompt: Prompt): Promise<Prompt> {
    try {
      // Make sure the directory exists
      await fs.mkdir(this.baseDir, { recursive: true });
      
      // Ensure dates are Date objects
      const updatedPrompt: Prompt = {
        ...prompt,
        createdAt: prompt.createdAt instanceof Date ? prompt.createdAt : new Date(prompt.createdAt || Date.now()),
        updatedAt: new Date()
      };
      
      // If it's a template, extract variables
      if (updatedPrompt.isTemplate) {
        updatedPrompt.variables = extractVariables(updatedPrompt.content);
      }
      
      // Write the prompt to a file
      const filePath = this.getFilePath(updatedPrompt.id);
      await fs.writeFile(filePath, JSON.stringify(updatedPrompt, null, 2), 'utf-8');
      
      return updatedPrompt;
    } catch (error) {
      console.error('Error adding prompt:', error);
      throw error;
    }
  }
  
  /**
   * Delete a prompt by its ID
   * @param id The ID of the prompt to delete
   * @returns Whether the deletion was successful
   */
  async deletePrompt(id: string): Promise<boolean> {
    try {
      const filePath = this.getFilePath(id);
      await fs.unlink(filePath);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return false;
      }
      throw error;
    }
  }
  
  /**
   * Close the storage provider (no-op for file storage)
   */
  async close(): Promise<void> {
    // No resources to close for file storage
  }
  
  /**
   * Get the file path for a prompt ID
   * @param id The prompt ID
   * @returns The file path
   */
  private getFilePath(id: string): string {
    return path.join(this.baseDir, `${id}.json`);
  }
  
  /**
   * Filter prompts based on options
   * @param prompts The prompts to filter
   * @param options The filter options
   * @returns Filtered prompts
   */
  private filterPrompts(prompts: Prompt[], options?: ListPromptOptions): Prompt[] {
    if (!options) {
      return prompts;
    }
    
    let filtered = prompts;
    
    // Filter by tags
    if (options.tags && options.tags.length > 0) {
      filtered = filtered.filter(prompt => 
        prompt.tags?.some(tag => options.tags!.includes(tag))
      );
    }
    
    // Filter by template status
    if (options.templatesOnly) {
      filtered = filtered.filter(prompt => prompt.isTemplate);
    }
    
    return filtered;
  }
}

/**
 * PostgreSQL with PGAI storage provider
 */
export class PgAIStorageProvider implements PromptStorage {
  private pool: any;
  private pgai: PgAIClient | null;
  private tableName: string;
  private schema: string;
  private initialized: boolean = false;
  
  /**
   * Create a new PGAI storage provider
   * @param connectionString PostgreSQL connection string
   * @param tableName Optional table name
   * @param schema Optional schema name
   */
  constructor(connectionString: string, tableName: string = 'mcp_prompts', schema: string = 'public') {
    if (!Pool) {
      throw new Error('PostgreSQL (pg) package is not installed. Run "npm install pg" to use PGAI storage.');
    }
    
    this.pool = new Pool({ connectionString });
    this.tableName = tableName;
    this.schema = schema;
    
    // Try to initialize PGAI client
    try {
      // This is just a placeholder for the PGAI client
      // In a real implementation, you would import and initialize the PGAI client
      this.pgai = {
        createEmbeddings: async (texts: string[]): Promise<number[][]> => {
          // Placeholder for embeddings
          return texts.map(() => Array(1536).fill(0).map(() => Math.random()));
        },
        initVectorStorage: async (tableName: string, schema?: string): Promise<void> => {
          // Placeholder for initializing vector storage
        }
      };
    } catch (error) {
      console.warn('PGAI client not available. Semantic search will not be available.', error);
      this.pgai = null;
    }
  }
  
  /**
   * Initialize the database schema
   */
  private async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    
    const client = await this.pool.connect();
    
    try {
      // Create schema if it doesn't exist
      if (this.schema !== 'public') {
        await client.query(`CREATE SCHEMA IF NOT EXISTS ${this.schema}`);
      }
      
      // Create table if it doesn't exist
      await client.query(`
        CREATE TABLE IF NOT EXISTS ${this.schema}.${this.tableName} (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          content TEXT NOT NULL,
          description TEXT,
          tags TEXT[],
          is_template BOOLEAN NOT NULL,
          variables TEXT[],
          created_at TIMESTAMP NOT NULL,
          updated_at TIMESTAMP NOT NULL,
          version INT NOT NULL,
          metadata JSONB,
          embedding VECTOR(1536)
        )
      `);
      
      // Initialize vector storage if PGAI is available
      if (this.pgai) {
        await this.pgai.initVectorStorage(this.tableName, this.schema);
      }
      
      this.initialized = true;
    } finally {
      client.release();
    }
  }
  
  /**
   * Get a prompt by its ID
   * @param id The ID of the prompt to retrieve
   * @returns The prompt or null if not found
   */
  async getPrompt(id: string): Promise<Prompt | null> {
    await this.initialize();
    
    const client = await this.pool.connect();
    
    try {
      const result = await client.query(
        `SELECT * FROM ${this.schema}.${this.tableName} WHERE id = $1`,
        [id]
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return this.rowToPrompt(result.rows[0]);
    } finally {
      client.release();
    }
  }
  
  /**
   * List all prompts with optional filtering
   * @param options Optional filtering options
   * @returns Array of prompts
   */
  async listPrompts(options?: ListPromptOptions): Promise<Prompt[]> {
    await this.initialize();
    
    const client = await this.pool.connect();
    
    try {
      let query = `SELECT * FROM ${this.schema}.${this.tableName}`;
      const params: any[] = [];
      const conditions: string[] = [];
      
      // Apply filters
      if (options?.tags && options.tags.length > 0) {
        conditions.push(`tags && $${params.length + 1}`);
        params.push(options.tags);
      }
      
      if (options?.templatesOnly) {
        conditions.push(`is_template = $${params.length + 1}`);
        params.push(true);
      }
      
      // Add WHERE clause if there are conditions
      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(' AND ')}`;
      }
      
      // Order by updated_at desc
      query += ` ORDER BY updated_at DESC`;
      
      const result = await client.query(query, params);
      
      return result.rows.map(row => this.rowToPrompt(row));
    } finally {
      client.release();
    }
  }
  
  /**
   * Add or update a prompt
   * @param prompt The prompt to add or update
   * @returns The added prompt
   */
  async addPrompt(prompt: Prompt): Promise<Prompt> {
    await this.initialize();
    
    const client = await this.pool.connect();
    
    try {
      // Start a transaction
      await client.query('BEGIN');
      
      // Generate embedding if PGAI is available
      let embedding = null;
      if (this.pgai) {
        const embeddings = await this.pgai.createEmbeddings([prompt.content]);
        embedding = embeddings[0];
      }
      
      // Convert prompt to row format
      const updatedPrompt: Prompt = {
        ...prompt,
        createdAt: prompt.createdAt instanceof Date ? prompt.createdAt : new Date(prompt.createdAt || Date.now()),
        updatedAt: new Date()
      };
      
      // If it's a template, extract variables
      if (updatedPrompt.isTemplate && !updatedPrompt.variables) {
        updatedPrompt.variables = extractVariables(updatedPrompt.content);
      }
      
      // Insert or update the prompt
      await client.query(`
        INSERT INTO ${this.schema}.${this.tableName}
        (id, name, content, description, tags, is_template, variables, created_at, updated_at, version, metadata, embedding)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (id) DO UPDATE
        SET name = $2, content = $3, description = $4, tags = $5, is_template = $6, 
            variables = $7, updated_at = $9, version = $10, metadata = $11, embedding = $12
      `, [
        updatedPrompt.id,
        updatedPrompt.name,
        updatedPrompt.content,
        updatedPrompt.description || null,
        updatedPrompt.tags || [],
        updatedPrompt.isTemplate,
        updatedPrompt.variables || [],
        updatedPrompt.createdAt,
        updatedPrompt.updatedAt,
        updatedPrompt.version,
        updatedPrompt.metadata || {},
        embedding
      ]);
      
      // Commit the transaction
      await client.query('COMMIT');
      
      return updatedPrompt;
    } catch (error) {
      // Rollback the transaction
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  /**
   * Delete a prompt by its ID
   * @param id The ID of the prompt to delete
   * @returns Whether the deletion was successful
   */
  async deletePrompt(id: string): Promise<boolean> {
    await this.initialize();
    
    const client = await this.pool.connect();
    
    try {
      const result = await client.query(
        `DELETE FROM ${this.schema}.${this.tableName} WHERE id = $1`,
        [id]
      );
      
      return result.rowCount > 0;
    } finally {
      client.release();
    }
  }
  
  /**
   * Search prompts by content using embeddings
   * @param content The content to search for
   * @param limit Maximum number of results to return
   * @returns Array of prompts matching the search
   */
  async searchPromptsByContent(content: string, limit: number = 10): Promise<Prompt[]> {
    if (!this.pgai) {
      throw new Error('PGAI client not available for semantic search');
    }
    
    await this.initialize();
    
    const client = await this.pool.connect();
    
    try {
      // Generate embedding for the search query
      const embeddings = await this.pgai.createEmbeddings([content]);
      const queryEmbedding = embeddings[0];
      
      // Search for similar prompts
      const result = await client.query(`
        SELECT *, embedding <-> $1 as distance
        FROM ${this.schema}.${this.tableName}
        ORDER BY distance
        LIMIT $2
      `, [queryEmbedding, limit]);
      
      return result.rows.map(row => this.rowToPrompt(row));
    } finally {
      client.release();
    }
  }
  
  /**
   * Close the storage provider and release resources
   */
  async close(): Promise<void> {
    await this.pool.end();
  }
  
  /**
   * Convert a database row to a Prompt object
   * @param row The database row
   * @returns The prompt object
   */
  private rowToPrompt(row: any): Prompt {
    return {
      id: row.id,
      name: row.name,
      content: row.content,
      description: row.description,
      tags: row.tags,
      isTemplate: row.is_template,
      variables: row.variables,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      version: row.version,
      metadata: row.metadata
    };
  }
}

/**
 * Create a storage provider based on configuration
 * @param config The configuration
 * @returns A storage provider instance
 */
export function createStorageProvider(config: Config): PromptStorage {
  if (config.storage.type === 'file') {
    const options = config.storage.options as { baseDir: string };
    return new FileStorageProvider(options.baseDir);
  } else if (config.storage.type === 'pgai') {
    const options = config.storage.options as { 
      connectionString: string;
      schema?: string;
      tableName?: string;
    };
    return new PgAIStorageProvider(
      options.connectionString,
      options.tableName,
      options.schema
    );
  } else {
    throw new Error(`Unsupported storage type: ${(config.storage as any).type}`);
  }
} 
} 