/**
 * Prompt Manager Module for MCP Prompts Server
 * 
 * This file consolidates prompt management functionality:
 * - Importing prompts from various sources
 * - Exporting prompts to various formats
 * - Processing raw prompts from text format
 * - Organizing and tagging prompts
 * - Managing the prompt pipeline
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { promisify } from 'util';
import { exec as execCallback } from 'child_process';
import * as readline from 'readline';
import {
  Prompt,
  ImportOptions,
  ExportOptions,
  ProcessOptions,
  OrganizeOptions,
  TagOptions,
  PipelineOptions
} from './types';
import {
  validatePrompt,
  generateDescription,
  generatePromptName,
  PROMPTS_DIR
} from './utils';

// Promisify exec
const exec = promisify(execCallback);

// Configuration
const PROCESSED_DIR = path.join(process.cwd(), 'processed_prompts');
const EXPORTS_DIR = path.join(process.cwd(), 'exports');
const BACKUP_DIR = path.join(process.cwd(), 'backups');
const LOGS_DIR = path.join(process.cwd(), 'logs');

// Helper function for logging
export function log(message: string, isError = false): void {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  
  if (isError) {
    console.error(logMessage);
  } else {
    console.log(logMessage);
  }
  
  // Ensure logs directory exists
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }
  
  // Append to log file
  const logFile = path.join(LOGS_DIR, isError ? 'error.log' : 'prompt-management.log');
  fs.appendFileSync(logFile, logMessage + '\n');
}

// Confirmation helper
export async function confirm(message: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    rl.question(`${message} (y/N): `, answer => {
      rl.close();
      resolve(answer.toLowerCase() === 'y');
    });
  });
}

// =====================================
// IMPORT FUNCTIONS
// =====================================

export async function importFromJsonFile(filePath: string, options: ImportOptions = {}): Promise<void> {
  const { dryRun = false } = options;
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(content);
    
    let prompts: Prompt[] = [];
    
    if (Array.isArray(data)) {
      prompts = data;
    } else if (data.prompts && Array.isArray(data.prompts)) {
      prompts = data.prompts;
    } else {
      throw new Error('Invalid JSON format. Expected an array or an object with a prompts array.');
    }
    
    log(`Found ${prompts.length} prompts in ${filePath}`);
    
    if (!dryRun) {
      await importPrompts(prompts, options);
    } else {
      log('[DRY RUN] Would import prompts but skipping in dry run mode');
    }
  } catch (error) {
    log(`Error importing from JSON file: ${(error as Error).message}`, true);
    throw error;
  }
}

export async function importFromDirectory(dirPath: string, options: ImportOptions = {}): Promise<void> {
  const { dryRun = false } = options;
  const prompts: Prompt[] = [];
  
  function processDirectory(dir: string): void {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        processDirectory(fullPath);
      } else if (file.endsWith('.json')) {
        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          const prompt = JSON.parse(content);
          prompts.push(prompt);
        } catch (error) {
          log(`Error parsing ${fullPath}: ${(error as Error).message}`, true);
        }
      }
    }
  }
  
  try {
    processDirectory(dirPath);
    log(`Found ${prompts.length} prompts in ${dirPath}`);
    
    if (!dryRun) {
      await importPrompts(prompts, options);
    } else {
      log('[DRY RUN] Would import prompts but skipping in dry run mode');
    }
  } catch (error) {
    log(`Error importing from directory: ${(error as Error).message}`, true);
    throw error;
  }
}

export async function importPrompts(prompts: Prompt[], options: ImportOptions = {}): Promise<void> {
  const { force = false, dryRun = false } = options;
  
  try {
    // Ensure prompts directory exists
    if (!fs.existsSync(PROMPTS_DIR)) {
      fs.mkdirSync(PROMPTS_DIR, { recursive: true });
    }
    
    let imported = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const prompt of prompts) {
      try {
        // Generate id if not present
        if (!prompt.id) {
          prompt.id = crypto.randomUUID();
        }
        
        const promptPath = path.join(PROMPTS_DIR, `${prompt.id}.json`);
        
        // Check if prompt already exists
        if (fs.existsSync(promptPath) && !force) {
          log(`Skipping existing prompt: ${prompt.name} (${prompt.id})`);
          skipped++;
          continue;
        }
        
        if (!dryRun) {
          fs.writeFileSync(promptPath, JSON.stringify(prompt, null, 2));
          log(`Imported prompt: ${prompt.name} (${prompt.id})`);
          imported++;
        } else {
          log(`[DRY RUN] Would import: ${prompt.name} (${prompt.id})`);
          imported++;
        }
      } catch (error) {
        log(`Error importing prompt ${prompt.name || 'unknown'}: ${(error as Error).message}`, true);
        errors++;
      }
    }
    
    log(`Import summary: ${imported} imported, ${skipped} skipped, ${errors} errors`);
  } catch (error) {
    log(`Error importing prompts: ${(error as Error).message}`, true);
    throw error;
  }
}

// =====================================
// EXPORT FUNCTIONS
// =====================================

export function exportAsJson(prompts: Prompt[], options: ExportOptions = {}): string {
  const { outFile } = options;
  const output = JSON.stringify({ prompts }, null, 2);
  
  const outputPath = outFile || path.join(EXPORTS_DIR, `prompts-export-${Date.now()}.json`);
  fs.writeFileSync(outputPath, output);
  
  log(`Exported ${prompts.length} prompts to ${outputPath}`);
  return outputPath;
}

export function exportAsMarkdown(prompts: Prompt[], options: ExportOptions = {}): string {
  const { outFile } = options;
  
  // Sort prompts by name
  prompts.sort((a, b) => a.name.localeCompare(b.name));
  
  // Group prompts by tag
  const promptsByTag: Record<string, Prompt[]> = {};
  promptsByTag['Untagged'] = [];
  
  for (const prompt of prompts) {
    if (!prompt.tags || prompt.tags.length === 0) {
      promptsByTag['Untagged'].push(prompt);
    } else {
      for (const tag of prompt.tags) {
        if (!promptsByTag[tag]) {
          promptsByTag[tag] = [];
        }
        promptsByTag[tag].push(prompt);
      }
    }
  }
  
  // Generate markdown
  let markdown = '# Prompt Collection\n\n';
  
  // Add table of contents
  markdown += '## Table of Contents\n\n';
  const tags = Object.keys(promptsByTag).sort();
  
  for (const tag of tags) {
    if (promptsByTag[tag].length > 0) {
      markdown += `- [${tag}](#${tag.toLowerCase().replace(/\s+/g, '-')})\n`;
    }
  }
  
  markdown += '\n## Prompts by Tag\n\n';
  
  // Add prompts by tag
  for (const tag of tags) {
    if (promptsByTag[tag].length > 0) {
      markdown += `### ${tag}\n\n`;
      
      for (const prompt of promptsByTag[tag]) {
        markdown += `#### ${prompt.name}\n\n`;
        
        if (prompt.description) {
          markdown += `${prompt.description}\n\n`;
        }
        
        markdown += '```\n';
        markdown += prompt.content;
        markdown += '\n```\n\n';
        
        if (prompt.isTemplate && prompt.variables) {
          markdown += 'Variables:\n';
          for (const variable of prompt.variables) {
            markdown += `- \`${variable}\`\n`;
          }
          markdown += '\n';
        }
        
        markdown += `ID: \`${prompt.id}\`\n\n`;
        markdown += `Created: ${prompt.createdAt}\n\n`;
        markdown += `Updated: ${prompt.updatedAt}\n\n`;
        markdown += '---\n\n';
      }
    }
  }
  
  const outputPath = outFile || path.join(EXPORTS_DIR, `prompts-export-${Date.now()}.md`);
  fs.writeFileSync(outputPath, markdown);
  
  log(`Exported ${prompts.length} prompts to ${outputPath}`);
  return outputPath;
}

// =====================================
// PROCESS FUNCTIONS
// =====================================

export function processRawPrompts(options: ProcessOptions = {}): void {
  const { 
    shouldCleanup = true, 
    shouldBackup = false,
    rawPromptsFile = path.join(process.cwd(), 'rawprompts.txt')
  } = options;
  
  // Check if raw prompts file exists
  if (!fs.existsSync(rawPromptsFile)) {
    log(`Error: Raw prompts file not found at ${rawPromptsFile}`, true);
    return;
  }
  
  // Ensure output directory exists
  if (!fs.existsSync(PROCESSED_DIR)) {
    fs.mkdirSync(PROCESSED_DIR, { recursive: true });
  }
  
  // Ensure backup directory exists if backup is requested
  if (shouldBackup && !fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
  
  // Read the raw prompts file
  const rawData = fs.readFileSync(rawPromptsFile, 'utf8');
  
  // Split by delimiter (assuming empty lines as delimiter)
  const rawPrompts = rawData.split(/\n{2,}/).filter(p => p.trim().length > 0);
  
  log(`Found ${rawPrompts.length} raw prompts to process`);
  
  // Process each prompt
  const processed = [];
  const timestamp = new Date().toISOString();
  
  for (let i = 0; i < rawPrompts.length; i++) {
    const content = rawPrompts[i].trim();
    if (content.length === 0) continue;
    
    // Generate a unique ID
    const id = crypto.createHash('md5').update(content).digest('hex');
    
    // Generate name from first line or first few words
    const name = generatePromptName(content);
    
    // Generate description
    const description = generateDescription(content);
    
    // Create prompt object
    const prompt: Partial<Prompt> = {
      id,
      name,
      description,
      content,
      isTemplate: content.includes('{{') && content.includes('}}'),
      createdAt: timestamp,
      updatedAt: timestamp,
      version: 1
    };
    
    // Extract template variables if it's a template
    if (prompt.isTemplate) {
      const variableMatches = content.match(/\{\{([^}]+)\}\}/g) || [];
      prompt.variables = variableMatches
        .map(match => match.replace(/\{\{|\}\}/g, '').trim())
        .filter((v, i, a) => a.indexOf(v) === i); // Remove duplicates
    }
    
    processed.push(prompt);
    
    // Save to file
    const outputFile = path.join(PROCESSED_DIR, `${id}.json`);
    fs.writeFileSync(outputFile, JSON.stringify(prompt, null, 2));
    
    log(`Processed prompt ${i + 1}/${rawPrompts.length}: ${name} (${id})`);
  }
  
  // Create a backup of the raw prompts file if requested
  if (shouldBackup) {
    const backupFile = path.join(BACKUP_DIR, `rawprompts-${Date.now()}.txt`);
    fs.copyFileSync(rawPromptsFile, backupFile);
    log(`Created backup at ${backupFile}`);
  }
  
  // Remove the raw prompts file if cleanup is enabled
  if (shouldCleanup) {
    fs.unlinkSync(rawPromptsFile);
    log('Removed raw prompts file after processing');
  }
  
  log(`Successfully processed ${processed.length} prompts`);
}

// =====================================
// TAG MANAGEMENT FUNCTIONS
// =====================================

export async function manageTags(options: TagOptions): Promise<void> {
  const { action, tag, newTag, promptIds } = options;
  
  switch (action) {
    case 'list':
      await listTags();
      break;
    case 'add':
      if (!tag || !promptIds || promptIds.length === 0) {
        log('Error: tag and promptIds are required for add action', true);
        return;
      }
      await addTagToPrompts(tag, promptIds);
      break;
    case 'remove':
      if (!tag || !promptIds || promptIds.length === 0) {
        log('Error: tag and promptIds are required for remove action', true);
        return;
      }
      await removeTagFromPrompts(tag, promptIds);
      break;
    case 'rename':
      if (!tag || !newTag) {
        log('Error: tag and newTag are required for rename action', true);
        return;
      }
      await renameTag(tag, newTag);
      break;
    default:
      log(`Unknown action: ${action}`, true);
  }
}

async function listTags(): Promise<void> {
  const tags: Record<string, number> = {};
  
  // Ensure prompts directory exists
  if (!fs.existsSync(PROMPTS_DIR)) {
    log('No prompts directory found', true);
    return;
  }
  
  // Read all prompt files
  const files = fs.readdirSync(PROMPTS_DIR);
  
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    
    try {
      const content = fs.readFileSync(path.join(PROMPTS_DIR, file), 'utf8');
      const prompt = JSON.parse(content);
      
      if (prompt.tags && Array.isArray(prompt.tags)) {
        for (const tag of prompt.tags) {
          tags[tag] = (tags[tag] || 0) + 1;
        }
      }
    } catch (error) {
      log(`Error reading prompt file ${file}: ${(error as Error).message}`, true);
    }
  }
  
  // Display tags sorted by count
  const sortedTags = Object.entries(tags)
    .sort((a, b) => b[1] - a[1])
    .map(([tag, count]) => `${tag} (${count})`);
  
  log(`Found ${Object.keys(tags).length} unique tags across all prompts:`);
  console.log(sortedTags.join('\n'));
}

async function addTagToPrompts(tag: string, promptIds: string[]): Promise<void> {
  let updated = 0;
  
  for (const id of promptIds) {
    const promptPath = path.join(PROMPTS_DIR, `${id}.json`);
    
    if (!fs.existsSync(promptPath)) {
      log(`Prompt not found: ${id}`, true);
      continue;
    }
    
    try {
      const content = fs.readFileSync(promptPath, 'utf8');
      const prompt = JSON.parse(content);
      
      if (!prompt.tags) {
        prompt.tags = [];
      }
      
      if (!prompt.tags.includes(tag)) {
        prompt.tags.push(tag);
        prompt.updatedAt = new Date().toISOString();
        
        fs.writeFileSync(promptPath, JSON.stringify(prompt, null, 2));
        log(`Added tag '${tag}' to prompt: ${prompt.name} (${id})`);
        updated++;
      } else {
        log(`Prompt already has tag '${tag}': ${prompt.name} (${id})`);
      }
    } catch (error) {
      log(`Error updating prompt ${id}: ${(error as Error).message}`, true);
    }
  }
  
  log(`Added tag '${tag}' to ${updated} prompts`);
}

async function removeTagFromPrompts(tag: string, promptIds: string[]): Promise<void> {
  let updated = 0;
  
  for (const id of promptIds) {
    const promptPath = path.join(PROMPTS_DIR, `${id}.json`);
    
    if (!fs.existsSync(promptPath)) {
      log(`Prompt not found: ${id}`, true);
      continue;
    }
    
    try {
      const content = fs.readFileSync(promptPath, 'utf8');
      const prompt = JSON.parse(content);
      
      if (prompt.tags && prompt.tags.includes(tag)) {
        prompt.tags = prompt.tags.filter((t: string) => t !== tag);
        prompt.updatedAt = new Date().toISOString();
        
        fs.writeFileSync(promptPath, JSON.stringify(prompt, null, 2));
        log(`Removed tag '${tag}' from prompt: ${prompt.name} (${id})`);
        updated++;
      } else {
        log(`Prompt does not have tag '${tag}': ${prompt.name} (${id})`);
      }
    } catch (error) {
      log(`Error updating prompt ${id}: ${(error as Error).message}`, true);
    }
  }
  
  log(`Removed tag '${tag}' from ${updated} prompts`);
}

async function renameTag(oldTag: string, newTag: string): Promise<void> {
  let updated = 0;
  
  // Ensure prompts directory exists
  if (!fs.existsSync(PROMPTS_DIR)) {
    log('No prompts directory found', true);
    return;
  }
  
  // Read all prompt files
  const files = fs.readdirSync(PROMPTS_DIR);
  
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    
    try {
      const promptPath = path.join(PROMPTS_DIR, file);
      const content = fs.readFileSync(promptPath, 'utf8');
      const prompt = JSON.parse(content);
      
      if (prompt.tags && prompt.tags.includes(oldTag)) {
        prompt.tags = prompt.tags.map((t: string) => t === oldTag ? newTag : t);
        prompt.updatedAt = new Date().toISOString();
        
        fs.writeFileSync(promptPath, JSON.stringify(prompt, null, 2));
        log(`Renamed tag '${oldTag}' to '${newTag}' in prompt: ${prompt.name} (${prompt.id})`);
        updated++;
      }
    } catch (error) {
      log(`Error updating prompt file ${file}: ${(error as Error).message}`, true);
    }
  }
  
  log(`Renamed tag '${oldTag}' to '${newTag}' in ${updated} prompts`);
}

// =====================================
// MAIN EXPORT FUNCTIONS
// =====================================

export async function runImport(options: ImportOptions = {}): Promise<void> {
  const { source, skipConfirm = false, dryRun = false, force = false } = options;
  
  if (!source) {
    log('Error: Source is required for import', true);
    return;
  }
  
  // Check if source exists
  if (!fs.existsSync(source)) {
    log(`Error: Source not found: ${source}`, true);
    return;
  }
  
  // Confirm import unless skipConfirm is true
  if (!skipConfirm) {
    const confirmed = await confirm(`Do you want to import from ${source}?`);
    if (!confirmed) {
      log('Import cancelled');
      return;
    }
  }
  
  // Determine import type based on source
  const stat = fs.statSync(source);
  
  if (stat.isDirectory()) {
    await importFromDirectory(source, { dryRun, force });
  } else if (source.endsWith('.json')) {
    await importFromJsonFile(source, { dryRun, force });
  } else {
    log(`Error: Unsupported source type: ${source}`, true);
  }
}

export async function runExport(options: ExportOptions = {}): Promise<void> {
  const { format = 'json', tags = [], outFile } = options;
  
  // Ensure exports directory exists
  if (!fs.existsSync(EXPORTS_DIR)) {
    fs.mkdirSync(EXPORTS_DIR, { recursive: true });
  }
  
  // Collect all prompts
  const prompts: Prompt[] = [];
  
  function processDirectory(dir: string): void {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        processDirectory(fullPath);
      } else if (file.endsWith('.json')) {
        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          const prompt = JSON.parse(content);
          
          // Filter by tags if specified
          if (tags.length > 0) {
            if (!prompt.tags || !prompt.tags.some((tag: string) => tags.includes(tag))) {
              continue;
            }
          }
          
          prompts.push(prompt);
        } catch (error) {
          log(`Error parsing ${fullPath}: ${(error as Error).message}`, true);
        }
      }
    }
  }
  
  if (fs.existsSync(PROMPTS_DIR)) {
    processDirectory(PROMPTS_DIR);
  }
  
  log(`Found ${prompts.length} prompts ${tags.length ? `with tags [${tags.join(', ')}]` : ''}`);
  
  if (prompts.length === 0) {
    log('No prompts to export');
    return;
  }
  
  // Export based on format
  switch (format) {
    case 'json':
      exportAsJson(prompts, { outFile });
      break;
    case 'markdown':
      exportAsMarkdown(prompts, { outFile });
      break;
    default:
      log(`Error: Unsupported export format: ${format}`, true);
  }
}

// Export the main functions
export default {
  import: runImport,
  export: runExport,
  process: processRawPrompts,
  manageTags
}; 