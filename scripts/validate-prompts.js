#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { glob } = require('glob');

// Simple JSON validation
function validateJsonFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    JSON.parse(content);
    return { valid: true, file: filePath };
  } catch (error) {
    return { valid: false, file: filePath, error: error.message };
  }
}

// Validate all JSON files in prompts directory
async function validatePrompts() {
  console.log('🔍 Validating prompts...');
  
  const promptFiles = await glob('prompts/**/*.json');
  const catalogFiles = await glob('catalog/**/*.json');
  const allFiles = [...promptFiles, ...catalogFiles];
  
  const results = allFiles.map(validateJsonFile);
  const invalidFiles = results.filter(result => !result.valid);
  
  if (invalidFiles.length > 0) {
    console.error('❌ Invalid JSON files found:');
    invalidFiles.forEach(file => {
      console.error(`  - ${file.file}: ${file.error}`);
    });
    process.exit(1);
  }
  
  console.log(`✅ All ${results.length} JSON files are valid!`);
}

validatePrompts().catch(console.error); 