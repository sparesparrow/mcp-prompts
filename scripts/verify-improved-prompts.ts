#!/usr/bin/env node

/**
 * Verify Improved Prompts in PGAI
 * This script verifies that the improved prompts are available in the PGAI database
 */

import { createConfig } from '../src/core';
import { createStorageProvider } from '../src/storage';

// List of improved prompt IDs to verify
const IMPROVED_PROMPT_IDS = [
  'enhanced-code-review',
  'advanced-code-refactoring',
  'intelligent-debugging',
  'system-architecture-designer',
  'comprehensive-data-analyzer',
  'advanced-content-analyzer',
  'comprehensive-research-assistant',
  'topic-modeling-specialist',
  'contextual-translator',
  'strategic-foresight-planner',
  'question-generation-specialist',
  'follow-up-question-generator'
];

// Categories for organization in console output
const CATEGORIES = {
  'development': [
    'enhanced-code-review',
    'advanced-code-refactoring',
    'intelligent-debugging'
  ],
  'design': [
    'system-architecture-designer'
  ],
  'analysis': [
    'comprehensive-data-analyzer',
    'advanced-content-analyzer'
  ],
  'research': [
    'comprehensive-research-assistant',
    'topic-modeling-specialist'
  ],
  'language': [
    'contextual-translator'
  ],
  'planning': [
    'strategic-foresight-planner'
  ],
  'productivity': [
    'question-generation-specialist',
    'follow-up-question-generator'
  ]
};

/**
 * Parse command line arguments
 */
function parseArgs(): { connectionString: string } {
  const args = process.argv.slice(2);
  let connectionString = 'postgresql://postgres:postgres@localhost:5432/mcp_prompts';
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--connection' || arg === '-c') {
      if (i + 1 < args.length) {
        connectionString = args[i + 1];
        i++;
      }
    }
  }
  
  return { connectionString };
}

/**
 * Verify improved prompts in PGAI database
 */
async function verifyImprovedPrompts(connectionString: string): Promise<void> {
  console.log('Verifying improved prompts in PGAI database...\n');
  
  // Create PGAI storage provider
  const pgaiConfig = createConfig({
    storage: {
      type: 'pgai',
      options: {
        connectionString
      }
    }
  });
  
  const pgaiStorage = createStorageProvider(pgaiConfig);
  
  try {
    // Get all prompts from PGAI
    console.log('Fetching prompts from database...');
    const allPrompts = await pgaiStorage.listPrompts();
    console.log(`Found ${allPrompts.length} prompts in PGAI database\n`);
    
    // Check if improved prompts are in the database
    let foundCount = 0;
    let missingCount = 0;
    const missingPrompts: string[] = [];
    
    console.log('Checking for improved prompts by category:');
    
    // Check each category
    for (const [category, promptIds] of Object.entries(CATEGORIES)) {
      console.log(`\n${category.toUpperCase()} CATEGORY:`);
      
      for (const id of promptIds) {
        const found = allPrompts.some(p => p.id === id);
        
        if (found) {
          const prompt = allPrompts.find(p => p.id === id);
          console.log(`  ✓ ${prompt?.name} (${id})`);
          foundCount++;
        } else {
          console.log(`  ✗ Missing: ${id}`);
          missingCount++;
          missingPrompts.push(id);
        }
      }
    }
    
    // Summary
    console.log('\n--- VERIFICATION SUMMARY ---');
    console.log(`Total improved prompts: ${IMPROVED_PROMPT_IDS.length}`);
    console.log(`Found in database: ${foundCount}`);
    console.log(`Missing from database: ${missingCount}`);
    
    if (missingCount > 0) {
      console.log('\nMissing prompts:');
      missingPrompts.forEach(id => console.log(`  - ${id}`));
      console.log('\nTo add the missing prompts, run:');
      console.log('  npm run pgai:migrate:improved');
    } else if (foundCount === IMPROVED_PROMPT_IDS.length) {
      console.log('\n✅ All improved prompts are available in the PGAI database!');
    }
    
    // Perform a quick semantic search test if prompts are found
    if (foundCount > 0) {
      console.log('\n--- QUICK SEARCH TEST ---');
      console.log('Performing semantic search for "code review"...');
      
      try {
        // Check if the storage provider supports semantic search
        if (typeof pgaiStorage.searchPromptsByContent === 'function') {
          const searchResults = await pgaiStorage.searchPromptsByContent('code review');
          
          if (searchResults.length > 0) {
            console.log(`Found ${searchResults.length} results:`);
            searchResults.slice(0, 3).forEach(prompt => {
              console.log(`  - ${prompt.name} (${prompt.id})`);
            });
            console.log('✅ Semantic search is working!');
          } else {
            console.log('No results found. Semantic search may not be working properly.');
          }
        } else {
          console.log('This storage provider does not support semantic search.');
        }
      } catch (error) {
        console.error('Error performing semantic search:', error);
      }
    }
    
  } finally {
    await pgaiStorage.close();
  }
}

/**
 * Main function
 */
async function main() {
  const { connectionString } = parseArgs();
  
  try {
    await verifyImprovedPrompts(connectionString);
  } catch (error) {
    console.error('Verification failed:', error);
    process.exit(1);
  }
}

// Run the main function
if (require.main === module) {
  main();
} 