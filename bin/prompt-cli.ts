#!/usr/bin/env node

/**
 * Prompt Management CLI
 * 
 * A unified command line interface for managing prompts, including:
 * - Importing prompts from various sources
 * - Exporting prompts to different formats
 * - Processing raw prompts
 * - Managing tags
 */

import * as promptManagement from '../src/core/prompt-management';

// Get command and arguments
const args = process.argv.slice(2);
const command = args[0];

// Help function
function showHelp() {
  console.log(`
MCP Prompts CLI

Usage: 
  npx prompt-cli <command> [options]

Commands:
  import       Import prompts from a file or directory
  export       Export prompts to a file
  process      Process raw prompts
  tags         Manage prompt tags

Options:
  Run a command with --help to see command-specific options
  `);
}

// Show help if no command is provided
if (!command) {
  showHelp();
  process.exit(0);
}

// Handle import command
async function handleImport() {
  const source = args.find(arg => !arg.startsWith('-') && arg !== 'import')
    || args.find(arg => arg.startsWith('--source='))?.split('=')[1];
  const skipConfirm = args.includes('--yes') || args.includes('-y');
  const dryRun = args.includes('--dry-run');
  const force = args.includes('--force') || args.includes('-f');
  const showHelp = args.includes('--help') || args.includes('-h');
  
  if (showHelp) {
    console.log(`
Import prompts from a file or directory

Usage:
  npx prompt-cli import <source> [options]

Options:
  --source=<path>   Source file or directory (can also be provided as first argument)
  --dry-run         Show what would be imported without making changes
  --force, -f       Force import even if prompts already exist
  --yes, -y         Skip confirmation prompt
  --help, -h        Show this help
    `);
    return;
  }
  
  await promptManagement.runImport({
    source,
    skipConfirm,
    dryRun,
    force
  });
}

// Handle export command
async function handleExport() {
  const format = args.find(arg => arg.startsWith('--format='))?.split('=')[1] || 'json';
  const tags = args.find(arg => arg.startsWith('--tags='))?.split('=')[1]?.split(',') || [];
  const outFile = args.find(arg => arg.startsWith('--out='))?.split('=')[1];
  const showHelp = args.includes('--help') || args.includes('-h');
  
  if (showHelp) {
    console.log(`
Export prompts to a file

Usage:
  npx prompt-cli export [options]

Options:
  --format=<format>   Export format (json, markdown) [default: json]
  --tags=<tags>       Filter by tags (comma-separated)
  --out=<file>        Output file path
  --help, -h          Show this help
    `);
    return;
  }
  
  await promptManagement.runExport({
    format: format as any,
    tags,
    outFile
  });
}

// Handle process command
function handleProcess() {
  const shouldCleanup = !args.includes('--no-cleanup');
  const shouldBackup = args.includes('--backup');
  const rawPromptsFile = args.find(arg => arg.startsWith('--file='))?.split('=')[1];
  const showHelp = args.includes('--help') || args.includes('-h');
  
  if (showHelp) {
    console.log(`
Process raw prompts from a text file

Usage:
  npx prompt-cli process [options]

Options:
  --file=<path>     Raw prompts file path [default: ./rawprompts.txt]
  --backup          Create a backup of the raw prompts file
  --no-cleanup      Do not delete the raw prompts file after processing
  --help, -h        Show this help
    `);
    return;
  }
  
  promptManagement.processRawPrompts({
    shouldCleanup,
    shouldBackup,
    rawPromptsFile
  });
}

// Handle tags command
async function handleTags() {
  const action = args[1] || 'list';
  const tag = args.find(arg => arg.startsWith('--tag='))?.split('=')[1];
  const newTag = args.find(arg => arg.startsWith('--new-tag='))?.split('=')[1];
  const promptIds = args.find(arg => arg.startsWith('--prompts='))?.split('=')[1]?.split(',') || [];
  const showHelp = args.includes('--help') || args.includes('-h');
  
  if (showHelp) {
    console.log(`
Manage prompt tags

Usage:
  npx prompt-cli tags <action> [options]

Actions:
  list              List all tags (default)
  add               Add a tag to prompts
  remove            Remove a tag from prompts
  rename            Rename a tag

Options:
  --tag=<tag>           Tag to add, remove, or rename
  --new-tag=<tag>       New tag name (for rename action)
  --prompts=<ids>       Prompt IDs (comma-separated, for add/remove actions)
  --help, -h            Show this help
    `);
    return;
  }
  
  await promptManagement.manageTags({
    action: action as any,
    tag,
    newTag,
    promptIds
  });
}

// Run the appropriate command
(async () => {
  try {
    switch (command) {
      case 'import':
        await handleImport();
        break;
      case 'export':
        await handleExport();
        break;
      case 'process':
        handleProcess();
        break;
      case 'tags':
        await handleTags();
        break;
      case '--help':
      case '-h':
        showHelp();
        break;
      default:
        console.error(`Unknown command: ${command}`);
        showHelp();
        process.exit(1);
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
})(); 