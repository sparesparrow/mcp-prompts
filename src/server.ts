/**
 * MCP Prompts Server
 * This file contains the implementation of the HTTP server that provides prompt management capabilities
 */

import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { v4 as uuidv4 } from 'uuid';
import { Config, Prompt, PromptStorage, applyTemplate, extractVariables } from './core';
import { createStorageProvider } from './storage';
import { Server } from 'http';

/**
 * Create and configure an MCP server
 * @param config The server configuration
 * @returns The Express application
 */
export function createServer(config: Config): express.Application {
  const app = express();
  const storage = createStorageProvider(config);
  
  // Configure middleware
  app.use(cors());
  app.use(express.json());
  
  // Add logging if not disabled
  if (config.server.logLevel !== 'none') {
    app.use(morgan(config.server.logLevel || 'dev'));
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

      const { name, content, description, tags, isTemplate, id } = req.body.arguments.prompt;
      
      // Validate required fields
      if (!name || !content) {
        return res.status(400).json({
          error: 'Missing required fields',
          details: 'Name and content are required'
        });
      }
      
      // Generate a unique ID if not provided
      const promptId = id || `prompt-${uuidv4()}`;
      
      // Create the prompt object
      const prompt: Prompt = {
        id: promptId,
        name,
        content,
        description,
        tags: tags || [],
        isTemplate: isTemplate || false,
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
        metadata: {}
      };
      
      // Auto-detect variables if it's a template
      if (prompt.isTemplate) {
        prompt.variables = extractVariables(content);
      }
      
      // Add the prompt to storage
      const result = await storage.addPrompt(prompt);
      
      return res.json({
        status: 'success',
        data: result
      });
    }, res);
  });
  
  // Edit prompt
  app.post('/mcp/tools/edit_prompt', (req, res) => {
    handlePromiseRoute(async () => {
      const { id, name, content, description, tags, isTemplate } = req.body;
      
      // Validate required fields
      if (!id) {
        return res.status(400).json({
          error: 'Missing required fields',
          details: 'Prompt ID is required'
        });
      }
      
      // Get the existing prompt
      const existingPrompt = await storage.getPrompt(id);
      
      if (!existingPrompt) {
        return res.status(404).json({
          error: 'Prompt not found',
          details: `No prompt found with ID: ${id}`
        });
      }
      
      // Update the prompt
      const updatedPrompt: Prompt = {
        ...existingPrompt,
        name: name || existingPrompt.name,
        content: content || existingPrompt.content,
        description: description !== undefined ? description : existingPrompt.description,
        tags: tags || existingPrompt.tags,
        isTemplate: isTemplate !== undefined ? isTemplate : existingPrompt.isTemplate,
        updatedAt: new Date(),
        version: existingPrompt.version + 1
      };
      
      // Auto-detect variables if it's a template and content was updated
      if (updatedPrompt.isTemplate && content) {
        updatedPrompt.variables = extractVariables(content);
      }
      
      // Update the prompt in storage
      const result = await storage.addPrompt(updatedPrompt);
      
      return res.json({
        status: 'success',
        data: result
      });
    }, res);
  });
  
  // Get prompt
  app.post('/mcp/tools/get_prompt', (req, res) => {
    handlePromiseRoute(async () => {
      const { id } = req.body;
      
      // Validate required fields
      if (!id) {
        return res.status(400).json({
          error: 'Missing required fields',
          details: 'Prompt ID is required'
        });
      }
      
      // Get the prompt
      const prompt = await storage.getPrompt(id);
      
      if (!prompt) {
        return res.status(404).json({
          error: 'Prompt not found',
          details: `No prompt found with ID: ${id}`
        });
      }
      
      return res.json({
        status: 'success',
        data: prompt
      });
    }, res);
  });
  
  // List prompts
  app.post('/mcp/tools/list_prompts', (req, res) => {
    handlePromiseRoute(async () => {
      const { tags, templatesOnly } = req.body;
      
      // List prompts with optional filters
      const prompts = await storage.listPrompts({
        tags,
        templatesOnly
      });
      
      return res.json({
        status: 'success',
        data: {
          prompts,
          count: prompts.length
        }
      });
    }, res);
  });
  
  // Apply template
  app.post('/mcp/tools/apply_template', (req, res) => {
    handlePromiseRoute(async () => {
      const { id, variables } = req.body;
      
      // Validate required fields
      if (!id || !variables) {
        return res.status(400).json({
          error: 'Missing required fields',
          details: 'Template ID and variables are required'
        });
      }
      
      // Get the template prompt
      const template = await storage.getPrompt(id);
      
      if (!template) {
        return res.status(404).json({
          error: 'Template not found',
          details: `No template found with ID: ${id}`
        });
      }
      
      if (!template.isTemplate) {
        return res.status(400).json({
          error: 'Not a template',
          details: `The prompt with ID ${id} is not a template`
        });
      }
      
      // Apply the template with variables
      const content = applyTemplate(template, variables);
      
      return res.json({
        status: 'success',
        data: {
          content,
          templateId: id,
          variablesApplied: Object.keys(variables)
        }
      });
    }, res);
  });
  
  // Delete prompt
  app.post('/mcp/tools/delete_prompt', (req, res) => {
    handlePromiseRoute(async () => {
      const { id } = req.body;
      
      // Validate required fields
      if (!id) {
        return res.status(400).json({
          error: 'Missing required fields',
          details: 'Prompt ID is required'
        });
      }
      
      // Delete the prompt
      const success = await storage.deletePrompt(id);
      
      if (!success) {
        return res.status(404).json({
          error: 'Prompt not found',
          details: `No prompt found with ID: ${id}`
        });
      }
      
      return res.json({
        status: 'success',
        message: `Prompt ${id} deleted successfully`
      });
    }, res);
  });
  
  // Search prompts
  app.post('/mcp/tools/search_prompts', (req, res) => {
    handlePromiseRoute(async () => {
      const { content, limit } = req.body;
      
      // Validate required fields
      if (!content) {
        return res.status(400).json({
          error: 'Missing required fields',
          details: 'Search content is required'
        });
      }
      
      // Check if semantic search is supported
      if (!storage.searchPromptsByContent) {
        return res.status(501).json({
          error: 'Semantic search not supported',
          details: 'The current storage provider does not support semantic search'
        });
      }
      
      // Search for prompts by content
      const prompts = await storage.searchPromptsByContent(content, limit || 10);
      
      return res.json({
        status: 'success',
        data: {
          prompts,
          count: prompts.length
        }
      });
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