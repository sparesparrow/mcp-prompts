#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Function to recursively find all .json files in data/prompts
function findPromptFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      findPromptFiles(filePath, fileList);
    } else if (file.endsWith('.json') && file !== 'index.json') {
      fileList.push(filePath);
    }
  });

  return fileList;
}

// Function to read and parse prompt metadata
function getPromptMetadata(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const prompt = JSON.parse(content);

    return {
      id: prompt.name,
      name: prompt.name,
      description: prompt.description,
      tags: prompt.tags || [],
      isTemplate: prompt.isTemplate || false,
      metadata: prompt.metadata || {}
    };
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error.message);
    return null;
  }
}

// Main function
function updateIndex() {
  const promptsDir = path.join(__dirname, '..', 'data', 'prompts');
  const indexPath = path.join(promptsDir, 'index.json');

  console.log('Finding prompt files...');
  const promptFiles = findPromptFiles(promptsDir);
  console.log(`Found ${promptFiles.length} prompt files`);

  const prompts = [];

  promptFiles.forEach(filePath => {
    const metadata = getPromptMetadata(filePath);
    if (metadata) {
      prompts.push(metadata);
    }
  });

  const indexData = {
    prompts: prompts
  };

  fs.writeFileSync(indexPath, JSON.stringify(indexData, null, 2));
  console.log(`Updated index.json with ${prompts.length} prompts`);
}

updateIndex();