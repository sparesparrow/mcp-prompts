import type { Prompt } from '../../src/interfaces.js';
import { promptSchemas, workflowSchema } from '../../src/schemas.js';
import { validatePrompt, ValidationError } from '../../src/validation.js';

describe.skip('Validation', () => {
  it('should pass for a valid full prompt object', () => {
    const validPrompt: Prompt = {
      id: '1',
      name: 'Valid Prompt',
      content: 'This is the content.',
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    expect(() => validatePrompt(validPrompt, 'full')).not.toThrow();
  });

  it('should pass for a valid create prompt object', () => {
    const validPrompt = {
      name: 'Valid Prompt',
      content: 'This is the content.',
    };
    expect(() => validatePrompt(validPrompt, 'create')).not.toThrow();
  });

  it('should throw ValidationError for a prompt with missing required fields', () => {
    const invalidPrompt = {
      id: '2',
      name: 'Invalid Prompt',
      version: 1,
      // content is missing
    };
    expect(() => validatePrompt(invalidPrompt, 'full')).toThrow(ValidationError);
  });

  it('should throw when extra fields are present in create schema', () => {
    const invalidPrompt = {
      name: 'Creative Prompt',
      content: 'This is the content.',
      extraField: 'should not be here',
    };
    expect(() => validatePrompt(invalidPrompt, 'create')).toThrow(ValidationError);
  });

  it('should return a success result when not throwing on error', () => {
    const validPrompt: Prompt = {
      id: '3',
      name: 'Valid Prompt',
      content: 'Content here.',
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const result = validatePrompt(validPrompt, 'full', false);
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.error).toBeUndefined();
  });

  it('should return a failure result with 4 issues when missing all required fields', () => {
    const invalidPrompt = {
      id: '4',
      version: 1,
      // name, content, createdAt, and updatedAt are missing
    };
    const result = validatePrompt(invalidPrompt, 'full', false);
    expect(result.success).toBe(false);
    expect(result.data).toBeUndefined();
    expect(result.error).toBeDefined();
    expect(result.error?.issues.length).toBe(4);
  });

  it('should throw ValidationError for empty required string fields', () => {
    const promptWithEmptyStrings = {
      id: '5',
      version: 1,
      name: '',
      content: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    expect(() => validatePrompt(promptWithEmptyStrings, 'full')).toThrow(ValidationError);
  });
});

describe.skip('Schema Validation', () => {
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