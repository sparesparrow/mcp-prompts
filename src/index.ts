/**
 * MCP Prompts Server
 * Main entry point for the MCP Prompts Server
 */

import { Command } from 'commander';
import { Config, createConfig } from './core';
import { startServer } from './server';
import { setupCLI } from './cli';

// Export components
export * from './core';
export * from './storage';
export * from './server';
export * from './cli';

/**
 * Start the MCP Prompts Server
 * @param overrides Configuration overrides
 * @returns A promise that resolves with the HTTP server
 */
export async function startPromptServer(overrides: Partial<Config> = {}): Promise<any> {
  const config = createConfig(overrides);
  return startServer(config);
}

// If this file is run directly, set up the CLI
if (require.main === module) {
  const program = new Command();
  
  program
    .description('MCP Prompts Server')
    .version('1.1.0');
  
  // Start server command
  program
    .command('start')
    .description('Start the MCP Prompts Server')
    .option('-p, --port <port>', 'Port to listen on', '3000')
    .option('-h, --host <host>', 'Host to bind to', 'localhost')
    .option('-s, --storage <type>', 'Storage type (file, pgai)', 'file')
    .option('-d, --dir <directory>', 'Storage directory for file storage', './prompts')
    .option('-c, --connection <string>', 'PostgreSQL connection string for PGAI storage')
    .action(async (options) => {
      try {
        const config: Partial<Config> = {
          server: {
            port: parseInt(options.port, 10),
            host: options.host
          },
          storage: {
            type: options.storage as 'file' | 'pgai',
            options: options.storage === 'file' 
              ? { baseDir: options.dir }
              : { connectionString: options.connection }
          }
        };
        
        // Validate PGAI configuration
        if (options.storage === 'pgai' && !options.connection) {
          console.error('Error: PostgreSQL connection string is required for PGAI storage');
          console.error('Example: --connection "postgresql://user:password@localhost:5432/dbname"');
          process.exit(1);
        }
        
        await startPromptServer(config);
      } catch (error) {
        console.error('Error starting server:', error);
        process.exit(1);
      }
    });
  
  // Add CLI commands from cli.ts
  const cli = setupCLI();
  cli.commands.forEach(cmd => {
    program.addCommand(cmd);
  });
  
  program.parse(process.argv);
}