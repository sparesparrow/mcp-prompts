#!/usr/bin/env node

/**
 * Prepare Package for Publishing
 * 
 * This script creates a clean publish directory with all required files.
 */

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');
const buildDir = path.join(rootDir, 'build');
const publishDir = path.join(rootDir, 'publish');

// Define colors for output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function success(message) {
  log(`✅ ${message}`, colors.green);
}

function warn(message) {
  log(`⚠️ ${message}`, colors.yellow);
}

function error(message) {
  log(`❌ ${message}`, colors.red);
  process.exit(1);
}

function step(message) {
  log(`\n🔹 ${message}`, colors.blue);
}

// Main function
async function main() {
  try {
    step('Preparing package for publishing');

    // Read package.json
    const packageJsonPath = path.join(rootDir, 'package.json');
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
    const version = packageJson.version;

    log(`Preparing version ${version} for publishing`, colors.cyan);

    // Run the build
    step('Building project');
    try {
      execSync('npm run build', { stdio: 'inherit', cwd: rootDir });
      success('Build completed successfully');
    } catch (err) {
      error(`Build failed: ${err.message}`);
      return;
    }

    // Verify build directory exists
    if (!fs.existsSync(buildDir)) {
      error('Build directory does not exist after build');
      return;
    }

    // Clean publish directory
    step('Preparing publish directory');
    if (fs.existsSync(publishDir)) {
      await fs.remove(publishDir);
    }
    await fs.ensureDir(publishDir);

    // Copy package.json to publish directory
    await fs.copy(packageJsonPath, path.join(publishDir, 'package.json'));
    success('Copied package.json');

    // Modify the package.json in the publish directory
    const publishPackageJsonPath = path.join(publishDir, 'package.json');
    const publishPackageJson = JSON.parse(await fs.readFile(publishPackageJsonPath, 'utf8'));

    // Disable all build and test related scripts to prevent issues during npm pack/publish
    const scriptsToDisable = [
      'build', 'prepare', 'prepublishOnly', 'copy-static-files', 'dev',
      'test:build', 'test:docker', 'test:docker:fixed', 'test:postgres',
      'docker:build', 'docker:build:fixed', 'docker:cleanup', 'docker:up', 'docker:down',
      'docker:postgres:up', 'docker:postgres:down', 'publish:all', 'prepare-publish',
      'publish:clean', 'test:package', 'test:integration', 'verify-package'
    ];

    for (const script of scriptsToDisable) {
      if (publishPackageJson.scripts[script]) {
        publishPackageJson.scripts[script] = `echo 'Script ${script} disabled for publishing'`;
      }
    }

    // Write the modified package.json back to the publish directory
    await fs.writeFile(publishPackageJsonPath, JSON.stringify(publishPackageJson, null, 2), 'utf8');
    success('Modified package.json for publishing');

    // Copy README.md and LICENSE to publish directory
    await fs.copy(path.join(rootDir, 'README.md'), path.join(publishDir, 'README.md'));
    success('Copied README.md');
    
    if (fs.existsSync(path.join(rootDir, 'LICENSE'))) {
      await fs.copy(path.join(rootDir, 'LICENSE'), path.join(publishDir, 'LICENSE'));
      success('Copied LICENSE');
    } else {
      warn('LICENSE file not found');
    }

    // Copy build directory to publish/build
    step('Copying build directory');
    await fs.copy(buildDir, path.join(publishDir, 'build'));
    success('Copied build directory');

    // Copy config directory to publish/config
    step('Copying config directory');
    const configDir = path.join(rootDir, 'config');
    if (fs.existsSync(configDir)) {
      await fs.copy(configDir, path.join(publishDir, 'config'));
      success('Copied config directory');
    } else {
      warn('Config directory not found');
    }

    // Copy src/utils/config.js to publish/src/utils/config.js
    step('Copying source config.js');
    const srcUtilsConfigPath = path.join(rootDir, 'src/utils/config.js');
    if (fs.existsSync(srcUtilsConfigPath)) {
      await fs.ensureDir(path.join(publishDir, 'src/utils'));
      await fs.copy(srcUtilsConfigPath, path.join(publishDir, 'src/utils/config.js'));
      success('Copied src/utils/config.js');
    } else {
      warn('src/utils/config.js not found');
    }

    // Success message
    step('Package preparation complete');
    success(`Package ready for publishing in the ${publishDir} directory`);
    log('\nTo publish, run:', colors.cyan);
    log(`  cd ${publishDir} && npm publish --access public`, colors.cyan);
    log('\nOr to test the package locally:', colors.cyan);
    log(`  cd ${publishDir} && npm pack && tar -tvf *.tgz | grep -E 'bin|index.js|cli.js'`, colors.cyan);
    
  } catch (err) {
    error(`Failed to prepare package: ${err.message}`);
  }
}

main(); 