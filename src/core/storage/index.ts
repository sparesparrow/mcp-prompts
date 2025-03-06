import { Config, FileStorageConfig, PgAIStorageConfig } from '../config';
import { PromptStorage } from '../types';
import { FileStorageProvider } from './file-storage';
import { PgAIStorageProvider } from './pgai-storage';

/**
 * Creates the appropriate storage provider based on config
 */
export function createStorageProvider(config: Config): PromptStorage {
  // Type guard to check for PGAI config
  function isPgAIConfig(config: any): config is PgAIStorageConfig {
    return config.type === 'pgai';
  }

  // Type guard to check for file config
  function isFileConfig(config: any): config is FileStorageConfig {
    return config.type === 'file';
  }

  const storageConfig = config.storage;

  if (isPgAIConfig(storageConfig)) {
    console.log('Using PGAI storage provider');
    const pgOptions = storageConfig.options;
    return new PgAIStorageProvider(pgOptions.connectionString);
  } else if (isFileConfig(storageConfig)) {
    console.log('Using file storage provider');
    const fileOptions = storageConfig.options;
    return new FileStorageProvider(fileOptions.baseDir);
  } else {
    throw new Error(`Unsupported storage type: ${(storageConfig as any).type}`);
  }
}

// Re-export storage providers
export { FileStorageProvider } from './file-storage';
export { PgAIStorageProvider } from './pgai-storage'; 