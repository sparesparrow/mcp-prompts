import { jest } from '@jest/globals';
import { mock } from 'jest-mock-extended';

import { PromptService } from '../../src/prompt-service.js';
import { MemoryAdapter } from '../../src/adapters.js';
import type { StorageAdapter } from '../../src/interfaces.js';
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
  connect: jest.fn() as unknown as () => Promise<void>,
  disconnect: jest.fn() as unknown as () => Promise<void>,
  isConnected: jest.fn() as unknown as () => boolean | Promise<boolean>,
  savePrompt: jest.fn() as unknown as () => Promise<any>,
  getPrompt: jest.fn() as unknown as () => Promise<any>,
  getAllPrompts: jest.fn() as unknown as () => Promise<any[]>,
  updatePrompt: jest.fn() as unknown as () => Promise<any>,
  listPrompts: jest.fn() as unknown as () => Promise<any[]>,
  deletePrompt: jest.fn() as unknown as () => Promise<void>,
  clearAll: jest.fn() as unknown as () => Promise<void>,
  backup: jest.fn() as unknown as () => Promise<string>,
  restore: jest.fn() as unknown as (backupId: string) => Promise<void>,
  listBackups: jest.fn() as unknown as () => Promise<string[]>,
  getSequence: jest.fn() as unknown as (id: string) => Promise<any>,
  saveSequence: jest.fn() as unknown as () => Promise<any>,
  deleteSequence: jest.fn() as unknown as (id: string) => Promise<void>,
  healthCheck: jest.fn() as unknown as () => Promise<boolean>,
  saveWorkflowState: jest.fn() as unknown as (state: any) => Promise<void>,
  getWorkflowState: jest.fn() as unknown as (executionId: string) => Promise<any>,
  listWorkflowStates: jest.fn() as unknown as (workflowId: string) => Promise<any[]>,
};

const mockPromptService = {} as PromptService;

describe('WorkflowService (Stateless)', () => {
  let service: WorkflowServiceImpl;
  let mockStorageAdapter: jest.Mocked<StorageAdapter>;
  let mockPromptService: jest.Mocked<PromptService>;

  beforeEach(() => {
    mockStorageAdapter = mock<StorageAdapter>();
    mockPromptService = mock<PromptService>();
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

    const result = await service.runWorkflowSteps(
      workflow,
      {
        context: {},
        history: [],
        currentStepId: 'step1',
        status: 'running',
        executionId: '',
        workflowId: '',
        createdAt: '',
        updatedAt: '',
      },
      statelessStepRunners,
    );
    expect(result.success).toBe(true);
    expect(mockStatelessPromptRunner.runStep).toHaveBeenCalledTimes(1);
    expect(mockStatelessShellRunner.runStep).toHaveBeenCalledTimes(1);
    expect(result.outputs).toEqual(expect.objectContaining({ out1: 'output1', out2: 'output2' }));
  });

  // ... other stateless tests ...
});

describe('WorkflowService (Stateful)', () => {
  let service: WorkflowServiceImpl;
  let mockStorageAdapter: jest.Mocked<StorageAdapter>;
  let mockPromptService: jest.Mocked<PromptService>;

  beforeEach(() => {
    mockStorageAdapter = mock<StorageAdapter>();
    mockPromptService = mock<PromptService>();
    service = new WorkflowServiceImpl(mockStorageAdapter, mockPromptService);
  });

  it('should run a simple workflow and save state correctly', async () => {
    const workflow: Workflow = {
      id: 'stateful-workflow',
      name: 'Stateful Workflow',
      version: 1,
      steps: [
        { id: 'step1', type: 'shell', command: 'echo "hello"', output: 'out1' },
        { id: 'step2', type: 'shell', command: 'echo "world"', output: 'out2' },
      ],
    };

    const result = await service.runWorkflow(workflow);

    expect(result.success).toBe(true);
    expect(mockStorageAdapter.saveWorkflowState).toHaveBeenCalledTimes(4); // Initial, after step1, after step2, final

    // Check final state saved
    const lastCall = (mockStorageAdapter.saveWorkflowState as jest.Mock).mock.calls[3][0] as any;
    expect(lastCall).toEqual(
      expect.objectContaining({
        status: 'completed',
        workflowId: 'stateful-workflow',
      }),
    );
  });

  it('should handle parallel steps and save state', async () => {
    const workflow: Workflow = {
      id: 'parallel-workflow',
      name: 'Parallel Test',
      threads: 2,
      steps: [
        {
          id: 'parallel-step',
          type: 'parallel',
          steps: [
            { id: 'p-step1', type: 'shell', command: 'echo "first"', output: 'out1' },
            { id: 'p-step2', type: 'shell', command: 'echo "second"', output: 'out2' },
          ],
        },
      ],
    };

    const result = await service.runWorkflow(workflow);

    expect(result.success).toBe(true);
    // Note: The number of saves is now threads + completion
    expect(mockStorageAdapter.saveWorkflowState).toHaveBeenCalledTimes(workflow.threads + 1);

    const lastCall = (mockStorageAdapter.saveWorkflowState as jest.Mock).mock.calls[
      workflow.threads
    ][0] as any;
    expect(lastCall.status).toBe('completed');
  });
});
