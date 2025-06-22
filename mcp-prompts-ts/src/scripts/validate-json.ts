#!/usr/bin/env node

/**
 * JSON Validation Script
 *
 * This script validates and fixes JSON files by:
 * 1. Reading the file content
 * 2. Attempting to parse it as JSON
 * 3. If parsing fails, applying common fixes
 * 4. Writing the fixed content back to the file
 *
 * Usage:
 *   npm run validate:json [directory]
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

import { workflowSchema } from '../schemas.js';

// Get dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Validates and fixes a JSON file
 * @param filePath Path to the JSON file
 * @returns True if validation/fix was successful, false otherwise
 */
async function validateAndFixJsonFile(filePath: string): Promise<boolean> {
  console.log(`Validating ${filePath}...`);

  try {
    // Read file content
    const content = await fs.promises.readFile(filePath, 'utf8');

    try {
      // Try to parse as JSON
      JSON.parse(content);
      console.log(`✓ ${filePath} is valid JSON`);
      return true;
    } catch (error: unknown) {
      // JSON parsing failed, try to fix it
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`✗ ${filePath} has JSON errors: ${errorMessage}`);

      // Fix the content
      const fixedContent = fixJsonContent(content);

      try {
        // Verify that the fixed content is valid JSON
        JSON.parse(fixedContent);

        // Write the fixed content back to the file
        await fs.promises.writeFile(filePath, fixedContent, 'utf8');
        console.log(`✓ ${filePath} fixed and saved`);
        return true;
      } catch (fixError: unknown) {
        const fixErrorMessage = fixError instanceof Error ? fixError.message : String(fixError);
        console.error(`✗ Could not fix ${filePath}: ${fixErrorMessage}`);
        return false;
      }
    }
  } catch (fileError: unknown) {
    const fileErrorMessage = fileError instanceof Error ? fileError.message : String(fileError);
    console.error(`✗ Error reading ${filePath}: ${fileErrorMessage}`);
    return false;
  }
}

/**
 * Fixes common JSON syntax errors
 * @param content JSON content to fix
 * @returns Fixed JSON content
 */
function fixJsonContent(content: string): string {
  let fixedContent = content;

  // Fix 1: Replace single quotes with double quotes
  fixedContent = fixedContent.replace(/(\w+)'/g, '$1"').replace(/'(\w+)/g, '"$1');

  // Fix 2: Add quotes around unquoted property names
  fixedContent = fixedContent.replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3');

  // Fix 3: Remove trailing commas in arrays and objects
  fixedContent = fixedContent.replace(/,(\s*[\]}])/g, '$1');

  // Fix 4: Escape unescaped quotes within strings
  // This is a simplistic approach and might not catch all cases
  fixedContent = fixedContent.replace(/:\s*"(.*?)([^\\])"(.*?)"(\s*[,}])/g, ': "$1$2\\"$3"$4');

  // Fix 5: Turn JavaScript-style comments into valid JSON (by removing them)
  fixedContent = fixedContent.replace(/\/\/.*$/gm, '');
  fixedContent = fixedContent.replace(/\/\*[\s\S]*?\*\//g, '');

  return fixedContent;
}

/**
 * Validates and fixes all JSON files in a directory
 * @param directoryPath Path to the directory containing JSON files
 */
async function validateAndFixAllJsonFiles(directoryPath: string): Promise<void> {
  try {
    const files = await fs.promises.readdir(directoryPath);
    let failures = 0;

    for (const file of files) {
      const filePath = path.join(directoryPath, file);
      const stats = await fs.promises.stat(filePath);

      if (stats.isDirectory()) {
        // Recursively process subdirectories
        await validateAndFixAllJsonFiles(filePath);
      } else if (file.endsWith('.json')) {
        // Process JSON files
        const success = await validateAndFixJsonFile(filePath);
        if (!success) {
          failures++;
        }
      }
    }

    if (failures > 0) {
      console.log(`✗ ${failures} files could not be fixed`);
    } else {
      console.log(`✓ All JSON files are valid`);
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`✗ Error accessing directory ${directoryPath}: ${errorMessage}`);
  }
}

/**
 * Validates a workflow JSON file against the workflowSchema
 * @param filePath Path to the workflow JSON file
 * @returns True if valid, false otherwise
 */
async function validateWorkflowFile(filePath: string): Promise<boolean> {
  console.log(`Validating workflow file: ${filePath}`);
  try {
    const content = await fs.promises.readFile(filePath, 'utf8');
    const data = JSON.parse(content);
    const result = workflowSchema.safeParse(data);
    if (result.success) {
      console.log(`✓ ${filePath} is a valid workflow definition`);
      return true;
    } else {
      console.error(`✗ ${filePath} failed workflow schema validation:`);
      console.error(result.error.format());
      return false;
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`✗ Error reading or parsing ${filePath}: ${errorMessage}`);
    return false;
  }
}

/**
 * Main function (extended for workflow validation)
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args[0] === '--workflow' && args[1]) {
    // Validate a workflow file
    const filePath = args[1];
    const success = await validateWorkflowFile(filePath);
    process.exit(success ? 0 : 1);
  } else {
    // Default: validate all JSON files in a directory
    const directoryPath = args[0] || path.resolve(__dirname, '../../prompts');
    console.log(`Validating JSON files in ${directoryPath}`);
    await validateAndFixAllJsonFiles(directoryPath);
  }
}

// Run the main function
main().catch(error => {
  console.error(`Fatal error: ${error.message}`);
  process.exit(1);
});
