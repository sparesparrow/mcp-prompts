// @ts-nocheck - Express type compatibility
import express from 'express';
import {
  applyTemplate,
  validatePrompt,
  savePrompt,
  loadPrompt,
  deletePrompt,
  listPrompts,
} from '../utils';
import { Prompt, ListPromptsOptions } from '../types';

const router = express.Router();

/**
 * Prompt routes:
 * - GET / - List all prompts
 * - GET /:id - Get a specific prompt
 * - POST / - Create a new prompt
 * - PUT /:id - Update an existing prompt
 * - DELETE /:id - Delete a prompt
 * - POST /:id/apply - Apply a template prompt
 */

// List all prompts
router.get('/', (req, res) => {
  try {
    const options: ListPromptsOptions = {
      tag: req.query.tag as string,
      isTemplate: req.query.isTemplate === 'true' ? true : 
                 req.query.isTemplate === 'false' ? false : undefined,
      search: req.query.search as string,
      sort: req.query.sort as string,
      order: req.query.order as 'asc' | 'desc',
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string) : undefined,
      // Support legacy templatesOnly parameter
      templatesOnly: req.query.templatesOnly === 'true'
    };
    
    listPrompts(options)
      .then(prompts => {
        res.json(prompts);
      })
      .catch(error => {
        console.error('Error listing prompts:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
      });
  } catch (error) {
    console.error('Error listing prompts:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// Get a prompt by ID
router.get('/:id', (req, res) => {
  try {
    loadPrompt(req.params.id)
      .then(prompt => {
        if (!prompt) {
          return res.status(404).json({ error: `Prompt ${req.params.id} not found` });
        }
        res.json(prompt);
      })
      .catch(error => {
        console.error(`Error getting prompt ${req.params.id}:`, error);
        res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
      });
  } catch (error) {
    console.error(`Error getting prompt ${req.params.id}:`, error);
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// Create a new prompt
router.post('/', (req, res) => {
  try {
    const prompt: Prompt = req.body;
    
    // Validate prompt
    const validation = validatePrompt(prompt);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }
    
    savePrompt(prompt)
      .then(() => {
        res.status(201).json(prompt);
      })
      .catch(error => {
        console.error('Error creating prompt:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
      });
  } catch (error) {
    console.error('Error creating prompt:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// Update an existing prompt
router.put('/:id', (req, res) => {
  try {
    const id = req.params.id;
    const updatedPrompt: Prompt = req.body;
    
    loadPrompt(id)
      .then(existingPrompt => {
        if (!existingPrompt) {
          return res.status(404).json({ error: `Prompt ${id} not found` });
        }
        
        // Validate prompt
        const validation = validatePrompt(updatedPrompt);
        if (!validation.valid) {
          return res.status(400).json({ error: validation.error });
        }
        
        // Save the updated prompt
        savePrompt(updatedPrompt)
          .then(() => {
            res.json(updatedPrompt);
          })
          .catch(error => {
            console.error(`Error saving updated prompt ${id}:`, error);
            res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
          });
      })
      .catch(error => {
        console.error(`Error updating prompt ${id}:`, error);
        res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
      });
  } catch (error) {
    console.error(`Error updating prompt ${req.params.id}:`, error);
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// Delete a prompt
router.delete('/:id', (req, res) => {
  try {
    const id = req.params.id;
    
    loadPrompt(id)
      .then(existingPrompt => {
        if (!existingPrompt) {
          return res.status(404).json({ error: `Prompt ${id} not found` });
        }
        
        // Delete the prompt
        deletePrompt(id)
          .then(() => {
            res.status(204).send();
          })
          .catch(error => {
            console.error(`Error deleting prompt ${id}:`, error);
            res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
          });
      })
      .catch(error => {
        console.error(`Error deleting prompt ${id}:`, error);
        res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
      });
  } catch (error) {
    console.error(`Error deleting prompt ${req.params.id}:`, error);
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// Apply a template
router.post('/:id/apply', (req, res) => {
  try {
    const id = req.params.id;
    const variables = req.body.variables || {};
    
    loadPrompt(id)
      .then(prompt => {
        if (!prompt) {
          return res.status(404).json({ error: `Prompt ${id} not found` });
        }
        
        if (!prompt.isTemplate) {
          return res.status(400).json({ error: `Prompt ${id} is not a template` });
        }
        
        const result = applyTemplate(prompt, variables);
        res.json(result);
      })
      .catch(error => {
        console.error(`Error applying template ${id}:`, error);
        res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
      });
  } catch (error) {
    console.error(`Error applying template ${req.params.id}:`, error);
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

export default router; 