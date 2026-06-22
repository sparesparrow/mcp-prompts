#!/usr/bin/env node

import { Command } from 'commander';
// AWS adapters are archived - using memory adapters only
import { MemoryPromptRepository, MemoryCatalogRepository, MemoryEventBus, loadSamplePrompts } from './adapters/memory-adapter';
import { PromptService } from './core/services/prompt.service';
import { PromptIndexingService } from './core/services/prompt-indexing.service';
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true
    }
  }
});

const program = new Command();

program
  .name('mcp-prompts')
  .description('MCP Prompts CLI with AWS integration')
  .version('3.12.4');

// Initialize services
function getServices() {
  // Using memory adapters only (AWS adapters are archived)
  logger.info('Using memory storage adapters');
  const promptRepository = new MemoryPromptRepository();
  const catalogRepository = new MemoryCatalogRepository();
  const eventBus = new MemoryEventBus();
  
  // Load sample prompts for memory mode
  loadSamplePrompts();
  
  const promptService = new PromptService(
    promptRepository,
    catalogRepository,
    eventBus
  );
  const indexingService = new PromptIndexingService(
    promptRepository,
    catalogRepository
  );

  return {
    promptRepository,
    catalogRepository,
    eventBus,
    promptService,
    indexingService
  };
}

// Health check command
program
  .command('health')
  .description('Check health of AWS services')
  .action(async () => {
    try {
      const { promptRepository, catalogRepository, eventBus } = getServices();
      
      logger.info('Checking AWS services health...');
      
      const [dynamoHealth, s3Health, sqsHealth] = await Promise.all([
        promptRepository.healthCheck(),
        catalogRepository.healthCheck(),
        eventBus.healthCheck()
      ]);

      const allHealthy = [dynamoHealth, s3Health, sqsHealth].every(h => h.status === 'healthy');

      logger.info('Health check results:');
      logger.info(`  DynamoDB: ${dynamoHealth.status}`);
      logger.info(`  S3: ${s3Health.status}`);
      logger.info(`  SQS: ${sqsHealth.status}`);
      logger.info(`Overall: ${allHealthy ? 'HEALTHY' : 'UNHEALTHY'}`);

      if (!allHealthy) {
        process.exit(1);
      }
    } catch (error) {
      logger.error('Health check failed:', error);
      process.exit(1);
    }
  });

// List prompts command
program
  .command('list')
  .description('List prompts')
  .option('-c, --category <category>', 'Filter by category')
  .option('-l, --limit <limit>', 'Limit number of results', '50')
  .action(async (options) => {
    try {
      const { promptService } = getServices();
      
      const prompts = options.category
        ? await promptService.getPromptsByCategory(options.category, parseInt(options.limit))
        : await promptService.getLatestPrompts(parseInt(options.limit));

      logger.info(`Found ${prompts.length} prompts:`);
      prompts.forEach(prompt => {
        logger.info(`  ${prompt.id} - ${prompt.name} (${prompt.category})`);
      });
    } catch (error) {
      logger.error('Failed to list prompts:', error);
      process.exit(1);
    }
  });

// Get prompt command
program
  .command('get <id>')
  .description('Get a specific prompt')
  .option('-v, --version <version>', 'Prompt version', 'latest')
  .action(async (id, options) => {
    try {
      const { promptService } = getServices();
      
      const prompt = await promptService.getPrompt(id, options.version);
      if (!prompt) {
        logger.error(`Prompt not found: ${id}`);
        process.exit(1);
      }

      logger.info('Prompt details:');
      logger.info(`  ID: ${prompt.id}`);
      logger.info(`  Name: ${prompt.name}`);
      logger.info(`  Description: ${prompt.description}`);
      logger.info(`  Category: ${prompt.category}`);
      logger.info(`  Version: ${prompt.version}`);
      logger.info(`  Created: ${prompt.createdAt.toISOString()}`);
      logger.info(`  Updated: ${prompt.updatedAt.toISOString()}`);
      logger.info(`  Tags: ${prompt.tags.join(', ')}`);
      logger.info(`  Variables: ${prompt.variables.join(', ')}`);
      logger.info('Template:');
      logger.info(prompt.template);
    } catch (error) {
      logger.error('Failed to get prompt:', error);
      process.exit(1);
    }
  });

