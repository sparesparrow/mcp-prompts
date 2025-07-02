import express from 'express';
import type { Request, Response } from 'express';
import { addPrompt } from '../../../packages/core/src/usecases/AddPrompt';
import { listPrompts } from '../../../packages/core/src/usecases/ListPrompts';
import { getPrompt } from '../../../packages/core/src/usecases/GetPrompt';
import { FilePromptRepository } from '../../../packages/adapters-file/src/FilePromptRepository';

export async function startHttpServer() {
  const app = express();
  app.use(express.json());

  // Configure adapter (in real app, use config/env)
  const repo = new FilePromptRepository({ promptsDir: './data/prompts' });
  await repo.connect();

  app.get('/prompts', async (req: Request, res: Response) => {
    const prompts = await listPrompts(repo);
    res.json(prompts);
  });

  app.get('/prompts/:id', async (req: Request, res: Response) => {
    const prompt = await getPrompt(repo, req.params.id);
    if (!prompt) return res.status(404).json({ error: 'Not found' });
    res.json(prompt);
  });

  app.post('/prompts', async (req: Request, res: Response) => {
    try {
      const prompt = await addPrompt(repo, req.body);
      res.status(201).json(prompt);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`HTTP server listening on port ${port}`);
  });
}
