import { Pool } from 'pg';
import { Prompt, PromptStorage, ListPromptOptions } from '../types';

// Import pgai functionality
// Note: You'll need to install these packages with:
// npm install pg pgai @types/pg
interface PgAIClient {
  createEmbedding(text: string): Promise<{ embedding: any }>;
  initVectorStorage(tableName: string, contentColumn: string, embeddingColumn: string): Promise<void>;
}

// Mock implementation until the real pgai package is installed
function createPgAIClient(pool: Pool): PgAIClient {
  return {
    createEmbedding: async (text: string) => ({ embedding: [] }),
    initVectorStorage: async (tableName: string, contentColumn: string, embeddingColumn: string) => {}
  };
}

export class PgAIStorageProvider implements PromptStorage {
  private client: PgAIClient;
  private pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
    this.client = createPgAIClient(this.pool);
    this.initializeSchema();
  }

  private async initializeSchema(): Promise<void> {
    try {
      // Create necessary tables and indices
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS prompts (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          content TEXT NOT NULL,
          description TEXT,
          tags TEXT[],
          metadata JSONB,
          is_template BOOLEAN DEFAULT FALSE,
          variables TEXT[],
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          version INTEGER DEFAULT 1,
          embedding vector(1536)
        );
        
        CREATE INDEX IF NOT EXISTS prompts_tags_idx ON prompts USING GIN (tags);
        CREATE INDEX IF NOT EXISTS prompts_is_template_idx ON prompts (is_template);
      `);
      
      // Set up vector storage if PGAI supports it
      await this.client.initVectorStorage('prompts', 'content', 'embedding');
      console.log('Database schema initialized successfully');
    } catch (error) {
      console.error('Error initializing database schema:', error);
      throw error;
    }
  }

  async getPrompt(id: string): Promise<Prompt | null> {
    try {
      const result = await this.pool.query(
        'SELECT * FROM prompts WHERE id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return this.rowToPrompt(row);
    } catch (error) {
      console.error(`Error getting prompt ${id}:`, error);
      throw error;
    }
  }
  
  async listPrompts(options?: ListPromptOptions): Promise<Prompt[]> {
    try {
      let queryText = 'SELECT * FROM prompts';
      const queryParams: any[] = [];
      const conditions: string[] = [];

      // Filter by tags if provided
      if (options?.tags && options.tags.length > 0) {
        conditions.push('tags && $1');
        queryParams.push(options.tags);
      }

      // Filter by template status if provided
      if (options?.templatesOnly !== undefined) {
        conditions.push('is_template = $' + (queryParams.length + 1));
        queryParams.push(options.templatesOnly);
      }

      // Add WHERE clause if there are conditions
      if (conditions.length > 0) {
        queryText += ' WHERE ' + conditions.join(' AND ');
      }

      // Add sorting
      queryText += ' ORDER BY name ASC';

      const result = await this.pool.query(queryText, queryParams);
      return result.rows.map((row: any) => this.rowToPrompt(row));
    } catch (error) {
      console.error('Error listing prompts:', error);
      throw error;
    }
  }
  
  async addPrompt(prompt: Prompt): Promise<void> {
    try {
      // Generate embedding for the prompt content
      const embeddingResult = await this.client.createEmbedding(prompt.content);
      const embedding = embeddingResult.embedding;

      await this.pool.query(
        `INSERT INTO prompts (
          id, name, content, description, tags, is_template, variables, 
          created_at, updated_at, version, embedding, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (id) DO UPDATE SET
          name = $2,
          content = $3,
          description = $4,
          tags = $5,
          is_template = $6,
          variables = $7,
          updated_at = $9,
          version = $10,
          embedding = $11,
          metadata = $12`,
        [
          prompt.id,
          prompt.name,
          prompt.content,
          prompt.description,
          prompt.tags,
          prompt.isTemplate,
          prompt.variables,
          prompt.createdAt,
          prompt.updatedAt,
          prompt.version,
          embedding,
          prompt.metadata || {}
        ]
      );
    } catch (error) {
      console.error(`Error adding prompt ${prompt.id}:`, error);
      throw error;
    }
  }
  
  async deletePrompt(id: string): Promise<boolean> {
    try {
      const result = await this.pool.query(
        'DELETE FROM prompts WHERE id = $1 RETURNING id',
        [id]
      );
      return result.rowCount > 0;
    } catch (error) {
      console.error(`Error deleting prompt ${id}:`, error);
      throw error;
    }
  }

  async searchPromptsByContent(query: string, limit: number = 10): Promise<Prompt[]> {
    try {
      // Create an embedding for the search query
      const queryEmbedding = await this.client.createEmbedding(query);
      
      // Perform vector similarity search
      const searchResult = await this.pool.query(
        `SELECT *, 
         (embedding <=> $1) AS distance 
         FROM prompts 
         ORDER BY distance 
         LIMIT $2`,
        [queryEmbedding.embedding, limit]
      );
      
      return searchResult.rows.map((row: any) => this.rowToPrompt(row));
    } catch (error) {
      console.error('Error searching prompts by content:', error);
      throw error;
    }
  }

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
      metadata: row.metadata
    };
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
} 