#!/usr/bin/env node

import fs from 'fs/promises';
import fetch from 'node-fetch';
import path from 'path';

const API_URL = process.env.MCP_PROMPTS_API_URL || 'http://localhost:3003';

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 3 || args[0] !== 'workflow') {
    printUsage();
    process.exit(1);
  }
  const command = args[1];
  if (command === 'run' && args[2].endsWith('.json')) {
    // Run workflow from file
    const filePath = path.resolve(args[2]);
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const workflow = JSON.parse(content);
      const res = await fetch(`${API_URL}/api/v1/workflows/run`, {
        body: JSON.stringify(workflow),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      });
      const result = await res.json();
      printResult(result, res.status);
    } catch (err) {
      console.error('Error running workflow from file:', err);
      process.exit(1);
    }
  } else if (command === 'save' && args[2].endsWith('.json')) {
    // Save workflow from file
    const filePath = path.resolve(args[2]);
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const workflow = JSON.parse(content);
      const res = await fetch(`${API_URL}/api/v1/workflows`, {
        body: JSON.stringify(workflow),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      });
      const result = await res.json();
      printResult(result, res.status);
    } catch (err) {
      console.error('Error saving workflow from file:', err);
      process.exit(1);
    }
  } else if (command === 'run' && args[2]) {
    // Run workflow by ID
    const id = args[2];
    try {
      const res = await fetch(`${API_URL}/api/v1/workflows/${id}/run`, {
        method: 'POST',
      });
      const result = await res.json();
      printResult(result, res.status);
    } catch (err) {
      console.error('Error running workflow by ID:', err);
      process.exit(1);
    }
  } else {
    printUsage();
    process.exit(1);
  }
}

function printUsage() {
  console.log(`Usage:
  mcp-prompts workflow run <file.json>    # Run workflow from file
  mcp-prompts workflow save <file.json>   # Save workflow from file
  mcp-prompts workflow run <id>           # Run saved workflow by ID
  (Set MCP_PROMPTS_API_URL to override API URL, default: http://localhost:3003)
  `);
}

function printResult(result: any, status: number) {
  if (status >= 200 && status < 300) {
    console.log('Success:', JSON.stringify(result, null, 2));
  } else {
    console.error('Error:', JSON.stringify(result, null, 2));
  }
}

main(); 