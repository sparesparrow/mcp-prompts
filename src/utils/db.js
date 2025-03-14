/**
 * Database utilities for prompt manager
 */
// Fix the pg import to work with ESM
import pkg from 'pg';
const { Pool } = pkg;

export async function initDatabase() {
  console.log("Initializing database...");
  
  try {
    // Check if we need to create the database structure
    const config = await import('../config.js').then(m => m.getConfig());
    
    if (config.storage.type === 'postgres') {
      // Use the Pool from the top-level import
      
      // Create connection pool
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
      const fs = await import('fs/promises');
      
      // Make sure the prompts directory exists
      await fs.mkdir(config.storage.promptsDir, { recursive: true });
      console.log(`File storage directory initialized: ${config.storage.promptsDir}`);
    }
    
    console.log("Database initialization completed successfully.");
  } catch (error) {
    console.error("Error initializing database:", error);
    throw error;
  }
}

/**
 * Get all prompts from files in the specified directory
 * @param {string} directory Directory containing prompt files
 * @returns {Promise<Array<import('../types/prompt').Prompt>>} Array of prompt objects
 */
export async function getAllPromptsFromFiles(directory) {
  try {
    // If no directory is provided, throw an error
    if (!directory) {
      throw new Error('Directory is required for getAllPromptsFromFiles');
    }
    
    const fs = await import('fs/promises');
    const path = await import('path');
    
    // Make sure the directory exists
    await fs.mkdir(directory, { recursive: true });
    
    // Read all files in the directory
    const files = await fs.readdir(directory);
    
    // Filter for JSON files (we assume only JSON for now)
    const jsonFiles = files.filter(file => file.endsWith('.json'));
    
    // Read and parse each file
    const prompts = await Promise.all(
      jsonFiles.map(async file => {
        const filePath = path.join(directory, file);
        try {
          const content = await fs.readFile(filePath, 'utf8');
          const prompt = JSON.parse(content);
          
          // Ensure the prompt has an ID (use filename without extension)
          if (!prompt.id) {
            prompt.id = path.basename(file, '.json');
          }
          
          return prompt;
        } catch (error) {
          console.error(`Error reading prompt file ${file}:`, error);
          return null;
        }
      })
    );
    
    // Filter out any failed reads
    return prompts.filter(p => p !== null);
  } catch (error) {
    console.error('Error reading prompts from files:', error);
    throw error;
  }
}

/**
 * Get all prompts from the database
 * @param {string} connectionString PostgreSQL connection string
 * @returns {Promise<Array<import('../types/prompt').Prompt>>} Array of prompt objects
 */
export async function getAllPromptsFromDb(connectionString) {
  // Use the Pool from the top-level import
  
  // Create connection pool
  const pool = new Pool({
    connectionString,
  });
  
  try {
    // Query all prompts
    const result = await pool.query(`
      SELECT 
        id, name, content, description, is_template as "isTemplate", 
        tags, variables, category, 
        created_at as "createdAt", updated_at as "updatedAt"
      FROM prompts
    `);
    
    return result.rows;
  } finally {
    await pool.end();
  }
}

/**
 * Save a prompt to a file
 * @param {import('../types/prompt').Prompt} prompt Prompt object to save
 * @param {string} directory Directory to save the file in
 * @returns {Promise<string>} Path of the saved file
 */
export async function savePromptToFile(prompt, directory) {
  const fs = await import('fs/promises');
  const path = await import('path');
  
  // Make sure the directory exists
  await fs.mkdir(directory, { recursive: true });
  
  // Ensure the prompt has an ID
  if (!prompt.id) {
    const { v4: uuidv4 } = await import('uuid');
    prompt.id = uuidv4();
  }
  
  // Format the file path
  const filePath = path.join(directory, `${prompt.id}.json`);
  
  // Save the file
  await fs.writeFile(filePath, JSON.stringify(prompt, null, 2), 'utf8');
  
  return filePath;
}

