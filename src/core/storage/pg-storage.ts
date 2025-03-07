import { Pool } from 'pg';
import { Prompt, PromptStorage, ListPromptOptions } from '../types';

/**
 * PostgreSQL storage provider for prompts
 * Implements the PromptStorage interface using a PostgreSQL database
 */
export class PostgreSQLStorageProvider implements PromptStorage {
  private pool: Pool;

  /**
   * Create a new PostgreSQL storage provider
   * @param connectionString Connection string for PostgreSQL
   */
  constructor(connectionString: string) {
    this.pool = new Pool({ 
      connectionString,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    this.initializeSchema();
  }

  /**
   * Initialize the database schema, creating necessary tables if they don't exist
   */
  private async initializeSchema(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS prompts (
          id VARCHAR PRIMARY KEY,
          name VARCHAR NOT NULL,
          description VARCHAR,
          content TEXT NOT NULL,
          is_template BOOLEAN NOT NULL,
          variables VARCHAR[],
          tags VARCHAR[],
          category VARCHAR NOT NULL DEFAULT 'development',
          created_at TIMESTAMPTZ NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL,
          version INTEGER NOT NULL,
          usage_count INTEGER DEFAULT 0,
          last_used TIMESTAMPTZ,
          metadata JSONB
        );
        
        -- Create indices for common query patterns
        CREATE INDEX IF NOT EXISTS prompts_tags_idx ON prompts USING GIN (tags);
        CREATE INDEX IF NOT EXISTS prompts_category_idx ON prompts (category);
        CREATE INDEX IF NOT EXISTS prompts_template_idx ON prompts (is_template);
        CREATE INDEX IF NOT EXISTS prompts_usage_count_idx ON prompts (usage_count DESC);
      `);
      console.log('PostgreSQL: Database schema initialized successfully');
    } catch (error) {
      console.error('PostgreSQL: Error initializing database schema:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get a prompt by ID
   * @param id Prompt ID
   * @returns The prompt or null if not found
   */
  async getPrompt(id: string): Promise<Prompt | null> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM prompts WHERE id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.rowToPrompt(result.rows[0]);
    } catch (error) {
      console.error(`PostgreSQL: Error getting prompt ${id}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }
  
  /**
   * List prompts with optional filtering
   * @param options Filter options
   * @returns Array of prompts
   */
  async listPrompts(options?: ListPromptOptions): Promise<Prompt[]> {
    const client = await this.pool.connect();
    try {
      let queryText = 'SELECT * FROM prompts';
      const queryParams: any[] = [];
      const conditions: string[] = [];

      // Filter by tags if provided
      if (options?.tags && options.tags.length > 0) {
        conditions.push('tags && $' + (queryParams.length + 1));
        queryParams.push(options.tags);
      }

      // Filter by template status if provided
      if (options?.templatesOnly !== undefined) {
        conditions.push('is_template = $' + (queryParams.length + 1));
        queryParams.push(options.templatesOnly);
      }

      // Filter by category if provided
      if (options?.category) {
        conditions.push('category = $' + (queryParams.length + 1));
        queryParams.push(options.category);
      }

      // Add WHERE clause if there are conditions
      if (conditions.length > 0) {
        queryText += ' WHERE ' + conditions.join(' AND ');
      }

      // Add sorting
      queryText += ' ORDER BY name ASC';

      const result = await client.query(queryText, queryParams);
      return result.rows.map(row => this.rowToPrompt(row));
    } catch (error) {
      console.error('PostgreSQL: Error listing prompts:', error);
      throw error;
    } finally {
      client.release();
    }
  }
  
  /**
   * Add or update a prompt
   * @param prompt The prompt to save
   */
  async addPrompt(prompt: Prompt): Promise<void> {
    const client = await this.pool.connect();
    try {
      // Default the category to 'development' if not specified
      const category = prompt.category || 'development';
      
      // Set default values for usage analytics if not provided
      const usageCount = prompt.usageCount || 0;
      const lastUsed = prompt.lastUsed || null;
      
      const query = {
        text: `
          INSERT INTO prompts (
            id, name, description, content, is_template, variables, tags,
            category, created_at, updated_at, version, usage_count, last_used, metadata
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
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
            usage_count = $12,
            last_used = $13,
            metadata = $14
        `,
        values: [
          prompt.id,
          prompt.name,
          prompt.description,
          prompt.content,
          prompt.isTemplate,
          prompt.variables || [],
          prompt.tags || [],
          category,
          prompt.createdAt,
          prompt.updatedAt,
          prompt.version,
          usageCount,
          lastUsed,
          prompt.metadata || {}
        ]
      };
      
      await client.query(query);
    } catch (error) {
      console.error(`PostgreSQL: Error adding prompt ${prompt.id}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }
  
  /**
   * Delete a prompt
   * @param id Prompt ID
   * @returns True if a prompt was deleted, false otherwise
   */
  async deletePrompt(id: string): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'DELETE FROM prompts WHERE id = $1 RETURNING id',
        [id]
      );
      return result.rowCount ? result.rowCount > 0 : false;
    } catch (error) {
      console.error(`PostgreSQL: Error deleting prompt ${id}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Increment usage count and update last used timestamp
   * @param id Prompt ID
   */
  async incrementUsage(id: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(
        'UPDATE prompts SET usage_count = usage_count + 1, last_used = NOW() WHERE id = $1',
        [id]
      );
    } catch (error) {
      console.error(`PostgreSQL: Error incrementing usage for prompt ${id}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get prompt usage analytics
   * @returns Array of prompt analytics data
   */
  async getPromptAnalytics(): Promise<{ id: string, name: string, usageCount: number, lastUsed: string | Date }[]> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'SELECT id, name, usage_count, last_used FROM prompts ORDER BY usage_count DESC'
      );
      return result.rows.map(row => ({
        id: row.id,
        name: row.name,
        usageCount: row.usage_count,
        lastUsed: row.last_used
      }));
    } catch (error) {
      console.error('PostgreSQL: Error getting prompt analytics:', error);
      throw error;
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
      content: row.content,
      description: row.description,
      tags: row.tags,
      isTemplate: row.is_template,
      variables: row.variables,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      version: row.version,
      category: row.category,
      usageCount: row.usage_count,
      lastUsed: row.last_used,
      metadata: row.metadata
    };
  }

  /**
   * Close database connections
   */
  async close(): Promise<void> {
    await this.pool.end();
  }
} 