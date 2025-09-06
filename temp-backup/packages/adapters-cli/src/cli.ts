#!/usr/bin/env node
import { Command } from 'commander';
// import { connectToServer, getPromptApp } from './client';
// import { PromptApplication } from '@core';

const program = new Command();
program.name('mcp-prompts').description('CLI for managing MCP prompts').version('0.1.0');

// List prompts
program
  .command('list')
  .description('List all prompts')
  .action(async () => {
    // const promptApp = await getPromptApp();
    // const prompts = await promptApp.listPrompts();
    // console.log(prompts);
    console.log('TODO: list prompts');
  });

// Get prompt by id
program
  .command('get <id>')
  .description('Get prompt by id')
  .action(async (id) => {
    // const promptApp = await getPromptApp();
    // const prompt = await promptApp.getPromptById(id);
    // console.log(prompt);
    console.log('TODO: get prompt', id);
  });

// Add prompt
program
  .command('add')
  .description('Add a new prompt')
  .option('-f, --file <file>', 'Prompt JSON file')
  .action(async (opts) => {
    // const promptApp = await getPromptApp();
    // const prompt = require(opts.file);
    // await promptApp.addPrompt(prompt);
    console.log('TODO: add prompt', opts.file);
  });

// Update prompt
program
  .command('update <id>')
  .description('Update a prompt')
  .option('-f, --file <file>', 'Prompt JSON file')
  .action(async (id, opts) => {
    // const promptApp = await getPromptApp();
    // const update = require(opts.file);
    // await promptApp.updatePrompt(id, update);
    console.log('TODO: update prompt', id, opts.file);
  });

// Delete prompt
program
  .command('delete <id>')
  .description('Delete a prompt')
  .action(async (id) => {
    // const promptApp = await getPromptApp();
    // await promptApp.deletePrompt(id);
    console.log('TODO: delete prompt', id);
  });

// TODO: batch import/export, connect to server or run offline

program.parseAsync(process.argv);
