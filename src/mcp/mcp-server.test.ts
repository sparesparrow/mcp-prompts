import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { McpServer } from './mcp-server';
import { PromptService } from '../core/services/prompt.service';
import { IPromptRepository } from '../core/ports/prompt-repository.interface';

// Mock dependencies
class MockPromptRepository implements IPromptRepository {
  async save(prompt: any): Promise<void> {}
  async findById(id: string): Promise<any> { return null; }
  async findByCategory(category: string, limit: number): Promise<any[]> { return []; }
  async search(query: string, category?: string): Promise<any[]> { return []; }
  async findAll(limit: number): Promise<any[]> { return []; }
  async delete(id: string): Promise<void> {}
  async healthCheck(): Promise<{ status: string }> { return { status: 'healthy' }; }
}

class MockCatalogRepository {
  async save(prompt: any): Promise<void> {}
  async findById(id: string): Promise<any> { return null; }
  async healthCheck(): Promise<{ status: string }> { return { status: 'healthy' }; }
}

class MockEventBus {
  async publish(event: any): Promise<void> {}
  async healthCheck(): Promise<{ status: string }> { return { status: 'healthy' }; }
}

describe('McpServer', () => {
  let mcpServer: McpServer;
  let promptService: PromptService;
  let mockPromptRepository: MockPromptRepository;
  let stdoutWriteSpy: any;
  let stdinOnSpy: any;
  let originalStdin: any;
  let originalStdout: any;

  beforeEach(() => {
    // Create mocks
    mockPromptRepository = new MockPromptRepository();
    const mockCatalogRepository = new MockCatalogRepository();
    const mockEventBus = new MockEventBus();
    promptService = new PromptService(
      mockPromptRepository as any,
      mockCatalogRepository as any,
      mockEventBus as any
    );

    mcpServer = new McpServer(promptService, mockPromptRepository);

    // Mock stdout
    originalStdout = process.stdout;
    stdoutWriteSpy = vi.fn();
    process.stdout = {
      write: stdoutWriteSpy,
      destroyed: false,
      closed: false,
      setEncoding: vi.fn(),
      on: vi.fn(),
      once: vi.fn(),
      isTTY: false
    } as any;

    // Mock stdin
    originalStdin = process.stdin;
    stdinOnSpy = vi.fn();
    process.stdin = {
      setEncoding: vi.fn(),
      on: stdinOnSpy,
      once: vi.fn()
    } as any;

    // Suppress console.log during tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.stdout = originalStdout;
    process.stdin = originalStdin;
  });

  describe('Initialization', () => {
    it('should wait for initialize request before responding', async () => {
      await mcpServer.start();
      
      // Verify stdin listener was set up
      expect(stdinOnSpy).toHaveBeenCalledWith('data', expect.any(Function));
      
      // No response should be sent until initialize is received
      expect(stdoutWriteSpy).not.toHaveBeenCalled();
    });

    it('should handle initialize request correctly', async () => {
      await mcpServer.start();
      
      const dataHandler = stdinOnSpy.mock.calls.find((call: any[]) => call[0] === 'data')?.[1];
      expect(dataHandler).toBeDefined();

      const initializeRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: {
            name: 'test-client',
            version: '1.0.0'
          }
        }
      };

      await dataHandler(Buffer.from(JSON.stringify(initializeRequest) + '\n'));

      // Should send initialize response
      expect(stdoutWriteSpy).toHaveBeenCalled();
      const response = JSON.parse(stdoutWriteSpy.mock.calls[0][0]);
      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(1);
      expect(response.result).toBeDefined();
      expect(response.result.protocolVersion).toBe('2024-11-05');
      expect(response.result.serverInfo.name).toBe('mcp-prompts-aws');
      expect(response.result.serverInfo.version).toBe('3.12.3');
    });

    it('should handle initialized notification', async () => {
      await mcpServer.start();
      
      const dataHandler = stdinOnSpy.mock.calls.find((call: any[]) => call[0] === 'data')?.[1];
      
      // First initialize
      const initRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {}
      };
      await dataHandler(Buffer.from(JSON.stringify(initRequest) + '\n'));
      stdoutWriteSpy.mockClear();

      // Then initialized notification
      const initializedNotification = {
        jsonrpc: '2.0',
        method: 'initialized',
        params: {}
      };
      await dataHandler(Buffer.from(JSON.stringify(initializedNotification) + '\n'));

      // Notifications don't get responses
      // Should not send any response for initialized notification
      expect(stdoutWriteSpy).not.toHaveBeenCalled();
    });

    it('should reject requests before initialization', async () => {
      await mcpServer.start();
      
      const dataHandler = stdinOnSpy.mock.calls.find((call: any[]) => call[0] === 'data')?.[1];
      
      // Try to call a tool before initialize
      const toolRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {}
      };
      await dataHandler(Buffer.from(JSON.stringify(toolRequest) + '\n'));

      // Should send error response
      expect(stdoutWriteSpy).toHaveBeenCalled();
      const response = JSON.parse(stdoutWriteSpy.mock.calls[0][0]);
      expect(response.error).toBeDefined();
      expect(response.error.code).toBe(-32002);
      expect(response.error.message).toBe('Invalid Request');
    });

    it('should reject duplicate initialize requests', async () => {
      await mcpServer.start();
      
      const dataHandler = stdinOnSpy.mock.calls.find((call: any[]) => call[0] === 'data')?.[1];
      
      // First initialize
      const initRequest1 = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {}
      };
      await dataHandler(Buffer.from(JSON.stringify(initRequest1) + '\n'));
      stdoutWriteSpy.mockClear();

      // Try to initialize again
      const initRequest2 = {
        jsonrpc: '2.0',
        id: 2,
        method: 'initialize',
        params: {}
      };
      await dataHandler(Buffer.from(JSON.stringify(initRequest2) + '\n'));

      // Should send error
      const response = JSON.parse(stdoutWriteSpy.mock.calls[0][0]);
      expect(response.error).toBeDefined();
      expect(response.error.code).toBe(-32002);
    });
  });

  describe('Tools', () => {
    beforeEach(async () => {
      await mcpServer.start();
      const dataHandler = stdinOnSpy.mock.calls.find((call: any[]) => call[0] === 'data')?.[1];
      
      // Initialize first
      const initRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {}
      };
      await dataHandler(Buffer.from(JSON.stringify(initRequest) + '\n'));
      stdoutWriteSpy.mockClear();
    });

    it('should handle tools/list request', async () => {
      const dataHandler = stdinOnSpy.mock.calls.find((call: any[]) => call[0] === 'data')?.[1];
      
      const toolsListRequest = {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {}
      };
      await dataHandler(Buffer.from(JSON.stringify(toolsListRequest) + '\n'));

      expect(stdoutWriteSpy).toHaveBeenCalled();
      const response = JSON.parse(stdoutWriteSpy.mock.calls[0][0]);
      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(2);
      expect(response.result).toBeDefined();
      expect(response.result.tools).toBeInstanceOf(Array);
      expect(response.result.tools.length).toBeGreaterThan(0);
      
      // Check for expected tools
      const toolNames = response.result.tools.map((t: any) => t.name);
      expect(toolNames).toContain('get_prompt');
      expect(toolNames).toContain('list_prompts');
      expect(toolNames).toContain('search_prompts');
    });

    it('should handle tools/call request', async () => {
      const dataHandler = stdinOnSpy.mock.calls.find((call: any[]) => call[0] === 'data')?.[1];
      
      // Mock the prompt service method
      vi.spyOn(promptService, 'getLatestPrompts').mockResolvedValue([]);
      
      const toolsCallRequest = {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'list_prompts',
          arguments: {}
        }
      };
      await dataHandler(Buffer.from(JSON.stringify(toolsCallRequest) + '\n'));

      expect(stdoutWriteSpy).toHaveBeenCalled();
      const response = JSON.parse(stdoutWriteSpy.mock.calls[0][0]);
      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(3);
      expect(response.result).toBeDefined();
      expect(response.result.content).toBeInstanceOf(Array);
    });

    it('should handle invalid tool name', async () => {
      const dataHandler = stdinOnSpy.mock.calls.find((call: any[]) => call[0] === 'data')?.[1];
      
      const toolsCallRequest = {
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          name: 'invalid_tool',
          arguments: {}
        }
      };
      await dataHandler(Buffer.from(JSON.stringify(toolsCallRequest) + '\n'));

      expect(stdoutWriteSpy).toHaveBeenCalled();
      const response = JSON.parse(stdoutWriteSpy.mock.calls[0][0]);
      expect(response.error).toBeDefined();
      expect(response.error.code).toBe(-32601);
      expect(response.error.message).toBe('Method not found');
    });

    it('should handle missing tool name in tools/call', async () => {
      const dataHandler = stdinOnSpy.mock.calls.find((call: any[]) => call[0] === 'data')?.[1];
      
      const toolsCallRequest = {
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: {
          arguments: {}
        }
      };
      await dataHandler(Buffer.from(JSON.stringify(toolsCallRequest) + '\n'));

      expect(stdoutWriteSpy).toHaveBeenCalled();
      const response = JSON.parse(stdoutWriteSpy.mock.calls[0][0]);
      expect(response.error).toBeDefined();
      expect(response.error.code).toBe(-32602);
      expect(response.error.message).toBe('Invalid params');
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await mcpServer.start();
      const dataHandler = stdinOnSpy.mock.calls.find((call: any[]) => call[0] === 'data')?.[1];
      
      // Initialize first
      const initRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {}
      };
      await dataHandler(Buffer.from(JSON.stringify(initRequest) + '\n'));
      stdoutWriteSpy.mockClear();
    });

    it('should handle invalid JSON', async () => {
      const dataHandler = stdinOnSpy.mock.calls.find((call: any[]) => call[0] === 'data')?.[1];
      
      await dataHandler(Buffer.from('invalid json\n'));

      // Should handle gracefully without crashing
      expect(stdoutWriteSpy).not.toHaveBeenCalled();
    });

    it('should handle invalid JSON-RPC version', async () => {
      const dataHandler = stdinOnSpy.mock.calls.find((call: any[]) => call[0] === 'data')?.[1];
      
      const invalidRequest = {
        jsonrpc: '1.0',
        id: 1,
        method: 'test',
        params: {}
      };
      await dataHandler(Buffer.from(JSON.stringify(invalidRequest) + '\n'));

      expect(stdoutWriteSpy).toHaveBeenCalled();
      const response = JSON.parse(stdoutWriteSpy.mock.calls[0][0]);
      expect(response.error).toBeDefined();
      expect(response.error.code).toBe(-32600);
    });

    it('should handle unknown method', async () => {
      const dataHandler = stdinOnSpy.mock.calls.find((call: any[]) => call[0] === 'data')?.[1];
      
      const unknownMethodRequest = {
        jsonrpc: '2.0',
        id: 6,
        method: 'unknown_method',
        params: {}
      };
      await dataHandler(Buffer.from(JSON.stringify(unknownMethodRequest) + '\n'));

      expect(stdoutWriteSpy).toHaveBeenCalled();
      const response = JSON.parse(stdoutWriteSpy.mock.calls[0][0]);
      expect(response.error).toBeDefined();
      expect(response.error.code).toBe(-32601);
      expect(response.error.message).toBe('Method not found');
    });

    it('should handle notifications without IDs', async () => {
      const dataHandler = stdinOnSpy.mock.calls.find((call: any[]) => call[0] === 'data')?.[1];
      
      const notification = {
        jsonrpc: '2.0',
        method: 'test_notification',
        params: {}
      };
      await dataHandler(Buffer.from(JSON.stringify(notification) + '\n'));

      // Notifications don't get responses
      expect(stdoutWriteSpy).not.toHaveBeenCalled();
    });
  });

  describe('Connection Handling', () => {
    it('should handle stdout close gracefully', async () => {
      process.stdout.closed = true;
      
      await mcpServer.start();
      const dataHandler = stdinOnSpy.mock.calls.find((call: any[]) => call[0] === 'data')?.[1];
      
      const initRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {}
      };
      
      // Should not throw when stdout is closed
      await expect(dataHandler(Buffer.from(JSON.stringify(initRequest) + '\n'))).resolves.not.toThrow();
    });

    it('should handle stdout destroyed state', async () => {
      process.stdout.destroyed = true;
      
      await mcpServer.start();
      const dataHandler = stdinOnSpy.mock.calls.find((call: any[]) => call[0] === 'data')?.[1];
      
      const initRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {}
      };
      
      // Should not throw when stdout is destroyed
      await expect(dataHandler(Buffer.from(JSON.stringify(initRequest) + '\n'))).resolves.not.toThrow();
    });
  });

  describe('Message Buffering', () => {
    it('should handle incomplete JSON messages', async () => {
      await mcpServer.start();
      const dataHandler = stdinOnSpy.mock.calls.find((call: any[]) => call[0] === 'data')?.[1];
      
      // Send incomplete message
      await dataHandler(Buffer.from('{"jsonrpc":"2.0","id":1,"method":"initialize"'));
      
      // Should not process incomplete message
      expect(stdoutWriteSpy).not.toHaveBeenCalled();
      
      // Complete the message
      await dataHandler(Buffer.from(',"params":{}}\n'));
      
      // Now should process
      expect(stdoutWriteSpy).toHaveBeenCalled();
    });

    it('should handle multiple messages in one chunk', async () => {
      await mcpServer.start();
      const dataHandler = stdinOnSpy.mock.calls.find((call: any[]) => call[0] === 'data')?.[1];
      
      const msg1 = JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {}
      });
      const msg2 = JSON.stringify({
        jsonrpc: '2.0',
        method: 'initialized',
        params: {}
      });
      
      await dataHandler(Buffer.from(msg1 + '\n' + msg2 + '\n'));
      
      // Should process both messages
      expect(stdoutWriteSpy).toHaveBeenCalledTimes(1); // Only initialize gets a response
    });
  });
});