/**
 * Save a prompt to the database
 * @param {import('../types/prompt').Prompt} prompt Prompt object to save
 * @param {string} connectionString PostgreSQL connection string
 * @returns {Promise<string>} ID of the saved prompt
 */
export async function savePromptToDb(prompt, connectionString) {
  // Use the Pool from the top-level import
  
  // Create connection pool
  const pool = new Pool({
    connectionString,
  });
  
  // Ensure prompt has an ID
  if (!prompt.id) {
    const { v4: uuidv4 } = await import('uuid');
    prompt.id = uuidv4();
  }
  
  const client = await pool.connect();
  try {
    // Check if prompt exists
    const existingPromptQuery = 'SELECT id FROM prompts WHERE id = $1';
    const existingResult = await client.query(existingPromptQuery, [prompt.id]);
    
    if (existingResult.rowCount && existingResult.rowCount > 0) {
      // Update existing prompt
      await client.query(
        `UPDATE prompts SET 
          name = $1,
          content = $2,
          description = $3,
          is_template = $4,
          tags = $5,
          variables = $6,
          category = $7,
          updated_at = NOW()
        WHERE id = $8`,
        [
          prompt.name,
          prompt.content,
          prompt.description || null,
          prompt.isTemplate || false,
          prompt.tags || [],
          // Make sure variables is an array of valid TemplateVariable objects
          Array.isArray(prompt.variables) ? prompt.variables : [],
          prompt.category || null,
          prompt.id
        ]
      );
    } else {
      // Insert new prompt
      await client.query(
        `INSERT INTO prompts (
          id, name, content, description, is_template, tags, variables, category, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
        [
          prompt.id,
          prompt.name,
          prompt.content,
          prompt.description || null,
          prompt.isTemplate || false,
          prompt.tags || [],
          // Make sure variables is an array of valid TemplateVariable objects
          Array.isArray(prompt.variables) ? prompt.variables : [],
          prompt.category || null
        ]
      );
    }
    
    return prompt.id;
  } finally {
    client.release();
    await pool.end();
  }
}

/**
 * Create a backup of all prompts
 * @param {string} backupDir Directory to store the backup
 * @param {object} options Backup options
 * @returns {Promise<string>} Path to the backup directory
 */
export async function createBackup(backupDir, options = {}) {
  const { storage = {} } = options;
  
  const fs = await import('fs/promises');
  const path = await import('path');
  const config = await import('../config.js').then(m => m.getConfig());
  
  // Create timestamp-based backup directory
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, `backup-${timestamp}`);
  
  // Create directory
  await fs.mkdir(backupPath, { recursive: true });
  
  // Get prompts
  let prompts;
  if (storage.type === 'postgres' && storage.pgConnectionString) {
    prompts = await getAllPromptsFromDb(storage.pgConnectionString);
  } else if (storage.type === 'file' && storage.promptsDir) {
    prompts = await getAllPromptsFromFiles(storage.promptsDir);
  } else {
    // Use default config
    if (config.storage.type === 'postgres') {
      prompts = await getAllPromptsFromDb(config.storage.pgConnectionString);
    } else {
      prompts = await getAllPromptsFromFiles(config.storage.promptsDir);
    }
  }
  
  // Save each prompt to the backup directory
  for (const prompt of prompts) {
    await savePromptToFile(prompt, backupPath);
  }
  
  // Create a metadata file with information about the backup
  const metadata = {
    timestamp: new Date().toISOString(),
    count: prompts.length,
    sourceType: storage.type || config.storage.type,
    version: '1.0.0',
  };
  
  await fs.writeFile(
    path.join(backupPath, 'backup-metadata.json'),
    JSON.stringify(metadata, null, 2),
    'utf8'
  );
  
  return backupPath;
}

/**
 * List all backups in the specified directory
 * @param {string} backupDir Directory containing backups
 * @returns {Promise<Array<object>>} Array of backup metadata
 */
export async function listBackups(backupDir) {
  const fs = await import('fs/promises');
  const path = await import('path');
  
  // Read the backup directory
  await fs.mkdir(backupDir, { recursive: true });
  const entries = await fs.readdir(backupDir, { withFileTypes: true });
  
  // Filter for directories that start with 'backup-'
  const backupDirs = entries
    .filter(entry => entry.isDirectory() && entry.name.startsWith('backup-'))
    .map(entry => entry.name);
  
  // Read metadata from each backup
  const backups = await Promise.all(
    backupDirs.map(async dirName => {
      const metadataPath = path.join(backupDir, dirName, 'backup-metadata.json');
      try {
        const metadataContent = await fs.readFile(metadataPath, 'utf8');
        const metadata = JSON.parse(metadataContent);
        return {
          name: dirName,
          path: path.join(backupDir, dirName),
          ...metadata
        };
      } catch {
        // If metadata file doesn't exist or can't be read, still include the backup
        return {
          name: dirName,
          path: path.join(backupDir, dirName),
          timestamp: dirName.replace('backup-', ''),
          count: null,
        };
      }
    })
  );
  
  // Sort by timestamp, newest first
  return backups.sort((a, b) => {
    const dateA = a.timestamp ? new Date(a.timestamp) : new Date(0);
    const dateB = b.timestamp ? new Date(b.timestamp) : new Date(0);
    return dateB.getTime() - dateA.getTime();
  });
}

/**
 * Restore from a backup
 * @param {string} backupPath Path to the backup directory
 * @param {object} options Restore options
 * @returns {Promise<number>} Number of prompts restored
 */
export async function restoreFromBackup(backupPath, options = {}) {
  const { clearExisting = false, storage = {} } = options;
  
  const fs = await import('fs/promises');
  const path = await import('path');
  const config = await import('../config.js').then(m => m.getConfig());
  
  // Verify the backup directory exists
  try {
    const stats = await fs.stat(backupPath);
    if (!stats.isDirectory()) {
      throw new Error(`Backup path ${backupPath} is not a directory`);
    }
  } catch (error) {
    throw new Error(`Backup path ${backupPath} does not exist or is not accessible`);
  }
  
  // Determine where to restore
  const targetStorage = {
    type: storage.type || config.storage.type,
    pgConnectionString: storage.pgConnectionString || config.storage.pgConnectionString,
    promptsDir: storage.promptsDir || config.storage.promptsDir,
  };
  
  // Helper function to clear existing data
  const clearData = async () => {
    if (targetStorage.type === 'postgres') {
      // Use the Pool from the top-level import
      
      const pool = new Pool({
        connectionString: targetStorage.pgConnectionString,
      });
      try {
        await pool.query('DELETE FROM prompts');
      } finally {
        await pool.end();
      }
    } else if (targetStorage.type === 'file') {
      // Clear files in the prompts directory
      const entries = await fs.readdir(targetStorage.promptsDir);
      for (const entry of entries) {
        if (entry.endsWith('.json')) {
          await fs.unlink(path.join(targetStorage.promptsDir, entry));
        }
      }
    }
  };
  
  // Clear existing data if requested
  if (clearExisting) {
    await clearData();
  }
  
  // Get prompts from backup
  const prompts = await getAllPromptsFromFiles(backupPath);
  
  // Restore prompts
  let restoredCount = 0;
  for (const prompt of prompts) {
    try {
      if (targetStorage.type === 'postgres') {
        await savePromptToDb(prompt, targetStorage.pgConnectionString);
      } else {
        await savePromptToFile(prompt, targetStorage.promptsDir);
      }
      restoredCount++;
    } catch (error) {
      console.error(`Error restoring prompt ${prompt.id}:`, error);
    }
  }
  
  return restoredCount;
} 