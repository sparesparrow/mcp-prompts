/**
 * Prompt Migration Script
 * This script migrates prompts from file-based storage to PostgreSQL
 */

import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
const PROMPTS_DIR = process.env.PROMPTS_DIR || path.join(process.cwd(), 'prompts');
const DRY_RUN = process.argv.includes('--dry-run');

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
 * Migrate prompts from file storage to PostgreSQL
 */
async function migratePrompts() {
  console.log('Starting prompt migration from file storage to PostgreSQL...');
  console.log(`Reading prompts from directory: ${PROMPTS_DIR}`);

  // Check if the directory exists
  if (!fs.existsSync(PROMPTS_DIR)) {
    console.error(`Error: Prompts directory ${PROMPTS_DIR} does not exist`);
    return;
  }

  // Get all JSON files from the prompts directory and subdirectories
  const promptFiles = findAllPromptFiles(PROMPTS_DIR);
  console.log(`Found ${promptFiles.length} prompt files`);

  if (DRY_RUN) {
    console.log('DRY RUN: Would migrate the following prompt files:');
    promptFiles.forEach(file => console.log(`- ${file}`));
    console.log('No changes were made to the database');
    return;
  }

  // Connect to the database
  const client = await pool.connect();
  
  try {
    let successCount = 0;
    let errorCount = 0;

    // Process each prompt file
    for (const file of promptFiles) {
      try {
        // Read and parse the prompt file
        const content = fs.readFileSync(file, 'utf-8');
        const prompt = JSON.parse(content);

        // Set default values for new fields
        prompt.category = prompt.category || 'development';
        prompt.usageCount = prompt.usageCount || prompt.usage_count || 0;
        prompt.lastUsed = prompt.lastUsed || prompt.last_used || null;
        
        // Insert the prompt into the database
        await client.query(`
          INSERT INTO prompts (
            id, name, description, content, is_template, variables, tags,
            category, created_at, updated_at, version, usage_count, last_used, metadata
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          ON CONFLICT (id) DO UPDATE SET
            name = $2,
            description = $3,
            content = $4,
            is_template = $5,
            variables = $6,
            tags = $7,
            category = $8,
            updated_at = $10,
            version = $11,
            usage_count = $12,
            last_used = $13,
            metadata = $14
        `, [
          prompt.id,
          prompt.name,
          prompt.description || '',
          prompt.content,
          prompt.isTemplate,
          prompt.variables || [],
          prompt.tags || [],
          prompt.category,
          prompt.createdAt,
          prompt.updatedAt,
          prompt.version || 1,
          prompt.usageCount,
          prompt.lastUsed,
          prompt.metadata || {}
        ]);

        console.log(`Migrated prompt ${prompt.id}: ${prompt.name}`);
        successCount++;
      } catch (error) {
        console.error(`Error migrating prompt file ${file}:`, error);
        errorCount++;
      }
    }

    console.log('Prompt migration completed');
    console.log(`Successful migrations: ${successCount}`);
    console.log(`Failed migrations: ${errorCount}`);
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

// Execute the migration
migratePrompts().catch(error => {
  console.error('Unhandled error during migration:', error);
  process.exit(1);
}); 