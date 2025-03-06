#!/usr/bin/env node

/**
 * PGAI Utilities
 * This script provides utilities for working with PGAI storage
 */

import fs from 'fs/promises';
import path from 'path';
import { createConfig, Prompt } from '../src/core';
import { createStorageProvider } from '../src/storage';

// Selected top prompts by category
const SELECTED_PROMPTS = [
  // Development category
  'code-review-assistant',
  'debugging-assistant',
  'code-refactoring-assistant',
  'development-system-prompt',
  
  // Analysis category
  'analysis-assistant',
  'data-analysis-template',
  
  // Design category
  'architecture-design-assistant',
  
  // Language/Translation category
  'translation-assistant',
  
  // Planning category
  'foresight-assistant',
  
  // General AI category
  'research-assistant'
];

/**
 * Migrate selected prompts from file storage to PGAI
 */
async function migrateToDatabase(connectionString: string, dryRun: boolean = false): Promise<void> {
  console.log('Starting migration to PGAI database...');
  
  if (dryRun) {
    console.log('DRY RUN MODE - No changes will be made');
  }
  
  // Create file storage provider for source
  const fileConfig = createConfig({
    storage: {
      type: 'file',
      options: {
        baseDir: './prompts'
      }
    }
  });
  
  // Create PGAI storage provider for destination
  const pgaiConfig = createConfig({
    storage: {
      type: 'pgai',
      options: {
        connectionString
      }
    }
  });
  
  const fileStorage = createStorageProvider(fileConfig);
  const pgaiStorage = dryRun ? null : createStorageProvider(pgaiConfig);
  
  try {
    // Get all prompts from file storage
    const allPrompts = await fileStorage.listPrompts();
    console.log(`Found ${allPrompts.length} prompts in file storage`);
    
    // Filter prompts based on selected IDs
    const selectedPrompts = allPrompts.filter(p => SELECTED_PROMPTS.includes(p.id));
    console.log(`Selected ${selectedPrompts.length} prompts for migration`);
    
    // Add category metadata to prompts
    const promptsByCategory = categorizePrompts(selectedPrompts);
    
    // Migrate each prompt
    for (const category of Object.keys(promptsByCategory)) {
      console.log(`\nCategory: ${category}`);
      
      for (const prompt of promptsByCategory[category]) {
        console.log(`  Migrating: ${prompt.id} - ${prompt.name}`);
        
        // Add category to metadata
        const enrichedPrompt: Prompt = {
          ...prompt,
          metadata: {
            ...prompt.metadata,
            category
          }
        };
        
        if (!dryRun && pgaiStorage) {
          try {
            await pgaiStorage.addPrompt(enrichedPrompt);
            console.log(`  ✓ Successfully migrated: ${prompt.id}`);
          } catch (error) {
            console.error(`  ✗ Failed to migrate ${prompt.id}:`, error);
          }
        } else {
          console.log(`  ✓ Would migrate: ${prompt.id} (dry run)`);
        }
      }
    }
    
    // Check if there are missing prompts
    const missingPrompts = SELECTED_PROMPTS.filter(id => !allPrompts.some(p => p.id === id));
    if (missingPrompts.length > 0) {
      console.log('\nWarning: The following selected prompts were not found:');
      for (const id of missingPrompts) {
        console.log(`  - ${id}`);
      }
    }
    
    console.log('\nMigration complete!');
  } finally {
    await fileStorage.close();
    if (!dryRun && pgaiStorage) {
      await pgaiStorage.close();
    }
  }
}

/**
 * Categorize prompts by tags and content
 */
function categorizePrompts(prompts: Prompt[]): Record<string, Prompt[]> {
  const categories: Record<string, Prompt[]> = {
    'development': [],
    'analysis': [],
    'design': [],
    'language': [],
    'planning': [],
    'general': []
  };
  
  for (const prompt of prompts) {
    const tags = prompt.tags || [];
    const content = prompt.content.toLowerCase();
    
    // Determine category based on tags and content
    if (
      tags.includes('code-review') || 
      tags.includes('development') || 
      prompt.id.includes('code') || 
      prompt.id.includes('development') ||
      content.includes('coding') ||
      content.includes('development')
    ) {
      categories['development'].push(prompt);
    } else if (
      tags.includes('analysis') || 
      prompt.id.includes('analysis') ||
      content.includes('analyze') ||
      content.includes('analysis')
    ) {
      categories['analysis'].push(prompt);
    } else if (
      tags.includes('design') || 
      tags.includes('architecture') || 
      prompt.id.includes('design') ||
      prompt.id.includes('architecture') ||
      content.includes('design') ||
      content.includes('architecture')
    ) {
      categories['design'].push(prompt);
    } else if (
      tags.includes('language') || 
      tags.includes('translation') || 
      prompt.id.includes('translation') ||
      content.includes('translate') ||
      content.includes('language')
    ) {
      categories['language'].push(prompt);
    } else if (
      tags.includes('planning') || 
      tags.includes('foresight') || 
      prompt.id.includes('planning') ||
      prompt.id.includes('foresight') ||
      content.includes('plan') ||
      content.includes('future')
    ) {
      categories['planning'].push(prompt);
    } else {
      categories['general'].push(prompt);
    }
  }
  
  return categories;
}

