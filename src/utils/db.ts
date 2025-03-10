/**
 * Database utilities for prompt manager
 */
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Database connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost/mydb'
});

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
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS prompts (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        description TEXT,
        category VARCHAR(255),
        tags TEXT[],
        is_template BOOLEAN DEFAULT FALSE,
        variables TEXT[],
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_prompts_name ON prompts(name);
      CREATE INDEX IF NOT EXISTS idx_prompts_category ON prompts(category);
    `);
    
    console.log('Database schema initialized successfully');
  } catch (error) {
    console.error('Error initializing database schema:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Save prompt to database
export async function savePromptToDb(prompt: Prompt): Promise<string> {
  const client = await pool.connect();
  try {
    const id = prompt.id || uuidv4();
    
    await client.query(
      `INSERT INTO prompts (
        id, name, content, description, category, tags, is_template, variables
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (id) DO UPDATE SET
        name = $2,
        content = $3,
        description = $4,
        category = $5,
        tags = $6,
        is_template = $7,
        variables = $8,
        updated_at = CURRENT_TIMESTAMP`,
      [
        id,
        prompt.name,
        prompt.content,
        prompt.description || null,
        prompt.category || null,
        prompt.tags || [],
        prompt.isTemplate || false,
        prompt.variables || []
      ]
    );
    
    return id;
  } catch (error) {
    console.error('Error saving prompt to database:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Get all prompts from database
export async function getAllPromptsFromDb(): Promise<Prompt[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT 
        id, 
        name, 
        content, 
        description, 
        category, 
        tags, 
        is_template as "isTemplate", 
        variables
      FROM prompts
      ORDER BY name
    `);
    
    return result.rows;
  } catch (error) {
    console.error('Error retrieving prompts from database:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Get prompt by ID from database
export async function getPromptFromDb(id: string): Promise<Prompt | null> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT 
        id, 
        name, 
        content, 
        description, 
        category, 
        tags, 
        is_template as "isTemplate", 
        variables
      FROM prompts
      WHERE id = $1`,
      [id]
    );
    
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.error(`Error retrieving prompt ${id} from database:`, error);
    throw error;
  } finally {
    client.release();
  }
}

// Delete prompt from database
export async function deletePromptFromDb(id: string): Promise<boolean> {
  const client = await pool.connect();
  try {
    const result = await client.query('DELETE FROM prompts WHERE id = $1', [id]);
    return result.rowCount ? result.rowCount > 0 : false;
  } catch (error) {
    console.error(`Error deleting prompt ${id} from database:`, error);
    throw error;
  } finally {
    client.release();
  }
}

// File system operations
const PROMPTS_DIR = process.env.PROMPTS_DIR || '/home/sparrow/mcp/data/prompts/';

// Save prompt to file
export function savePromptToFile(id: string, prompt: Prompt): void {
  // Create directory if it doesn't exist
  if (!fs.existsSync(PROMPTS_DIR)) {
    fs.mkdirSync(PROMPTS_DIR, { recursive: true });
  }
  
  const filePath = path.join(PROMPTS_DIR, `${id}.json`);
  
  // Save to file
  fs.writeFileSync(filePath, JSON.stringify(prompt, null, 2), 'utf8');
}

// Get all prompts from file system
export function getAllPromptsFromFiles(): Prompt[] {
  if (!fs.existsSync(PROMPTS_DIR)) {
    return [];
  }
  
  const files = fs.readdirSync(PROMPTS_DIR);
  
  return files
    .filter(file => file.endsWith('.json'))
    .map(file => {
      try {
        const filePath = path.join(PROMPTS_DIR, file);
        const content = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(content);
      } catch (e) {
        console.error(`Error parsing ${file}:`, e);
        return null;
      }
    })
    .filter(Boolean) as Prompt[];
}

// Get prompt from file
export function getPromptFromFile(id: string): Prompt | null {
  const filePath = path.join(PROMPTS_DIR, `${id}.json`);
  
  if (!fs.existsSync(filePath)) {
    return null;
  }
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (e) {
    console.error(`Error reading prompt ${id}:`, e);
    return null;
  }
}

// Delete prompt file
export function deletePromptFile(id: string): boolean {
  const filePath = path.join(PROMPTS_DIR, `${id}.json`);
  
  if (!fs.existsSync(filePath)) {
    return false;
  }
  
  try {
    fs.unlinkSync(filePath);
    return true;
  } catch (e) {
    console.error(`Error deleting prompt ${id}:`, e);
    return false;
  }
}

// Create backup directory
const BACKUP_DIR = process.env.BACKUP_DIR || '/home/sparrow/mcp/backups/prompts/';

// Create a backup of all prompts
export function createBackup(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(BACKUP_DIR, timestamp);
  
  // Create backup directory
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
  
  // Create directory for this backup
  fs.mkdirSync(backupDir, { recursive: true });
  
  // Copy each prompt file to backup directory
  if (fs.existsSync(PROMPTS_DIR)) {
    const files = fs.readdirSync(PROMPTS_DIR);
    
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      
      const srcPath = path.join(PROMPTS_DIR, file);
      const destPath = path.join(backupDir, file);
      
      fs.copyFileSync(srcPath, destPath);
    }
  }
  
  // Create a manifest file
  fs.writeFileSync(
    path.join(backupDir, 'manifest.json'),
    JSON.stringify({
      timestamp,
      count: fs.existsSync(PROMPTS_DIR) ? 
        fs.readdirSync(PROMPTS_DIR).filter(f => f.endsWith('.json')).length : 0,
      date: new Date().toISOString()
    }, null, 2)
  );
  
  return backupDir;
}

// List available backups
export function listBackups(): { timestamp: string, count: number }[] {
  if (!fs.existsSync(BACKUP_DIR)) {
    return [];
  }
  
  const dirs = fs.readdirSync(BACKUP_DIR);
  
  return dirs
    .map(dir => {
      const backupDir = path.join(BACKUP_DIR, dir);
      
      // Skip if not a directory
      if (!fs.statSync(backupDir).isDirectory()) return null;
      
      // Check for manifest file
      const metadataPath = path.join(backupDir, 'manifest.json');
      if (!fs.existsSync(metadataPath)) return null;
      
      try {
        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
        return { 
          timestamp: dir, 
          count: metadata.count || -1 
        };
      } catch (e) {
        console.error(`Error reading metadata from ${dir}:`, e);
        return { 
          timestamp: dir, 
          count: -1 
        };
      }
    })
    .filter(Boolean) as { timestamp: string, count: number }[];
}

// Restore from a specific backup
export function restoreFromBackup(timestamp: string): { success: boolean, count: number } {
  const backupDir = path.join(BACKUP_DIR, timestamp);
  
  if (!fs.existsSync(backupDir)) {
    throw new Error(`Backup ${timestamp} not found`);
  }
  
  // Create prompts directory if it doesn't exist
  if (!fs.existsSync(PROMPTS_DIR)) {
    fs.mkdirSync(PROMPTS_DIR, { recursive: true });
  }
  
  // Get all backup files
  const files = fs.readdirSync(backupDir)
    .filter(file => file.endsWith('.json') && file !== 'manifest.json');
  
  // Copy each file to prompts directory
  for (const file of files) {
    const srcPath = path.join(backupDir, file);
    const destPath = path.join(PROMPTS_DIR, file);
    
    fs.copyFileSync(srcPath, destPath);
  }
  
  return { success: true, count: files.length };
}
