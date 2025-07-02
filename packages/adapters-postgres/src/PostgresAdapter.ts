import pg from 'pg';
import type { Prompt, PromptSequence, WorkflowExecutionState, ListPromptsOptions } from '@core/interfaces';
import type { IPromptRepository, ISequenceRepository, IWorkflowRepository } from '@core/ports/IPromptRepository';

function sanitizePromptMetadata<T extends { metadata?: any }>(prompt: T): T {
  if ('metadata' in prompt && prompt.metadata === null) {
    return { ...prompt, metadata: undefined };
  }
  return prompt;
}

export class PostgresAdapter implements IPromptRepository, ISequenceRepository, IWorkflowRepository {
  private pool: pg.Pool;
  private connected = false;
  private config: pg.PoolConfig;
  private maxRetries = 5;
  private retryDelay = 1000; // 1 second

  public constructor(config: pg.PoolConfig) {
    this.config = {
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000, // 10-second timeout
      ...config,
    };
    this.pool = new pg.Pool(this.config);
  }

  // ... (rest of PostgresAdapter implementation from src/adapters.ts) ...
} 