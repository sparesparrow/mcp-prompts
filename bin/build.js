#!/usr/bin/env node

/**
 * Unified build script for MCP Prompts Server
 * 
 * This script consolidates functionality from multiple build scripts:
 * - build.sh
 * - build-and-install.sh
 * - install.sh
 * 
 * Usage:
 *   node bin/build.js [--install] [--force] [--clean]
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);
const shouldInstall = args.includes('--install');
const forceInstall = args.includes('--force');
const shouldClean = args.includes('--clean');
const verbose = args.includes('--verbose');

// Configuration
const INSTALL_DIR = process.env.MCP_INSTALL_DIR || path.join(process.env.HOME, '.mcp/servers/mcp-prompts');

// Logger
function log(message, isError = false) {
  const timestamp = new Date().toISOString();
  if (isError) {
    console.error(`[${timestamp}] ERROR: ${message}`);
  } else {
    console.log(`[${timestamp}] ${message}`);
  }
}

function execCommand(command, errorMessage) {
  try {
    if (verbose) {
      log(`Executing: ${command}`);
    }
    execSync(command, { stdio: 'inherit' });
    return true;
  } catch (error) {
    log(errorMessage || `Command failed: ${command}`, true);
    log(error.message, true);
    return false;
  }
}

// Clean the build directory
function clean() {
  log('Cleaning build directory...');
  execCommand('npm run clean', 'Failed to clean build directory');
}

// Build the project
function build() {
  log('Building project...');
  return execCommand('npm run build', 'Build failed');
}

// Install the project
function install() {
  log(`Installing to ${INSTALL_DIR}...`);
  
  // Create install directory if it doesn't exist
  if (!fs.existsSync(INSTALL_DIR)) {
    log(`Creating installation directory: ${INSTALL_DIR}`);
    fs.mkdirSync(INSTALL_DIR, { recursive: true });
  } else if (forceInstall) {
    log('Forcing reinstallation...');
  } else {
    log('Installation directory already exists. Use --force to reinstall.');
    return false;
  }
  
  // Copy files
  const filesToCopy = [
    'build',
    'bin',
    'prompts',
    'package.json',
    'package-lock.json',
    'README.md',
    'LICENSE'
  ];
  
  for (const file of filesToCopy) {
    const source = path.join(process.cwd(), file);
    const dest = path.join(INSTALL_DIR, file);
    
    if (fs.existsSync(source)) {
      log(`Copying ${file}...`);
      
      if (fs.lstatSync(source).isDirectory()) {
        // Create directory if it doesn't exist
        if (!fs.existsSync(dest)) {
          fs.mkdirSync(dest, { recursive: true });
        }
        
        // Use rsync to copy directory contents
        execCommand(`rsync -a --delete "${source}/" "${dest}/"`, `Failed to copy ${file}`);
      } else {
        // Copy file
        fs.copyFileSync(source, dest);
      }
    }
  }
  
  // Install dependencies
  log('Installing dependencies...');
  process.chdir(INSTALL_DIR);
  return execCommand('npm ci --production', 'Failed to install dependencies');
}

// Main function
async function main() {
  try {
    // Clean if requested
    if (shouldClean) {
      clean();
    }
    
    // Build the project
    const buildSuccess = build();
    if (!buildSuccess) {
      process.exit(1);
    }
    
    // Install if requested
    if (shouldInstall) {
      const installSuccess = install();
      if (!installSuccess) {
        process.exit(1);
      }
      
      log('Installation completed successfully!');
      log(`Installed to: ${INSTALL_DIR}`);
      log('You can now run the server with: mcp-prompts');
    } else {
      log('Build completed successfully!');
      log('To install, run with --install flag');
    }
  } catch (error) {
    log(`Unexpected error: ${error.message}`, true);
    process.exit(1);
  }
}

// Run the main function
main(); 