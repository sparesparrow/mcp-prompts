#!/usr/bin/env node

import { PromptService } from '../core/services/prompt.service';

export class McpServer {
  private promptService: PromptService;

  public constructor(promptService: PromptService) {
    this.promptService = promptService;
  }

  public async start(): Promise<void> {
    console.log('Starting MCP server in stdio mode...');
    
    // Simple MCP server implementation using stdio
    process.stdin.setEncoding('utf8');
    process.stdout.setEncoding('utf8');

    let requestId = 0;

    process.stdin.on('data', async (data) => {
      try {
        const lines = data.toString().trim().split('\n');
        for (const line of lines) {
          if (line.trim()) {
            const request = JSON.parse(line);
            const response = await this.handleRequest(request, ++requestId);
            if (response) {
              process.stdout.write(JSON.stringify(response) + '\n');
            }
          }
        }
      } catch (error) {
        console.error('Error processing request:', error);
        const errorResponse = {
          jsonrpc: '2.0',
          id: requestId,
          error: {
            code: -32603,
            message: 'Internal error',
            data: error instanceof Error ? error.message : 'Unknown error'
          }
        };
        process.stdout.write(JSON.stringify(errorResponse) + '\n');
      }
    });

    // Send initialization response
    const initResponse = {
      jsonrpc: '2.0',
      id: 1,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {},
          prompts: {}
        },
        serverInfo: {
          name: 'mcp-prompts-aws',
          version: '1.0.0'
        }
      }
    };
    process.stdout.write(JSON.stringify(initResponse) + '\n');
    
    console.log('MCP Server started with stdio transport');
  }

  private async handleRequest(request: any, id: number): Promise<any> {
    if (request.method === 'tools/list') {
      return {
        jsonrpc: '2.0',
        id,
        result: {
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
        }
      };
    }

    if (request.method === 'tools/call') {
      const { name, arguments: args } = request.params;

      try {
        let result: any;
        switch (name) {
          case 'get_prompt':
            const prompt = await this.promptService.getPrompt(args.id, args.version);
            result = prompt ? prompt.toJSON() : null;
            break;
          
          case 'list_prompts':
            const prompts = args.category
              ? await this.promptService.getPromptsByCategory(args.category, args.limit || 50)
              : await this.promptService.getLatestPrompts(args.limit || 50);
            result = prompts.map(p => p.toJSON());
            break;
          
          case 'search_prompts':
            const searchResults = await this.promptService.searchPrompts(args.query, args.category);
            result = searchResults.map(p => p.toJSON());
            break;
          
          case 'apply_template':
            result = await this.promptService.applyTemplate(args.promptId, args.variables);
            break;
          
          case 'create_prompt':
            const newPrompt = await this.promptService.createPrompt(args);
            result = newPrompt.toJSON();
            break;

          case 'update_prompt':
            const updatedPrompt = await this.promptService.updatePrompt(args.id, args);
            result = updatedPrompt.toJSON();
            break;

          case 'delete_prompt':
            await this.promptService.deletePrompt(args.id);
            result = 'Prompt deleted successfully';
            break;
          
          default:
            throw new Error(`Unknown tool: ${name}`);
        }

        return {
          jsonrpc: '2.0',
          id,
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
          jsonrpc: '2.0',
          id,
          error: {
            code: -32603,
            message: 'Internal error',
            data: error instanceof Error ? error.message : 'Unknown error'
          }
        };
      }
    }

    return null;
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