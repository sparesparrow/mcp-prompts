#!/usr/bin/env node

import { IPromptRepository } from '../ports/prompt-repository.interface';
import { ICatalogRepository } from '../ports/catalog-repository.interface';
import { Prompt } from '../entities/prompt.entity';

export class PromptIndexingService {
  constructor(
    private promptRepository: IPromptRepository,
    private catalogRepository: ICatalogRepository
  ) {}

  async indexPrompt(promptId: string): Promise<void> {
    try {
      console.log(`Indexing prompt: ${promptId}`);
      
      // Get prompt from repository
      const prompt = await this.promptRepository.findById(promptId);
      if (!prompt) {
        console.warn(`Prompt not found for indexing: ${promptId}`);
        return;
      }

      // Update search index (this could be enhanced with Elasticsearch or similar)
      // For now, we'll just log the indexing
      console.log(`Indexed prompt: ${prompt.name} (${prompt.category})`);
      
      // Update metadata with indexing timestamp
      const updatedMetadata = {
        ...prompt.metadata,
        lastIndexed: new Date().toISOString(),
        indexedVersion: prompt.version
      };

      // Save updated prompt with metadata
      const updatedPrompt = new Prompt(
        prompt.id,
        prompt.name,
        prompt.description,
        prompt.template,
        prompt.category,
        prompt.tags,
        prompt.variables,
        prompt.version,
        prompt.createdAt,
        prompt.updatedAt,
        prompt.isLatest,
        updatedMetadata
      );

      await this.promptRepository.save(updatedPrompt);
      
    } catch (error) {
      console.error(`Error indexing prompt ${promptId}:`, error);
      throw error;
    }
  }

  async removeFromIndex(promptId: string): Promise<void> {
    try {
      console.log(`Removing prompt from index: ${promptId}`);
      
      // Remove from search index
      // For now, we'll just log the removal
      console.log(`Removed prompt from index: ${promptId}`);
      
    } catch (error) {
      console.error(`Error removing prompt from index ${promptId}:`, error);
      throw error;
    }
  }

  async reindexAll(): Promise<void> {
    try {
      console.log('Starting full reindex...');
      
      // Get all latest prompts
      const prompts = await this.promptRepository.findLatestVersions(1000);
      
      for (const prompt of prompts) {
        await this.indexPrompt(prompt.id);
      }
      
      console.log(`Reindexed ${prompts.length} prompts`);
      
    } catch (error) {
      console.error('Error during full reindex:', error);
      throw error;
    }
  }

  async syncFromCatalog(): Promise<void> {
    try {
      console.log('Syncing prompts from catalog...');
      
      // Get catalog index
      const catalog = await this.catalogRepository.getCatalogIndex();
      
      if (!catalog.categories) {
        console.log('No categories found in catalog');
        return;
      }

      let syncedCount = 0;
      
      // Process each category
      for (const [category, categoryPrompts] of Object.entries(catalog.categories)) {
        if (typeof categoryPrompts === 'object' && categoryPrompts !== null) {
          for (const [promptName, promptData] of Object.entries(categoryPrompts as any)) {
            try {
              // Get prompt template from catalog
              const template = await this.catalogRepository.getPromptTemplate(category, promptName);
              
              // Create or update prompt in repository
              const promptId = `${category}_${promptName}`;
              const existingPrompt = await this.promptRepository.findById(promptId);
              
              if (existingPrompt) {
                // Update existing prompt
                const updatedPrompt = new Prompt(
                  existingPrompt.id,
                  existingPrompt.name,
                  existingPrompt.description,
                  template,
                  category,
                  existingPrompt.tags,
                  existingPrompt.variables,
                  existingPrompt.version,
                  existingPrompt.createdAt,
                  new Date(),
                  existingPrompt.isLatest,
                  existingPrompt.metadata
                );
                
                await this.promptRepository.save(updatedPrompt);
              } else {
                // Create new prompt
                const newPrompt = new Prompt(
                  promptId,
                  promptName,
                  (promptData as any).description || '',
                  template,
                  category,
                  (promptData as any).tags || [],
                  (promptData as any).variables || [],
                  'latest',
                  new Date(),
                  new Date(),
                  true,
                  { source: 'catalog', syncedAt: new Date().toISOString() }
                );
                
                await this.promptRepository.save(newPrompt);
              }
              
              syncedCount++;
              
            } catch (error) {
              console.error(`Error syncing prompt ${category}/${promptName}:`, error);
            }
          }
        }
      }
      
      console.log(`Synced ${syncedCount} prompts from catalog`);
      
    } catch (error) {
      console.error('Error syncing from catalog:', error);
      throw error;
    }
  }
}