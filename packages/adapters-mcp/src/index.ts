// MCP Server Adapter – DI implementation
import { createServer } from '@modelcontextprotocol/sdk';
import { z } from 'zod';
import {
  PromptSchema,
  PromptIdSchema,
} from './schemas';
import type { IPromptApplication } from '@mcp-prompts/core/src/ports/IPromptApplication';

export function startMcpServer(promptApp: IPromptApplication) {
  const server = createServer({
    methods: {
      addPrompt: {
        input: PromptSchema,
        output: PromptSchema,
        handler: async ({ input }) => promptApp.addPrompt(input),
      },
      getPromptById: {
        input: z.object({ id: PromptIdSchema }),
        output: PromptSchema.nullable(),
        handler: async ({ input }) => promptApp.getPromptById(input.id),
      },
      listPrompts: {
        input: z.void(),
        output: z.array(PromptSchema),
        handler: async () => promptApp.listPrompts(),
      },
      // Další metody lze přidat obdobně
    },
  });

  // Výběr transportu podle proměnné prostředí
  const transport = process.env.MCP_TRANSPORT || 'stdio';
  if (transport === 'stdio') {
    server.listen();
  } else if (transport === 'sse') {
    // server.listenSSE(); // Příklad, záleží na SDK
  }

  return server;
}
