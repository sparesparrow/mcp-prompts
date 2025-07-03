// TEMPORARY WORKAROUND: Unblock typechecking for MCP SDK
// @ts-ignore
import { MCPServer } from '@modelcontextprotocol/sdk';
import { z } from 'zod';
import {
  PromptSchema,
  PromptIdSchema,
} from './schemas.js';
import type { IPromptApplication } from '@mcp-prompts/core';

export function startMcpServer(promptApp: IPromptApplication) {
  const server = MCPServer({
    methods: {
      addPrompt: {
        input: PromptSchema,
        output: PromptSchema,
        handler: async ({ input }: { input: any }) => promptApp.addPrompt(input),
      },
      getPromptById: {
        input: z.object({ id: PromptIdSchema }),
        output: PromptSchema.nullable(),
        handler: async ({ input }: { input: any }) => promptApp.getPromptById(input.id),
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
