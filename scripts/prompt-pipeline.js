#!/usr/bin/env node

/**
 * prompt-pipeline.js
 * 
 * A helper script that runs the complete prompt processing pipeline:
 * 1. Process raw prompts
 * 2. Organize prompts into categories
 * 3. Run tag management operations
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Configuration
const SCRIPTS_DIR = path.join(__dirname);
const RAW_PROMPTS_FILE = path.join(process.cwd(), 'rawprompts.txt');
const CLI_PATH = path.join(process.cwd(), 'bin', 'prompt-cli.ts');

// Get command line arguments
const args = process.argv.slice(2);
const skipBackup = args.includes('--no-backup');
const skipCleanup = args.includes('--no-cleanup');
const dryRun = args.includes('--dry-run');
const verbose = args.includes('--verbose');

console.log('Starting MCP Prompts processing pipeline...');

// Check if rawprompts.txt exists
if (!fs.existsSync(RAW_PROMPTS_FILE)) {
  console.error(`Error: Raw prompts file not found at ${RAW_PROMPTS_FILE}`);
  console.log('Please create a rawprompts.txt file with your prompt data first.');
  process.exit(1);
}

// Helper function to run a CLI command with arguments
async function runCliCommand(command, args = []) {
  return new Promise((resolve, reject) => {
    console.log(`\n[Pipeline] Running prompt-cli ${command} ${args.join(' ')}`);
    
    const child = spawn('ts-node', [CLI_PATH, command, ...args], {
      stdio: verbose ? 'inherit' : 'pipe'
    });
    
    let output = '';
    
    if (!verbose && child.stdout) {
      child.stdout.on('data', (data) => {
        output += data.toString();
      });
    }
    
    if (!verbose && child.stderr) {
      child.stderr.on('data', (data) => {
        console.error(`[prompt-cli ${command}] ${data.toString()}`);
      });
    }
    
    child.on('close', (code) => {
      if (code === 0) {
        if (!verbose) {
          console.log(`✓ prompt-cli ${command} completed successfully`);
          
          // Print summary of output (first and last few lines)
          if (output) {
            const lines = output.split('\n');
            if (lines.length > 10) {
              console.log(`  Summary of output (${lines.length} lines total):`);
              console.log('  ' + lines.slice(0, 3).join('\n  '));
              console.log('  ...');
              console.log('  ' + lines.slice(-3).join('\n  '));
            } else {
              console.log(`  Output:`);
              console.log('  ' + lines.join('\n  '));
            }
          }
        }
        resolve();
      } else {
        console.error(`✗ prompt-cli ${command} failed with exit code ${code}`);
        reject(new Error(`Command prompt-cli ${command} failed with exit code ${code}`));
      }
    });
  });
}

// Define the pipeline steps
const runPipeline = async () => {
  try {
    // Step 1: Process raw prompts
    const processArgs = [];
    if (!skipBackup) processArgs.push('--backup');
    if (skipCleanup) processArgs.push('--no-cleanup');
    
    await runCliCommand('process', processArgs);
    
    // Step 2: Run tag management operations
    // First list all tags to see what we're working with
    await runCliCommand('tags', ['list']);
    
    // Add or update tags based on content
    const tagOperations = [
      // Add AI Assistant tag to relevant prompts
      ['add', 'ai-assistant', 'You are a'],
      
      // Add language-model tag to prompts about LLMs
      ['add', 'language-model', 'language model|LLM|Claude|GPT'],
      
      // Add coding tag to programming-related prompts
      ['add', 'coding', 'code|programming|developer|Python|JavaScript'],
      
      // Add problem-solving tag
      ['add', 'problem-solving', 'solve|solution|troubleshoot|fix|debug']
    ];
    
    for (const [operation, ...args] of tagOperations) {
      await runCliCommand('tags', [operation, ...args]);
    }
    
    // Step 3: Organize prompts into categories
    const organizeArgs = dryRun ? ['--dry-run'] : [];
    await runCliCommand('organize', organizeArgs);
    
    // Final step: Show updated tag statistics
    await runCliCommand('tags', ['list']);
    
    console.log('\n🎉 Prompt processing pipeline completed successfully!');
    console.log('\nNext steps:');
    console.log('- Review the organized prompts in the prompts/ directory');
    console.log('- Start the MCP server with: npm start');
    console.log('- Or integrate with Claude Desktop');
    
  } catch (error) {
    console.error('\n❌ Pipeline failed:', error.message);
    process.exit(1);
  }
};

// Run the pipeline
runPipeline();

console.log(`
Usage:
  node scripts/prompt-pipeline.js             # Run full pipeline
  node scripts/prompt-pipeline.js --no-backup # Skip backup creation
  node scripts/prompt-pipeline.js --no-cleanup # Keep rawprompts.txt
  node scripts/prompt-pipeline.js --dry-run   # Show what would happen
  node scripts/prompt-pipeline.js --verbose   # Show full output
`); 