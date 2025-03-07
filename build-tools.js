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
  tempDirs: ['temp-*'],
  installDirs: [
    { src: 'build', dest: 'build' },
    { src: 'bin', dest: 'bin' },
    { src: 'prompts', dest: 'prompts' }
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
  verbose: args.includes('--verbose') || args.includes('-v')
};

// Logging utility
function log(message, type = 'info') {
  const colors = {
    info: '\x1b[36m', // cyan
    success: '\x1b[32m', // green
    warning: '\x1b[33m', // yellow
    error: '\x1b[31m', // red
    reset: '\x1b[0m' // reset
  };

  if (!options.verbose && type === 'info') return;
  
  console.log(`${colors[type]}[${type.toUpperCase()}]${colors.reset} ${message}`);
}

// Execute a shell command
function execute(command, silent = false) {
  try {
    log(`Executing: ${command}`, 'info');
    const output = execSync(command, { encoding: 'utf8', stdio: silent ? 'pipe' : 'inherit' });
    return { success: true, output };
  } catch (error) {
    if (!silent) {
      log(`Command failed: ${error.message}`, 'error');
    }
    return { success: false, error };
  }
}

// Confirm an action with the user
function confirmAction(message) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question(`${message} (y/N): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y');
    });
  });
}

// Clean the build directory and temporary files
async function clean() {
  log('Cleaning build artifacts and temporary files...', 'info');
  
  // Remove build directory
  if (fs.existsSync(config.buildDir)) {
    log(`Removing ${config.buildDir}/`, 'info');
    fs.rmSync(config.buildDir, { recursive: true, force: true });
  }
  
  // Remove temporary directories
  for (const tempPattern of config.tempDirs) {
    const tempDirs = fs.readdirSync('.')
      .filter(file => {
        const isMatch = file.match(new RegExp(tempPattern.replace('*', '.*')));
        const isDir = fs.statSync(file).isDirectory();
        return isMatch && isDir;
      });
    
    for (const tempDir of tempDirs) {
      log(`Removing ${tempDir}/`, 'info');
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
  
  log('Clean completed successfully', 'success');
  return true;
}

// Build the project using TypeScript compiler
async function build() {
  log('Building project...', 'info');
  
  const result = execute('npx tsc');
  
  if (result.success) {
    log('Build completed successfully', 'success');
    return true;
  } else {
    log('Build failed', 'error');
    return false;
  }
}

// Install the built project
async function install() {
  log('Installing the project...', 'info');
  
  if (options.global) {
    // Perform global npm installation
    log('Installing globally...', 'info');
    
    if (options.force) {
      execute(`npm uninstall -g ${config.globalInstallName}`);
    }
    
    const result = execute(`npm install -g`);
    if (!result.success) {
      log('Global installation failed', 'error');
      return false;
    }
  } else {
    // Perform local installation
    log('No local installation needed for this project', 'info');
  }
  
  log('Installation completed successfully', 'success');
  return true;
}

// Build Docker image
async function buildDocker() {
  log('Building Docker image...', 'info');
  
  const result = execute('docker build -t mcp-prompts .');
  
  if (result.success) {
    log('Docker build completed successfully', 'success');
    return true;
  } else {
    log('Docker build failed', 'error');
    return false;
  }
}

// Show help message
function showHelp() {
  console.log(`
MCP Prompts Build Tools

Usage: node build-tools.js [options]

Options:
  --clean, -c       Clean build artifacts and temporary files
  --install, -i     Install the project after building
  --force, -f       Force reinstallation if it already exists
  --global, -g      Install globally
  --docker, -d      Build Docker image
  --verbose, -v     Show verbose output
  --help, -h        Show this help message

Examples:
  node build-tools.js                   # Just build the project
  node build-tools.js --clean           # Clean and then build
  node build-tools.js --install --force # Force reinstallation
  node build-tools.js --docker          # Build Docker image
  `);
}

// Main function
async function main() {
  if (options.help) {
    showHelp();
    return;
  }
  
  let success = true;
  
  if (options.clean) {
    success = await clean();
    if (!success && !options.force) return;
  }
  
  if (success || options.force) {
    success = await build();
    if (!success && !options.force) return;
  }
  
  if ((success || options.force) && options.install) {
    success = await install();
  }
  
  if ((success || options.force) && options.docker) {
    success = await buildDocker();
  }
  
  if (success) {
    log('All operations completed successfully', 'success');
  } else {
    log('Some operations failed', 'error');
    process.exit(1);
  }
}

// Run the main function
main().catch(error => {
  log(`An unexpected error occurred: ${error.message}`, 'error');
  process.exit(1);
}); 