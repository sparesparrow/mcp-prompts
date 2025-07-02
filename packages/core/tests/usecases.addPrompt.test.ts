import { addPrompt } from '@core/use-cases/addPrompt';
import { Prompt } from '@core/entities/Prompt';
import { ValidationError } from '@core/validation/PromptValidation';

describe('addPrompt', () => {
  it('should add a valid prompt', async () => {
    const repo = {
      savePrompt: jest.fn(async (p: Prompt) => p),
    } as any;
    const prompt: Prompt = {
      id: 'test',
      name: 'Test',
      content: 'Hello, {{name}}!',
      isTemplate: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
      variables: ['name'],
    };
    const result = await addPrompt(repo, prompt);
    expect(result).toEqual(prompt);
    expect(repo.savePrompt).toHaveBeenCalledWith(prompt);
  });

  it('should throw if variables do not match template', async () => {
    const repo = { savePrompt: jest.fn() } as any;
    const prompt: Prompt = {
      id: 'test',
      name: 'Test',
      content: 'Hello, {{name}} and {{surname}}!',
      isTemplate: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
      variables: ['name'],
    };
    await expect(addPrompt(repo, prompt)).rejects.toThrow(ValidationError);
  });
});
