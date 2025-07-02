import express from 'express';
import type { IPromptApplication } from '@mcp-prompts/core/src/ports/IPromptApplication';

export function createRestServer(promptApp: IPromptApplication) {
  const app = express();
  app.use(express.json());

  // List prompts
  app.get('/prompts', async (req, res) => {
    const prompts = await promptApp.listPrompts();
    res.json(prompts);
  });

  // Get prompt by id
  app.get('/prompts/:id', async (req, res) => {
    const prompt = await promptApp.getPromptById(req.params.id);
    if (!prompt) return res.status(404).json({ error: 'Not found' });
    res.json(prompt);
  });

  // Add prompt
  app.post('/prompts', async (req, res) => {
    const prompt = await promptApp.addPrompt(req.body);
    res.status(201).json(prompt);
  });

  // Update prompt
  app.put('/prompts/:id', async (req, res) => {
    const updated = await promptApp.updatePrompt(req.params.id, req.body);
    res.json(updated);
  });

  // Delete prompt
  app.delete('/prompts/:id', async (req, res) => {
    await promptApp.deletePrompt(req.params.id);
    res.status(204).send();
  });

  // TODO: OpenAPI, error mapping, middleware, health-check

  return app;
}
