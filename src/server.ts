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
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', version: '1.1.0' });
  });
  
  // Add prompt
  app.post('/mcp/tools/add_prompt', async (req, res) => {
    try {
      const { name, content, description, tags, isTemplate, id } = req.body;
      
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
      
      res.json({
        success: true,
        prompt: result
      });
    } catch (error) {
      console.error('Error adding prompt:', error);
      res.status(500).json({
        error: 'Failed to add prompt',
        details: (error as Error).message
      });
    }
  });
  
  // Edit prompt
  app.post('/mcp/tools/edit_prompt', async (req, res) => {
    try {
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
      
      res.json({
        success: true,
        prompt: result
      });
    } catch (error) {
      console.error('Error editing prompt:', error);
      res.status(500).json({
        error: 'Failed to edit prompt',
        details: (error as Error).message
      });
    }
  });
  
  // Get prompt
  app.post('/mcp/tools/get_prompt', async (req, res) => {
    try {
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
      
      res.json({
        success: true,
        prompt
      });
    } catch (error) {
      console.error('Error getting prompt:', error);
      res.status(500).json({
        error: 'Failed to get prompt',
        details: (error as Error).message
      });
    }
  });
  
  // List prompts
  app.post('/mcp/tools/list_prompts', async (req, res) => {
    try {
      const { tags, templatesOnly } = req.body;
      
      // List prompts with optional filters
      const prompts = await storage.listPrompts({
        tags,
        templatesOnly
      });
      
      res.json({
        success: true,
        prompts,
        count: prompts.length
      });
    } catch (error) {
      console.error('Error listing prompts:', error);
      res.status(500).json({
        error: 'Failed to list prompts',
        details: (error as Error).message
      });
    }
  });
  
  // Apply template
  app.post('/mcp/tools/apply_template', async (req, res) => {
    try {
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
      
      res.json({
        success: true,
        content,
        templateId: id,
        variablesApplied: Object.keys(variables)
      });
    } catch (error) {
      console.error('Error applying template:', error);
      res.status(500).json({
        error: 'Failed to apply template',
        details: (error as Error).message
      });
    }
  });
  
  // Delete prompt
  app.post('/mcp/tools/delete_prompt', async (req, res) => {
    try {
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
      
      res.json({
        success: true,
        message: `Prompt ${id} deleted successfully`
      });
    } catch (error) {
      console.error('Error deleting prompt:', error);
      res.status(500).json({
        error: 'Failed to delete prompt',
        details: (error as Error).message
      });
    }
  });
  
  // Search prompts
  app.post('/mcp/tools/search_prompts', async (req, res) => {
    try {
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
      
      res.json({
        success: true,
        prompts,
        count: prompts.length
      });
    } catch (error) {
      console.error('Error searching prompts:', error);
      res.status(500).json({
        error: 'Failed to search prompts',
        details: (error as Error).message
      });
    }
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
export async function startServer(config: Config): Promise<any> {
  const app = createServer(config);
  
  return new Promise((resolve) => {
    const server = app.listen(config.server.port, config.server.host, () => {
      console.log(`MCP Prompts Server running at http://${config.server.host}:${config.server.port}`);
      resolve(server);
    });
  });
} 