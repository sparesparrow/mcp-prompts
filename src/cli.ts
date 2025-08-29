#!/usr/bin/env node

import { spawn } from 'child_process';
import { join } from 'path';

const serverPath = join(__dirname, 'index.js');

const child = spawn('node', [serverPath, ...process.argv.slice(2)], {
  stdio: 'inherit',
  cwd: process.cwd()
});

child.on('exit', (code) => {
  process.exit(code || 0);
});

process.on('SIGINT', () => {
  child.kill('SIGINT');
});

process.on('SIGTERM', () => {
  child.kill('SIGTERM');
});
