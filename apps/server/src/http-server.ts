import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { addPrompt, listPrompts, getPromptById } from '@mcp-prompts/core';
import { FilePromptRepository } from '@mcp-prompts/adapters-file';

export async function startHttpServer() {
  const app = express();
  app.use(express.json());

  // Configure adapter (in real app, use config/env)
  const repo = new FilePromptRepository({ promptsDir: './data/prompts' });
  await repo.connect();

  app.get('/prompts', (req: Request, res: Response, next: NextFunction) => {
    listPrompts(repo)
      .then((prompts: any) => res.json(prompts))
      .catch(next);
  });

  app.get('/prompts/:id', (req: Request, res: Response, next: NextFunction) => {
    getPromptById(repo, req.params.id)
      .then((prompt: any) => {
        if (!prompt) return res.status(404).json({ error: 'Not found' });
        res.json(prompt);
      })
      .catch(next);
  });

  app.post('/prompts', (req: Request, res: Response, next: NextFunction) => {
    addPrompt(repo, req.body)
      .then((prompt: any) => res.status(201).json(prompt))
      .catch((err: any) => res.status(400).json({ error: err.message }));
  });

  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`HTTP server listening on port ${port}`);
  });
}
