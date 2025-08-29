#!/usr/bin/env node
// Kompozice a start MCP serveru
import { MemoryPromptRepository } from '@adapters-memory/src/MemoryPromptRepository';
import { FilePromptRepository } from '@adapters-file/src/FilePromptRepository';
import { IPromptRepository } from '@core/ports/IPromptRepository';

// Výběr adaptéru podle proměnné prostředí
function selectRepository(): IPromptRepository {
  switch (process.env.PROMPT_STORAGE) {
    case 'file':
      return new FilePromptRepository();
    case 'memory':
    default:
      return new MemoryPromptRepository();
  }
}

async function main() {
  const repo = selectRepository();
  // Zde by následovalo napojení na aplikační port, REST/MCP server atd.
  console.log('MCP server startuje s adaptérem:', repo.constructor.name);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
