import { jest } from '@jest/globals';

import { MemoryAdapter } from '../../src/adapters.js';
import type { StorageAdapter } from '../../src/interfaces.js';
import { PromptService } from '../../src/prompt-service.js';
import {
  HttpRunner,
  PromptRunner,
  ShellRunner,
  WorkflowServiceImpl,
  type Workflow,
} from '../../src/workflow-service.js';

// Mock StepRunners for stateless tests
const mockStatelessPromptRunner = {
  runStep: jest.fn<() => Promise<{ success: boolean; output?: string; error?: string }>>(),
};
const mockStatelessShellRunner = {
  runStep: jest.fn<() => Promise<{ success: boolean; output?: string; error?: string }>>(),
};
const mockStatelessHttpRunner = {
  runStep: jest.fn<() => Promise<{ success: boolean; output?: string; error?: string }>>(),
};

const statelessStepRunners = {
  prompt: mockStatelessPromptRunner,
  shell: mockStatelessShellRunner,
  http: mockStatelessHttpRunner,
};

// Mocks for stateful tests
const mockStorageAdapter: StorageAdapter = {
  saveWorkflowState: jest.fn(),
  getWorkflowState: jest.fn(),
  listWorkflowStates: jest.fn(),
  // Add other required methods as mocks if needed
  create: jest.fn(),
  get: jest.fn(),
  list: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  healthCheck: jest.fn(),
  init: jest.fn(),
  isConnected: jest.fn(),
  getAllPrompts: jest.fn(),
  createSequence: jest.fn(),
  getSequence: jest.fn(),
  updateSequence: jest.fn(),
  deleteSequence: jest.fn(),
};

const mockPromptService = {} as PromptService;

describe('WorkflowService (Stateless)', () => {
  let service: WorkflowServiceImpl;

  beforeEach(() => {
    // Note: This service instance is not fully initialized for stateful tests.
    service = new WorkflowServiceImpl(mockStorageAdapter, mockPromptService);
    jest.clearAllMocks();
  });

  it('should run a simple linear workflow', async () => {
    mockStatelessPromptRunner.runStep.mockResolvedValue({ success: true, output: 'output1' });
    mockStatelessShellRunner.runStep.mockResolvedValue({ success: true, output: 'output2' });

    const workflow: Workflow = {
      id: 'linear-workflow',
      name: 'Linear Workflow',
      version: 1,
      steps: [
        { id: 'step1', type: 'prompt', promptId: 'p1', input: {}, output: 'out1' },
        { id: 'step2', type: 'shell', command: 'ls', output: 'out2' },
      ],
    };

    const result = await service.runWorkflowSteps(workflow, { context: {}, history: [], currentStepId: 'step1', status: 'running', executionId: '', workflowId: '', createdAt: '', updatedAt: ''}, statelessStepRunners);
    expect(result.success).toBe(true);
    expect(mockStatelessPromptRunner.runStep).toHaveBeenCalledTimes(1);
    expect(mockStatelessShellRunner.runStep).toHaveBeenCalledTimes(1);
    expect(result.outputs).toEqual(expect.objectContaining({ out1: 'output1', out2: 'output2' }));
  });
  
  // ... other stateless tests ...
});


describe('WorkflowService (Stateful)', () => {
  let service: WorkflowServiceImpl;

  beforeEach(() => {
    // Use real runners and mocked services for stateful tests
    const storage = new MemoryAdapter();
    const promptService = new PromptService(storage);
    service = new WorkflowServiceImpl(mockStorageAdapter, promptService);
    jest.clearAllMocks();
    (mockStorageAdapter.saveWorkflowState as jest.Mock).mockClear();
  });

  it('should run a simple workflow and save state correctly', async () => {
    const workflow: Workflow = {
      id: 'stateful-workflow',
      name: 'Stateful Workflow',
      version: 1,
      steps: [
        { id: 'step1', type: 'shell', command: 'echo "hello"' },
        { id: 'step2', type: 'shell', command: 'echo "world"' },
      ],
    };

    const result = await service.runWorkflow(workflow);
    
    expect(result.success).toBe(true);
    expect(mockStorageAdapter.saveWorkflowState).toHaveBeenCalledTimes(3); // Initial, after step1, final
    
    // Check final state saved
    const lastCall = (mockStorageAdapter.saveWorkflowState as jest.Mock).mock.calls[2][0];
    expect(lastCall).toEqual(expect.objectContaining({
      status: 'completed',
      workflowId: 'stateful-workflow',
    }));
  });

  it('should handle parallel steps and save state', async () => {
    const workflow: Workflow = {
      id: 'parallel-workflow',
      name: 'Parallel Workflow',
      version: 1,
      steps: [
        {
          id: 'parallel-step',
          type: 'parallel',
          steps: [
            { id: 'p-step1', type: 'shell', command: 'echo "first"' },
            { id: 'p-step2', type: 'shell', command: 'echo "second"' },
          ],
        },
      ],
    };
    
    const result = await service.runWorkflow(workflow);

    expect(result.success).toBe(true);
    // Initial save, then one save after the parallel block completes
    expect(mockStorageAdapter.saveWorkflowState).toHaveBeenCalledTimes(2);
    
    const lastCall = (mockStorageAdapter.saveWorkflowState as jest.Mock).mock.calls[1][0];
    expect(lastCall.status).toBe('completed');
  });
}); 