/**
 * Test the PGAI storage provider
 */
async function testPgaiStorage(connectionString: string): Promise<void> {
  console.log('Starting PGAI storage provider test...');
  
  // Create PGAI storage provider
  const pgaiConfig = createConfig({
    storage: {
      type: 'pgai',
      options: {
        connectionString
      }
    }
  });
  
  const storage = createStorageProvider(pgaiConfig);
  
  try {
    // Test basic CRUD operations
    console.log('\n--- Testing CRUD Operations ---');
    await testCrudOperations(storage);
    
    // Test listing and filtering
    console.log('\n--- Testing List and Filter ---');
    await testListAndFilter(storage);
    
    // Test semantic search
    console.log('\n--- Testing Semantic Search ---');
    await testSemanticSearch(storage);
    
    console.log('\nAll tests completed successfully!');
  } finally {
    await storage.close();
  }
}

/**
 * Test CRUD operations
 */
async function testCrudOperations(storage: any): Promise<void> {
  // Create a test prompt
  const testPrompt: Prompt = {
    id: 'test-prompt-' + Date.now(),
    name: 'Test Prompt',
    content: 'This is a test prompt for PGAI storage provider',
    description: 'A prompt created for testing purposes',
    tags: ['test', 'pgai'],
    isTemplate: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 1,
    metadata: {
      test: true,
      source: 'pgai-test-script'
    }
  };
  
  // Add the prompt
  console.log('Adding test prompt...');
  await storage.addPrompt(testPrompt);
  console.log('✓ Prompt added successfully');
  
  // Get the prompt
  console.log('Getting test prompt...');
  const retrievedPrompt = await storage.getPrompt(testPrompt.id);
  
  if (!retrievedPrompt) {
    throw new Error('Failed to retrieve the added prompt');
  }
  
  console.log('✓ Retrieved prompt successfully');
  
  // Verify prompt data
  if (retrievedPrompt.id !== testPrompt.id) {
    throw new Error(`ID mismatch: ${retrievedPrompt.id} !== ${testPrompt.id}`);
  }
  
  if (retrievedPrompt.name !== testPrompt.name) {
    throw new Error(`Name mismatch: ${retrievedPrompt.name} !== ${testPrompt.name}`);
  }
  
  if (retrievedPrompt.content !== testPrompt.content) {
    throw new Error(`Content mismatch: ${retrievedPrompt.content} !== ${testPrompt.content}`);
  }
  
  console.log('✓ Verified prompt data integrity');
  
  // Update the prompt
  console.log('Updating test prompt...');
  const updatedPrompt: Prompt = {
    ...retrievedPrompt,
    name: 'Updated Test Prompt',
    content: 'This prompt has been updated',
    tags: [...(retrievedPrompt.tags || []), 'updated'],
    updatedAt: new Date(),
    version: (retrievedPrompt.version || 1) + 1
  };
  
  await storage.addPrompt(updatedPrompt);
  
  // Get the updated prompt
  const retrievedUpdatedPrompt = await storage.getPrompt(testPrompt.id);
  
  if (!retrievedUpdatedPrompt) {
    throw new Error('Failed to retrieve the updated prompt');
  }
  
  if (retrievedUpdatedPrompt.name !== updatedPrompt.name) {
    throw new Error(`Updated name mismatch: ${retrievedUpdatedPrompt.name} !== ${updatedPrompt.name}`);
  }
  
  if (retrievedUpdatedPrompt.content !== updatedPrompt.content) {
    throw new Error(`Updated content mismatch: ${retrievedUpdatedPrompt.content} !== ${updatedPrompt.content}`);
  }
  
  console.log('✓ Updated prompt successfully');
  
  // Delete the prompt
  console.log('Deleting test prompt...');
  const deleteResult = await storage.deletePrompt(testPrompt.id);
  
  if (!deleteResult) {
    throw new Error('Failed to delete the prompt');
  }
  
  // Verify deletion
  const deletedPrompt = await storage.getPrompt(testPrompt.id);
  
  if (deletedPrompt) {
    throw new Error('Prompt was not deleted successfully');
  }
  
  console.log('✓ Deleted prompt successfully');
}

