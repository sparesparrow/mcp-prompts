/**
 * MCP Prompts Server
 * This file contains the implementation of the HTTP server that provides prompt management capabilities
 */

import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { v4 as uuidv4 } from 'uuid';
import { createStorageProvider } from './core/storage';
import { Server } from 'http';
import { Prompt, ListPromptOptions } from './core/types';
import { Config } from './core/config';
import { applyTemplate, extractVariables } from './core/prompt-management';
import { sanitizeHtml } from './utils';

/**
 * Create and configure an MCP server
 * @param config The server configuration
 * @returns The Express application
 */
export function createServer(config: Config): express.Application {
  const app = express();
  
  // Create storage provider from config
  const storageType = config.storage.type;
  const dbConnectionString = (config.storage.options as any)?.connectionString;
  const fileStorageBaseDir = (config.storage.options as any)?.baseDir;
  
  const storage = createStorageProvider({
    storageType,
    promptsDir: storageType === 'file' ? fileStorageBaseDir : undefined,
    databaseUrl: ['pgai', 'postgres', 'postgresql'].includes(storageType) ? dbConnectionString : undefined
  });
  
  // Configure middleware
  app.use(cors());
  app.use(express.json());
  
  // Add logging if not disabled
  const logLevel = config.server.logLevel || 'dev';
  // We use a string comparison here because the type system doesn't know all possible values
  if (logLevel && typeof logLevel === 'string' && logLevel.toLowerCase() !== 'none') {
    app.use(morgan(logLevel));
  }
  
  // Health check endpoint
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  
  // Add prompt
  app.post('/mcp/tools/add_prompt', (req, res) => {
    handlePromiseRoute(async () => {
      // Validate request
      if (!req.body || !req.body.arguments || !req.body.arguments.prompt) {
        return res.status(400).json({
          status: 'error',
          message: 'Missing required parameters'
        });
      }

      const { name, content, description, tags, isTemplate, id, category } = req.body.arguments.prompt;
      
      // Validate required fields
      if (!name) {
        return res.status(400).json({
          status: 'error',
          message: 'Prompt name is required'
        });
      }
      
      if (!content) {
        return res.status(400).json({
          status: 'error',
          message: 'Prompt content is required'
        });
      }
      
      // Create or update prompt
      const promptId = id || uuidv4();
      
      // Extract variables if this is a template
      let variables: string[] = [];
      if (isTemplate) {
        variables = extractVariables(content);
      }

      // Create prompt object
      const prompt: Prompt = {
        id: promptId,
        name,
        content,
        description: description || '',
        tags: tags || [],
        isTemplate: isTemplate || false,
        variables,
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
        category: category || 'development'
      };
      
      // Save prompt
      await storage.addPrompt(prompt);
      
      return res.json({
        status: 'success',
        data: {
          id: promptId,
          name,
          content: [
            {
              type: 'text',
              text: `Prompt "${name}" has been saved with ID "${promptId}"`
            }
          ]
        }
      });
    }, res);
  });
  
  // Edit prompt
  app.post('/mcp/tools/edit_prompt', (req, res) => {
    handlePromiseRoute(async () => {
      if (!req.body || !req.body.arguments || !req.body.arguments.id) {
        return res.status(400).json({
          status: 'error',
          message: 'Missing required parameters'
        });
      }
      
      const { id, name, content, description, tags, isTemplate, category } = req.body.arguments;
      
      // Get the existing prompt
      const existingPrompt = await storage.getPrompt(id);
      
      if (!existingPrompt) {
        return res.status(404).json({
          status: 'error',
          message: `No prompt found with ID "${id}". Try listing available prompts with list_prompts.`
        });
      }
      
      // Create updated prompt
      const updatedPrompt: Prompt = {
        ...existingPrompt,
        name: name || existingPrompt.name,
        content: content || existingPrompt.content,
        description: description !== undefined ? description : existingPrompt.description,
        tags: tags || existingPrompt.tags,
        category: category || existingPrompt.category || 'development',
        isTemplate: isTemplate !== undefined ? isTemplate : existingPrompt.isTemplate,
        updatedAt: new Date(),
        version: existingPrompt.version + 1
      };
      
      // If it's a template, extract variables
      if (updatedPrompt.isTemplate) {
        updatedPrompt.variables = extractVariables(updatedPrompt.content);
      } else {
        updatedPrompt.variables = [];
      }
      
      // Update the prompt
      await storage.addPrompt(updatedPrompt);
      
      res.json({
        status: 'success',
        content: [
          {
            type: 'text',
            text: JSON.stringify(updatedPrompt, null, 2)
          }
        ]
      });
    }, res);
  });
  
  // Get prompt
  app.post('/mcp/tools/get_prompt', (req, res) => {
    handlePromiseRoute(async () => {
      // Validate request
      if (!req.body || !req.body.arguments || !req.body.arguments.id) {
        return res.status(400).json({
          status: 'error',
          message: 'Missing required parameters'
        });
      }
      
      const { id } = req.body.arguments;
      
      // Get prompt
      const prompt = await storage.getPrompt(id);
      
      if (!prompt) {
        return res.status(404).json({
          status: 'error',
          message: `Prompt with ID "${id}" not found. Try listing available prompts with list_prompts.`
        });
      }
      
      // Increment usage count if the storage provider supports it
      try {
        if ('incrementUsage' in storage) {
          await (storage as any).incrementUsage(id);
        }
      } catch (error) {
        console.error(`Error incrementing usage for prompt ${id}:`, error);
        // Continue since this is not a critical error
      }
      
      return res.json({
        status: 'success',
        data: {
          content: [
            {
              type: 'text',
              text: JSON.stringify(prompt, null, 2)
            }
          ]
        }
      });
    }, res);
  });
  
  // List prompts
  app.post('/mcp/tools/list_prompts', (req, res) => {
    handlePromiseRoute(async () => {
      const options: ListPromptOptions = {};
      
      // Extract filter options from request
      if (req.body && req.body.arguments) {
        const { tags, templatesOnly, category } = req.body.arguments;
        
        if (tags && Array.isArray(tags)) {
          options.tags = tags;
        }
        
        if (templatesOnly !== undefined) {
          options.templatesOnly = templatesOnly === true;
        }
        
        if (category) {
          options.category = category;
        }
      }
      
      // Retrieve prompts
      const prompts = await storage.listPrompts(options);
      
      // Format for display
      const promptsList = prompts.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        isTemplate: p.isTemplate,
        tags: p.tags,
        category: p.category || 'development',
        usageCount: p.usageCount || 0,
        lastUsed: p.lastUsed
      }));
      
      return res.json({
        status: 'success',
        data: {
          content: [
            {
              type: 'text',
              text: JSON.stringify(promptsList, null, 2)
            }
          ]
        }
      });
    }, res);
  });
  
  // Apply template
  app.post('/mcp/tools/apply_template', (req, res) => {
    handlePromiseRoute(async () => {
      // Validate request
      if (!req.body || !req.body.arguments || !req.body.arguments.id) {
        return res.status(400).json({
          status: 'error',
          message: 'Missing required parameters'
        });
      }
      
      const { id, variables } = req.body.arguments;
      
      // Get template
      const template = await storage.getPrompt(id);
      
      if (!template) {
        return res.status(404).json({
          status: 'error',
          message: `Template with ID "${id}" not found. Try listing available templates with list_prompts.`
        });
      }
      
      if (!template.isTemplate) {
        return res.status(400).json({
          status: 'error',
          message: `Prompt with ID "${id}" is not a template.`
        });
      }
      
      // Increment usage count if the storage provider supports it
      try {
        if ('incrementUsage' in storage) {
          await (storage as any).incrementUsage(id);
        }
      } catch (error) {
        console.error(`Error incrementing usage for template ${id}:`, error);
        // Continue since this is not a critical error
      }
      
      // Apply variables to template
      const appliedContent = applyTemplate(template.content, variables || {});
      
      return res.json({
        status: 'success',
        data: {
          content: [
            {
              type: 'text',
              text: appliedContent
            }
          ]
        }
      });
    }, res);
  });
  
  // Delete prompt
  app.post('/mcp/tools/delete_prompt', (req, res) => {
    handlePromiseRoute(async () => {
      const { id } = req.body?.arguments || {};
      
      // Validate required fields
      if (!id) {
        return res.status(400).json({
          status: 'error',
          message: 'Prompt ID is required'
        });
      }
      
      // Delete the prompt
      const success = await storage.deletePrompt(id);
      
      if (!success) {
        return res.status(404).json({
          status: 'error',
          message: `No prompt found with ID "${id}"`
        });
      }
      
      res.json({
        status: 'success',
        content: [
          {
            type: 'text',
            text: `Prompt "${id}" successfully deleted.`
          }
        ]
      });
    }, res);
  });
  
  // Search prompts
  app.post('/mcp/tools/search_prompts', (req, res) => {
    handlePromiseRoute(async () => {
      const { content, limit } = req.body?.arguments || {};
      
      // Validate required fields
      if (!content) {
        return res.status(400).json({
          status: 'error',
          message: 'Search content is required'
        });
      }
      
      // Check if semantic search is available
      if (!(storage as any).searchPromptsByContent) {
        return res.status(501).json({
          status: 'error',
          message: 'Semantic search is not available with the current storage provider. Try using PGAI storage.'
        });
      }
      
      // Search prompts by content
      try {
        const prompts = await (storage as any).searchPromptsByContent(content, limit || 10);
        
        // Format the response to only include necessary fields
        const formattedPrompts = prompts.map((prompt: any) => ({
          id: prompt.id,
          name: prompt.name,
          description: prompt.description,
          isTemplate: prompt.isTemplate,
          tags: prompt.tags,
          category: prompt.category,
          usage_count: prompt.usage_count,
          last_used: prompt.last_used
        }));
        
        res.json({
          status: 'success',
          content: [
            {
              type: 'text',
              text: JSON.stringify(formattedPrompts, null, 2)
            }
          ]
        });
      } catch (error) {
        console.error('Error searching prompts:', error);
        return res.status(500).json({
          status: 'error',
          message: 'An error occurred during search. ' + (error instanceof Error ? error.message : 'Unknown error')
        });
      }
    }, res);
  });
  
  // Add prompt_analytics tool
  app.post('/mcp/tools/prompt_analytics', (req, res) => {
    handlePromiseRoute(async () => {
      // Get analytics data
      try {
        if (!('getPromptAnalytics' in storage)) {
          return res.status(501).json({
            status: 'error',
            message: 'Analytics functionality is not supported by the current storage provider.'
          });
        }
        
        const analytics = await (storage as any).getPromptAnalytics();
        
        return res.json({
          status: 'success',
          data: {
            content: [
              {
                type: 'text',
                text: JSON.stringify(analytics, null, 2)
              }
            ]
          }
        });
      } catch (error) {
        console.error('Error getting prompt analytics:', error);
        return res.status(500).json({
          status: 'error',
          message: 'Failed to retrieve prompt analytics. Please try again later.'
        });
      }
    }, res);
  });
  
  // Add close handler
  app.on('close', async () => {
    await storage.close();
  });
  
  return app;
}

/**
 * Start the MCP server
 * @param config The server configuration
 * @returns A promise that resolves with the HTTP server
 */
export function startServer(config: Config): Server {
  const app = createServer(config);
  
  // Ensure we have valid port and host
  const port = config.server?.port || 3000;
  const host = config.server?.host || 'localhost';
  
  const server = app.listen(port, host, () => {
    console.log(`MCP Prompts Server running at http://${host}:${port}`);
  });

  return server;
}

// Add a helper function to handle promise-based routes
function handlePromiseRoute(
  routeHandler: () => Promise<any>,
  res: express.Response
): void {
  routeHandler().catch(error => {
    console.error('Route error:', error);
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  });
} 