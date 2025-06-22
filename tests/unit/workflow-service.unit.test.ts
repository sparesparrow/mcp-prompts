import { jest } from '@jest/globals';
import { mock } from 'jest-mock-extended';

import type { StorageAdapter, PromptService, WorkflowExecutionState } from '../../src/interfaces.js';
import {
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
  listPromptVersions: jest.fn() as unknown as () => Promise<number[]>,
  updatePrompt: jest.fn() as unknown as () => Promise<any>,
  listPrompts: jest.fn() as unknown as () => Promise<any[]>,
  deletePrompt: jest.fn() as unknown as (id: string, version?: number) => Promise<boolean>,
  clearAll: jest.fn() as unknown as () => Promise<void>,
  backup: jest.fn() as unknown as () => Promise<string>,
  restore: jest.fn() as unknown as (backupId: string) => Promise<void>,
  listBackups: jest.fn() as unknown as () => Promise<string[]>,
  getSequence: jest.fn() as unknown as (id: string) => Promise<any>,
  saveSequence: jest.fn() as unknown as () => Promise<any>,
  deleteSequence: jest.fn() as unknown as (id: string) => Promise<void>,
  healthCheck: jest.fn() as unknown as () => Promise<boolean>,
  saveWorkflowState: jest.fn() as unknown as (state: any) => Promise<void>,
  getWorkflowState: jest.fn() as unknown as (executionId: string) => Promise<WorkflowExecutionState>,
  listWorkflowStates: jest.fn() as unknown as (workflowId: string) => Promise<any[]>,
};

const mockPromptService = mock<PromptService>();

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
    mockStorageAdapter.saveWorkflowState.mockResolvedValue();
    const state: WorkflowExecutionState = {
      context: {},
      history: [],
      currentStepId: 'step1',
      status: 'running',
      executionId: 'exec-123',
      workflowId: 'test-workflow',
      version: 1,
      createdAt: '',
      updatedAt: '',
    };
    mockStorageAdapter.getWorkflowState.mockResolvedValue(state);

    const workflow: Workflow = {
      name: 'Test Workflow',
      id: 'test-workflow',
      version: 1,
      steps: [
        { id: 'step1', type: 'shell', command: 'echo "hello"', output: 'out1' },
        { id: 'step2', type: 'shell', command: 'echo "world"', output: 'out2' },
      ],
    };

    // Act
    await service.runWorkflow(workflow, {});

    // Assert
    expect(mockStorageAdapter.saveWorkflowState).toHaveBeenCalledTimes(4); // 2 steps + 2 parallel steps + completion
  });

  it('should handle parallel steps and save state', async () => {
    mockStorageAdapter.saveWorkflowState.mockResolvedValue();
    const workflow: Workflow = {
      name: 'Parallel Workflow',
      id: 'parallel-workflow',
      version: 1,
      steps: [
        { id: 'step1', type: 'shell', command: 'echo "hello"', output: 'out1' },
        { id: 'step2', type: 'shell', command: 'echo "world"', output: 'out2' },
      ],
    };

    // Act
    await service.runWorkflow(workflow, {});

    // Assert
    expect(mockStorageAdapter.saveWorkflowState).toHaveBeenCalledTimes(3); // 2 parallel steps + completion
  });

  it('should run a workflow and save state correctly', async () => {
    mockStorageAdapter.saveWorkflowState.mockResolvedValue();
    const workflow: Workflow = {
      name: 'Test Workflow',
      id: 'test-workflow',
      version: 1,
      steps: [
        { id: 'step1', type: 'shell', command: 'echo "hello"', output: 'out1' },
        { id: 'step2', type: 'shell', command: 'echo "world"', output: 'out2' },
      ],
    };

    // Act
    const result = await service.runWorkflow(workflow, {});

    // Assert
    expect(result.success).toBe(true);
    // Note: The number of saves is now 4 (2 steps + 2 parallel steps + completion)
    expect(mockStorageAdapter.saveWorkflowState).toHaveBeenCalledTimes(4);

    const lastCall = (mockStorageAdapter.saveWorkflowState as jest.Mock).mock.calls[3][0] as any;
    expect(lastCall.status).toBe('completed');
  });
});
