#!/usr/bin/env node

import { PromptService } from '../core/services/prompt.service';
import { SlashCommandsService } from '../core/services/slash-commands.service';
import { IPromptRepository } from '../core/ports/prompt-repository.interface';

export class McpServer {
  private promptService: PromptService;
  private slashCommandsService!: SlashCommandsService;
  private initialized: boolean = false;
  private buffer: string = '';

  public constructor(promptService: PromptService, promptRepository?: IPromptRepository) {
    this.promptService = promptService;
    if (promptRepository) {
      this.slashCommandsService = new SlashCommandsService(promptRepository);
    }
  }

  public async start(): Promise<void> {
    console.log('Starting MCP server in stdio mode...');
    
    // Simple MCP server implementation using stdio
    process.stdin.setEncoding('utf8');
    process.stdout.setEncoding('utf8');

    // Handle stdin data with proper JSON-RPC message parsing
    process.stdin.on('data', async (data) => {
      try {
        this.buffer += data.toString();
        
        // Process complete JSON-RPC messages (one per line)
        const lines = this.buffer.split('\n');
        this.buffer = lines.pop() || ''; // Keep incomplete line in buffer
        
        for (const line of lines) {
          if (line.trim()) {
            try {
              const request = JSON.parse(line);
              await this.handleRequest(request);
            } catch (parseError) {
              console.error('Error parsing JSON:', parseError);
              // Try to send error response if we can extract an ID
              if (line.includes('"id"')) {
                try {
                  const partial = JSON.parse(line);
                  if (partial.id !== undefined) {
                    this.sendError(partial.id, -32700, 'Parse error', 'Invalid JSON');
                  }
                } catch {
                  // Ignore if we can't parse at all
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('Error processing request:', error);
      }
    });

    // Handle stdin end
    process.stdin.on('end', () => {
      console.log('MCP Server stdin closed');
      process.exit(0);
    });

    // Handle errors
    process.stdin.on('error', (error) => {
      console.error('MCP Server stdin error:', error);
      process.exit(1);
    });

    // Handle stdout errors and close events
    process.stdout.on('error', (error) => {
      console.error('MCP Server stdout error:', error);
      // Don't exit immediately - let the client handle reconnection
    });

    process.stdout.on('close', () => {
      console.log('MCP Server stdout closed');
      // Client disconnected, exit gracefully
      process.exit(0);
    });
    
    console.log('MCP Server started with stdio transport, waiting for initialize request...');
  }

  private sendResponse(id: any, result?: any, error?: any): void {
    // Check if stdout is still writable
    if (process.stdout.destroyed || process.stdout.closed) {
      console.error('Cannot send response: stdout is closed');
      return;
    }

    const response: any = {
      jsonrpc: '2.0',
      id
    };
    
    if (error) {
      response.error = error;
    } else {
      response.result = result;
    }
    
    try {
      const output = JSON.stringify(response) + '\n';
      // Write to stdout - for stdio, this should be synchronous
      const written = process.stdout.write(output);
      if (written === false) {
        // If write returns false, wait for drain event
        process.stdout.once('drain', () => {
          // Already written, just need to wait
        });
      }
    } catch (err) {
      console.error('Error sending response:', err);
      // Don't try to send another error if stdout is broken
      if (!process.stdout.destroyed && !process.stdout.closed && id !== undefined && id !== null) {
        try {
          const errorResponse = JSON.stringify({
            jsonrpc: '2.0',
            id,
            error: {
              code: -32000,
              message: 'Server error',
              data: err instanceof Error ? err.message : 'Failed to send response'
            }
          }) + '\n';
          process.stdout.write(errorResponse);
        } catch {
          // Ignore if we can't even send the error
        }
      }
    }
  }

  private sendError(id: any, code: number, message: string, data?: any): void {
    this.sendResponse(id, undefined, {
      code,
      message,
      data
    });
  }

  private async handleRequest(request: any): Promise<void> {
    // Validate JSON-RPC 2.0 structure
    if (request.jsonrpc !== '2.0') {
      if (request.id !== undefined) {
        this.sendError(request.id, -32600, 'Invalid Request', 'jsonrpc must be "2.0"');
      }
      return;
    }

    const isNotification = request.id === undefined || request.id === null;
    const requestId = request.id;

    try {
      // Handle initialize request (must be first)
      if (request.method === 'initialize') {
        if (this.initialized) {
          this.sendError(requestId, -32002, 'Invalid Request', 'Server already initialized');
          return;
        }

        const result = {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {},
            prompts: {}
          },
          serverInfo: {
            name: 'mcp-prompts-aws',
            version: '3.12.3'
          }
        };

        this.initialized = true;
        this.sendResponse(requestId, result);
        console.log('MCP Server initialized successfully');
        return;
      }

      // Handle initialized notification
      if (request.method === 'initialized') {
        // Notifications don't get responses
        // This is just an acknowledgment from the client
        return;
      }

      // All other methods require initialization
      if (!this.initialized) {
        this.sendError(requestId, -32002, 'Invalid Request', 'Server not initialized');
        return;
      }

      // Handle tools/list
      if (request.method === 'tools/list') {
        const response = await this.handleToolsList();
        this.sendResponse(requestId, response);
        return;
      }

      // Handle tools/call
      if (request.method === 'tools/call') {
        const response = await this.handleToolsCall(request.params);
        if (response.error) {
          this.sendError(requestId, response.error.code || -32603, response.error.message || 'Internal error', response.error.data);
        } else {
          this.sendResponse(requestId, response.result);
        }
        return;
      }

      // Unknown method
      this.sendError(requestId, -32601, 'Method not found', `Unknown method: ${request.method}`);
    } catch (error) {
      console.error('Error handling request:', error);
      if (!isNotification) {
        this.sendError(requestId, -32603, 'Internal error', error instanceof Error ? error.message : 'Unknown error');
      }
    }
  }

  private async handleToolsList(): Promise<any> {
    return {
      tools: [
        {
          name: 'get_prompt',
          description: 'Get a prompt by ID',
          inputSchema: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Prompt ID' },
              version: { type: 'string', description: 'Prompt version (optional)' }
            },
            required: ['id']
          }
        },
        {
          name: 'list_prompts',
          description: 'List prompts by category or get latest prompts',
          inputSchema: {
            type: 'object',
            properties: {
              category: { type: 'string', description: 'Category to filter by (optional)' },
              limit: { type: 'number', description: 'Maximum number of prompts to return (default: 50)' }
            }
          }
        },
        {
          name: 'search_prompts',
          description: 'Search prompts by query',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search query' },
              category: { type: 'string', description: 'Category to filter by (optional)' }
            },
            required: ['query']
          }
        },
        {
          name: 'apply_template',
          description: 'Apply variables to a prompt template',
          inputSchema: {
            type: 'object',
            properties: {
              promptId: { type: 'string', description: 'Prompt ID' },
              variables: { type: 'object', description: 'Variables to apply' }
            },
            required: ['promptId', 'variables']
          }
        },
        {
          name: 'create_prompt',
          description: 'Create a new prompt',
          inputSchema: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Prompt name' },
              content: { type: 'string', description: 'Prompt content' },
              category: { type: 'string', description: 'Prompt category' },
              tags: { type: 'array', items: { type: 'string' }, description: 'Prompt tags' },
              isTemplate: { type: 'boolean', description: 'Whether this is a template' },
              variables: { type: 'array', items: { type: 'string' }, description: 'Template variables' }
            },
            required: ['name', 'content']
          }
        },
        {
          name: 'update_prompt',
          description: 'Update an existing prompt',
          inputSchema: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Prompt ID' },
              name: { type: 'string', description: 'Prompt name' },
              content: { type: 'string', description: 'Prompt content' },
              category: { type: 'string', description: 'Prompt category' },
              tags: { type: 'array', items: { type: 'string' }, description: 'Prompt tags' },
              isTemplate: { type: 'boolean', description: 'Whether this is a template' },
              variables: { type: 'array', items: { type: 'string' }, description: 'Template variables' }
            },
            required: ['id']
          }
        },
        {
          name: 'slash_command',
          description: 'Execute a slash command to quickly apply a prompt template',
          inputSchema: {
            type: 'object',
            properties: {
              command: { type: 'string', description: 'Slash command (e.g., "/code-review", "/bug-analyzer")' },
              variables: { type: 'object', description: 'Variables to apply to the command template' }
            },
            required: ['command']
          }
        },
        {
          name: 'list_slash_commands',
          description: 'List available slash commands',
          inputSchema: {
            type: 'object',
            properties: {
              category: { type: 'string', description: 'Filter by category (optional)' },
              limit: { type: 'number', description: 'Maximum number of commands to return (default: 20)' }
            }
          }
        },
        {
          name: 'suggest_slash_commands',
          description: 'Get slash command suggestions based on a query',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search query for command suggestions' },
              limit: { type: 'number', description: 'Maximum number of suggestions to return (default: 10)' }
            },
            required: ['query']
          }
        },
        {
          name: 'delete_prompt',
          description: 'Delete a prompt',
          inputSchema: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Prompt ID' }
            },
            required: ['id']
          }
        }
      ]
    };
  }

  private async handleToolsCall(params: any): Promise<{ result?: any; error?: any }> {
    const { name, arguments: args } = params || {};

    if (!name) {
      return {
        error: {
          code: -32602,
          message: 'Invalid params',
          data: 'Tool name is required'
        }
      };
    }

    try {
      let result: any;
      switch (name) {
        case 'get_prompt':
          const prompt = await this.promptService.getPrompt(args?.id, args?.version);
          result = prompt ? prompt.toJSON() : null;
          break;
        
        case 'list_prompts':
          const prompts = args?.category
            ? await this.promptService.getPromptsByCategory(args.category, args.limit || 50)
            : await this.promptService.getLatestPrompts(args?.limit || 50);
          result = prompts.map(p => p.toJSON());
          break;
        
        case 'search_prompts':
          if (!args?.query) {
            throw new Error('Query parameter is required');
          }
          const searchResults = await this.promptService.searchPrompts(args.query, args.category);
          result = searchResults.map(p => p.toJSON());
          break;
        
        case 'apply_template':
          if (!args?.promptId || !args?.variables) {
            throw new Error('promptId and variables are required');
          }
          result = await this.promptService.applyTemplate(args.promptId, args.variables);
          break;
        
        case 'create_prompt':
          if (!args?.name || !args?.content) {
            throw new Error('name and content are required');
          }
          const newPrompt = await this.promptService.createPrompt(args);
          result = newPrompt.toJSON();
          break;

        case 'update_prompt':
          if (!args?.id) {
            throw new Error('id is required');
          }
          const updatedPrompt = await this.promptService.updatePrompt(args.id, args);
          result = updatedPrompt.toJSON();
          break;

        case 'delete_prompt':
          if (!args?.id) {
            throw new Error('id is required');
          }
          await this.promptService.deletePrompt(args.id);
          result = 'Prompt deleted successfully';
          break;

        case 'slash_command':
          if (!this.slashCommandsService) {
            throw new Error('Slash commands not available');
          }
          if (!args?.command) {
            throw new Error('command is required');
          }
          result = await this.slashCommandsService.executeCommand(args.command, args.variables || {});
          break;

        case 'list_slash_commands':
          if (!this.slashCommandsService) {
            throw new Error('Slash commands not available');
          }
          const commands = args?.category
            ? await this.slashCommandsService.getCommandsByCategory(args.category)
            : await this.slashCommandsService.getAvailableCommands();
          result = commands.slice(0, args?.limit || 20);
          break;

        case 'suggest_slash_commands':
          if (!this.slashCommandsService) {
            throw new Error('Slash commands not available');
          }
          if (!args?.query) {
            throw new Error('query is required');
          }
          result = await this.slashCommandsService.getCommandSuggestions(args.query, args.limit || 10);
          break;

        default:
          return {
            error: {
              code: -32601,
              message: 'Method not found',
              data: `Unknown tool: ${name}`
            }
          };
      }

      return {
        result: {
          content: [
            {
              type: 'text',
              text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
            }
          ]
        }
      };
    } catch (error) {
      return {
        error: {
          code: -32603,
          message: 'Internal error',
          data: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  // Legacy methods for HTTP compatibility
  public getCapabilities(): any {
    return {
      name: 'mcp-prompts-aws',
      version: '1.0.0',
      capabilities: {
        tools: {},
        prompts: {},
      },
    };
  }

  public getTools(): any[] {
    return [
      {
        name: 'get_prompt',
        description: 'Get a prompt by ID',
      },
      {
        name: 'list_prompts',
        description: 'List prompts by category or get latest prompts',
      },
      {
        name: 'search_prompts',
        description: 'Search prompts by query',
      },
      {
        name: 'apply_template',
        description: 'Apply variables to a prompt template',
      },
      {
        name: 'create_prompt',
        description: 'Create a new prompt',
      },
      {
        name: 'update_prompt',
        description: 'Update an existing prompt',
      },
      {
        name: 'delete_prompt',
        description: 'Delete a prompt',
      },
    ];
  }

  public async executeTool(toolName: string, args: any): Promise<any> {
    // Legacy tool execution for HTTP compatibility
    try {
      switch (toolName) {
        case 'get_prompt':
          const prompt = await this.promptService.getPrompt(args.id, args.version);
          return { result: prompt ? prompt.toJSON() : null };
        
        case 'list_prompts':
          const prompts = args.category
            ? await this.promptService.getPromptsByCategory(args.category, args.limit || 50)
            : await this.promptService.getLatestPrompts(args.limit || 50);
          return { result: prompts.map(p => p.toJSON()) };
        
        case 'search_prompts':
          const searchResults = await this.promptService.searchPrompts(args.query, args.category);
          return { result: searchResults.map(p => p.toJSON()) };
        
        case 'apply_template':
          const result = await this.promptService.applyTemplate(args.promptId, args.variables);
          return { result };
        
        case 'create_prompt':
          const newPrompt = await this.promptService.createPrompt(args);
          return { result: newPrompt.toJSON() };

        case 'update_prompt':
          const updatedPrompt = await this.promptService.updatePrompt(args.id, args);
          return { result: updatedPrompt.toJSON() };

        case 'delete_prompt':
          await this.promptService.deletePrompt(args.id);
          return { result: 'Prompt deleted successfully' };
        
        default:
          throw new Error(`Unknown tool: ${toolName}`);
      }
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}