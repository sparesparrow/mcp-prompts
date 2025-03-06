/**
 * MCP Prompts CLI
 * This file contains the command-line interface for working with prompts
 */

import fs from 'fs/promises';
import path from 'path';
import { Command } from 'commander';
import { v4 as uuidv4 } from 'uuid';
import { createConfig, Prompt, extractVariables } from './core';
import { createStorageProvider } from './storage';

// CLI version
const VERSION = '1.1.0';

/**
 * Process raw prompts from markdown files
 * @param options Options for prompt processing
 */
async function processRawPrompts(
  inputDir: string,
  outputDir: string,
  options: { 
    cleanup?: boolean; 
    backup?: boolean;
  } = {}
): Promise<void> {
  console.log(`Processing prompts from ${inputDir} to ${outputDir}`);
  
  // Create output directory
  await fs.mkdir(outputDir, { recursive: true });
  
  // Backup existing prompts if requested
  if (options.backup) {
    const backupDir = `${outputDir}-backup-${Date.now()}`;
    console.log(`Backing up existing prompts to ${backupDir}`);
    
    try {
      await fs.mkdir(backupDir, { recursive: true });
      const files = await fs.readdir(outputDir);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const sourceFile = path.join(outputDir, file);
          const destFile = path.join(backupDir, file);
          await fs.copyFile(sourceFile, destFile);
        }
      }
      
      console.log('Backup completed');
    } catch (error) {
      console.error('Error during backup:', error);
    }
  }
  
  // Read raw markdown files
  const files = await fs.readdir(inputDir);
  const mdFiles = files.filter(file => file.endsWith('.md'));
  
  console.log(`Found ${mdFiles.length} markdown files`);
  
  // Process each markdown file
  let processed = 0;
  
  for (const file of mdFiles) {
    try {
      const filePath = path.join(inputDir, file);
      const content = await fs.readFile(filePath, 'utf-8');
      
      // Extract prompt details
      const nameMatch = content.match(/^# (.*)/m);
      const name = nameMatch ? nameMatch[1].trim() : file.replace('.md', '');
      
      const descriptionMatch = content.match(/## Description\s*\n\s*(.*)/s);
      const description = descriptionMatch 
        ? descriptionMatch[1].trim().split('\n\n')[0] 
        : '';
      
      const promptMatch = content.match(/```\s*(?:prompt)?\s*\n([\s\S]*?)```/);
      const promptContent = promptMatch 
        ? promptMatch[1].trim() 
        : content.trim();
      
      const tagsMatch = content.match(/## Tags\s*\n\s*(.*)/);
      const tags = tagsMatch 
        ? tagsMatch[1].split(',').map(tag => tag.trim()) 
        : [];
      
      // Check if it's a template
      const isTemplate = promptContent.includes('{{') && promptContent.includes('}}');
      
      // Generate ID from name
      const id = file.replace('.md', '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      
      // Create prompt object
      const prompt: Prompt = {
        id,
        name,
        content: promptContent,
        description,
        tags,
        isTemplate,
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
        metadata: {
          sourceFile: file
        }
      };
      
      // Extract variables if it's a template
      if (isTemplate) {
        prompt.variables = extractVariables(promptContent);
      }
      
      // Write to output file
      const outputFile = path.join(outputDir, `${id}.json`);
      await fs.writeFile(outputFile, JSON.stringify(prompt, null, 2), 'utf-8');
      
      processed++;
      console.log(`Processed: ${file} → ${id}.json`);
    } catch (error) {
      console.error(`Error processing ${file}:`, error);
    }
  }
  
  console.log(`Successfully processed ${processed} out of ${mdFiles.length} files`);
  
  // Clean up if requested
  if (options.cleanup) {
    console.log('Cleaning up processed files');
    const tempDir = `${inputDir}-processed-${Date.now()}`;
    await fs.mkdir(tempDir, { recursive: true });
    
    for (const file of mdFiles) {
      const sourceFile = path.join(inputDir, file);
      const destFile = path.join(tempDir, file);
      await fs.rename(sourceFile, destFile);
    }
    
    console.log(`Moved processed files to ${tempDir}`);
  }
}

/**
 * Manage prompt tags
 * @param action Action to perform (list, add, remove, rename)
 * @param options Options for tag management
 */
async function manageTags(
  action: 'list' | 'add' | 'remove' | 'rename',
  options: {
    baseDir?: string;
    tag?: string;
    newTag?: string;
    promptIds?: string[];
  } = {}
): Promise<void> {
  const baseDir = options.baseDir || path.join(process.cwd(), 'prompts');
  
  // Create storage provider
  const config = createConfig({
    storage: {
      type: 'file',
      options: {
        baseDir
      }
    }
  });
  
  const storage = createStorageProvider(config);
  
  try {
    const prompts = await storage.listPrompts();
    
    if (action === 'list') {
      // Count tag occurrences
      const tagCounts: Record<string, number> = {};
      
      prompts.forEach(prompt => {
        (prompt.tags || []).forEach(tag => {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
      });
      
      // Sort tags by count (descending)
      const sortedTags = Object.entries(tagCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([tag, count]) => ({ tag, count }));
      
      console.log('Tags used in prompts:');
      console.table(sortedTags);
      
      return;
    }
    
    if (!options.tag) {
      console.error('Tag is required for add, remove, and rename actions');
      return;
    }
    
    // Filter prompts if IDs are provided
    const targetPrompts = options.promptIds && options.promptIds.length > 0
      ? prompts.filter(p => options.promptIds!.includes(p.id))
      : prompts;
    
    if (targetPrompts.length === 0) {
      console.log('No prompts found to modify');
      return;
    }
    
    let modifiedCount = 0;
    
    for (const prompt of targetPrompts) {
      let modified = false;
      
      if (action === 'add') {
        // Add tag if it doesn't exist
        if (!prompt.tags) {
          prompt.tags = [options.tag];
          modified = true;
        } else if (!prompt.tags.includes(options.tag)) {
          prompt.tags.push(options.tag);
          modified = true;
        }
      } else if (action === 'remove') {
        // Remove tag if it exists
        if (prompt.tags && prompt.tags.includes(options.tag)) {
          prompt.tags = prompt.tags.filter(t => t !== options.tag);
          modified = true;
        }
      } else if (action === 'rename') {
        // Rename tag
        if (!options.newTag) {
          console.error('New tag name is required for rename action');
          return;
        }
        
        if (prompt.tags && prompt.tags.includes(options.tag)) {
          prompt.tags = prompt.tags.map(t => t === options.tag ? options.newTag! : t);
          modified = true;
        }
      }
      
      if (modified) {
        prompt.updatedAt = new Date();
        await storage.addPrompt(prompt);
        modifiedCount++;
      }
    }
    
    console.log(`Modified ${modifiedCount} out of ${targetPrompts.length} prompts`);
  } finally {
    await storage.close();
  }
}

/**
 * Export prompts to a specific format
 * @param outputDir Output directory
 * @param options Export options
 */
async function exportPrompts(
  outputDir: string,
  options: {
    format?: 'json' | 'markdown';
    baseDir?: string;
    tags?: string[];
  } = {}
): Promise<void> {
  const format = options.format || 'json';
  const baseDir = options.baseDir || path.join(process.cwd(), 'prompts');
  
  // Create storage provider
  const config = createConfig({
    storage: {
      type: 'file',
      options: {
        baseDir
      }
    }
  });
  
  const storage = createStorageProvider(config);
  
  try {
    // Get prompts with optional tag filtering
    const prompts = await storage.listPrompts(options.tags ? { tags: options.tags } : undefined);
    
    console.log(`Exporting ${prompts.length} prompts to ${format} format in ${outputDir}`);
    
    // Create output directory
    await fs.mkdir(outputDir, { recursive: true });
    
    for (const prompt of prompts) {
      if (format === 'json') {
        const outputFile = path.join(outputDir, `${prompt.id}.json`);
        await fs.writeFile(outputFile, JSON.stringify(prompt, null, 2), 'utf-8');
      } else if (format === 'markdown') {
        const outputFile = path.join(outputDir, `${prompt.id}.md`);
        
        let mdContent = `# ${prompt.name}\n\n`;
        
        if (prompt.description) {
          mdContent += `## Description\n\n${prompt.description}\n\n`;
        }
        
        mdContent += "```prompt\n";
        mdContent += `${prompt.content}\n`;
        mdContent += "```\n\n";
        
        if (prompt.tags && prompt.tags.length > 0) {
          mdContent += `## Tags\n\n${prompt.tags.join(', ')}\n\n`;
        }
        
        if (prompt.isTemplate && prompt.variables && prompt.variables.length > 0) {
          mdContent += `## Variables\n\n${prompt.variables.join(', ')}\n\n`;
        }
        
        await fs.writeFile(outputFile, mdContent, 'utf-8');
      }
      
      console.log(`Exported: ${prompt.id}`);
    }
    
    console.log(`Export completed: ${prompts.length} prompts exported`);
  } finally {
    await storage.close();
  }
}

/**
 * Import prompts from a file or directory
 * @param input Input file or directory
 * @param options Import options
 */
async function importPrompts(
  input: string,
  options: {
    baseDir?: string;
    force?: boolean;
    dryRun?: boolean;
    yes?: boolean;
  } = {}
): Promise<void> {
  const baseDir = options.baseDir || path.join(process.cwd(), 'prompts');
  const isDryRun = options.dryRun || false;
  
  // Create storage provider
  const config = createConfig({
    storage: {
      type: 'file',
      options: {
        baseDir
      }
    }
  });
  
  const storage = createStorageProvider(config);
  
  try {
    // Check if input is a file or directory
    const stats = await fs.stat(input);
    const inputFiles: string[] = [];
    
    if (stats.isDirectory()) {
      // Get all JSON and Markdown files from the directory
      const files = await fs.readdir(input);
      inputFiles.push(...files
        .filter(file => file.endsWith('.json') || file.endsWith('.md'))
        .map(file => path.join(input, file))
      );
    } else {
      // Single file
      inputFiles.push(input);
    }
    
    console.log(`Found ${inputFiles.length} files to import`);
    
    if (inputFiles.length === 0) {
      console.log('No files to import');
      return;
    }
    
    // Process each input file
    let processed = 0;
    let imported = 0;
    let skipped = 0;
    
    for (const file of inputFiles) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        let prompt: Prompt;
        
        // Parse file based on extension
        if (file.endsWith('.json')) {
          prompt = JSON.parse(content) as Prompt;
        } else if (file.endsWith('.md')) {
          // Extract prompt details from markdown
          const nameMatch = content.match(/^# (.*)/m);
          const name = nameMatch ? nameMatch[1].trim() : path.basename(file, '.md');
          
          const descriptionMatch = content.match(/## Description\s*\n\s*(.*)/s);
          const description = descriptionMatch 
            ? descriptionMatch[1].trim().split('\n\n')[0] 
            : '';
          
          const promptMatch = content.match(/```\s*(?:prompt)?\s*\n([\s\S]*?)```/);
          const promptContent = promptMatch 
            ? promptMatch[1].trim() 
            : content.trim();
          
          const tagsMatch = content.match(/## Tags\s*\n\s*(.*)/);
          const tags = tagsMatch 
            ? tagsMatch[1].split(',').map(tag => tag.trim()) 
            : [];
          
          // Generate ID from filename
          const id = path.basename(file, '.md')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');
          
          // Create prompt object
          prompt = {
            id,
            name,
            content: promptContent,
            description,
            tags,
            isTemplate: promptContent.includes('{{') && promptContent.includes('}}'),
            createdAt: new Date(),
            updatedAt: new Date(),
            version: 1,
            metadata: {
              sourceFile: path.basename(file)
            }
          };
          
          // Extract variables if it's a template
          if (prompt.isTemplate) {
            prompt.variables = extractVariables(promptContent);
          }
        } else {
          console.warn(`Skipping unsupported file: ${file}`);
          skipped++;
          continue;
        }
        
        // Validate prompt
        if (!prompt.id || !prompt.name || !prompt.content) {
          console.warn(`Skipping invalid prompt: ${file} (missing id, name, or content)`);
          skipped++;
          continue;
        }
        
        // Check if prompt already exists
        const existingPrompt = await storage.getPrompt(prompt.id);
        
        if (existingPrompt && !options.force) {
          console.log(`Prompt with ID ${prompt.id} already exists. Use --force to overwrite.`);
          skipped++;
          continue;
        }
        
        // Import prompt (or simulate in dry run mode)
        if (!isDryRun) {
          await storage.addPrompt(prompt);
          console.log(`Imported: ${prompt.id} - ${prompt.name}`);
        } else {
          console.log(`[DRY RUN] Would import: ${prompt.id} - ${prompt.name}`);
        }
        
        imported++;
        processed++;
      } catch (error) {
        console.error(`Error processing ${file}:`, error);
      }
    }
    
    console.log(`\nImport summary:`);
    console.log(`- Processed: ${processed} files`);
    console.log(`- Imported: ${imported} prompts`);
    console.log(`- Skipped: ${skipped} files`);
    
    if (isDryRun) {
      console.log('\nThis was a dry run. No changes were made.');
    }
  } finally {
    await storage.close();
  }
}

/**
 * Set up the CLI commands
 */
export function setupCLI(): Command {
  const program = new Command();
  
  program.name('mcp-prompts')
    .description('MCP Prompts Server CLI')
    .version(VERSION);
  
  // Process prompts command
  program
    .command('process')
    .description('Process prompts from markdown files')
    .argument('<inputDir>', 'Directory containing markdown prompt files')
    .argument('[outputDir]', 'Directory to store processed prompts', './prompts')
    .option('--no-cleanup', 'Do not clean up processed files')
    .option('--backup', 'Backup existing prompts before processing')
    .action(async (inputDir, outputDir, options) => {
      try {
        await processRawPrompts(inputDir, outputDir, {
          cleanup: options.cleanup,
          backup: options.backup
        });
      } catch (error) {
        console.error('Error processing prompts:', error);
        process.exit(1);
      }
    });
  
  // Tags management command
  const tagsCommand = program
    .command('tags')
    .description('Manage prompt tags');
  
  tagsCommand
    .command('list')
    .description('List all tags and their usage')
    .option('-d, --dir <directory>', 'Prompts directory', './prompts')
    .action(async (options) => {
      try {
        await manageTags('list', { baseDir: options.dir });
      } catch (error) {
        console.error('Error listing tags:', error);
        process.exit(1);
      }
    });
  
  tagsCommand
    .command('add')
    .description('Add a tag to prompts')
    .argument('<tag>', 'Tag to add')
    .option('-d, --dir <directory>', 'Prompts directory', './prompts')
    .option('-p, --prompts <ids>', 'Prompt IDs (comma-separated)', '')
    .action(async (tag, options) => {
      try {
        const promptIds = options.prompts ? options.prompts.split(',') : [];
        await manageTags('add', { 
          baseDir: options.dir, 
          tag,
          promptIds
        });
      } catch (error) {
        console.error('Error adding tag:', error);
        process.exit(1);
      }
    });
  
  tagsCommand
    .command('remove')
    .description('Remove a tag from prompts')
    .argument('<tag>', 'Tag to remove')
    .option('-d, --dir <directory>', 'Prompts directory', './prompts')
    .option('-p, --prompts <ids>', 'Prompt IDs (comma-separated)', '')
    .action(async (tag, options) => {
      try {
        const promptIds = options.prompts ? options.prompts.split(',') : [];
        await manageTags('remove', { 
          baseDir: options.dir, 
          tag,
          promptIds
        });
      } catch (error) {
        console.error('Error removing tag:', error);
        process.exit(1);
      }
    });
  
  tagsCommand
    .command('rename')
    .description('Rename a tag in prompts')
    .argument('<oldTag>', 'Tag to rename')
    .argument('<newTag>', 'New tag name')
    .option('-d, --dir <directory>', 'Prompts directory', './prompts')
    .option('-p, --prompts <ids>', 'Prompt IDs (comma-separated)', '')
    .action(async (oldTag, newTag, options) => {
      try {
        const promptIds = options.prompts ? options.prompts.split(',') : [];
        await manageTags('rename', { 
          baseDir: options.dir, 
          tag: oldTag,
          newTag,
          promptIds
        });
      } catch (error) {
        console.error('Error renaming tag:', error);
        process.exit(1);
      }
    });
  
  // Export command
  program
    .command('export')
    .description('Export prompts to a specific format')
    .argument('[outputDir]', 'Directory to export prompts to', './exported_prompts')
    .option('-d, --dir <directory>', 'Prompts directory', './prompts')
    .option('-f, --format <format>', 'Export format (json, markdown)', 'json')
    .option('-t, --tags <tags>', 'Filter by tags (comma-separated)')
    .action(async (outputDir, options) => {
      try {
        const format = options.format === 'markdown' ? 'markdown' : 'json';
        const tags = options.tags ? options.tags.split(',') : undefined;
        
        await exportPrompts(outputDir, {
          format,
          baseDir: options.dir,
          tags
        });
      } catch (error) {
        console.error('Error exporting prompts:', error);
        process.exit(1);
      }
    });
  
  // Import command
  program
    .command('import')
    .description('Import prompts from a file or directory')
    .argument('<input>', 'File or directory to import prompts from')
    .option('-d, --dir <directory>', 'Prompts directory', './prompts')
    .option('-f, --force', 'Force overwrite existing prompts')
    .option('--dry-run', 'Simulate import without making changes')
    .option('-y, --yes', 'Skip confirmation prompts')
    .action(async (input, options) => {
      try {
        await importPrompts(input, {
          baseDir: options.dir,
          force: options.force,
          dryRun: options.dryRun,
          yes: options.yes
        });
      } catch (error) {
        console.error('Error importing prompts:', error);
        process.exit(1);
      }
    });
  
  return program;
}

// For direct CLI usage
if (require.main === module) {
  const program = setupCLI();
  program.parse(process.argv);
} 