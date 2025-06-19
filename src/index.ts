#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { createStorageAdapter } from './adapters.js';
import { startHttpServer } from './http-server.js';
import { loadConfig } from './config.js';
import { initializeDefaultPrompts } from './data/defaults.js';
import { promptSchemas } from './schemas.js';
import { applyTemplate } from './utils.js';
import { Prompt, StorageAdapter } from './interfaces.js';
import { randomUUID } from 'crypto';
import { PromptService } from './prompt-service.js';
import { SequenceServiceImpl } from './sequence-service.js';

type AddPromptInput = z.infer<typeof promptSchemas.add>;
type UpdatePromptInput = z.infer<typeof promptSchemas.update>;

/**
 * Main function to initialize and run the MCP Prompts Server.
 */
async function main() {
  const config = loadConfig();
  // Only allow valid storage types for StorageConfig
  const allowedTypes = ['file', 'memory', 'postgres'] as const;
  let storageType: 'file' | 'memory' | 'postgres' = 'file';
  if (allowedTypes.includes(config.storageType as any)) {
    storageType = config.storageType as 'file' | 'memory' | 'postgres';
  }
  const storageConfig: import('./interfaces.js').StorageConfig = {
    type: storageType,
    promptsDir: config.promptsDir,
    backupsDir: config.backupsDir,
    pgHost: config.postgres?.host,
    pgPort: config.postgres?.port,
    pgUser: config.postgres?.user,
    pgPassword: config.postgres?.password,
    pgDatabase: config.postgres?.database,
  };
  const storageAdapter: StorageAdapter = createStorageAdapter(storageConfig);
  await storageAdapter.connect();
  const promptService = new PromptService(storageAdapter);
  const sequenceService = new SequenceServiceImpl(storageAdapter);

  const args = process.argv.slice(2);

  // CLI command handling
  if (args.length > 0 && args[0] === 'sequence' && args[1] === 'run' && args[2]) {
    const sequenceId = args[2];
    try {
      const { prompts } = await sequenceService.getSequenceWithPrompts(sequenceId);
      console.log(`--- Running sequence: ${sequenceId} ---`);
      prompts.forEach((prompt, index) => {
        console.log(`\n--- Prompt ${index + 1}: ${prompt.name} (${prompt.id}) ---\n`);
        console.log(prompt.content);
      });
      console.log(`\n--- Sequence finished ---`);
    } catch (error: any) {
      console.error(`Error running sequence: ${error.message}`);
      process.exit(1);
    }
    return; // Exit after command execution
  }

  // Default server startup
  console.log(`Starting MCP Prompts Server v${config.version}...`);
  
  await initializeDefaultPrompts(storageAdapter);

  if (config.httpServer) {
    await startHttpServer(
      null,
      {
        port: config.port,
        host: config.host,
        corsOrigin: config.corsOrigin,
        enableSSE: config.enableSSE,
        ssePath: config.ssePath,
      },
      { promptService, sequenceService }
    );
  }

  // TODO: MCP SDK integrace byla odstraněna kvůli změně API.
  // Pro opětovné přidání použijte aktuální pattern podle dokumentace MCP SDK:
  // - Vytvořte instanci Server s parametry name, version, capabilities
  // - Zaregistrujte tools/resources pomocí setupTools/server.connect atd.
  // - Viz příklady v rules/mcp-integration.mdc nebo v oficiální dokumentaci SDK
  //
  // Příklad:
  // const server = new Server({ name: 'mcp-prompts', version: config.version }, { ...capabilities });
  // setupPromptTools(server, promptService, ...);
  // const transport = new StdioServerTransport();
  // await server.connect(transport);
  //
  // Zatím běží pouze HTTP server.

  console.log('MCP Prompts Server is running.');
}

// Execute the main function
main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});