#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Generate a comprehensive index of all prompts in the data/prompts directory
 * Supports multiple formats: .json, .mdc, .md
 */

const PROMPTS_DIR = path.join(__dirname, '..', 'data', 'prompts');

const ACCESS_LEVELS = {
  public: 'public',
  paid: 'premium',
  private: 'private'
};

function parseJsonPrompt(filePath, accessLevel) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(content);

    // Handle different JSON structures
    const prompt = {
      id: data.id || path.basename(filePath, '.json'),
      name: data.name || data.title || path.basename(filePath, '.json'),
      description: data.description || '',
      content: data.prompt_text || data.content || data.template || '',
      isTemplate: data.isTemplate !== false, // Default to true for JSON files
      variables: data.variables || [],
      tags: data.tags || [],
      access_level: accessLevel,
      createdAt: data.createdAt || data.created_at || new Date().toISOString(),
      updatedAt: data.updatedAt || data.updated_at || new Date().toISOString(),
      version: data.version || 1,
      metadata: data.metadata || {},
      format: 'json'
    };

    return prompt;
  } catch (error) {
    console.error(`Error parsing JSON file ${filePath}:`, error.message);
    return null;
  }
}

function parseMarkdownPrompt(filePath, accessLevel) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const filename = path.basename(filePath, path.extname(filePath));

    // Extract title from first line if it starts with #
    const lines = content.split('\n');
    let title = filename;
    let description = '';
    let startIndex = 0;

    if (lines[0] && lines[0].startsWith('# ')) {
      title = lines[0].substring(2).trim();
      startIndex = 1;

      // Look for description in the next few lines
      for (let i = 1; i < Math.min(5, lines.length); i++) {
        if (lines[i].trim() && !lines[i].startsWith('#')) {
          description = lines[i].trim();
          startIndex = i + 1;
          break;
        }
      }
    }

    const prompt = {
      id: filename,
      name: title,
      description: description,
      content: lines.slice(startIndex).join('\n').trim(),
      isTemplate: false, // Markdown files are typically not templates
      variables: [], // Markdown files don't have defined variables
      tags: [filename.split('_')[0], filename.split('_')[1]].filter(Boolean), // Extract tags from filename
      access_level: accessLevel,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
      metadata: {
        format: 'markdown',
        originalFile: path.relative(PROMPTS_DIR, filePath)
      },
      format: 'markdown'
    };

    return prompt;
  } catch (error) {
    console.error(`Error parsing markdown file ${filePath}:`, error.message);
    return null;
  }
}

function getAllFiles(dirPath, extensions) {
  const files = [];

  function traverse(currentPath) {
    const items = fs.readdirSync(currentPath);

    for (const item of items) {
      const fullPath = path.join(currentPath, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        traverse(fullPath);
      } else if (stat.isFile()) {
        const ext = path.extname(item);
        if (extensions.includes(ext)) {
          files.push(fullPath);
        }
      }
    }
  }

  traverse(dirPath);
  return files;
}

async function generateIndex() {
  const index = {
    generatedAt: new Date().toISOString(),
    totalPrompts: 0,
    categories: {
      public: { count: 0, prompts: [] },
      premium: { count: 0, prompts: [] },
      private: { count: 0, prompts: [] }
    },
    prompts: []
  };

  // Process each access level directory
  for (const [dir, accessLevel] of Object.entries(ACCESS_LEVELS)) {
    const dirPath = path.join(PROMPTS_DIR, dir);

    if (!fs.existsSync(dirPath)) {
      console.log(`Directory ${dirPath} does not exist, skipping...`);
      continue;
    }

    console.log(`Processing ${dir} prompts (${accessLevel} access)...`);

    // Find all prompt files
    const jsonFiles = getAllFiles(dirPath, ['.json']);
    const markdownFiles = getAllFiles(dirPath, ['.mdc']);
    const mdFiles = getAllFiles(dirPath, ['.md']);

    const allFiles = [...jsonFiles, ...markdownFiles, ...mdFiles];

    for (const filePath of allFiles) {
      let prompt = null;

      if (filePath.endsWith('.json')) {
        prompt = parseJsonPrompt(filePath, accessLevel);
      } else if (filePath.endsWith('.mdc') || filePath.endsWith('.md')) {
        prompt = parseMarkdownPrompt(filePath, accessLevel);
      }

      if (prompt) {
        // Add to appropriate category
        index.categories[accessLevel].prompts.push({
          id: prompt.id,
          name: prompt.name,
          description: prompt.description,
          tags: prompt.tags,
          format: prompt.format,
          filePath: path.relative(PROMPTS_DIR, filePath)
        });

        // Add full prompt to main prompts array
        index.prompts.push(prompt);
        index.categories[accessLevel].count++;
        index.totalPrompts++;

        console.log(`  ✓ ${prompt.name} (${accessLevel})`);
      }
    }
  }

  // Write the index file
  const indexPath = path.join(PROMPTS_DIR, 'index.json');
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));

  console.log(`\n🎉 Generated index with ${index.totalPrompts} prompts:`);
  console.log(`  - Public: ${index.categories.public.count}`);
  console.log(`  - Premium: ${index.categories.premium.count}`);
  console.log(`  - Private: ${index.categories.private.count}`);
  console.log(`\nIndex saved to: ${indexPath}`);

  return index;
}

// Run if called directly
if (require.main === module) {
  generateIndex().catch(console.error);
}

module.exports = { generateIndex };