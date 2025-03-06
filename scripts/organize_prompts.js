#!/usr/bin/env node

/**
 * organize_prompts.js
 * 
 * This script organizes prompts into a more structured directory tree
 * based on their categories and tags.
 */

const fs = require('fs');
const path = require('path');

// Configuration
const PROMPTS_DIR = path.join(process.cwd(), 'prompts');
const CATEGORIES = {
  'development': ['programming', 'code', 'development', 'debugging', 'refactoring', 'architecture'],
  'analysis': ['analysis', 'data', 'statistics', 'research', 'insights', 'visualization'],
  'content': ['content', 'translation', 'language', 'writing', 'summary'],
  'planning': ['planning', 'decision-making', 'future', 'scenarios', 'prediction'],
  'productivity': ['productivity', 'workflow', 'organization'],
  'ai': ['ai', 'llm', 'language-model', 'claude', 'gpt'],
  'templates': []
};

// Get command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const force = args.includes('--force');

console.log(`${dryRun ? '[DRY RUN] ' : ''}Organizing prompts...`);

// Ensure all category directories exist
Object.keys(CATEGORIES).forEach(category => {
  const categoryDir = path.join(PROMPTS_DIR, category);
  if (!fs.existsSync(categoryDir)) {
    if (!dryRun) {
      fs.mkdirSync(categoryDir, { recursive: true });
      console.log(`Created directory: ${categoryDir}`);
    } else {
      console.log(`Would create directory: ${categoryDir}`);
    }
  }
});

// Process directory function
function processDirectory(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      // Skip category directories we just created
      if (Object.keys(CATEGORIES).includes(entry.name)) {
        continue;
      }
      // Process subdirectories recursively
      processDirectory(fullPath);
    } else if (entry.name.endsWith('.json')) {
      // Process JSON files
      try {
        const promptContent = fs.readFileSync(fullPath, 'utf8');
        const prompt = JSON.parse(promptContent);
        
        // Skip special directories like 'examples' and 'curated'
        const parentDir = path.basename(dir);
        if (['examples', 'curated'].includes(parentDir)) {
          continue;
        }
        
        // Determine the appropriate category based on tags
        let targetCategory = null;
        
        // Templates go to the templates category
        if (prompt.isTemplate) {
          targetCategory = 'templates';
        } else {
          // Find the first matching category
          for (const [category, tags] of Object.entries(CATEGORIES)) {
            if (prompt.tags && prompt.tags.some(tag => tags.includes(tag.toLowerCase()))) {
              targetCategory = category;
              break;
            }
          }
        }
        
        // If no category was found, use the generic 'ai' category
        if (!targetCategory) {
          targetCategory = 'ai';
        }
        
        const targetDir = path.join(PROMPTS_DIR, targetCategory);
        const targetJsonPath = path.join(targetDir, entry.name);
        const targetMdPath = path.join(targetDir, entry.name.replace('.json', '.md'));
        
        // Check if the MD version exists
        const mdPath = fullPath.replace('.json', '.md');
        const mdExists = fs.existsSync(mdPath);
        
        // Skip if target already exists and force is not specified
        if (!force && (fs.existsSync(targetJsonPath) || (mdExists && fs.existsSync(targetMdPath)))) {
          console.log(`Skipping ${entry.name} - target already exists. Use --force to overwrite.`);
          continue;
        }
        
        // Move the files
        if (!dryRun) {
          // Copy JSON file
          fs.copyFileSync(fullPath, targetJsonPath);
          console.log(`Moved ${fullPath} to ${targetJsonPath}`);
          
          // Copy MD file if it exists
          if (mdExists) {
            fs.copyFileSync(mdPath, targetMdPath);
            console.log(`Moved ${mdPath} to ${targetMdPath}`);
          }
          
          // Delete original files after successful move
          fs.unlinkSync(fullPath);
          if (mdExists) {
            fs.unlinkSync(mdPath);
          }
        } else {
          console.log(`Would move ${fullPath} to ${targetJsonPath}`);
          if (mdExists) {
            console.log(`Would move ${mdPath} to ${targetMdPath}`);
          }
        }
      } catch (error) {
        console.error(`Error processing ${fullPath}: ${error.message}`);
      }
    }
  }
}

// Start processing from the root prompts directory
processDirectory(PROMPTS_DIR);

// Update README.md with new structure
const readmePath = path.join(PROMPTS_DIR, 'README.md');
if (fs.existsSync(readmePath)) {
  let readme = fs.readFileSync(readmePath, 'utf8');
  
  // Add a section about the new organization if it doesn't exist
  if (!readme.includes('## Directory Structure')) {
    const structureSection = `
## Directory Structure

The prompts are organized into the following categories:

- **development/** - Programming, coding, debugging, and architecture prompts
- **analysis/** - Data analysis, research, and insights prompts
- **content/** - Content creation, translation, and language prompts
- **planning/** - Future planning, decision-making, and scenario prompts
- **productivity/** - Workflow and organization prompts
- **ai/** - General AI and language model prompts
- **templates/** - Reusable prompt templates with variables

Special directories:
- **examples/** - Example prompts for demonstration purposes
- **curated/** - Carefully crafted and enhanced prompts
`;
    
    readme += structureSection;
    
    if (!dryRun) {
      fs.writeFileSync(readmePath, readme);
      console.log(`Updated ${readmePath} with directory structure information`);
    } else {
      console.log(`Would update ${readmePath} with directory structure information`);
    }
  }
}

console.log(`\n${dryRun ? '[DRY RUN] ' : ''}Prompt organization completed.`);
console.log(`\nUsage: 
  node scripts/organize_prompts.js        # Organize prompts (skip existing)
  node scripts/organize_prompts.js --force # Organize prompts (overwrite existing)
  node scripts/organize_prompts.js --dry-run # Show what would be done without making changes`); 