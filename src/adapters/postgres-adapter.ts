import { Pool, PoolClient } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { Prompt, StorageAdapter, ListPromptsOptions } from '../core/types.js';

/**
 * PostgreSQL Adapter
 * Implements the StorageAdapter interface for PostgreSQL-based storage
 */

/**
 * PostgreSQL-based storage adapter
 */
export class PostgresAdapter implements StorageAdapter {
  private pool: Pool;
  private _isConnected: boolean = false;
  private schemaInitialized: boolean = false;
  
  /**
   * Create a new PostgreSQL adapter
   * @param connectionString PostgreSQL connection string
   */
  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      // Increase statement timeout to allow for schema initialization
      statement_timeout: 30000,
    });
    
    // Handle pool errors to prevent app crashes
    this.pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
    });
  }
  
  /**
   * Connect to the PostgreSQL database
   */
  async connect(): Promise<void> {
    try {
      // Test connection and ensure schema is initialized
      const client = await this.pool.connect();
      try {
        // Test connection is working
        await client.query('SELECT NOW()');
        console.log('Connected to PostgreSQL database');
        this._isConnected = true;
        
        // Initialize schema if not already done
        if (!this.schemaInitialized) {
          await this.initializeSchema(client);
          this.schemaInitialized = true;
        }
      } finally {
        client.release();
      }
    } catch (error) {
      this._isConnected = false;
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to connect to PostgreSQL: ${errorMessage}`);
    }
  }
  
  /**
   * Disconnect from the PostgreSQL database
   */
  async disconnect(): Promise<void> {
    try {
      await this.pool.end();
      this._isConnected = false;
      console.log('Disconnected from PostgreSQL database');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to disconnect from PostgreSQL: ${errorMessage}`);
    }
  }
  
  /**
   * Check if connected to the database
   * @returns Promise that resolves to true if connected, false otherwise
   */
  async isConnected(): Promise<boolean> {
    if (!this._isConnected) return false;
    
    try {
      const client = await this.pool.connect();
      try {
        await client.query('SELECT 1');
        return true;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('PostgreSQL connection check failed:', error);
      this._isConnected = false;
      return false;
    }
  }
  
  /**
   * Initialize the database schema
   * @param client PostgreSQL client
   */
  private async initializeSchema(client: PoolClient): Promise<void> {
    try {
      // Start transaction
      await client.query('BEGIN');
      
      // Create prompts table
      await client.query(`
        CREATE TABLE IF NOT EXISTS prompts (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          content TEXT NOT NULL,
          is_template BOOLEAN NOT NULL DEFAULT FALSE,
          variables JSONB,
          tags TEXT[],
          category TEXT,
          created_at TIMESTAMP WITH TIME ZONE NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
          version INTEGER NOT NULL DEFAULT 1,
          metadata JSONB
        )
      `);
      
      // Create index for faster searches
      await client.query('CREATE INDEX IF NOT EXISTS idx_prompts_name ON prompts (name)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_prompts_category ON prompts (category)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_prompts_is_template ON prompts (is_template)');
      
      // Commit transaction
      await client.query('COMMIT');
      
      console.log('PostgreSQL schema initialized');
    } catch (error) {
      // Rollback transaction
      await client.query('ROLLBACK');
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to initialize PostgreSQL schema: ${errorMessage}`);
    }
  }
  
  /**
   * Save a prompt to the database
   * @param prompt Prompt to save
   * @returns The saved prompt
   */
  async savePrompt(prompt: Partial<Prompt>): Promise<Prompt> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      
      // Ensure the prompt has an ID
      if (!prompt.id) {
        prompt.id = uuidv4();
      }
      
      // Create timestamps if not provided
      const now = new Date().toISOString();
      if (!prompt.createdAt) {
        prompt.createdAt = now;
      }
      if (!prompt.updatedAt) {
        prompt.updatedAt = now;
      }
      
      // Extract variables if needed and convert to complete Prompt
      const fullPrompt = prompt as Prompt;
      
      // Insert prompt into prompts table
      const insertPromptQuery = `
        INSERT INTO prompts (
          id, name, description, content, is_template, created_at, updated_at, 
          category, version, metadata
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
        ) ON CONFLICT (id) DO UPDATE SET
          name = $2,
          description = $3,
          content = $4,
          is_template = $5,
          updated_at = $7,
          category = $8,
          version = $9,
          metadata = $10
        RETURNING *
      `;
      
      const promptResult = await client.query(insertPromptQuery, [
        fullPrompt.id,
        fullPrompt.name,
        fullPrompt.description || null,
        fullPrompt.content,
        fullPrompt.isTemplate || false,
        fullPrompt.createdAt,
        fullPrompt.updatedAt,
        fullPrompt.category || null,
        fullPrompt.version || 1,
        fullPrompt.metadata ? JSON.stringify(fullPrompt.metadata) : null
      ]);
      
      // Handle tags
      if (fullPrompt.tags && fullPrompt.tags.length > 0) {
        // Delete existing tags
        await client.query('DELETE FROM prompt_tags WHERE prompt_id = $1', [fullPrompt.id]);
        
        // Insert new tags
        for (const tag of fullPrompt.tags) {
          await client.query(
            'INSERT INTO prompt_tags (prompt_id, tag) VALUES ($1, $2)',
            [fullPrompt.id, tag]
          );
        }
      }
      
      // Handle variables
      if (fullPrompt.variables && fullPrompt.variables.length > 0) {
        // Delete existing variables
        await client.query('DELETE FROM prompt_variables WHERE prompt_id = $1', [fullPrompt.id]);
        
        // Insert new variables
        for (const variable of fullPrompt.variables) {
          await client.query(
            `INSERT INTO prompt_variables 
              (prompt_id, name, description, default_value, required, type) 
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              fullPrompt.id,
              variable.name,
              variable.description || null,
              variable.default || null,
              variable.required || false,
              variable.type || 'string'
            ]
          );
        }
      }
      
      await client.query('COMMIT');
      
      // Fetch the complete prompt with all relations
      return await this.getPrompt(fullPrompt.id);
    } catch (error) {
      await client.query('ROLLBACK');
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to save prompt: ${errorMessage}`);
    } finally {
      client.release();
    }
  }
  
  /**
   * Update a prompt in the database
   * @param id Prompt ID
   * @param updates Partial prompt data to update
   * @returns The updated prompt
   */
  async updatePrompt(id: string, updates: Partial<Prompt>): Promise<Prompt> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      
      // Get existing prompt to merge with updates
      const existingPrompt = await this.getPrompt(id);
      
      // Update timestamps
      const now = new Date().toISOString();
      updates.updatedAt = now;
      
      // Merge updates with existing prompt
      const updatedPrompt = { ...existingPrompt, ...updates };
      
      // Update prompt in prompts table
      const updatePromptQuery = `
        UPDATE prompts SET
          name = $2,
          description = $3,
          content = $4,
          is_template = $5,
          updated_at = $6,
          category = $7,
          version = $8,
          metadata = $9
        WHERE id = $1
        RETURNING *
      `;
      
      await client.query(updatePromptQuery, [
        id,
        updatedPrompt.name,
        updatedPrompt.description || null,
        updatedPrompt.content,
        updatedPrompt.isTemplate || false,
        updatedPrompt.updatedAt,
        updatedPrompt.category || null,
        (existingPrompt.version || 0) + 1, // Increment version
        updatedPrompt.metadata ? JSON.stringify(updatedPrompt.metadata) : null
      ]);
      
      // Handle tags
      if (updates.tags !== undefined) {
        // Delete existing tags
        await client.query('DELETE FROM prompt_tags WHERE prompt_id = $1', [id]);
        
        // Insert new tags
        if (updatedPrompt.tags && updatedPrompt.tags.length > 0) {
          for (const tag of updatedPrompt.tags) {
            await client.query(
              'INSERT INTO prompt_tags (prompt_id, tag) VALUES ($1, $2)',
              [id, tag]
            );
          }
        }
      }
      
      // Handle variables
      if (updates.variables !== undefined) {
        // Delete existing variables
        await client.query('DELETE FROM prompt_variables WHERE prompt_id = $1', [id]);
        
        // Insert new variables
        if (updatedPrompt.variables && updatedPrompt.variables.length > 0) {
          for (const variable of updatedPrompt.variables) {
            await client.query(
              `INSERT INTO prompt_variables 
                (prompt_id, name, description, default_value, required, type) 
               VALUES ($1, $2, $3, $4, $5, $6)`,
              [
                id,
                variable.name,
                variable.description || null,
                variable.default || null,
                variable.required || false,
                variable.type || 'string'
              ]
            );
          }
        }
      }
      
      await client.query('COMMIT');
      
      // Fetch the complete updated prompt with all relations
      return await this.getPrompt(id);
    } catch (error) {
      await client.query('ROLLBACK');
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to update prompt: ${errorMessage}`);
    } finally {
      client.release();
    }
  }
  
  /**
   * Get a prompt by ID
   * @param id Prompt ID
   * @returns The prompt
   */
  async getPrompt(id: string): Promise<Prompt> {
    try {
      const result = await this.pool.query('SELECT * FROM prompts WHERE id = $1', [id]);
      
      if (result.rows.length === 0) {
        throw new Error(`Prompt with ID ${id} not found`);
      }
      
      return this.rowToPrompt(result.rows[0]);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to get prompt from PostgreSQL: ${errorMessage}`);
    }
  }
  
  /**
   * List prompts with filtering options
   * @param options Filtering options
   * @returns Array of prompts matching options
   */
  async listPrompts(options?: ListPromptsOptions): Promise<Prompt[]> {
    try {
      // Build the query based on options
      let query = 'SELECT * FROM prompts';
      const conditions: string[] = [];
      const values: any[] = [];
      
      if (options) {
        // Filter by template status
        if (options.isTemplate !== undefined) {
          conditions.push(`is_template = $${values.length + 1}`);
          values.push(options.isTemplate);
        }
        
        // Filter by category
        if (options.category) {
          conditions.push(`category = $${values.length + 1}`);
          values.push(options.category);
        }
        
        // Filter by tags (all specified tags must be present)
        if (options.tags && options.tags.length > 0) {
          conditions.push(`tags @> $${values.length + 1}`);
          values.push(JSON.stringify(options.tags));
        }
        
        // Filter by search term
        if (options.search) {
          conditions.push(`(
            name ILIKE $${values.length + 1} OR
            description ILIKE $${values.length + 1} OR
            content ILIKE $${values.length + 1}
          )`);
          values.push(`%${options.search}%`);
        }
        
        // Add conditions to query
        if (conditions.length > 0) {
          query += ' WHERE ' + conditions.join(' AND ');
        }
        
        // Add sorting
        if (options.sort) {
          // Map camelCase to snake_case for PostgreSQL
          const sortField = this.camelToSnake(options.sort);
          const order = options.order === 'desc' ? 'DESC' : 'ASC';
          query += ` ORDER BY ${sortField} ${order}`;
        } else {
          // Default sort by updated_at
          query += ' ORDER BY updated_at DESC';
        }
        
        // Add pagination
        if (options.limit !== undefined) {
          query += ` LIMIT $${values.length + 1}`;
          values.push(options.limit);
          
          if (options.offset !== undefined) {
            query += ` OFFSET $${values.length + 1}`;
            values.push(options.offset);
          }
        }
      } else {
        // Default sort by updated_at
        query += ' ORDER BY updated_at DESC';
      }
      
      const result = await this.pool.query(query, values);
      return result.rows.map(row => this.rowToPrompt(row));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to list prompts from PostgreSQL: ${errorMessage}`);
    }
  }
  
  /**
   * Delete a prompt
   * @param id Prompt ID
   */
  async deletePrompt(id: string): Promise<void> {
    try {
      const result = await this.pool.query('DELETE FROM prompts WHERE id = $1', [id]);
      
      if (result.rowCount === 0) {
        throw new Error(`Prompt with ID ${id} not found`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to delete prompt from PostgreSQL: ${errorMessage}`);
    }
  }
  
  /**
   * Get all prompts from storage
   * @returns Array of all prompts
   */
  async getAllPrompts(): Promise<Prompt[]> {
    try {
      const result = await this.pool.query('SELECT * FROM prompts ORDER BY updated_at DESC');
      return result.rows.map(row => this.rowToPrompt(row));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to get all prompts from PostgreSQL: ${errorMessage}`);
    }
  }
  
  /**
   * Clear all prompts from storage
   */
  async clearAll(): Promise<void> {
    try {
      await this.pool.query('DELETE FROM prompts');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to clear all prompts from PostgreSQL: ${errorMessage}`);
    }
  }
  
  /**
   * Convert a database row to a Prompt object
   * @param row Database row
   * @returns Prompt object
   */
  private rowToPrompt(row: any): Prompt {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      content: row.content,
      isTemplate: row.is_template,
      variables: row.variables ? row.variables : undefined,
      tags: row.tags ? row.tags : undefined,
      category: row.category,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      version: row.version,
      metadata: row.metadata ? row.metadata : undefined
    };
  }
  
  /**
   * Convert camelCase to snake_case
   * @param str String in camelCase
   * @returns String in snake_case
   */
  private camelToSnake(str: string): string {
    return str.replace(/([A-Z])/g, '_$1').toLowerCase();
  }
}