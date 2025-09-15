#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '../dist');

// Regular expressions to find and replace CommonJS patterns
const EXPORTS_REGEX = /Object\.defineProperty\(exports, "__esModule", \{ value: true \}\);/g;
const EXPORTS_DECLARE_REGEX = /exports\.(\w+) = void 0;/g;
const USE_STRICT_REGEX = /"use strict";/g;

// Function to recursively process all JavaScript files in a directory
async function processDirectory(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      await processDirectory(fullPath);
    } else if (entry.name.endsWith('.js')) {
      await fixModuleImports(fullPath);
    }
  }
}

// Function to fix a single JavaScript file
async function fixModuleImports(filePath) {
  try {
    console.log(`Processing ${filePath}...`);
    let content = await fs.readFile(filePath, 'utf8');
    
    // Remove the "use strict" directive (not needed in ESM)
    content = content.replace(USE_STRICT_REGEX, '');
    
    // Remove the exports.__esModule assignment
    content = content.replace(EXPORTS_REGEX, '');
    
    // Remove exports declarations (void 0)
    content = content.replace(EXPORTS_DECLARE_REGEX, '');
    
    // Replace requires with imports
    content = content.replace(/const (\w+)_(\d+) = require\("([^"]+)"\);/g, (match, name, num, path) => {
      // Handle Node.js ESM compatibility
      const importPath = path;
      return `import * as ${name}_${num} from "${importPath}";`;
    });
    
    // Replace CommonJS export assignments with ESM exports
    // First handle class and function exports
    content = content.replace(/^(class|function) (\w+)/gm, (match, type, name) => {
      // Replace any "export const X = X" at the end to avoid duplicates
      const exportPattern = new RegExp(`export const ${name} = ${name};`);
      content = content.replace(exportPattern, '');
      return `export ${type} ${name}`;
    });
    
    // Handle all the different export patterns
    content = content.replace(/exports\.(\w+) = (\w+);/g, 'export const $1 = $2;');
    content = content.replace(/exports\.default = (\w+);/g, 'export default $1;');
    content = content.replace(/exports\.(\w+) = {/g, 'export const $1 = {');
    content = content.replace(/module\.exports = {/g, 'export {');
    content = content.replace(/module\.exports = (\w+);/g, 'export default $1;');
    
    // Fix double exports
    content = content.replace(/export class (\w+)[\s\S]*?export const \1 = \1;/g, 'export class $1');
    
    await fs.writeFile(filePath, content, 'utf8');
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error);
  }
}

// Main function
async function main() {
  try {
    console.log('Fixing ESM compatibility issues in the dist directory...');
    await processDirectory(distDir);
    console.log('Done!');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main(); 