import { Client, Pool } from 'pg';
import { Prompt, StorageAdapter, ListPromptsOptions } from '../core/types';
import { validatePrompt } from '../core/utils';

/**
 * Storage adapter implementation that uses PostgreSQL
 */
export class PostgresAdapter implements StorageAdapter {
  private client: Client;
  private connected: boolean = false;
  
  /**
   * Create a new PostgresAdapter instance
   * @param connectionString PostgreSQL connection string
   */
  constructor(connectionString: string) {
    this.client = new Client({ connectionString });
  }
  
  /**
   * Connect to the PostgreSQL database and initialize tables
   */
  async connect(): Promise<void> {
    try {
      await this.client.connect();
      this.connected = true;
      
      // Create the prompts table if it doesn't exist
      await this.client.query(`
        CREATE TABLE IF NOT EXISTS prompts (
          id VARCHAR(255) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          content TEXT NOT NULL,
          is_template BOOLEAN NOT NULL DEFAULT FALSE,
          variables TEXT[],
          tags TEXT[],
          category VARCHAR(255),
          created_at TIMESTAMP WITH TIME ZONE NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
          version INTEGER NOT NULL DEFAULT 1
        )
      `);
    } catch (error: any) {
      throw new Error(`Failed to connect to PostgreSQL: ${error.message}`);
    }
  }
  
  /**
   * Disconnect from the PostgreSQL database
   */
  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.client.end();
      this.connected = false;
    }
  }
  
  /**
   * Get a prompt by ID
   * @param id Prompt ID
   * @returns Promise resolving to the prompt
   */
  async getPrompt(id: string): Promise<Prompt> {
    try {
      const result = await this.client.query(
        'SELECT * FROM prompts WHERE id = $1',
        [id]
      );
      
      if (result.rowCount === 0) {
        throw new Error(`Prompt not found: ${id}`);
      }
      
      const row = result.rows[0];
      const prompt: Prompt = {
        id: row.id,
        name: row.name,
        description: row.description,
        content: row.content,
        isTemplate: row.is_template,
        variables: row.variables,
        tags: row.tags,
        category: row.category,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
        version: row.version
      };
      
      if (!validatePrompt(prompt)) {
        throw new Error(`Invalid prompt data for ID: ${id}`);
      }
      
      return prompt;
    } catch (error: any) {
      throw new Error(`Failed to get prompt: ${error.message}`);
    }
  }
  
  /**
   * Save a prompt to the PostgreSQL database
   * @param prompt Prompt to save
   */
  async savePrompt(prompt: Prompt): Promise<void> {
    try {
      if (!validatePrompt(prompt)) {
        throw new Error('Invalid prompt data');
      }
      
      // Check if prompt already exists
      const existingResult = await this.client.query(
        'SELECT id FROM prompts WHERE id = $1',
        [prompt.id]
      );
      
      const exists = existingResult.rowCount ? existingResult.rowCount > 0 : false;
      
      if (exists) {
        // Update existing prompt
        await this.client.query(
          `UPDATE prompts 
           SET name = $1, description = $2, content = $3, is_template = $4, 
               variables = $5, tags = $6, category = $7, updated_at = $8, version = $9
           WHERE id = $10`,
          [
            prompt.name,
            prompt.description,
            prompt.content,
            prompt.isTemplate,
            prompt.variables,
            prompt.tags,
            prompt.category,
            new Date(prompt.updatedAt),
            prompt.version,
            prompt.id
          ]
        );
      } else {
        // Insert new prompt
        await this.client.query(
          `INSERT INTO prompts (
             id, name, description, content, is_template, variables, 
             tags, category, created_at, updated_at, version
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            prompt.id,
            prompt.name,
            prompt.description,
            prompt.content,
            prompt.isTemplate,
            prompt.variables,
            prompt.tags,
            prompt.category,
            new Date(prompt.createdAt),
            new Date(prompt.updatedAt),
            prompt.version
          ]
        );
      }
    } catch (error: any) {
      throw new Error(`Failed to save prompt: ${error.message}`);
    }
  }
  
  /**
   * List prompts with optional filtering
   * @param options Filtering and pagination options
   * @returns Promise resolving to an array of prompts
   */
  async listPrompts(options?: ListPromptsOptions): Promise<Prompt[]> {
    try {
      let query = 'SELECT * FROM prompts';
      const params: any[] = [];
      const conditions: string[] = [];
      
      // Build query conditions based on options
      if (options) {
        // Filter by isTemplate
        if (options.isTemplate !== undefined) {
          conditions.push(`is_template = $${params.length + 1}`);
          params.push(options.isTemplate);
        }
        
        // Filter by category
        if (options.category) {
          conditions.push(`category = $${params.length + 1}`);
          params.push(options.category);
        }
        
        // Filter by search term
        if (options.search) {
          conditions.push(`(
            name ILIKE $${params.length + 1} OR 
            description ILIKE $${params.length + 1} OR 
            content ILIKE $${params.length + 1}
          )`);
          params.push(`%${options.search}%`);
        }
        
        // Filter by tags (this is more complex in SQL)
        if (options.tags && options.tags.length > 0) {
          const tagConditions = options.tags.map((tag, i) => `tags @> ARRAY[$${params.length + i + 1}]::text[]`);
          conditions.push(`(${tagConditions.join(' OR ')})`);
          params.push(...options.tags);
        }
        
        // Add WHERE clause if we have conditions
        if (conditions.length > 0) {
          query += ` WHERE ${conditions.join(' AND ')}`;
        }
        
        // Add ORDER BY clause
        if (options.sort) {
          // Map sort field name to database column name
          const sortField = options.sort === 'isTemplate' ? 'is_template' : 
                          options.sort === 'createdAt' ? 'created_at' : 
                          options.sort === 'updatedAt' ? 'updated_at' : 
                          options.sort;
          
          query += ` ORDER BY ${sortField} ${options.order === 'desc' ? 'DESC' : 'ASC'}`;
        }
        
        // Add LIMIT and OFFSET for pagination
        if (options.limit !== undefined) {
          query += ` LIMIT $${params.length + 1}`;
          params.push(options.limit);
          
          if (options.offset !== undefined) {
            query += ` OFFSET $${params.length + 1}`;
            params.push(options.offset);
          }
        }
      }
      
      const result = await this.client.query(query, params);
      
      return result.rows.map(row => {
        const prompt: Prompt = {
          id: row.id,
          name: row.name,
          description: row.description,
          content: row.content,
          isTemplate: row.is_template,
          variables: row.variables,
          tags: row.tags,
          category: row.category,
          createdAt: row.created_at.toISOString(),
          updatedAt: row.updated_at.toISOString(),
          version: row.version
        };
        
        return prompt;
      });
    } catch (error: any) {
      throw new Error(`Failed to list prompts: ${error.message}`);
    }
  }
  
  /**
   * Delete a prompt by ID
   * @param id Prompt ID to delete
   */
  async deletePrompt(id: string): Promise<void> {
    try {
      const result = await this.client.query(
        'DELETE FROM prompts WHERE id = $1',
        [id]
      );
      
      if (result.rowCount === 0) {
        throw new Error(`Prompt not found: ${id}`);
      }
    } catch (error: any) {
      throw new Error(`Failed to delete prompt: ${error.message}`);
    }
  }
}