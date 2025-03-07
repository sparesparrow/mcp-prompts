#!/usr/bin/env node

/**
 * PostgreSQL Schema Migration Script
 * This script creates or updates the database schema for MCP Prompts
 */

import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
const DRY_RUN = process.argv.includes('--dry-run');

if (!DATABASE_URL) {
  console.error('Error: DATABASE_URL environment variable is required');
  process.exit(1);
}

// SQL to create the schema
const createSchemaSQL = `
-- Create the prompts table
CREATE TABLE IF NOT EXISTS prompts (
  id VARCHAR PRIMARY KEY,
  name VARCHAR NOT NULL,
  description VARCHAR,
  content TEXT NOT NULL,
  is_template BOOLEAN NOT NULL,
  variables VARCHAR[],
  tags VARCHAR[],
  category VARCHAR NOT NULL DEFAULT 'development',
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  version INTEGER NOT NULL,
  usage_count INTEGER DEFAULT 0,
  last_used TIMESTAMPTZ,
  metadata JSONB
);

-- Create indices
CREATE INDEX IF NOT EXISTS prompts_tags_idx ON prompts USING GIN (tags);
CREATE INDEX IF NOT EXISTS prompts_category_idx ON prompts (category);
CREATE INDEX IF NOT EXISTS prompts_template_idx ON prompts (is_template);
CREATE INDEX IF NOT EXISTS prompts_usage_count_idx ON prompts (usage_count DESC);
`;

async function migrateSchema() {
  console.log('Starting PostgreSQL schema migration...');
  
  if (DRY_RUN) {
    console.log('DRY RUN: Would execute the following SQL:');
    console.log(createSchemaSQL);
    console.log('No changes were made to the database');
    return;
  }
  
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
  
  try {
    console.log('Connecting to database...');
    const client = await pool.connect();
    
    try {
      console.log('Creating schema...');
      await client.query(createSchemaSQL);
      console.log('Schema migration completed successfully');
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error migrating schema:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Execute the migration
migrateSchema().catch(error => {
  console.error('Unhandled error during migration:', error);
  process.exit(1);
}); 