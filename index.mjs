#!/usr/bin/env node

// This is a simple ESM wrapper for the CommonJS output from TypeScript
// It allows us to maintain the "type": "module" in package.json while
// still using TypeScript's CommonJS output

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createRequire } from 'module';

// Set up custom require function
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

// Use require to load the CommonJS module
const entryPoint = join(__dirname, 'dist', 'index.js');
require(entryPoint);