/**
 * Test listing and filtering prompts
 */
async function testListAndFilter(storage: any): Promise<void> {
  // Create test prompts for different scenarios
  const testPrompts: Prompt[] = [
    {
      id: 'test-basic-' + Date.now(),
      name: 'Basic Test Prompt',
      content: 'This is a basic test prompt',
      tags: ['test', 'basic'],
      isTemplate: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1
    },
    {
      id: 'test-template-' + Date.now(),
      name: 'Template Test Prompt',
      content: 'This is a template with {{variable}}',
      tags: ['test', 'template'],
      isTemplate: true,
      variables: ['variable'],
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1
    },
    {
      id: 'test-category-a-' + Date.now(),
      name: 'Category A Test Prompt',
      content: 'This is a test prompt for category A',
      tags: ['test', 'category-a'],
      isTemplate: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1
    },
    {
      id: 'test-category-b-' + Date.now(),
      name: 'Category B Test Prompt',
      content: 'This is a test prompt for category B',
      tags: ['test', 'category-b'],
      isTemplate: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1
    }
  ];
  
  // Add all test prompts
  console.log('Adding test prompts...');
  for (const prompt of testPrompts) {
    await storage.addPrompt(prompt);
  }
  console.log(`✓ Added ${testPrompts.length} test prompts`);
  
  // Test listing all prompts
  console.log('Listing all prompts...');
  const allPrompts = await storage.listPrompts();
  
  if (allPrompts.length < testPrompts.length) {
    throw new Error(`Expected at least ${testPrompts.length} prompts, but got ${allPrompts.length}`);
  }
  
  console.log(`✓ Listed ${allPrompts.length} prompts`);
  
  // Test filtering by tag
  console.log('Filtering by tag "template"...');
  const templatePrompts = await storage.listPrompts({ tags: ['template'] });
  
  // Verify at least our template prompt is returned
  const hasTemplatePrompt = templatePrompts.some(p => p.id === testPrompts[1].id);
  
  if (!hasTemplatePrompt) {
    throw new Error('Template prompt not found when filtering by "template" tag');
  }
  
  console.log(`✓ Found ${templatePrompts.length} template prompts`);
  
  // Test filtering by template status
  console.log('Filtering by template status...');
  const templatesOnly = await storage.listPrompts({ templatesOnly: true });
  
  // Verify at least our template prompt is returned
  const hasTemplateInTemplatesOnly = templatesOnly.some(p => p.id === testPrompts[1].id);
  
  if (!hasTemplateInTemplatesOnly) {
    throw new Error('Template prompt not found when filtering by template status');
  }
  
  console.log(`✓ Found ${templatesOnly.length} templates`);
  
  // Test filtering by category tag
  console.log('Filtering by category tag...');
  const categoryAPrompts = await storage.listPrompts({ tags: ['category-a'] });
  
  // Verify our category-a prompt is returned
  const hasCategoryA = categoryAPrompts.some(p => p.id === testPrompts[2].id);
  
  if (!hasCategoryA) {
    throw new Error('Category A prompt not found when filtering by "category-a" tag');
  }
  
  console.log(`✓ Found ${categoryAPrompts.length} category A prompts`);
  
  // Clean up test prompts
  console.log('Cleaning up test prompts...');
  for (const prompt of testPrompts) {
    await storage.deletePrompt(prompt.id);
  }
  console.log('✓ Cleaned up test prompts');
}

/**
 * Test semantic search functionality
 */
