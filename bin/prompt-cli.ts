#!/usr/bin/env node

/**
 * MCP Prompts CLI
 * 
 * A simple command line interface for the MCP Prompts server.
 */

import { Command } from 'commander';
import path from 'path';
import fs from 'fs/promises';
import { FileAdapter } from '../src/adapters/file-adapter';
import { PromptService } from '../src/services/prompt-service';
import { getConfig, validateConfig } from '../src/config';

const program = new Command();

// Setup the program
program
  .name('mcp-prompts')
  .description('Command line interface for MCP Prompts')
  .version('1.0.0');

// Function to get prompt service
async function getPromptService() {
  const config = getConfig();
  validateConfig(config);
  
  // Initialize storage adapter
  let storageAdapter;
  if (config.storage.type === 'file') {
    storageAdapter = new FileAdapter(config.storage.promptsDir);
  } else {
    throw new Error(`Storage type not supported: ${config.storage.type}`);
  }
  
  await storageAdapter.connect();
  return new PromptService(storageAdapter);
}

// List prompts command
program
  .command('list')
  .description('List all prompts')
  .option('-t, --tags <tags>', 'Filter by tags (comma-separated)')
  .option('-c, --category <category>', 'Filter by category')
  .option('-T, --template', 'Show only templates')
  .option('-s, --search <term>', 'Search term')
  .action(async (options) => {
    try {
      const promptService = await getPromptService();
      
      const listOptions = {
        tags: options.tags ? options.tags.split(',') : undefined,
        category: options.category,
        isTemplate: options.template === true ? true : undefined,
        search: options.search
      };
      
      const prompts = await promptService.listPrompts(listOptions);
      console.log(JSON.stringify(prompts, null, 2));
    } catch (error: any) {
      console.error('Error listing prompts:', error.message);
      process.exit(1);
    }
  });

// Get a prompt command
program
  .command('get')
  .description('Get a prompt by ID')
  .argument('<id>', 'Prompt ID')
  .action(async (id) => {
    try {
      const promptService = await getPromptService();
      const prompt = await promptService.getPrompt(id);
      console.log(JSON.stringify(prompt, null, 2));
    } catch (error: any) {
      console.error('Error getting prompt:', error.message);
      process.exit(1);
    }
  });

// Add a prompt command
program
  .command('add')
  .description('Add a new prompt')
  .requiredOption('-n, --name <name>', 'Prompt name')
  .requiredOption('-c, --content <content>', 'Prompt content')
  .option('-d, --description <description>', 'Prompt description')
  .option('-t, --tags <tags>', 'Comma-separated tags')
  .option('-C, --category <category>', 'Prompt category')
  .option('-T, --template', 'Mark as template')
  .action(async (options) => {
    try {
      const promptService = await getPromptService();
      
      const prompt = {
        name: options.name,
        content: options.content,
        description: options.description,
        tags: options.tags ? options.tags.split(',') : undefined,
        category: options.category,
        isTemplate: options.template === true
      };
      
      const result = await promptService.addPrompt(prompt);
      console.log(`Prompt added with ID: ${result.id}`);
    } catch (error: any) {
      console.error('Error adding prompt:', error.message);
      process.exit(1);
    }
  });

// Update a prompt command
program
  .command('update')
  .description('Update an existing prompt')
  .argument('<id>', 'Prompt ID')
  .option('-n, --name <name>', 'New name')
  .option('-c, --content <content>', 'New content')
  .option('-d, --description <description>', 'New description')
  .option('-t, --tags <tags>', 'New comma-separated tags')
  .option('-C, --category <category>', 'New category')
  .option('-T, --template <boolean>', 'Mark as template (true/false)')
  .action(async (id, options) => {
    try {
      const promptService = await getPromptService();
      
      const updateData: any = {};
      if (options.name) updateData.name = options.name;
      if (options.content) updateData.content = options.content;
      if (options.description) updateData.description = options.description;
      if (options.tags) updateData.tags = options.tags.split(',');
      if (options.category) updateData.category = options.category;
      if (options.template) updateData.isTemplate = options.template === 'true';
      
      const result = await promptService.updatePrompt(id, updateData);
      console.log(`Prompt updated: ${result.id}`);
    } catch (error: any) {
      console.error('Error updating prompt:', error.message);
      process.exit(1);
    }
  });

// Delete a prompt command
program
  .command('delete')
  .description('Delete a prompt')
  .argument('<id>', 'Prompt ID')
  .action(async (id) => {
    try {
      const promptService = await getPromptService();
      await promptService.deletePrompt(id);
      console.log(`Prompt deleted: ${id}`);
    } catch (error: any) {
      console.error('Error deleting prompt:', error.message);
      process.exit(1);
    }
  });

// Apply a template command
program
  .command('apply')
  .description('Apply a template prompt')
  .argument('<id>', 'Template ID')
  .requiredOption('-v, --variables <variables>', 'JSON string of variables')
  .action(async (id, options) => {
    try {
      const promptService = await getPromptService();
      
      let variables;
      try {
        variables = JSON.parse(options.variables);
      } catch (error: any) {
        throw new Error('Invalid JSON for variables');
      }
      
      const result = await promptService.applyTemplate(id, variables);
      console.log(result.content);
    } catch (error: any) {
      console.error('Error applying template:', error.message);
      process.exit(1);
    }
  });

// Import prompts command
program
  .command('import')
  .description('Import prompts from a JSON file')
  .argument('<file>', 'JSON file containing prompts')
  .option('-y, --yes', 'Skip confirmation')
  .action(async (file, options) => {
    try {
      const promptService = await getPromptService();
      
      // Read file
      const content = await fs.readFile(file, 'utf8');
      const prompts = JSON.parse(content);
      
      if (!Array.isArray(prompts)) {
        throw new Error('File does not contain an array of prompts');
      }
      
      // Confirm import
      if (!options.yes) {
        console.log(`About to import ${prompts.length} prompts.`);
        console.log('Press Ctrl+C to cancel or Enter to continue...');
        await new Promise(resolve => process.stdin.once('data', resolve));
      }
      
      // Import prompts
      for (const promptData of prompts) {
        try {
          const result = await promptService.addPrompt(promptData);
          console.log(`Imported prompt: ${result.id}`);
        } catch (error: any) {
          console.error(`Error importing prompt: ${error.message}`);
        }
      }
      
      console.log('Import completed');
    } catch (error: any) {
      console.error('Error importing prompts:', error.message);
      process.exit(1);
    }
  });

// Export prompts command
program
  .command('export')
  .description('Export prompts to a JSON file')
  .argument('[file]', 'Output file (default: prompts.json)', 'prompts.json')
  .option('-t, --tags <tags>', 'Filter by tags (comma-separated)')
  .option('-c, --category <category>', 'Filter by category')
  .option('-T, --template', 'Export only templates')
  .action(async (file, options) => {
    try {
      const promptService = await getPromptService();
      
      const listOptions = {
        tags: options.tags ? options.tags.split(',') : undefined,
        category: options.category,
        isTemplate: options.template === true ? true : undefined
      };
      
      const prompts = await promptService.listPrompts(listOptions);
      
      const outputPath = path.resolve(file);
      await fs.writeFile(outputPath, JSON.stringify(prompts, null, 2), 'utf8');
      
      console.log(`Exported ${prompts.length} prompts to ${outputPath}`);
    } catch (error: any) {
      console.error('Error exporting prompts:', error.message);
      process.exit(1);
    }
  });

// Parse the command line arguments
program.parse();

// If no arguments are provided, show help
if (process.argv.length === 2) {
  program.help();
} 