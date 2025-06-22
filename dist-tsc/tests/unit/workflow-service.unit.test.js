import { jest } from '@jest/globals';
import { mock } from 'jest-mock-extended';
import { WorkflowServiceImpl, } from '../../src/workflow-service.js';
// Mock StepRunners for stateless tests
const mockStatelessPromptRunner = {
    runStep: jest.fn(),
};
const mockStatelessShellRunner = {
    runStep: jest.fn(),
};
const mockStatelessHttpRunner = {
    runStep: jest.fn(),
};
const statelessStepRunners = {
    prompt: mockStatelessPromptRunner,
    shell: mockStatelessShellRunner,
    http: mockStatelessHttpRunner,
};
// Mocks for stateful tests
const mockStorageAdapter = {
    connect: jest.fn(),
    disconnect: jest.fn(),
    isConnected: jest.fn(),
    savePrompt: jest.fn(),
    getPrompt: jest.fn(),
    getAllPrompts: jest.fn(),
    updatePrompt: jest.fn(),
    listPrompts: jest.fn(),
    deletePrompt: jest.fn(),
    clearAll: jest.fn(),
    backup: jest.fn(),
    restore: jest.fn(),
    listBackups: jest.fn(),
    getSequence: jest.fn(),
    saveSequence: jest.fn(),
    deleteSequence: jest.fn(),
    healthCheck: jest.fn(),
    saveWorkflowState: jest.fn(),
    getWorkflowState: jest.fn(),
    listWorkflowStates: jest.fn(),
};
const mockPromptService = {};
describe('WorkflowService (Stateless)', () => {
    let service;
    let mockStorageAdapter;
    let mockPromptService;
    beforeEach(() => {
        mockStorageAdapter = mock();
        mockPromptService = mock();
        service = new WorkflowServiceImpl(mockStorageAdapter, mockPromptService);
        jest.clearAllMocks();
    });
    it('should run a simple linear workflow', async () => {
        mockStatelessPromptRunner.runStep.mockResolvedValue({ success: true, output: 'output1' });
        mockStatelessShellRunner.runStep.mockResolvedValue({ success: true, output: 'output2' });
        const workflow = {
            id: 'linear-workflow',
            name: 'Linear Workflow',
            version: 1,
            steps: [
                { id: 'step1', type: 'prompt', promptId: 'p1', input: {}, output: 'out1' },
                { id: 'step2', type: 'shell', command: 'ls', output: 'out2' },
            ],
        };
        const result = await service.runWorkflowSteps(workflow, {
            context: {},
            history: [],
            currentStepId: 'step1',
            status: 'running',
            executionId: '',
            workflowId: '',
            createdAt: '',
            updatedAt: '',
        }, statelessStepRunners);
        expect(result.success).toBe(true);
        expect(mockStatelessPromptRunner.runStep).toHaveBeenCalledTimes(1);
        expect(mockStatelessShellRunner.runStep).toHaveBeenCalledTimes(1);
        expect(result.outputs).toEqual(expect.objectContaining({ out1: 'output1', out2: 'output2' }));
    });
    // ... other stateless tests ...
});
describe('WorkflowService (Stateful)', () => {
    let service;
    let mockStorageAdapter;
    let mockPromptService;
    beforeEach(() => {
        mockStorageAdapter = mock();
        mockPromptService = mock();
        service = new WorkflowServiceImpl(mockStorageAdapter, mockPromptService);
    });
    it('should run a simple workflow and save state correctly', async () => {
        const workflow = {
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
        const lastCall = mockStorageAdapter.saveWorkflowState.mock.calls[3][0];
        expect(lastCall).toEqual(expect.objectContaining({
            status: 'completed',
            workflowId: 'stateful-workflow',
        }));
    });
    it('should handle parallel steps and save state', async () => {
        const workflow = {
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
        const lastCall = mockStorageAdapter.saveWorkflowState.mock.calls[workflow.threads][0];
        expect(lastCall.status).toBe('completed');
    });
});