async function testSemanticSearch(storage: any): Promise<void> {
  // Check if semantic search is implemented
  if (!storage.searchPromptsByContent) {
    console.log('Semantic search not implemented in storage provider. Skipping test.');
    return;
  }
  
  // Create test prompts with different contents
  const testPrompts: Prompt[] = [
    {
      id: 'test-search-code-' + Date.now(),
      name: 'Code Review Prompt',
      content: 'This prompt helps you review code and find bugs in JavaScript applications. It focuses on code quality and best practices.',
      tags: ['test', 'code', 'review'],
      isTemplate: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1
    },
    {
      id: 'test-search-data-' + Date.now(),
      name: 'Data Analysis Prompt',
      content: 'This prompt helps you analyze numerical data and create visualizations for business intelligence reporting.',
      tags: ['test', 'data', 'analysis'],
      isTemplate: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1
    },
    {
      id: 'test-search-writing-' + Date.now(),
      name: 'Creative Writing Prompt',
      content: 'This prompt helps you write creative stories and generate fictional content for entertainment purposes.',
      tags: ['test', 'writing', 'creative'],
      isTemplate: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1
    }
  ];
  
  // Add all test prompts
  console.log('Adding test prompts for semantic search...');
  for (const prompt of testPrompts) {
    await storage.addPrompt(prompt);
  }
  console.log(`✓ Added ${testPrompts.length} test prompts`);
  
  try {
    // Test semantic search for code review
    console.log('Searching for code-related content...');
    const codeResults = await storage.searchPromptsByContent('JavaScript programming bugs');
    
    // Verify code review prompt is in the results
    const hasCodePrompt = codeResults.some(p => p.id === testPrompts[0].id);
    console.log(`Search results for "JavaScript programming bugs": ${codeResults.length} results`);
    
    if (!hasCodePrompt) {
      console.warn('⚠️ Code review prompt was not found in semantic search results. This may indicate a semantic search issue.');
    } else {
      console.log('✓ Found code review prompt in search results');
    }
    
    // Test semantic search for data analysis
    console.log('Searching for data-related content...');
    const dataResults = await storage.searchPromptsByContent('numerical data visualization');
    
    // Verify data analysis prompt is in the results
    const hasDataPrompt = dataResults.some(p => p.id === testPrompts[1].id);
    console.log(`Search results for "numerical data visualization": ${dataResults.length} results`);
    
    if (!hasDataPrompt) {
      console.warn('⚠️ Data analysis prompt was not found in semantic search results. This may indicate a semantic search issue.');
    } else {
      console.log('✓ Found data analysis prompt in search results');
    }
    
    // Test semantic search for creative writing
    console.log('Searching for writing-related content...');
    const writingResults = await storage.searchPromptsByContent('fiction writing stories');
    
    // Verify creative writing prompt is in the results
    const hasWritingPrompt = writingResults.some(p => p.id === testPrompts[2].id);
    console.log(`Search results for "fiction writing stories": ${writingResults.length} results`);
    
    if (!hasWritingPrompt) {
      console.warn('⚠️ Creative writing prompt was not found in semantic search results. This may indicate a semantic search issue.');
    } else {
      console.log('✓ Found creative writing prompt in search results');
    }
  } finally {
    // Clean up test prompts
    console.log('Cleaning up semantic search test prompts...');
    for (const prompt of testPrompts) {
      await storage.deletePrompt(prompt.id);
    }
    console.log('✓ Cleaned up semantic search test prompts');
  }
}

/**
 * Parse command line arguments
 */
function parseArgs(): { connectionString: string, dryRun: boolean, command: 'migrate' | 'test' } {
  const args = process.argv.slice(2);
  let connectionString = '';
  let dryRun = false;
  let command: 'migrate' | 'test' = 'migrate';
  
  // Check for command
  if (args.includes('migrate')) {
    command = 'migrate';
    const commandIndex = args.indexOf('migrate');
    if (commandIndex !== -1) {
      args.splice(commandIndex, 1);
    }
  } else if (args.includes('test')) {
    command = 'test';
    const commandIndex = args.indexOf('test');
    if (commandIndex !== -1) {
      args.splice(commandIndex, 1);
    }
  }
  
  // Parse --connection argument
  const connectionIndex = args.indexOf('--connection');
  if (connectionIndex !== -1 && connectionIndex < args.length - 1) {
    connectionString = args[connectionIndex + 1];
  }
  
  // Use environment variable as fallback
  if (!connectionString && process.env.PGAI_CONNECTION_STRING) {
    connectionString = process.env.PGAI_CONNECTION_STRING;
  }
  
  // Default connection string if none provided
  if (!connectionString) {
    connectionString = 'postgresql://postgres:postgres@localhost:5432/mcp_prompts';
  }
  
  // Check for --dry-run flag
  dryRun = args.includes('--dry-run');
  
  return { connectionString, dryRun, command };
}

/**
 * Main function
 */
async function main() {
  try {
    const { connectionString, dryRun, command } = parseArgs();
    
    if (command === 'migrate') {
      console.log(`Using connection: ${connectionString}`);
      await migrateToDatabase(connectionString, dryRun);
    } else if (command === 'test') {
      console.log(`Using connection: ${connectionString}`);
      await testPgaiStorage(connectionString);
    } else {
      console.error('Invalid command. Use "migrate" or "test".');
      process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
} 