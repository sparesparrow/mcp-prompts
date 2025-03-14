/**
 * Database utilities for prompt manager
 */
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { getConfig } from '../config.js';

// Define prompt interface (matching existing structure)
export interface Prompt {
  id?: string;
  name: string;
  content: string;
  description?: string;
  category?: string;
  tags?: string[];
  isTemplate?: boolean;
  variables?: string[];
}

// Initialize database with required schema
export async function initDatabase(): Promise<void> {
  console.log("Initializing database...");
  
  try {
    // Get configuration
    const config = getConfig();
    
    if (config.storage.type === 'postgres') {
      // Create connection pool using the config
      const pool = new Pool({
        connectionString: config.storage.pgConnectionString,
      });
      
      // Create schema if it doesn't exist
      const client = await pool.connect();
      try {
        // Create tables if they don't exist
        await client.query(`
          CREATE TABLE IF NOT EXISTS prompts (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            content TEXT NOT NULL,
            description TEXT,
            is_template BOOLEAN DEFAULT FALSE,
            tags TEXT[],
            variables TEXT[],
            category TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          )
        `);
        
        console.log("Database schema initialized successfully.");
      } finally {
        client.release();
      }
      
      await pool.end();
    } else if (config.storage.type === 'file') {
      // Ensure the prompts directory exists
      const promptsDir = config.storage.promptsDir;
      if (!fs.existsSync(promptsDir)) {
        fs.mkdirSync(promptsDir, { recursive: true });
      }
      console.log(`File storage initialized at ${promptsDir}`);
    }
  } catch (error) {
    console.error('Error initializing database:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

// Save prompt to database
export async function savePromptToDb(prompt: Prompt): Promise<string> {
  const config = getConfig();
  
  if (config.storage.type !== 'postgres') {
    throw new Error('Database storage not configured');
  }
  
  const pool = new Pool({
    connectionString: config.storage.pgConnectionString,
  });
  
  const client = await pool.connect();
  
  try {
    const id = prompt.id || uuidv4();
    
    const query = `
      INSERT INTO prompts (
        id, name, content, description, category, tags, is_template, variables
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8
      ) 
      ON CONFLICT (id) DO UPDATE SET
        name = $2,
        content = $3,
        description = $4,
        category = $5,
        tags = $6,
        is_template = $7,
        variables = $8,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id
    `;
    
    const values = [
      id,
      prompt.name,
      prompt.content,
      prompt.description || '',
      prompt.category || '',
      prompt.tags || [],
      prompt.isTemplate || false,
      prompt.variables || []
    ];
    
    const result = await client.query(query, values);
    return result.rows[0].id;
  } finally {
    client.release();
    await pool.end();
  }
}

// Get all prompts from database
export async function getAllPromptsFromDb(): Promise<Prompt[]> {
  const config = getConfig();
  
  if (config.storage.type !== 'postgres') {
    throw new Error('Database storage not configured');
  }
  
  const pool = new Pool({
    connectionString: config.storage.pgConnectionString,
  });
  
  const client = await pool.connect();
  
  try {
    const query = `
      SELECT id, name, content, description, category, tags, is_template AS "isTemplate", variables
      FROM prompts
      ORDER BY name
    `;
    
    const result = await client.query(query);
    return result.rows;
  } finally {
    client.release();
    await pool.end();
  }
}

// Get a prompt by ID from database
export async function getPromptFromDb(id: string): Promise<Prompt | null> {
  const config = getConfig();
  
  if (config.storage.type !== 'postgres') {
    throw new Error('Database storage not configured');
  }
  
  const pool = new Pool({
    connectionString: config.storage.pgConnectionString,
  });
  
  const client = await pool.connect();
  
  try {
    const query = `
      SELECT id, name, content, description, category, tags, is_template AS "isTemplate", variables
      FROM prompts
      WHERE id = $1
    `;
    
    const result = await client.query(query, [id]);
    return result.rows.length > 0 ? result.rows[0] : null;
  } finally {
    client.release();
    await pool.end();
  }
}

// Delete a prompt by ID from database
export async function deletePromptFromDb(id: string): Promise<boolean> {
  const config = getConfig();
  
  if (config.storage.type !== 'postgres') {
    throw new Error('Database storage not configured');
  }
  
  const pool = new Pool({
    connectionString: config.storage.pgConnectionString,
  });
  
  const client = await pool.connect();
  
  try {
    const query = 'DELETE FROM prompts WHERE id = $1 RETURNING id';
    const result = await client.query(query, [id]);
    return result.rowCount !== null && result.rowCount > 0;
  } finally {
    client.release();
    await pool.end();
  }
}

// File-based storage functions

// Get backup directory path
function getBackupDir(config: ReturnType<typeof getConfig>): string {
  // Default to 'backups' directory in current working directory
  return config.storage.backupsDir || path.join(process.cwd(), 'backups');
}

// Save prompt to file
export function savePromptToFile(prompt: Prompt): string {
  const config = getConfig();
  const promptsDir = config.storage.promptsDir;
  
  // Create directory if it doesn't exist
  if (!fs.existsSync(promptsDir)) {
    fs.mkdirSync(promptsDir, { recursive: true });
  }
  
  const id = prompt.id || uuidv4();
  const promptWithId = { ...prompt, id };
  
  fs.writeFileSync(
    path.join(promptsDir, `${id}.json`),
    JSON.stringify(promptWithId, null, 2),
    'utf8'
  );
  
  return id;
}

// Get all prompts from files
export function getAllPromptsFromFiles(): Prompt[] {
  const config = getConfig();
  const promptsDir = config.storage.promptsDir;
  
  if (!fs.existsSync(promptsDir)) {
    fs.mkdirSync(promptsDir, { recursive: true });
    return [];
  }
  
  const files = fs.readdirSync(promptsDir)
    .filter(file => file.endsWith('.json'));
  
  return files.map(file => {
    try {
      const content = fs.readFileSync(path.join(promptsDir, file), 'utf8');
      return JSON.parse(content) as Prompt;
    } catch (error) {
      console.error(`Error reading prompt file ${file}:`, error);
      return null;
    }
  }).filter(Boolean) as Prompt[];
}

// Get a prompt by ID from file
export function getPromptFromFile(id: string): Prompt | null {
  const config = getConfig();
  const promptsDir = config.storage.promptsDir;
  const filePath = path.join(promptsDir, `${id}.json`);
  
  if (!fs.existsSync(filePath)) {
    return null;
  }
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content) as Prompt;
  } catch (error) {
    console.error(`Error reading prompt file ${id}:`, error);
    return null;
  }
}

// Delete a prompt file
export function deletePromptFile(id: string): boolean {
  const config = getConfig();
  const promptsDir = config.storage.promptsDir;
  const filePath = path.join(promptsDir, `${id}.json`);
  
  if (!fs.existsSync(filePath)) {
    return false;
  }
  
  try {
    fs.unlinkSync(filePath);
    return true;
  } catch (error) {
    console.error(`Error deleting prompt file ${id}:`, error);
    return false;
  }
}

// Backup and restore functions

// Create a backup of all prompts
export function createBackup(): string {
  const config = getConfig();
  const promptsDir = config.storage.promptsDir;
  const backupsDir = getBackupDir(config);
  
  // Create backups directory if it doesn't exist
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }
  
  // Get all prompts
  let prompts: Prompt[] = [];
  
  if (config.storage.type === 'file') {
    prompts = getAllPromptsFromFiles();
  } else {
    throw new Error('Backup only supported for file storage currently');
  }
  
  if (prompts.length === 0) {
    throw new Error('No prompts to backup');
  }
  
  // Create backup file
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFileName = `backup-${timestamp}.json`;
  const backupFilePath = path.join(backupsDir, backupFileName);
  
  fs.writeFileSync(
    backupFilePath,
    JSON.stringify({ 
      timestamp,
      count: prompts.length,
      prompts
    }, null, 2),
    'utf8'
  );
  
  return backupFilePath;
}

