/**
 * Tests for project orchestrator tools
 */

import { Server as McpServer } from "@modelcontextprotocol/sdk/dist/server/index.js";
import { setupProjectOrchestratorTools } from "../tools/project-orchestrator-tools";
import fs from 'fs';
import path from 'path';
import os from 'os';

// Mock dependencies
jest.mock('@modelcontextprotocol/sdk/dist/server/index.js', () => ({
  McpServer: jest.fn().mockImplementation(() => ({
    tool: jest.fn()
  }))
}));

jest.mock('../services/prompt-service', () => ({
  PromptService: jest.fn().mockImplementation(() => ({
    addPrompt: jest.fn().mockResolvedValue({ id: 'test-id' }),
    getPrompt: jest.fn().mockResolvedValue({
      id: 'test-id',
      name: 'Test Prompt',
      content: 'Test content',
      isTemplate: true
    }),
    applyTemplate: jest.fn().mockResolvedValue({
      content: '# Generated Project Plan'
    }),
    listPrompts: jest.fn().mockResolvedValue([{ id: 'test-id', name: 'Test Prompt' }])
  }))
}));

jest.mock('../adapters/file-adapter', () => ({
  FileAdapter: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(undefined)
  }))
}));

jest.mock('../config', () => ({
  getConfig: jest.fn().mockReturnValue({
    storage: {
      type: 'file',
      promptsDir: './prompts'
    }
  })
}));

jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  readFileSync: jest.fn().mockReturnValue('{"id": "test-id", "name": "Test Prompt", "content": "Test content"}'),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  copyFileSync: jest.fn()
}));

describe('Project Orchestrator Tools', () => {
  let server: McpServer;
  let mockToolHandler: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    server = new McpServer();
    mockToolHandler = jest.fn();
    server.tool = jest.fn().mockImplementation((name, desc, schema, handler) => {
      if (name === 'init_project_orchestrator') {
        mockToolHandler = handler;
      }
      return server;
    });
  });

  test('should setup tools on the server', () => {
    setupProjectOrchestratorTools(server);
    expect(server.tool).toHaveBeenCalledWith(
      'init_project_orchestrator',
      'Initialize project orchestrator templates',
      expect.any(Object),
      expect.any(Function)
    );
    expect(server.tool).toHaveBeenCalledWith(
      'create_project',
      'Create a new project using the project orchestrator',
      expect.any(Object),
      expect.any(Function)
    );
    expect(server.tool).toHaveBeenCalledWith(
      'list_project_templates',
      'List available project templates',
      expect.any(Object),
      expect.any(Function)
    );
    expect(server.tool).toHaveBeenCalledWith(
      'list_component_templates',
      'List available component templates',
      expect.any(Object),
      expect.any(Function)
    );
  });

  test('init_project_orchestrator should handle initialization', async () => {
    setupProjectOrchestratorTools(server);
    
    // Get the handler function
    const initHandler = (server.tool as jest.Mock).mock.calls.find(
      call => call[0] === 'init_project_orchestrator'
    )[3];
    
    // Execute handler
    const result = await initHandler({});
    
    expect(result).toEqual({
      content: [{ 
        type: "text", 
        text: expect.stringContaining("Project orchestrator templates") 
      }]
    });
  });

  test('create_project should handle project creation', async () => {
    setupProjectOrchestratorTools(server);
    
    // Get the handler function
    const createHandler = (server.tool as jest.Mock).mock.calls.find(
      call => call[0] === 'create_project'
    )[3];
    
    // Create temp directory for testing
    const testDir = path.join(os.tmpdir(), 'mcp-test-project');
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    
    // Execute handler
    const result = await createHandler({
      project_name: 'TestProject',
      project_idea: 'A test project',
      output_directory: testDir
    });
    
    expect(result).toEqual({
      content: [{ 
        type: "text", 
        text: expect.stringContaining("Project \"TestProject\" created successfully") 
      }]
    });
  });
});
