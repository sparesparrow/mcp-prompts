#!/usr/bin/env node

/**
 * Test script for the PostgreSQL adapter
 * This script tests basic functionality of the MCP Prompts Server with PostgreSQL storage
 */

import { Client } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import fetch from 'node-fetch';

const BASE_URL = process.env.MCP_SERVER_URL || 'http://localhost:3003';
const PG_CONNECTION_STRING = process.env.POSTGRES_CONNECTION_STRING || 'postgresql://postgres:postgres@localhost:5432/mcp_prompts';

// Colors for output
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';

/**
 * Log a step message
 * @param {string} message Message to log
 */
function logStep(message) {
  console.log(`${BLUE}===> ${message}${RESET}`);
}

/**
 * Log a success message
 * @param {string} message Message to log
 */
function logSuccess(message) {
  console.log(`${GREEN}✓ ${message}${RESET}`);
}

/**
 * Log an error message
 * @param {string} message Message to log
 */
function logError(message) {
  console.log(`${RED}✗ ${message}${RESET}`);
}

/**
 * Log a warning message
 * @param {string} message Message to log
 */
function logWarning(message) {
  console.log(`${YELLOW}! ${message}${RESET}`);
}

/**
 * Sleep for a specified number of milliseconds
 * @param {number} ms Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if the server is healthy
 * @returns {Promise<boolean>} True if the server is healthy, false otherwise
 */
async function checkServerHealth() {
  try {
    const response = await fetch(`${BASE_URL}/health`);
    const data = await response.json();
    return response.status === 200 && data.status === 'healthy';
  } catch (error) {
    console.error('Error checking server health:', error);
    return false;
  }
}

/**
 * Wait for the server to become healthy
 * @param {number} retries Number of retries
 * @param {number} interval Interval between retries in milliseconds
 * @returns {Promise<boolean>} True if the server became healthy, false otherwise
 */
async function waitForServerHealth(retries = 10, interval = 2000) {
  for (let i = 0; i < retries; i++) {
    logStep(`Checking server health (attempt ${i + 1}/${retries})...`);
    const isHealthy = await checkServerHealth();
    if (isHealthy) {
      logSuccess('Server is healthy');
      return true;
    }
    
    if (i < retries - 1) {
      logWarning('Server is not healthy yet, waiting...');
      await sleep(interval);
    }
  }
  
  logError('Server is not healthy after multiple attempts');
  return false;
}

/**
 * Check if PostgreSQL table exists
 * @param {string} tableName Name of the table to check
 * @returns {Promise<boolean>} True if the table exists, false otherwise
 */
async function checkTableExists(tableName) {
  const client = new Client({
    connectionString: PG_CONNECTION_STRING,
  });
  
  try {
    await client.connect();
    const result = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      );
    `, [tableName]);
    
    return result.rows[0].exists;
  } catch (error) {
    console.error('Error checking if table exists:', error);
    return false;
  } finally {
    await client.end();
  }
}

/**
 * Create a test prompt
 * @returns {Promise<object>} The created prompt
 */
async function createTestPrompt() {
  const promptId = `test-prompt-${uuidv4().substring(0, 8)}`;
  const prompt = {
    id: promptId,
    name: 'Test Prompt',
    description: 'Test prompt for PostgreSQL adapter',
    content: 'This is a test prompt for PostgreSQL adapter integration testing.',
    isTemplate: false,
    tags: ['test', 'postgresql', 'integration'],
    category: 'test'
  };
  
  const response = await fetch(`${BASE_URL}/api/prompts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(prompt),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to create test prompt: ${response.statusText}`);
  }
  
  return await response.json();
}

/**
 * Get a prompt by ID
 * @param {string} id Prompt ID
 * @returns {Promise<object>} The prompt
 */
async function getPrompt(id) {
  const response = await fetch(`${BASE_URL}/api/prompts/${id}`);
  
  if (!response.ok) {
    throw new Error(`Failed to get prompt: ${response.statusText}`);
  }
  
  return await response.json();
}

/**
 * List prompts with optional filters
 * @param {object} filters Filters to apply
 * @returns {Promise<Array>} Array of prompts
 */
async function listPrompts(filters = {}) {
  let url = `${BASE_URL}/api/prompts`;
  
  if (Object.keys(filters).length > 0) {
    const params = new URLSearchParams();
    
    for (const [key, value] of Object.entries(filters)) {
      params.append(key, value);
    }
    
    url += `?${params.toString()}`;
  }
  
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Failed to list prompts: ${response.statusText}`);
  }
  
  return await response.json();
}

/**
 * Delete a prompt by ID
 * @param {string} id Prompt ID
 * @returns {Promise<void>}
 */
async function deletePrompt(id) {
  const response = await fetch(`${BASE_URL}/api/prompts/${id}`, {
    method: 'DELETE',
  });
  
  if (!response.ok) {
    throw new Error(`Failed to delete prompt: ${response.statusText}`);
  }
}

/**
 * Run the tests
 */
async function runTests() {
  try {
    // Check if the server is running and healthy
    logStep('Checking server health...');
    const isHealthy = await waitForServerHealth();
    
    if (!isHealthy) {
      logError('Server is not healthy, aborting tests');
      process.exit(1);
    }
    
    // Check if the PostgreSQL table exists
    logStep('Checking if PostgreSQL table exists...');
    const tableExists = await checkTableExists('prompts');
    
    if (tableExists) {
      logSuccess('PostgreSQL table "prompts" exists');
    } else {
      logWarning('PostgreSQL table "prompts" does not exist, it may be created when prompts are added');
    }
    
    // Create a test prompt
    logStep('Creating test prompt...');
    const createdPrompt = await createTestPrompt();
    logSuccess(`Test prompt created with ID: ${createdPrompt.id}`);
    
    // Get the created prompt
    logStep('Retrieving test prompt...');
    const retrievedPrompt = await getPrompt(createdPrompt.id);
    logSuccess(`Test prompt retrieved successfully: ${retrievedPrompt.name}`);
    
    // Verify prompt data
    logStep('Verifying prompt data...');
    if (
      retrievedPrompt.id === createdPrompt.id &&
      retrievedPrompt.name === createdPrompt.name &&
      retrievedPrompt.content === createdPrompt.content
    ) {
      logSuccess('Prompt data verified successfully');
    } else {
      logError('Prompt data verification failed');
      console.log('Created prompt:', createdPrompt);
      console.log('Retrieved prompt:', retrievedPrompt);
    }
    
    // List prompts
    logStep('Listing prompts...');
    const prompts = await listPrompts();
    logSuccess(`Found ${prompts.length} prompts`);
    
    // List prompts with filters
    logStep('Listing prompts with filters...');
    const filteredPrompts = await listPrompts({ category: 'test' });
    logSuccess(`Found ${filteredPrompts.length} prompts with category "test"`);
    
    // Delete the test prompt
    logStep('Deleting test prompt...');
    await deletePrompt(createdPrompt.id);
    logSuccess(`Test prompt deleted successfully: ${createdPrompt.id}`);
    
    // Verify deletion
    logStep('Verifying prompt deletion...');
    try {
      await getPrompt(createdPrompt.id);
      logError('Prompt still exists after deletion');
    } catch (error) {
      logSuccess('Prompt deletion verified');
    }
    
    logSuccess('All PostgreSQL adapter tests passed successfully');
  } catch (error) {
    logError(`Test failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// Run the tests
runTests(); 