// List all backups
export function listBackups(): { timestamp: string, count: number }[] {
  const config = getConfig();
  const backupsDir = getBackupDir(config);
  
  if (!fs.existsSync(backupsDir)) {
    return [];
  }
  
  const files = fs.readdirSync(backupsDir)
    .filter(file => file.startsWith('backup-') && file.endsWith('.json'));
  
  return files.map(file => {
    try {
      const content = fs.readFileSync(path.join(backupsDir, file), 'utf8');
      const backup = JSON.parse(content);
      return { 
        timestamp: backup.timestamp,
        count: backup.count
      };
    } catch (error) {
      console.error(`Error reading backup file ${file}:`, error);
      return null;
    }
  }).filter(Boolean) as { timestamp: string, count: number }[];
}

// Restore from a backup
export function restoreFromBackup(timestamp: string): { success: boolean, count: number } {
  const config = getConfig();
  const promptsDir = config.storage.promptsDir;
  const backupsDir = getBackupDir(config);
  
  // Find backup file
  const files = fs.readdirSync(backupsDir)
    .filter(file => file.includes(timestamp) && file.endsWith('.json'));
  
  if (files.length === 0) {
    throw new Error(`No backup found with timestamp: ${timestamp}`);
  }
  
  // Read backup file
  const backupFilePath = path.join(backupsDir, files[0]);
  const backupContent = fs.readFileSync(backupFilePath, 'utf8');
  const backup = JSON.parse(backupContent);
  
  if (!backup.prompts || !Array.isArray(backup.prompts)) {
    throw new Error('Invalid backup file format');
  }
  
  // Clear existing prompts directory
  const existingFiles = fs.readdirSync(promptsDir)
    .filter(file => file.endsWith('.json'));
  
  for (const file of existingFiles) {
    fs.unlinkSync(path.join(promptsDir, file));
  }
  
  // Restore prompts
  for (const prompt of backup.prompts) {
    savePromptToFile(prompt);
  }
  
  return { 
    success: true,
    count: backup.prompts.length
  };
}
