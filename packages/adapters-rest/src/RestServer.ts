import express, { Request, Response, NextFunction } from 'express';
import type { IPromptApplication } from '@sparesparrow/mcp-prompts-core';

export function createRestServer(promptApp: IPromptApplication): express.Application {
  const app = express();
  app.use(express.json());

  // List prompts
  app.get('/prompts', (req: Request, res: Response, next: NextFunction) => {
    promptApp.listPrompts()
      .then((prompts: any) => res.json(prompts))
      .catch(next);
  });

  // Get prompt by id
  app.get('/prompts/:id', (req: Request, res: Response, next: NextFunction) => {
    promptApp.getPromptById(req.params.id)
      .then((prompt: any) => {
        if (!prompt) return res.status(404).json({ error: 'Not found' });
        res.json(prompt);
      })
      .catch(next);
  });

  // Add prompt
  app.post('/prompts', (req: Request, res: Response, next: NextFunction) => {
    promptApp.addPrompt(req.body)
      .then((prompt: any) => res.status(201).json(prompt))
      .catch(next);
  });

  // Update prompt
  app.put('/prompts/:id', (req: Request, res: Response, next: NextFunction) => {
    promptApp.updatePrompt(req.params.id, req.body)
      .then((updated: any) => res.json(updated))
      .catch(next);
  });

  // Delete prompt
  app.delete('/prompts/:id', (req: Request, res: Response, next: NextFunction) => {
    promptApp.deletePrompt(req.params.id)
      .then(() => res.status(204).send())
      .catch(next);
  });

  // TODO: OpenAPI, error mapping, middleware, health-check

  return app;
}
