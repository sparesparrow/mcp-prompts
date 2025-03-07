# MCP Prompts Server - Storage Adapters

This document describes the storage adapter architecture in the MCP Prompts Server and provides details on the implemented file-based storage as well as plans for future adapters.

## Storage Adapter Architecture

The MCP Prompts Server uses a storage adapter pattern to abstract the persistence layer from the business logic. This allows for different storage implementations while maintaining the same interface.

### StorageAdapter Interface

```typescript
export interface StorageAdapter {
  /** Get a prompt by ID */
  getPrompt(id: string): Promise<Prompt>;
  
  /** Save a prompt (create or update) */
  savePrompt(prompt: Prompt): Promise<void>;
  
  /** List prompts with optional filtering */
  listPrompts(options?: ListPromptsOptions): Promise<Prompt[]>;
  
  /** Delete a prompt by ID */
  deletePrompt(id: string): Promise<void>;
  
  /** Connect to the storage backend */
  connect(): Promise<void>;
  
  /** Disconnect from the storage backend */
  disconnect(): Promise<void>;
}
```

## File Storage Adapter

The current implementation uses a simple file-based storage adapter that persists prompts as JSON files in a configurable directory.

### Implementation

The file storage adapter is implemented in `src/adapters/file-adapter.ts`:

```typescript
export class FileAdapter implements StorageAdapter {
  private promptsDir: string;
  
  constructor(promptsDir: string) {
    this.promptsDir = promptsDir;
  }
  
  async connect(): Promise<void> {
    await fs.mkdir(this.promptsDir, { recursive: true });
  }
  
  async getPrompt(id: string): Promise<Prompt> {
    const filePath = path.join(this.promptsDir, `${id}.json`);
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content) as Prompt;
  }
  
  // Additional methods implemented...
}
```

### Configuration

The file storage adapter is configured through environment variables:

```
STORAGE_TYPE=file
PROMPTS_DIR=./prompts
```

### Benefits and Limitations

**Benefits:**
- Simple setup with no external dependencies
- Easy to understand and debug
- Works well for development and small deployments
- Files can be manually inspected and edited

**Limitations:**
- Limited scalability for large prompt collections
- No built-in querying capabilities beyond basic filtering
- No concurrent access protection
- No transaction support

## Planned Future Adapters

### PostgreSQL Adapter

A PostgreSQL adapter is planned to provide more robust storage for larger deployments:

```typescript
export class PostgresAdapter implements StorageAdapter {
  private pool: Pool;
  
  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }
  
  async connect(): Promise<void> {
    // Set up schema if needed
  }
  
  // Implementation of interface methods...
}
```

**Features:**
- Scalable for large prompt collections
- Improved query performance
- Full-text search capabilities
- Concurrent access support
- Transaction support

### In-Memory Adapter

An in-memory adapter will be useful for testing and lightweight deployments:

```typescript
export class MemoryAdapter implements StorageAdapter {
  private prompts: Map<string, Prompt> = new Map();
  
  async connect(): Promise<void> {
    // No-op for in-memory adapter
  }
  
  // Implementation of interface methods...
}
```

**Features:**
- Extremely fast performance
- No external dependencies
- Useful for testing and development
- Optional persistence to disk on shutdown

## Adapter Selection

The storage adapter is selected based on the `STORAGE_TYPE` environment variable in `config.ts`:

```typescript
// Current implementation
if (config.storage.type === 'file') {
  storageAdapter = new FileAdapter(config.storage.promptsDir);
} else if (config.storage.type === 'postgres') {
  throw new Error('PostgreSQL adapter not implemented yet');
} else if (config.storage.type === 'memory') {
  throw new Error('Memory adapter not implemented yet');
}
```

## Implementation Guidelines for New Adapters

When implementing a new storage adapter:

1. Create a new file in `src/adapters/` for your adapter
2. Implement the `StorageAdapter` interface
3. Provide proper error handling
4. Handle connections and disconnections appropriately
5. Implement filtering in `listPrompts` according to the interface
6. Add adapter selection in `src/index.ts`
7. Update configuration options in `src/config.ts`
8. Add appropriate tests in `src/tests/`

## Migration Between Adapters

In the future, migration utilities will be added to facilitate moving prompts between different storage adapters:

```bash
# Example future CLI commands
npm run migrate --from=file --to=postgres
npm run backup --adapter=postgres --out=backup.json
npm run restore --adapter=postgres --in=backup.json
```

These utilities will make it easier to switch between adapters as your needs change. 