import type { Prompt } from '../../src/interfaces.js';
import { promptSchemas, workflowSchema } from '../../src/schemas.js';
import { validatePrompt, ValidationError } from '../../src/validation.js';

describe('Validation', () => {
  it('should pass for a valid prompt object', () => {
    const validPrompt: Prompt = {
      id: '1',
      name: 'Valid Prompt',
      content: 'This is the content.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    expect(() => validatePrompt(validPrompt)).not.toThrow();
  });

  it('should throw ValidationError for a prompt with missing required fields', () => {
    const invalidPrompt = {
      id: '2',
      name: 'Invalid Prompt',
      // content is missing
    };
    expect(() => validatePrompt(invalidPrompt)).toThrow(ValidationError);
  });

  it('should return a success result when not throwing on error', () => {
    const validPrompt: Prompt = {
      id: '3',
      name: 'Valid Prompt',
      content: 'Content here.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const result = validatePrompt(validPrompt, false);
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.error).toBeUndefined();
  });

  it('should return a failure result when not throwing on error', () => {
    const invalidPrompt = {
      id: '4',
      // name, content, createdAt, and updatedAt are missing
    };
    const result = validatePrompt(invalidPrompt, false);
    expect(result.success).toBe(false);
    expect(result.data).toBeUndefined();
    expect(result.error).toBeDefined();
    expect(result.error?.issues).toHaveLength(2); // for name, content
  });

  it('should throw ValidationError for empty required string fields', () => {
    const promptWithEmptyStrings = {
      id: '',
      name: '',
      content: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    expect(() => validatePrompt(promptWithEmptyStrings)).toThrow(ValidationError);
  });
});

describe('Schema Validation', () => {
  describe('promptSchemas', () => {
    it('should trim the name field', () => {
      const result = promptSchemas.create.parse({
        name: '  test-prompt  ',
        content: 'Test content',
      });
      expect(result.name).toBe('test-prompt');
    });

    it('should set default for isTemplate', () => {
      const result = promptSchemas.create.parse({
        name: 'test-prompt',
        content: 'Test content',
      });
      expect(result.isTemplate).toBe(false);
    });

    it('should fail if name is empty', () => {
      expect(() => {
        promptSchemas.create.parse({ name: '', content: 'Test content' });
      }).toThrow();
    });

    it('should fail if content is empty', () => {
      expect(() => {
        promptSchemas.create.parse({ name: 'test', content: '' });
      }).toThrow();
    });
  });

  describe('workflowSchema', () => {
    it('should fail if steps array is empty', () => {
      const invalidWorkflow = {
        id: 'wf-1',
        name: 'Test Workflow',
        version: 1,
        steps: [],
      };
      expect(() => {
        workflowSchema.parse(invalidWorkflow);
      }).toThrow('Workflow must have at least one step');
    });

    it('should pass if steps array is not empty', () => {
      const validWorkflow = {
        id: 'wf-1',
        name: 'Test Workflow',
        version: 1,
        steps: [{ id: 'step-1', type: 'prompt', promptId: 'p-1', input: {}, output: 'out' }],
      };
      expect(() => {
        workflowSchema.parse(validWorkflow);
      }).not.toThrow();
    });
  });
}); 