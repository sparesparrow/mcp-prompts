import { container } from 'tsyringe';
import { createRestServer } from '@sparesparrow/mcp-prompts-adapters-rest';

export function startRest() {
  const promptApp = container.resolve('IPromptApplication');
  const app = createRestServer(promptApp);
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`REST API listening on http://localhost:${port}`);
  });
}
