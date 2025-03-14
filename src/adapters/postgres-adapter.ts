import { Pool } from 'pg';
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
  private connected: boolean = false;
  
  /**
   * Create a new PostgreSQL adapter
   * @param connectionString PostgreSQL connection string
   */
  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    });
  }
  
  /**
   * Connect to the PostgreSQL database
   */
  async connect(): Promise<void> {
    // Test connection
    const client = await this.pool.connect();
    try {
      // Create table if it doesn't exist
      await client.query(`
        CREATE TABLE IF NOT EXISTS prompts (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          content TEXT NOT NULL,
          is_template BOOLEAN NOT NULL DEFAULT FALSE,
          variables TEXT[],
          tags TEXT[],
          category TEXT,
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          version INTEGER NOT NULL DEFAULT 1
        );
      `);
      
      // Create index on name for faster searches
      await client.query(`
        CREATE INDEX IF NOT EXISTS prompts_name_idx ON prompts (name);
      `);
      
      // Create index on category for faster filtering
      await client.query(`
        CREATE INDEX IF NOT EXISTS prompts_category_idx ON prompts (category);
      `);
      
      this.connected = true;
      console.log('Connected to PostgreSQL database');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to connect to PostgreSQL database: ${errorMessage}`);
    } finally {
      client.release();
    }
  }
  
  /**
   * Disconnect from the PostgreSQL database
   */
  async disconnect(): Promise<void> {
    await this.pool.end();
    this.connected = false;
    console.log('Disconnected from PostgreSQL database');
  }
  
  /**
   * Save a prompt to the PostgreSQL database
   * @param prompt Prompt to save
   */
  async savePrompt(prompt: Prompt): Promise<void> {
    if (!this.connected) {
      throw new Error('Not connected to database');
    }
    
    const client = await this.pool.connect();
    try {
      // Check if prompt exists
      const checkResult = await client.query(
        'SELECT id FROM prompts WHERE id = $1',
        [prompt.id]
      );
      
      // If prompt exists, update it
      if (checkResult.rowCount && checkResult.rowCount > 0) {
        await client.query(
          `
          UPDATE prompts SET
            name = $1,
            description = $2,
            content = $3,
            is_template = $4,
            variables = $5,
            tags = $6,
            category = $7,
            updated_at = NOW(),
            version = version + 1
          WHERE id = $8
          `,
          [
            prompt.name,
            prompt.description || null,
            prompt.content,
            prompt.isTemplate,
            prompt.variables || null,
            prompt.tags || null,
            prompt.category || null,
            prompt.id
          ]
        );
      } else {
        // Otherwise, insert a new prompt
        await client.query(
          `
          INSERT INTO prompts (
            id, name, description, content, is_template, variables, tags, category, created_at, updated_at, version
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
          )
          `,
          [
            prompt.id || uuidv4(),
            prompt.name,
            prompt.description || null,
            prompt.content,
            prompt.isTemplate,
            prompt.variables || null,
            prompt.tags || null,
            prompt.category || null,
            prompt.createdAt || new Date().toISOString(),
            prompt.updatedAt || new Date().toISOString(),
            prompt.version || 1
          ]
        );
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to save prompt: ${errorMessage}`);
    } finally {
      client.release();
    }
  }
  
  /**
   * Get a prompt from the PostgreSQL database
   * @param id Prompt ID
   * @returns The prompt
   */
  async getPrompt(id: string): Promise<Prompt> {
    if (!this.connected) {
      throw new Error('Not connected to database');
    }
    
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM prompts WHERE id = $1',
        [id]
      );
      
      if (result.rows.length === 0) {
        throw new Error(`Prompt with ID ${id} not found`);
      }
      
      return this.rowToPrompt(result.rows[0]);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to get prompt: ${errorMessage}`);
    } finally {
      client.release();
    }
  }
  
  /**
   * List prompts from the PostgreSQL database
   * @param options Options for filtering and sorting
   * @returns Array of prompts
   */
  async listPrompts(options?: ListPromptsOptions): Promise<Prompt[]> {
    if (!this.connected) {
      throw new Error('Not connected to database');
    }
    
    const client = await this.pool.connect();
    try {
      let query = 'SELECT * FROM prompts';
      const params: any[] = [];
      const conditions: string[] = [];
      
      // Apply filters
      if (options) {
        // Filter by template status
        if (options.isTemplate !== undefined) {
          conditions.push(`is_template = $${params.length + 1}`);
          params.push(options.isTemplate);
        }
        
        // Filter by category
        if (options.category) {
          conditions.push(`category = $${params.length + 1}`);
          params.push(options.category);
        }
        
        // Filter by tags
        if (options.tags && options.tags.length > 0) {
          conditions.push(`tags @> $${params.length + 1}`);
          params.push(options.tags);
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
        
        // Add WHERE clause if there are conditions
        if (conditions.length > 0) {
          query += ' WHERE ' + conditions.join(' AND ');
        }
        
        // Add ORDER BY clause
        if (options.sort) {
          const sortField = this.snakeCaseField(options.sort);
          const sortOrder = options.order === 'desc' ? 'DESC' : 'ASC';
          query += ` ORDER BY ${sortField} ${sortOrder}`;
        } else {
          // Default sort by updated_at
          query += ' ORDER BY updated_at DESC';
        }
        
        // Add LIMIT and OFFSET
        if (options.limit) {
          query += ` LIMIT $${params.length + 1}`;
          params.push(options.limit);
        }
        
        if (options.offset) {
          query += ` OFFSET $${params.length + 1}`;
          params.push(options.offset);
        }
      } else {
        // Default sort by updated_at
        query += ' ORDER BY updated_at DESC';
      }
      
      const result = await client.query(query, params);
      
      return result.rows.map(row => this.rowToPrompt(row));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to list prompts: ${errorMessage}`);
    } finally {
      client.release();
    }
  }
  
  /**
   * Delete a prompt from the PostgreSQL database
   * @param id Prompt ID
   */
  async deletePrompt(id: string): Promise<void> {
    if (!this.connected) {
      throw new Error('Not connected to database');
    }
    
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'DELETE FROM prompts WHERE id = $1',
        [id]
      );
      
      if (result.rowCount === 0) {
        throw new Error(`Prompt with ID ${id} not found`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to delete prompt: ${errorMessage}`);
    } finally {
      client.release();
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
      variables: row.variables,
      tags: row.tags,
      category: row.category,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      version: row.version
    };
  }
  
  /**
   * Convert a camelCase field name to snake_case for PostgreSQL
   * @param field Field name in camelCase
   * @returns Field name in snake_case
   */
  private snakeCaseField(field: string): string {
    return field.replace(/([A-Z])/g, '_$1').toLowerCase();
  }
}