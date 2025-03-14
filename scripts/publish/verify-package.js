#!/usr/bin/env node

/**
 * Verify Package Script
 * 
 * This script verifies that the package has all necessary files
 * before publishing to npm.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');
const buildDir = path.join(rootDir, 'build');

// Required files and directories to check
const requiredFiles = [
  'index.js',
  'cli.js',
  'config.js',
  'utils/config.js',
  'services/prompt-service.js',
  'adapters/file-adapter.js',
  'adapters/postgres-adapter.js',
  'core/types.js',
  'utils/http-server.js'
];

console.log('🔍 Verifying package before publishing...');

let hasErrors = false;

// Check that build directory exists
if (!fs.existsSync(buildDir)) {
  console.error('❌ Error: build directory does not exist. Run "npm run build" first.');
  process.exit(1);
}

// Check each required file
for (const file of requiredFiles) {
  const filePath = path.join(buildDir, file);
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Error: Required file ${file} is missing from build directory.`);
    hasErrors = true;
    
    // For critical config files, suggest how to fix
    if (file === 'config.js' || file === 'utils/config.js') {
      console.error(`   Fix: Run the ensure-config.js script: "node ./scripts/build/ensure-config.js"`);
      
      // Check if source exists
      const srcUtilsConfigPath = path.join(rootDir, 'src/utils/config.js');
      if (fs.existsSync(srcUtilsConfigPath)) {
        console.error(`   Source file exists at src/utils/config.js but wasn't copied to build.`);
      }
    }
  } else {
    console.log(`✅ Found ${file}`);
  }
}

// Check package.json configuration
const packageJsonPath = path.join(rootDir, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

if (packageJson.main !== 'build/index.js') {
  console.error('❌ Error: package.json "main" field should be "build/index.js"');
  hasErrors = true;
} else {
  console.log('✅ package.json "main" field is correct');
}

if (!packageJson.bin || packageJson.bin['mcp-prompts'] !== './build/cli.js') {
  console.error('❌ Error: package.json "bin" field should be { "mcp-prompts": "./build/cli.js" }');
  hasErrors = true;
} else {
  console.log('✅ package.json "bin" field is correct');
}

// Check files includes build directory and config files
const requiredFilesEntries = ['build/**/*', 'README.md'];
const missingFilesEntries = requiredFilesEntries.filter(entry => !packageJson.files.includes(entry));

if (missingFilesEntries.length > 0) {
  console.error(`❌ Error: package.json "files" field is missing: ${missingFilesEntries.join(', ')}`);
  hasErrors = true;
} else {
  console.log('✅ package.json "files" field includes required entries');
}

// Final check - verify built package actually works
try {
  console.log('🧪 Testing the build package integrity...');
  // Simple check - require the main file to catch any immediate issues
  const mainFilePath = path.join(buildDir, 'index.js');
  if (fs.existsSync(mainFilePath)) {
    const mainFileContent = fs.readFileSync(mainFilePath, 'utf8');
    if (!mainFileContent.includes('config')) {
      console.warn('⚠️ Warning: index.js does not reference config - may cause issues');
    } else {
      console.log('✅ index.js seems to reference config correctly');
    }
  }
} catch (err) {
  console.error(`❌ Error testing package: ${err.message}`);
  hasErrors = true;
}

if (hasErrors) {
  console.error('\n❌ Verification failed. Please fix the errors before publishing.');
  process.exit(1);
} else {
  console.log('\n✅ Package verification successful! Ready to publish.');
} 