// Create prompt command
program
  .command('create')
  .description('Create a new prompt')
  .option('-n, --name <name>', 'Prompt name')
  .option('-d, --description <description>', 'Prompt description')
  .option('-t, --template <template>', 'Prompt template')
  .option('-c, --category <category>', 'Prompt category', 'general')
  .option('--tags <tags>', 'Comma-separated tags')
  .option('--variables <variables>', 'Comma-separated variables')
  .action(async (options) => {
    try {
      const { promptService } = getServices();
      
      if (!options.name || !options.template) {
        logger.error('Name and template are required');
        process.exit(1);
      }

      const promptData = {
        name: options.name,
        description: options.description || '',
        template: options.template,
        category: options.category,
        tags: options.tags ? options.tags.split(',').map((t: string) => t.trim()) : [] as string[],
        variables: options.variables ? options.variables.split(',').map((v: string) => v.trim()) : [] as string[]
      };

      const prompt = await promptService.createPrompt(promptData);
      logger.info(`Created prompt: ${prompt.id}`);
    } catch (error) {
      logger.error('Failed to create prompt:', error);
      process.exit(1);
    }
  });

// Search prompts command
program
  .command('search <query>')
  .description('Search prompts')
  .option('-c, --category <category>', 'Filter by category')
  .action(async (query, options) => {
    try {
      const { promptService } = getServices();
      
      const prompts = await promptService.searchPrompts(query, options.category);
      logger.info(`Found ${prompts.length} prompts matching "${query}":`);
      prompts.forEach(prompt => {
        logger.info(`  ${prompt.id} - ${prompt.name} (${prompt.category})`);
      });
    } catch (error) {
      logger.error('Failed to search prompts:', error);
      process.exit(1);
    }
  });

// Sync catalog command
program
  .command('sync-catalog')
  .description('Sync prompts from GitHub catalog to AWS')
  .option('-r, --repo <repo>', 'GitHub repository URL', 'https://github.com/sparesparrow/mcp-prompts-catalog')
  .action(async (options) => {
    try {
      const { catalogRepository, indexingService } = getServices();
      
      logger.info('Syncing catalog from GitHub...');
      await catalogRepository.syncFromGitHub(options.repo);
      
      logger.info('Syncing prompts to DynamoDB...');
      await indexingService.syncFromCatalog();
      
      logger.info('Catalog sync completed successfully');
    } catch (error) {
      logger.error('Failed to sync catalog:', error);
      process.exit(1);
    }
  });

// Apply template command
program
  .command('apply <id>')
  .description('Apply variables to a prompt template')
  .option('-v, --variables <variables>', 'JSON string of variables')
  .action(async (id, options) => {
    try {
      const { promptService } = getServices();
      
      let variables = {};
      if (options.variables) {
        variables = JSON.parse(options.variables);
      }

      const result = await promptService.applyTemplate(id, variables);
      logger.info('Applied template:');
      logger.info(result);
    } catch (error) {
      logger.error('Failed to apply template:', error);
      process.exit(1);
    }
  });

// Start server command
program
  .command('start')
  .description('Start the MCP Prompts server')
  .option('-m, --mode <mode>', 'Server mode (mcp|http)', 'mcp')
  .option('-p, --port <port>', 'Port number', '3000')
  .option('-h, --host <host>', 'Host address', '0.0.0.0')
  .action(async (options) => {
    try {
      process.env.MODE = options.mode;
      process.env.PORT = options.port;
      process.env.HOST = options.host;
      
      // Import and start the server
      await import('./mcp-server-standalone');
    } catch (error) {
      logger.error('Failed to start server:', error);
      process.exit(1);
    }
  });

program.parse();