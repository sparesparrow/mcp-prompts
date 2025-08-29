import { Pool } from 'pg';
import type { Prompt, PromptId, IPromptRepository } from '@sparesparrow/mcp-prompts-core';

export class PostgresPromptRepository implements IPromptRepository {
  private pool: Pool;

  constructor(pool?: Pool) {
    this.pool = pool || new Pool({
      connectionString: process.env.PG_URL || 'postgres://postgres:postgres@localhost:5432/mcp',
    });
  }

  async save(prompt: Prompt): Promise<void> {
    // TODO: Upsert prompt (včetně pgvector sloupce)
    throw new Error('Not implemented');
  }

  async findById(id: PromptId): Promise<Prompt | null> {
    // TODO: Select prompt by id
    throw new Error('Not implemented');
  }

  async findAll(): Promise<Prompt[]> {
    // TODO: Select all prompts
    throw new Error('Not implemented');
  }

  async update(id: PromptId, update: Partial<Prompt>): Promise<void> {
    // TODO: Update prompt by id
    throw new Error('Not implemented');
  }

  async delete(id: PromptId): Promise<void> {
    // TODO: Delete prompt by id
    throw new Error('Not implemented');
  }
}

// TODO: migrace schématu (drizzle-kit), testcontainers, pgvector, indexy
