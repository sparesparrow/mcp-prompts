#!/usr/bin/env node

/**
 * Increment version in package.json
 * This script automatically increments the patch version of the package
 * It can also handle minor and major version updates when specified
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packagePath = path.join(process.cwd(), 'package.json');

// Parse command line arguments
const args = process.argv.slice(2);
let versionType = 'patch'; // Default to patch update
let dryRun = false;

// Process arguments
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  
  if (arg === '--dry-run') {
    dryRun = true;
  } else {
    const validTypes = ['patch', 'minor', 'major'];
    if (validTypes.includes(arg)) {
      versionType = arg;
    } else {
      console.error(`Invalid version type: ${arg}. Valid options are: ${validTypes.join(', ')}`);
      console.error(`Usage: node increment-version.js [patch|minor|major] [--dry-run]`);
      process.exit(1);
    }
  }
}

// Read the package.json
console.log('📦 Incrementing package version...');
try {
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  const currentVersion = packageJson.version;
  
  if (!currentVersion) {
    console.error('❌ No version found in package.json');
    process.exit(1);
  }
  
  // Parse the version components
  const versionParts = currentVersion.split('.').map(part => parseInt(part, 10));
  if (versionParts.length !== 3 || versionParts.some(isNaN)) {
    console.error(`❌ Invalid version format: ${currentVersion}. Expected semver (x.y.z)`);
    process.exit(1);
  }
  
  // Increment the appropriate part
  let [major, minor, patch] = versionParts;
  
  switch (versionType) {
    case 'major':
      major += 1;
      minor = 0;
      patch = 0;
      break;
    case 'minor':
      minor += 1;
      patch = 0;
      break;
    case 'patch':
    default:
      patch += 1;
      break;
  }
  
  // Create the new version
  const newVersion = `${major}.${minor}.${patch}`;
  
  if (dryRun) {
    console.log(`✅ Dry run: Would update version from ${currentVersion} to ${newVersion}`);
    console.log(newVersion);
    process.exit(0);
  }
  
  // Update the version in package.json
  packageJson.version = newVersion;
  fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n', 'utf8');
  
  console.log(`✅ Version updated from ${currentVersion} to ${newVersion}`);
  
  // Output the new version for use in scripts
  console.log(newVersion);
  
  // Also update CHANGELOG.md if it exists
  const changelogPath = path.join(process.cwd(), 'CHANGELOG.md');
  if (fs.existsSync(changelogPath)) {
    try {
      let changelog = fs.readFileSync(changelogPath, 'utf8');
      const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      const newVersionEntry = `## [${newVersion}] - ${date}\n\n- Automated version bump\n\n`;
      
      // Add the new version entry below the header
      if (changelog.includes('# Changelog')) {
        changelog = changelog.replace('# Changelog', '# Changelog\n\n' + newVersionEntry);
        fs.writeFileSync(changelogPath, changelog, 'utf8');
        console.log(`✅ Updated CHANGELOG.md with version ${newVersion}`);
      } else {
        console.log(`⚠️ Could not update CHANGELOG.md: no '# Changelog' header found`);
      }
    } catch (error) {
      console.error(`❌ Error updating CHANGELOG.md:`, error);
    }
  }
  
  // Output ONLY the new version as the last line for capture by scripts
  console.log(newVersion);
} catch (error) {
  console.error('❌ Error updating version:', error);
  process.exit(1);
} 