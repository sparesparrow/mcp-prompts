import { jest } from '@jest/globals';

import { PromptService } from '../../src/prompt-service.js';
import { MemoryAdapter } from '../../src/adapters.js';
import type { StorageAdapter } from '../../src/interfaces.js';
import {
  WorkflowServiceImpl,
  type Workflow,
} from '../../src/workflow-service.js';

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

describe('WorkflowService (Stateful) - Isolated', () => {
  let service: WorkflowServiceImpl;

  beforeEach(() => {
    // Use real runners and mocked services for stateful tests
    const storage = new MemoryAdapter();
    const promptService = new PromptService(storage);
    service = new WorkflowServiceImpl(mockStorageAdapter, promptService);
    jest.clearAllMocks();
    (mockStorageAdapter.saveWorkflowState as jest.Mock).mockClear();
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
            { id: 'p-step1', type: 'shell', command: 'echo "first"', output: 'out1' },
            { id: 'p-step2', type: 'shell', command: 'echo "second"', output: 'out2' },
          ],
        },
      ],
    };
    
    const result = await service.runWorkflow(workflow);

    expect(result.success).toBe(true);
    // Initial save, then one save after the parallel block completes
    expect(mockStorageAdapter.saveWorkflowState).toHaveBeenCalledTimes(3); // Initial, after parallel block, final
    
    const lastCall = (mockStorageAdapter.saveWorkflowState as jest.Mock).mock.calls[2][0] as any;
    expect(lastCall.status).toBe('completed');
  });
}); 