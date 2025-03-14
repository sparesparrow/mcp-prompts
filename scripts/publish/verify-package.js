#!/usr/bin/env node

/**
 * Verify Package Script
 * 
 * This script verifies that all required files are present in the build directory
 * before publishing the package.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');
const buildDir = path.join(rootDir, 'build');

// List of required files
const requiredFiles = [
  'index.js',
  'config.js',
  'package.json',
  'README.md'
];

// List of required directories
const requiredDirs = [
  'adapters',
  'core',
  'services',
  'tools',
  'utils',
  'data/prompts',
  'data/backups'
];

console.log('🔍 Verifying package contents before publishing...');

// Check if build directory exists
if (!fs.existsSync(buildDir)) {
  console.error('❌ Build directory not found! Run `npm run build` first.');
  process.exit(1);
}

// Check required files
let missingFiles = [];
for (const file of requiredFiles) {
  const filePath = path.join(buildDir, file);
  if (!fs.existsSync(filePath)) {
    missingFiles.push(file);
  }
}

// Check required directories
let missingDirs = [];
for (const dir of requiredDirs) {
  const dirPath = path.join(buildDir, dir);
  if (!fs.existsSync(dirPath)) {
    missingDirs.push(dir);
  }
}

// Report missing files and directories
if (missingFiles.length > 0 || missingDirs.length > 0) {
  console.error('❌ Verification failed!');
  
  if (missingFiles.length > 0) {
    console.error(`\nMissing files:`);
    missingFiles.forEach(file => console.error(`  - ${file}`));
  }
  
  if (missingDirs.length > 0) {
    console.error(`\nMissing directories:`);
    missingDirs.forEach(dir => console.error(`  - ${dir}`));
  }
  
  console.error('\nPlease run the build process again and ensure all files are generated correctly.');
  process.exit(1);
}

console.log('✅ All required files and directories are present.');

// Get the config.js content to double-check it exists and is valid
try {
  const configPath = path.join(buildDir, 'config.js');
  const configContent = fs.readFileSync(configPath, 'utf8');
  
  if (configContent.length < 10) {
    console.error('❌ config.js file exists but appears to be empty or too small!');
    process.exit(1);
  }
  
  console.log('✅ config.js file is present and contains data.');
} catch (error) {
  console.error('❌ Error checking config.js:', error.message);
  process.exit(1);
}

console.log('✅ Package verification completed successfully.'); 