#!/usr/bin/env node

import catalog from '@sparesparrow/mcp-prompts-catalog';
import { execSync } from 'child_process';
import fs from 'fs/promises';
import fetch from 'node-fetch';
import path from 'path';

const API_URL = process.env.MCP_PROMPTS_API_URL || 'http://localhost:3003';

/**
 *
 */
async function main() {
  const args = process.argv.slice(2);
  if (args[0] === 'catalog') {
    const sub = args[1];
    if (sub === 'list') {
      if (args[2]) {
        // List prompts in a category
        const prompts = catalog.listPrompts(args[2]);
        console.log(prompts.join('\n'));
      } else {
        // List categories
        const categories = catalog.getCategories();
        console.log(categories.join('\n'));
      }
      process.exit(0);
    } else if (sub === 'show' && args[2] && args[3]) {
      // Show a specific prompt
      const prompt = catalog.loadPrompt(args[3], args[2]);
      console.log(JSON.stringify(prompt, null, 2));
      process.exit(0);
    } else if (sub === 'validate') {
      // Validate all prompts
      try {
        execSync('node packages/mcp-prompts-catalog/validate-prompts.js', { stdio: 'inherit' });
        process.exit(0);
      } catch (e) {
        process.exit(1);
      }
    } else {
      printCatalogUsage();
      process.exit(1);
    }
  } else if (args.length < 3 || args[0] !== 'workflow') {
    printUsage();
    process.exit(1);
  }
  const command = args[1];
  if (command === 'run' && args[2].endsWith('.json')) {
    // Run workflow from file
    const filePath = path.resolve(args[2]);
    const vars = args.slice(3).reduce(
      (acc, arg) => {
        if (arg.startsWith('--var')) {
          const [key, value] = arg.replace(/^--var\./, '').split('=');
          if (key && value !== undefined) {
            acc[key] = value;
          }
        }
        return acc;
      },
      {} as Record<string, string>,
    );
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const workflow = JSON.parse(content);
      const body = { initialContext: vars, workflow };
      const res = await fetch(`${API_URL}/api/v1/workflows/run`, {
        body: JSON.stringify(body),
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
  } else if (command === 'resume' && args[2]) {
    const executionId = args[2];
    console.log(`Resuming workflow execution: ${executionId}`);
    // TODO: Implement API call
    // try {
    //   const res = await fetch(`${API_URL}/api/v1/workflows/resume/${executionId}`, {
    //     method: 'POST',
    //   });
    //   const result = await res.json();
    //   printResult(result, res.status);
    // } catch (err) {
    //   console.error(`Error resuming workflow ${executionId}:`, err);
    //   process.exit(1);
    // }
  } else if (command === 'list' && args[2]) {
    const workflowId = args[2];
    console.log(`Listing executions for workflow: ${workflowId}`);
    // TODO: Implement API call
    // try {
    //   const res = await fetch(`${API_URL}/api/v1/workflows/${workflowId}/executions`);
    //   const result = await res.json();
    //   printResult(result, res.status);
    // } catch (err) {
    //   console.error(`Error listing executions for workflow ${workflowId}:`, err);
    //   process.exit(1);
    // }
  } else if (command === 'status' && args[2]) {
    const executionId = args[2];
    console.log(`Getting status for workflow execution: ${executionId}`);
    // TODO: Implement API call
    // try {
    //   const res = await fetch(`${API_URL}/api/v1/workflows/executions/${executionId}`);
    //   const result = await res.json();
    //   printResult(result, res.status);
    // } catch (err) {
    //   console.error(`Error getting status for execution ${executionId}:`, err);
    //   process.exit(1);
    // }
  } else {
    printUsage();
    process.exit(1);
  }
}

/**
 *
 */
function printUsage() {
  console.log(`Usage:
  mcp-prompts workflow run <file.json> [--var.key=value]... # Run workflow from file with context variables
  mcp-prompts workflow save <file.json>   # Save workflow from file
  mcp-prompts workflow run <id>           # Run saved workflow by ID
  mcp-prompts workflow resume <executionId> # Resume a workflow
  mcp-prompts workflow list <workflowId>  # List executions for a workflow
  mcp-prompts workflow status <executionId> # Get status of a workflow execution
  (Set MCP_PROMPTS_API_URL to override API URL, default: http://localhost:3003)
  `);
}

/**
 *
 */
function printCatalogUsage() {
  console.log(`Usage:
  mcp-prompts catalog list                # List all categories
  mcp-prompts catalog list <category>     # List prompts in a category
  mcp-prompts catalog show <category> <prompt> # Show a prompt's JSON
  mcp-prompts catalog validate            # Validate all prompts in the catalog
  `);
}

/**
 *
 * @param result
 * @param status
 */
function printResult(result: any, status: number) {
  if (status >= 200 && status < 300) {
    console.log('Success:', JSON.stringify(result, null, 2));
  } else {
    console.error('Error:', JSON.stringify(result, null, 2));
  }
}

main();
