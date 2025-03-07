import { PromptStorage } from '../types';
import { FileStorageProvider } from './file-storage';
import { PgAIStorageProvider } from './pgai-storage';
import { PostgreSQLStorageProvider } from './pg-storage';

/**
 * Create a prompt storage provider based on the configuration
 * @param options Configuration options
 * @returns A prompt storage provider
 */
export function createStorageProvider(options: {
  storageType?: string;
  promptsDir?: string;
  databaseUrl?: string;
}): PromptStorage {
  const { storageType, promptsDir, databaseUrl } = options;
  
  // Log storage configuration (without sensitive details)
  console.log(`Creating storage provider of type: ${storageType || 'file'}`);
  
  // Create the appropriate storage provider
  switch (storageType?.toLowerCase()) {
    case 'pgai':
      if (!databaseUrl) {
        throw new Error('DATABASE_URL environment variable is required for PGAI storage');
      }
      return new PgAIStorageProvider(databaseUrl);
    
    case 'postgres':
    case 'postgresql':
      if (!databaseUrl) {
        throw new Error('DATABASE_URL environment variable is required for PostgreSQL storage');
      }
      return new PostgreSQLStorageProvider(databaseUrl);
    
    case 'file':
    default:
      return new FileStorageProvider(promptsDir || './prompts');
  }
}

// Re-export storage providers
export { FileStorageProvider } from './file-storage';
export { PgAIStorageProvider } from './pgai-storage';
export { PostgreSQLStorageProvider } from './pg-storage'; 