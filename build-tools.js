#!/usr/bin/env node

/**
 * Consolidated Build Tools for MCP Prompts Server
 * 
 * This script provides a unified interface for building, cleaning, and installing
 * the MCP Prompts Server. It replaces multiple shell scripts with a single Node.js tool.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Configuration
const config = {
  buildDir: 'build',
  tempDirs: ['temp-*', 'processed_prompts'],
  installDirs: [
    { src: 'build', dest: 'build' },
    { src: 'bin', dest: 'bin' },
    { src: 'prompts/examples', dest: 'prompts/examples' },
    { src: 'prompts/curated', dest: 'prompts/curated' },
    { src: 'prompts/README.md', dest: 'prompts/README.md' }
  ],
  globalInstallName: 'mcp-prompts'
};

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  clean: args.includes('--clean') || args.includes('-c'),
  install: args.includes('--install') || args.includes('-i'),
  force: args.includes('--force') || args.includes('-f'),
  global: args.includes('--global') || args.includes('-g'),
  docker: args.includes('--docker') || args.includes('-d'),
  help: args.includes('--help') || args.includes('-h'),
  processPrompts: args.includes('--process-prompts') || args.includes('-p'),
  verbose: args.includes('--verbose') || args.includes('-v')
};

// Helper functions
function log(message, type = 'info') {
  const colors = {
    info: '\x1b[36m%s\x1b[0m',    // Cyan
    success: '\x1b[32m%s\x1b[0m',  // Green
    warning: '\x1b[33m%s\x1b[0m',  // Yellow
    error: '\x1b[31m%s\x1b[0m'     // Red
  };
  
  if (type === 'error') {
    console.error(colors[type], message);
  } else {
    console.log(colors[type], message);
  }
}

function execute(command, silent = false) {
  try {
    if (options.verbose && !silent) {
      log(`Executing: ${command}`, 'info');
    }
    return execSync(command, { stdio: silent ? 'ignore' : 'inherit' });
  } catch (error) {
    log(`Error executing command: ${command}`, 'error');
    if (options.verbose) {
      console.error(error);
    }
    return false;
  }
}

function confirmAction(message) {
  if (options.force) return true;
  
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

// Main functions
async function clean() {
  log('Cleaning build artifacts...', 'info');
  
  if (fs.existsSync(config.buildDir)) {
    if (!options.force) {
      const confirmed = await confirmAction(`Are you sure you want to delete the ${config.buildDir} directory?`);
      if (!confirmed) {
        log('Clean operation cancelled.', 'warning');
        return false;
      }
    }
    
    try {
      execute(`rimraf ${config.buildDir}`);
      log(`Removed ${config.buildDir} directory.`, 'success');
    } catch (error) {
      log(`Failed to remove ${config.buildDir} directory.`, 'error');
      return false;
    }
  }
  
  // Clean temporary directories
  for (const tempDir of config.tempDirs) {
    execute(`rimraf ${tempDir}`, !options.verbose);
  }
  
  log('Clean completed successfully.', 'success');
  return true;
}

async function build() {
  log('Building MCP Prompts Server...', 'info');
  
  // Run TypeScript compiler
  const result = execute('tsc');
  if (!result) {
    log('Build failed.', 'error');
    return false;
  }
  
  // Make scripts executable
  execute('chmod +x bin/*.js scripts/*.ts bin/*.ts');
  
  log('Build completed successfully.', 'success');
  return true;
}

async function install() {
  log('Installing MCP Prompts Server...', 'info');
  
  if (options.global) {
    // Global installation
    log('Performing global installation...', 'info');
    execute('npm install -g .');
    log(`MCP Prompts Server installed globally as '${config.globalInstallName}'.`, 'success');
  } else if (options.docker) {
    // Docker installation
    log('Building Docker image...', 'info');
    execute('docker build -t mcp-prompts .');
    log('Docker image built successfully.', 'success');
  } else {
    // Local installation
    log('Performing local installation...', 'info');
    execute('npm install');
    log('Local installation completed.', 'success');
  }
  
  return true;
}

async function processPrompts() {
  log('Processing prompts...', 'info');
  execute('npm run prompt:process');
  log('Prompts processed successfully.', 'success');
  return true;
}

function showHelp() {
  console.log(`
MCP Prompts Server Build Tools

Usage: node build-tools.js [options]

Options:
  -c, --clean            Clean build artifacts
  -i, --install          Install the server
  -f, --force            Force operations without confirmation
  -g, --global           Install globally
  -d, --docker           Build Docker image
  -p, --process-prompts  Process raw prompts
  -v, --verbose          Show verbose output
  -h, --help             Show this help message

Examples:
  node build-tools.js --clean --install        Clean and install locally
  node build-tools.js --global                 Install globally
  node build-tools.js --docker                 Build Docker image
  node build-tools.js --process-prompts        Process prompts
  `);
}

// Main execution
async function main() {
  if (options.help) {
    showHelp();
    return;
  }
  
  let success = true;
  
  if (options.clean) {
    success = await clean();
    if (!success) return;
  }
  
  if (success && !options.clean) {
    success = await build();
    if (!success) return;
  }
  
  if (success && options.install) {
    success = await install();
    if (!success) return;
  }
  
  if (success && options.processPrompts) {
    success = await processPrompts();
    if (!success) return;
  }
  
  if (success) {
    log('All operations completed successfully.', 'success');
  }
}

// Run the main function
main().catch(error => {
  log('An unexpected error occurred:', 'error');
  console.error(error);
  process.exit(1);
}); 