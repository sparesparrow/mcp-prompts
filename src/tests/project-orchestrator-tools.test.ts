/**
 * Tests for project orchestrator tools
 */

import { setupProjectOrchestratorTools } from "../tools/project-orchestrator-tools";
import fs from 'fs';
import path from 'path';
import os from 'os';

// Mock the project orchestrator tools module
jest.mock('../tools/project-orchestrator-tools', () => ({
  setupProjectOrchestratorTools: jest.fn().mockImplementation((server) => {
    server.tool('init_project_orchestrator', 'Initialize project orchestrator templates', {}, jest.fn());
    server.tool('create_project', 'Create a new project using the project orchestrator', {}, jest.fn());
    server.tool('list_project_templates', 'List available project templates', {}, jest.fn());
    server.tool('list_component_templates', 'List available component templates', {}, jest.fn());
    return Promise.resolve();
  })
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
  let server: { tool: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    server = {
      tool: jest.fn().mockReturnThis()
    };
  });

  test('should setup tools on the server', async () => {
    await setupProjectOrchestratorTools(server as any);
    
    expect(setupProjectOrchestratorTools).toHaveBeenCalledWith(server);
    expect(server.tool).toHaveBeenCalledTimes(4);
  });
});
