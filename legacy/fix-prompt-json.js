#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const promptsDir = process.argv[2] || './prompts';

// List of files to fix
const filesToFix = [
  'collaborative-development.json',
  'docker-mcp-servers-orchestration.json',
  'mcp-code-generator.json',
  'mcp-resources-integration.json'
];

// Function to fix JSON content
function fixJsonContent(content) {
  try {
    // First check if it's valid as-is
    JSON.parse(content);
    return content; // If it's valid, just return it
  } catch (error) {
    // If it's not valid, begin fixing it
    console.log(`Fixing JSON: ${error.message}`);
    
    // Extract the structure of the json (id, name, description, content)
    const idMatch = content.match(/"id"\s*:\s*"([^"]+)"/);
    const nameMatch = content.match(/"name"\s*:\s*"([^"]+)"/);
    const descMatch = content.match(/"description"\s*:\s*"([^"]+)"/);
    
    // Extract content between "content": " and the last " before the closing }
    const contentStartIndex = content.indexOf('"content": "') + 12;
    const contentEndIndex = content.lastIndexOf('"');
    
    if (contentStartIndex < 0 || contentEndIndex < 0 || contentEndIndex <= contentStartIndex) {
      throw new Error("Couldn't locate content field boundaries");
    }
    
    // Get the raw content string that needs proper escaping
    let rawContent = content.substring(contentStartIndex, contentEndIndex);
    
    // Escape special characters properly
    rawContent = rawContent
      .replace(/\\/g, '\\\\')  // Escape backslashes
      .replace(/"/g, '\\"')    // Escape double quotes
      .replace(/\n/g, '\\n')   // Escape newlines
      .replace(/\r/g, '\\r')   // Escape carriage returns
      .replace(/\t/g, '\\t')   // Escape tabs
      .replace(/\f/g, '\\f')   // Escape form feeds
      .replace(/[\u0000-\u001F]/g, '') // Remove other control characters
      
    // Now rebuild the JSON structure
    const fixedJson = {
      id: idMatch ? idMatch[1] : 'unknown-id',
      name: nameMatch ? nameMatch[1] : 'Unknown Name',
      description: descMatch ? descMatch[1] : 'No description available',
      content: rawContent
    };
    
    // Return the stringified JSON
    return JSON.stringify(fixedJson, null, 2);
  }
}

async function fixFiles() {
  console.log(`Fixing JSON files in ${promptsDir}`);
  
  let fixedCount = 0;
  let errorCount = 0;
  
  for (const file of filesToFix) {
    const filePath = path.join(promptsDir, file);
    console.log(`Processing ${filePath}...`);
    
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const fixedContent = fixJsonContent(content);
      
      // Validate the fixed content
      JSON.parse(fixedContent);
      
      // Create a backup
      fs.writeFileSync(`${filePath}.bak`, content);
      console.log(`✅ Created backup at ${filePath}.bak`);
      
      // Write the fixed file
      fs.writeFileSync(filePath, fixedContent);
      console.log(`✅ Fixed ${file}`);
      
      fixedCount++;
    } catch (error) {
      console.error(`❌ Error fixing ${file}: ${error.message}`);
      errorCount++;
    }
  }
  
  console.log('\nSummary:');
  console.log(`✅ ${fixedCount} files fixed successfully`);
  console.log(`❌ ${errorCount} files could not be fixed`);
}

fixFiles();
