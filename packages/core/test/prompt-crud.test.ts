import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryPromptRepository } from '@mcp-prompts/adapters-memory/src/MemoryPromptRepository';
import { addPrompt } from '../src/use-cases/addPrompt';
import { getPromptById } from '../src/use-cases/getPromptById';
import { listPrompts } from '../src/use-cases/listPrompts';
import { updatePrompt } from '../src/use-cases/updatePrompt';
import { deletePrompt } from '../src/use-cases/deletePrompt';

const samplePrompt = {
  id: '018e7b2e-7b2e-7b2e-7b2e-7b2e7b2e7b2e',
  name: 'Test prompt',
  template: {
    id: 'tpl-1',
    content: 'Hello, {{name}}!',
    variables: [{ name: 'name', type: 'string', required: true }],
  },
  category: { id: 'cat-1', name: 'General' },
  tags: ['test'],
  createdBy: { id: 'user-1', username: 'tester' },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('Prompt CRUD use-cases', () => {
  let repo: MemoryPromptRepository;

  beforeEach(() => {
    repo = new MemoryPromptRepository();
    repo.reset();
  });

  it('should add and get a prompt', async () => {
    await addPrompt(repo, samplePrompt);
    const found = await getPromptById(repo, samplePrompt.id);
    expect(found).toBeTruthy();
    expect(found?.name).toBe('Test prompt');
  });

  it('should list prompts', async () => {
    await addPrompt(repo, samplePrompt);
    const prompts = await listPrompts(repo);
    expect(prompts.length).toBe(1);
    expect(prompts[0].id).toBe(samplePrompt.id);
  });

  it('should update a prompt', async () => {
    await addPrompt(repo, samplePrompt);
    await updatePrompt(repo, samplePrompt.id, { name: 'Updated' });
    const found = await getPromptById(repo, samplePrompt.id);
    expect(found?.name).toBe('Updated');
  });

  it('should delete a prompt', async () => {
    await addPrompt(repo, samplePrompt);
    await deletePrompt(repo, samplePrompt.id);
    const found = await getPromptById(repo, samplePrompt.id);
    expect(found).toBeNull();
  });
});
