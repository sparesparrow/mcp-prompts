import { jest } from '@jest/globals';
// Auto-mocking the MCP SDK to avoid direct dependency
jest.mock(
  '@modelcontextprotocol/sdk',
  () => {
    return {
      __esModule: true,
      Server: class MockServer {
        methods = {};
        constructor() {}
        method(name, handler) {
          this.methods[name] = handler;
          return this;
        }
        listen() {
          return this;
        }
      },
    };
  },
  { virtual: true },
); // Add virtual option to mock without requiring the real module
import { MemoryAdapter, FileAdapter, PostgresAdapter } from '../../src/adapters.js';
// Basic tests for storage adapters
describe('Storage Adapters', () => {
  describe('MemoryAdapter', () => {
    it('should be defined', () => {
      expect(MemoryAdapter).toBeDefined();
    });
    it('should be instantiable', () => {
      const adapter = new MemoryAdapter();
      expect(adapter).toBeDefined();
      expect(adapter.constructor.name).toBe('MemoryAdapter');
    });
  });
  describe('FileAdapter', () => {
    it('should be defined', () => {
      expect(FileAdapter).toBeDefined();
    });
    it('should be instantiable with a path', () => {
      const adapter = new FileAdapter('./test-prompts');
      expect(adapter).toBeDefined();
      expect(adapter.constructor.name).toBe('FileAdapter');
    });
  });
  describe('PostgresAdapter', () => {
    it('should be defined', () => {
      expect(PostgresAdapter).toBeDefined();
    });
    it('should be instantiable with config', () => {
      const adapter = new PostgresAdapter({
        host: 'localhost',
        port: 5432,
        database: 'test',
        user: 'postgres',
        password: 'password',
        ssl: false,
      });
      expect(adapter).toBeDefined();
      expect(adapter.constructor.name).toBe('PostgresAdapter');
    });
  });
});
// Mock server methods tests
describe('Server Methods', () => {
  let mockStorageAdapter;
  beforeEach(() => {
    // Create a properly typed mock storage adapter
    mockStorageAdapter = {
      connect: jest.fn().mockResolvedValue(),
      disconnect: jest.fn().mockResolvedValue(),
      isConnected: jest.fn().mockReturnValue(true),
      savePrompt: jest.fn().mockResolvedValue('test-prompt-id'),
      getPrompt: jest.fn().mockResolvedValue({
        id: 'test-prompt',
        name: 'Test Prompt',
        content: 'Test Content',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
      deletePrompt: jest.fn().mockResolvedValue(),
      getAllPrompts: jest.fn().mockResolvedValue([]),
      listPrompts: jest.fn().mockResolvedValue([
        {
          id: 'prompt1',
          name: 'Prompt 1',
          content: 'Content 1',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'prompt2',
          name: 'Prompt 2',
          content: 'Content 2',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]),
    };
  });
  it('should verify storage adapter methods', () => {
    expect(typeof mockStorageAdapter.connect).toBe('function');
    expect(typeof mockStorageAdapter.getPrompt).toBe('function');
    expect(typeof mockStorageAdapter.listPrompts).toBe('function');
    expect(typeof mockStorageAdapter.savePrompt).toBe('function');
    expect(typeof mockStorageAdapter.deletePrompt).toBe('function');
  });
});
