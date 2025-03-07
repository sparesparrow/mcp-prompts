/**
 * Verify Migrated Prompts Script
 * This script verifies that prompts were correctly migrated to PostgreSQL
 */

import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
const PROMPTS_DIR = process.env.PROMPTS_DIR || path.join(process.cwd(), 'prompts');

if (!DATABASE_URL) {
  console.error('Error: DATABASE_URL environment variable is required');
  process.exit(1);
}

// Create a database connection pool
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

/**
 * Verify that prompts were correctly migrated to PostgreSQL
 */
async function verifyMigratedPrompts() {
  console.log('Starting verification of migrated prompts...');

  // Check if the prompts directory exists
  if (!fs.existsSync(PROMPTS_DIR)) {
    console.error(`Error: Prompts directory ${PROMPTS_DIR} does not exist`);
    return;
  }

  // Connect to the database
  const client = await pool.connect();
  
  try {
    // Get count of prompts in the database
    const dbCountResult = await client.query('SELECT COUNT(*) FROM prompts');
    const dbPromptCount = parseInt(dbCountResult.rows[0].count, 10);
    
    // Get all JSON files from the prompts directory
    const promptFiles = findAllPromptFiles(PROMPTS_DIR);
    const filePromptCount = promptFiles.length;
    
    console.log(`Prompts in database: ${dbPromptCount}`);
    console.log(`Prompts in file system: ${filePromptCount}`);
    
    if (dbPromptCount < filePromptCount) {
      console.warn(`Warning: There are fewer prompts in the database than in the file system. Some prompts may not have been migrated.`);
    }
    
    // Verify specific prompts by ID
    console.log('\nVerifying specific prompts by ID...');
    for (const file of promptFiles.slice(0, 5)) { // Check the first 5 prompts as a sample
      try {
        // Read and parse the prompt file
        const content = fs.readFileSync(file, 'utf-8');
        const filePrompt = JSON.parse(content);
        
        // Query the database for this prompt
        const dbPromptResult = await client.query('SELECT * FROM prompts WHERE id = $1', [filePrompt.id]);
        
        if (dbPromptResult.rows.length === 0) {
          console.error(`Error: Prompt ${filePrompt.id} (${filePrompt.name}) not found in the database`);
        } else {
          console.log(`✓ Verified prompt ${filePrompt.id}: ${filePrompt.name}`);
        }
      } catch (error) {
        console.error(`Error verifying prompt from file ${file}:`, error);
      }
    }
    
    // Verify the database structure
    console.log('\nVerifying database structure...');
    try {
      const columnsResult = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'prompts'
      `);
      
      const columns = columnsResult.rows.map((row: any) => row.column_name);
      
      // Check for required columns
      const requiredColumns = [
        'id', 'name', 'content', 'is_template', 'category', 
        'usage_count', 'last_used', 'created_at', 'updated_at'
      ];
      
      for (const column of requiredColumns) {
        if (columns.includes(column)) {
          console.log(`✓ Column ${column} exists`);
        } else {
          console.error(`✗ Column ${column} is missing`);
        }
      }
    } catch (error) {
      console.error('Error verifying database structure:', error);
    }
    
    console.log('\nVerification completed');
  } finally {
    client.release();
    await pool.end();
  }
}

/**
 * Find all prompt JSON files in the specified directory and its subdirectories
 */
function findAllPromptFiles(dir: string): string[] {
  let results: string[] = [];

  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const itemPath = path.join(dir, item);
    const stat = fs.statSync(itemPath);

    if (stat.isDirectory()) {
      // Recursively search subdirectories
      results = results.concat(findAllPromptFiles(itemPath));
    } else if (item.endsWith('.json')) {
      // Add JSON files to the results
      results.push(itemPath);
    }
  }

  return results;
}

// Execute the verification
verifyMigratedPrompts().catch(error => {
  console.error('Unhandled error during verification:', error);
  process.exit(1);
}); 