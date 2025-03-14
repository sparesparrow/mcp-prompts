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
   */
  async savePrompt(prompt: Prompt): Promise<void> {
    try {
      // Generate an ID if not provided
      if (!prompt.id) {
        prompt.id = uuidv4();
      }
      
      // Convert camelCase to snake_case for PostgreSQL
      const values = [
        prompt.id,
        prompt.name,
        prompt.description || null,
        prompt.content,
        prompt.isTemplate || false,
        prompt.variables ? JSON.stringify(prompt.variables) : null,
        prompt.tags ? JSON.stringify(prompt.tags) : null,
        prompt.category || null,
        prompt.createdAt,
        prompt.updatedAt,
        prompt.version || 1,
        prompt.metadata ? JSON.stringify(prompt.metadata) : null
      ];
      
      // Insert or update (upsert) the prompt
      await this.pool.query(`
        INSERT INTO prompts (
          id, name, description, content, is_template, variables, tags, 
          category, created_at, updated_at, version, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (id) DO UPDATE SET
          name = $2,
          description = $3,
          content = $4,
          is_template = $5,
          variables = $6,
          tags = $7,
          category = $8,
          updated_at = $10,
          version = $11,
          metadata = $12
      `, values);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to save prompt to PostgreSQL: ${errorMessage}`);
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