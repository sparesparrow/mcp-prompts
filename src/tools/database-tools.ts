/**
 * Database Tools for MCP Prompts Server
 * Implements tools for database operations (PostgreSQL)
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import * as pg from 'pg';
const { Pool } = pg;
import { getConfig } from '../config.js';
import {
  initDatabase,
  getAllPromptsFromFiles,
  getAllPromptsFromDb,
  savePromptToDb,
  savePromptToFile,
  createBackup,
  listBackups,
  restoreFromBackup
} from "../utils/db.js";
import { v4 as uuidv4 } from "uuid";
import { FileAdapter } from "../adapters/file-adapter.js";
import { PostgresAdapter } from "../adapters/postgres-adapter.js";
import { StorageAdapter } from "../core/types.js";
import { Prompt } from "../types/prompt.js";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Config } from "../config.js";

/**
 * Setup database tools for the MCP server
 * @param server MCP Server instance
 */
export async function setupDatabaseTools(server: McpServer): Promise<void> {
  const config = getConfig();
  const pgConnectionString = config.storage.pgConnectionString;
  
  // Skip if PostgreSQL connection is not configured
  if (!pgConnectionString) {
    console.warn('PostgreSQL connection string not provided. Database tools will not be registered.');
    return;
  }
  
  // Create a connection pool
  const pool = new Pool({
    connectionString: pgConnectionString,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  // Database query tool
  server.tool(
    "run_sql_query",
    "Run a SQL query on the PostgreSQL database",
    z.object({
      query: z.string(),
      parameters: z.array(z.union([
        z.string(),
        z.number(),
        z.boolean(),
        z.null()
      ])).optional().default([]),
    }),
    async ({ query, parameters }) => {
      let client: pg.PoolClient | null = null;
      
      try {
        // Get client from pool
        client = await pool.connect();
        
        // Validate query (simple check, should be improved)
        if (query.trim().toLowerCase().startsWith('drop ') || 
            query.trim().toLowerCase().startsWith('truncate ') ||
            query.trim().toLowerCase().includes('delete from ') ||
            query.trim().toLowerCase().includes('update ')) {
          throw new Error('Destructive SQL operations are not allowed');
        }
        
        // Execute query
        const result = await client.query(query, parameters);
        
        // Format response
        const rows = result.rows.slice(0, 100);
        const rowCount = result.rowCount ?? 0;
        const additional_rows = rowCount > 100 ? rowCount - 100 : 0;
        
        return {
          content: [
            { 
              type: "text", 
              text: `Query executed successfully.
              
Rows returned: ${rowCount} (${additional_rows > 0 ? `showing first 100, ${additional_rows} more rows available` : 'all rows shown'})

Results:
\`\`\`json
${JSON.stringify(rows, null, 2)}
\`\`\`

${result.fields ? `Columns: ${result.fields.map(f => f.name).join(', ')}` : ''}
` 
            }
          ]
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ 
            type: "text", 
            text: `Error executing SQL query: ${error.message}` 
          }]
        };
      } finally {
        if (client) {
          client.release();
        }
      }
    }
  );

  // Database schema introspection tool
  server.tool(
    "get_database_schema",
    "Get the database schema (tables, columns, and their types)",
    z.object({
      schema: z.string().default('public'),
      include_system_tables: z.boolean().default(false),
    }),
    async (args) => {
      const { schema = 'public', include_system_tables = false } = args || {};
      
      let client: pg.PoolClient | null = null;
      
      try {
        // Get client from pool
        client = await pool.connect();
        
        // Query to get schema information
        const schemaQuery = `
          SELECT 
            t.table_name, 
            c.column_name, 
            c.data_type,
            c.column_default,
            c.is_nullable,
            c.character_maximum_length,
            tc.constraint_type,
            kcu.column_name as key_column
          FROM 
            information_schema.tables t
          LEFT JOIN 
            information_schema.columns c ON t.table_name = c.table_name AND t.table_schema = c.table_schema
          LEFT JOIN 
            information_schema.table_constraints tc ON tc.table_name = t.table_name AND tc.table_schema = t.table_schema AND tc.constraint_type = 'PRIMARY KEY'
          LEFT JOIN 
            information_schema.key_column_usage kcu ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
          WHERE 
            t.table_schema = $1
            ${!include_system_tables ? "AND t.table_name NOT LIKE 'pg_%' AND t.table_name NOT LIKE 'sql_%'" : ""}
          ORDER BY 
            t.table_name, 
            c.ordinal_position;
        `;
        
        // Execute query
        const result = await client.query(schemaQuery, [schema]);
        
        // Process results to group by table
        const schemaInfo: Record<string, any[]> = {};
        
        result.rows.forEach(row => {
          if (!schemaInfo[row.table_name]) {
            schemaInfo[row.table_name] = [];
          }
          
          schemaInfo[row.table_name].push({
            column_name: row.column_name,
            data_type: row.data_type,
            is_nullable: row.is_nullable === 'YES',
            default_value: row.column_default,
            max_length: row.character_maximum_length,
            is_primary_key: row.key_column === row.column_name && row.constraint_type === 'PRIMARY KEY'
          });
        });
        
        // Format response
        return {
          content: [{ 
            type: "text", 
            text: `Database Schema (${schema}):
            
\`\`\`json
${JSON.stringify(schemaInfo, null, 2)}
\`\`\`

Schema contains ${Object.keys(schemaInfo).length} tables.` 
          }]
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ 
            type: "text", 
            text: `Error retrieving database schema: ${error.message}` 
          }]
        };
      } finally {
        if (client) {
          client.release();
        }
      }
    }
  );

  // Table data preview tool
  server.tool(
    "preview_table_data",
    "Preview data from a database table",
    z.object({
      table_name: z.string(),
      schema: z.string().default('public'),
      limit: z.number().int().positive().default(10),
      offset: z.number().int().nonnegative().default(0),
      order_by: z.string().optional(),
      where: z.string().optional(),
    }),
    async (args) => {
      const { 
        table_name, 
        schema = 'public', 
        limit = 10, 
        offset = 0,
        order_by,
        where
      } = args;
      
      let client: pg.PoolClient | null = null;
      
      try {
        // Get client from pool
        client = await pool.connect();
        
        // Validate table name (prevent SQL injection)
        const tableCheckQuery = `
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = $1 
            AND table_name = $2
          );
        `;
        
        const tableExists = await client.query(tableCheckQuery, [schema, table_name]);
        
        if (!tableExists.rows[0].exists) {
          throw new Error(`Table "${schema}.${table_name}" does not exist`);
        }
        
        // Build query
        let query = `SELECT * FROM "${schema}"."${table_name}"`;
        
        // Add WHERE clause if provided
        if (where) {
          query += ` WHERE ${where}`;
        }
        
        // Add ORDER BY clause if provided
        if (order_by) {
          query += ` ORDER BY ${order_by}`;
        }
        
        // Add LIMIT and OFFSET
        query += ` LIMIT $1 OFFSET $2`;
        
        // Execute query
        const result = await client.query(query, [limit, offset]);
        
        // Get total count
        const countQuery = `SELECT COUNT(*) FROM "${schema}"."${table_name}"${where ? ` WHERE ${where}` : ''}`;
        const countResult = await client.query(countQuery);
        const totalRows = parseInt(countResult.rows[0].count, 10);
        
        // Format response
        return {
          content: [{ 
            type: "text", 
            text: `Preview of ${schema}.${table_name}:
            
Total rows: ${totalRows}
Showing rows ${offset + 1} to ${Math.min(offset + limit, totalRows)} (limit: ${limit})

\`\`\`json
${JSON.stringify(result.rows, null, 2)}
\`\`\`

${result.fields ? `Columns: ${result.fields.map(f => f.name).join(', ')}` : ''}` 
          }]
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ 
            type: "text", 
            text: `Error previewing table data: ${error.message}` 
          }]
        };
      } finally {
        if (client) {
          client.release();
        }
      }
    }
  );

  // Database status tool
  server.tool(
    "get_database_status",
    "Get the current status of the database",
    z.object({}),
    async () => {
      let client: pg.PoolClient | null = null;
      
      try {
        // Get client from pool
        client = await pool.connect();
        
        // Query for database status
        const result = await client.query(`
          SELECT
            current_database() as database_name,
            current_user as current_user,
            version() as version,
            pg_size_pretty(pg_database_size(current_database())) as database_size,
            (SELECT count(*) FROM pg_stat_activity) as active_connections
        `);
        
        // Format response
        return {
          content: [{ 
            type: "text", 
            text: `Database Status:
            
- Database Name: ${result.rows[0].database_name}
- Current User: ${result.rows[0].current_user}
- PostgreSQL Version: ${result.rows[0].version}
- Database Size: ${result.rows[0].database_size}
- Active Connections: ${result.rows[0].active_connections}` 
          }]
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ 
            type: "text", 
            text: `Error retrieving database status: ${error.message}` 
          }]
        };
      } finally {
        if (client) {
          client.release();
        }
      }
    }
  );

  // Database backend health check tool
  server.tool(
    "check_database_connection",
    "Check if the database connection is working properly",
    z.object({}),
    async () => {
      let client: pg.PoolClient | null = null;
      
      try {
        // Get client from pool and perform a simple query
        const startTime = Date.now();
        client = await pool.connect();
        await client.query('SELECT 1');
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        return {
          content: [{ 
            type: "text", 
            text: `Database connection check:
            
✅ Successfully connected to the database
- Response time: ${responseTime}ms`
          }]
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ 
            type: "text", 
            text: `Database connection failed: ${error.message}` 
          }]
        };
      } finally {
        if (client) {
          client.release();
        }
      }
    }
  );

  // Initialize storage adapter
  let storageAdapter: StorageAdapter;
  if (config.storage.type === 'file') {
    storageAdapter = new FileAdapter(config.storage.promptsDir);
  } else if (config.storage.type === 'postgres') {
    if (!config.storage.pgConnectionString) {
      throw new Error('PostgreSQL connection string is required for postgres storage');
    }
    storageAdapter = new PostgresAdapter(config.storage.pgConnectionString);
  } else {
    throw new Error(`Unknown storage type: ${config.storage.type}`);
  }
  
  await initDatabase();
  
  // Initialize database tool
  server.tool(
    "init_database",
    "Initialize the database",
    z.object({}),
    async () => {
      try {
        await initDatabase();
        return {
          content: [{ 
            type: "text", 
            text: "Database initialized successfully" 
          }]
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ 
            type: "text", 
            text: `Error initializing database: ${error.message}` 
          }]
        };
      }
    }
  );
  
  // Import prompts tool
  server.tool(
    "import_prompts_from_files",
    "Import prompts from files into the database",
    z.object({
      directory: z.string().optional(),
    }),
    async ({ directory }) => {
      try {
        // Make sure we have a directory to read from
        const dirToRead = directory || config.storage.promptsDir;
        if (!dirToRead) {
          throw new Error('No directory specified and no default directory configured');
        }
        
        // Read all files in the directory
        const fs = await import('fs/promises');
        const path = await import('path');
        
        // Make sure the directory exists
        await fs.mkdir(dirToRead, { recursive: true });
        
        // Read all files in the directory
        const files = await fs.readdir(dirToRead);
        
        // Filter for JSON files
        const jsonFiles = files.filter(file => file.endsWith('.json'));
        
        // Read each file and parse it
        const prompts: Array<{
          id?: string;
          name?: string;
          content?: string;
          description?: string;
          isTemplate?: boolean;
          tags?: string[];
          variables?: string[];
          category?: string;
        }> = [];
        for (const file of jsonFiles) {
          const filePath = path.join(dirToRead, file);
          try {
            const content = await fs.readFile(filePath, 'utf8');
            const prompt = JSON.parse(content);
            
            // Ensure the prompt has an ID (use filename without extension)
            if (!prompt.id) {
              prompt.id = path.basename(file, '.json');
            }
            
            prompts.push(prompt);
          } catch (error) {
            console.error(`Error reading prompt file ${file}:`, error);
          }
        }
        
        // Save each prompt to the database
        let importedCount = 0;
        for (const prompt of prompts) {
          if (!prompt.id) {
            prompt.id = uuidv4();
          }
          
          // Ensure all prompt properties align with the Prompt type
          await storageAdapter.savePrompt({
            id: prompt.id || uuidv4(),
            name: prompt.name || '',
            content: prompt.content || '',
            description: prompt.description || undefined,
            isTemplate: prompt.isTemplate === true,
            tags: Array.isArray(prompt.tags) ? prompt.tags : [],
            variables: Array.isArray(prompt.variables) 
              ? prompt.variables.map(v => {
                  // If it's already a TemplateVariable object, use it
                  if (typeof v === 'object' && v !== null && 'name' in v) {
                    return v;
                  }
                  // Otherwise convert the string to a TemplateVariable
                  return { name: v.toString(), required: false };
                }) 
              : [],
            category: prompt.category || undefined,
            createdAt: (prompt as any).createdAt || new Date().toISOString(),
            updatedAt: (prompt as any).updatedAt || new Date().toISOString(),
            version: (prompt as any).version || 1
          });
          
          importedCount++;
        }
        
        return {
          content: [{ 
            type: "text", 
            text: `Imported ${importedCount} prompts successfully` 
          }]
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ 
            type: "text", 
            text: `Error importing prompts: ${error.message}` 
          }]
        };
      }
    }
  );
  
  // Export prompts tool
  server.tool(
    "export_prompts_to_files",
    "Export prompts from the database to files",
    z.object({
      directory: z.string().optional(),
      format: z.enum(['json', 'yaml']).optional(),
    }),
    async ({ directory, format }) => {
      try {
        const prompts = await storageAdapter.getAllPrompts();
        
        if (!directory) {
          throw new Error('directory is required');
        }
        
        if (!fs.existsSync(directory)) {
          fs.mkdirSync(directory, { recursive: true });
        }
        
        for (const prompt of prompts) {
          const fileName = `${prompt.id}.${format || 'json'}`;
          const filePath = path.join(directory, fileName);
          
          if (format === 'json') {
            fs.writeFileSync(filePath, JSON.stringify(prompt, null, 2), 'utf8');
          } else {
            // YAML format would be implemented here
            throw new Error('YAML format not implemented yet');
          }
        }
        
        return {
          content: [{ 
            type: "text", 
            text: `Exported ${prompts.length} prompts to ${directory}` 
          }]
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ 
            type: "text", 
            text: `Error exporting prompts: ${error.message}` 
          }]
        };
      }
    }
  );
  
  // Backup database tool
  server.tool(
    "backup_database",
    "Backup the entire prompts database",
    z.object({
      backupDir: z.string().optional(),
    }),
    async ({ backupDir }) => {
      try {
        const backupDirectory = backupDir || path.join(config.storage.promptsDir, `backup-${Date.now()}`);
        
        if (!fs.existsSync(backupDirectory)) {
          fs.mkdirSync(backupDirectory, { recursive: true });
        }
        
        const prompts = await storageAdapter.getAllPrompts();
        
        for (const prompt of prompts) {
          const fileName = `${prompt.id}.json`;
          const filePath = path.join(backupDirectory, fileName);
          fs.writeFileSync(filePath, JSON.stringify(prompt, null, 2), 'utf8');
        }
        
        return {
          content: [{ 
            type: "text", 
            text: `Database backed up successfully to ${backupDirectory}` 
          }]
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ 
            type: "text", 
            text: `Error backing up database: ${error.message}` 
          }]
        };
      }
    }
  );
  
  // Restore database tool
  server.tool(
    "restore_database",
    "Restore the prompts database from a backup",
    z.object({
      backupPath: z.string(),
      clearExisting: z.boolean().optional(),
    }),
    async ({ backupPath, clearExisting }) => {
      try {
        if (!fs.existsSync(backupPath)) {
          throw new Error(`Backup path ${backupPath} does not exist`);
        }
        
        if (clearExisting) {
          await storageAdapter.clearAll();
        }
        
        const files = fs.readdirSync(backupPath);
        let importedCount = 0;
        
        for (const file of files) {
          if (file.endsWith('.json')) {
            const filePath = path.join(backupPath, file);
            const content = fs.readFileSync(filePath, 'utf8');
            try {
              const prompt = JSON.parse(content);
              await storageAdapter.savePrompt(prompt);
              importedCount++;
            } catch (error) {
              console.error(`Error parsing prompt file ${file}:`, error);
            }
          }
        }
        
        return {
          content: [{ 
            type: "text", 
            text: `Restored ${importedCount} prompts from backup` 
          }]
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ 
            type: "text", 
            text: `Error restoring database: ${error.message}` 
          }]
        };
      }
    }
  );
  
  // Purge database tool
  server.tool(
    "purge_database",
    "Purge all data from the prompts database",
    z.object({
      confirm: z.boolean(),
    }),
    async ({ confirm }) => {
      try {
        if (!confirm) {
          return {
            content: [{ 
              type: "text", 
              text: "Operation cancelled. Set confirm to true to proceed." 
            }]
          };
        }
        
        await storageAdapter.clearAll();
        
        return {
          content: [{ 
            type: "text", 
            text: "Database cleared successfully" 
          }]
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ 
            type: "text", 
            text: `Error clearing database: ${error.message}` 
          }]
        };
      }
    }
  );
  
  // Get database stats tool
  server.tool(
    "get_database_stats",
    "Get statistics about the database",
    z.object({}),
    async () => {
      try {
        const prompts = await storageAdapter.getAllPrompts();
        
        const stats = {
          totalPrompts: prompts.length,
          templates: prompts.filter(p => p.isTemplate).length,
          categories: [...new Set(prompts.map(p => p.category).filter(Boolean))],
          tags: [...new Set(prompts.flatMap(p => p.tags || []))],
        };
        
        return {
          content: [{ 
            type: "text", 
            text: JSON.stringify(stats, null, 2) 
          }]
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ 
            type: "text", 
            text: `Error getting database stats: ${error.message}` 
          }]
        };
      }
    }
  );
  
  // Search prompts tool
  server.tool(
    "search_prompts",
    "Search for prompts in the database",
    z.object({
      query: z.string(),
      fields: z.array(z.string()).optional(),
      caseSensitive: z.boolean().optional(),
    }),
    async ({ query, fields, caseSensitive }) => {
      try {
        const prompts = await storageAdapter.getAllPrompts();
        
        const searchFields = fields || ['name', 'description', 'content', 'tags', 'category'];
        const isCaseSensitive = caseSensitive || false;
        
        const results = prompts.filter(prompt => {
          return searchFields.some(field => {
            if (field === 'tags' && prompt.tags) {
              return prompt.tags.some(tag => {
                if (isCaseSensitive) {
                  return tag.includes(query);
                } else {
                  return tag.toLowerCase().includes(query.toLowerCase());
                }
              });
            } else if (prompt[field as keyof Prompt]) {
              const value = prompt[field as keyof Prompt] as string;
              if (isCaseSensitive) {
                return value.includes(query);
              } else {
                return value.toLowerCase().includes(query.toLowerCase());
              }
            }
            return false;
          });
        });
        
        return {
          content: [{ 
            type: "text", 
            text: JSON.stringify(results, null, 2) 
          }]
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ 
            type: "text", 
            text: `Error searching prompts: ${error.message}` 
          }]
        };
      }
    }
  );
  
  // Get storage info tool
  server.tool(
    "get_storage_info",
    "Get information about the storage configuration",
    z.object({}),
    async () => {
      try {
        const storageInfo = {
          type: config.storage.type,
          promptsDir: config.storage.type === 'file' ? config.storage.promptsDir : undefined,
          databaseConnected: await storageAdapter.isConnected(),
        };
        
        return {
          content: [{ 
            type: "text", 
            text: JSON.stringify(storageInfo, null, 2) 
          }]
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ 
            type: "text", 
            text: `Error getting storage info: ${error.message}` 
          }]
        };
      }
    }
  );
  
  // Migrate storage tool
  server.tool(
    "migrate_storage",
    "Migrate data between storage types",
    z.object({
      sourceType: z.enum(['file', 'postgres']),
      targetType: z.enum(['file', 'postgres']),
      sourceConfig: z.object({
        promptsDir: z.string().optional(),
        pgConnectionString: z.string().optional(),
      }),
      targetConfig: z.object({
        promptsDir: z.string().optional(),
        pgConnectionString: z.string().optional(),
      }),
    }),
    async (args) => {
      try {
        const { sourceType, targetType, sourceConfig, targetConfig } = args;
        
        // Create source adapter
        let sourceAdapter: StorageAdapter;
        if (sourceType === 'file') {
          if (!sourceConfig.promptsDir) {
            throw new Error('promptsDir is required for file source');
          }
          sourceAdapter = new FileAdapter(sourceConfig.promptsDir);
        } else if (sourceType === 'postgres') {
          if (!sourceConfig.pgConnectionString) {
            throw new Error('pgConnectionString is required for postgres source');
          }
          sourceAdapter = new PostgresAdapter(sourceConfig.pgConnectionString);
        } else {
          throw new Error(`Unknown source type: ${sourceType}`);
        }
        
        // Create target adapter
        let targetAdapter: StorageAdapter;
        if (targetType === 'file') {
          if (!targetConfig.promptsDir) {
            throw new Error('promptsDir is required for file target');
          }
          targetAdapter = new FileAdapter(targetConfig.promptsDir);
        } else if (targetType === 'postgres') {
          if (!targetConfig.pgConnectionString) {
            throw new Error('pgConnectionString is required for postgres target');
          }
          targetAdapter = new PostgresAdapter(targetConfig.pgConnectionString);
        } else {
          throw new Error(`Unknown target type: ${targetType}`);
        }
        
        // Connect to both adapters
        await sourceAdapter.connect();
        await targetAdapter.connect();
        
        // Get all prompts from source
        const prompts = await sourceAdapter.getAllPrompts();
        
        // Save all prompts to target
        for (const prompt of prompts) {
          await targetAdapter.savePrompt(prompt);
        }
        
        // Disconnect from both adapters
        await sourceAdapter.disconnect();
        await targetAdapter.disconnect();
        
        return {
          content: [{ 
            type: "text", 
            text: `Migrated ${prompts.length} prompts from ${sourceType} to ${targetType}` 
          }]
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ 
            type: "text", 
            text: `Error migrating storage: ${error.message}` 
          }]
        };
      }
    }
  );

  // Database migration tool
  server.tool(
    "run_database_migration",
    "Run database migrations for the prompts system",
    z.object({
      force: z.boolean().optional().default(false),
    }),
    async ({ force }) => {
      if (force) {
        console.log("Forcing database migration...");
        try {
          await initDatabase();
          return {
            content: [{ 
              type: "text", 
              text: "Database initialized successfully with forced migration" 
            }]
          };
        } catch (error: any) {
          return {
            isError: true,
            content: [{ 
              type: "text", 
              text: `Error initializing database: ${error.message}` 
            }]
          };
        }
      } else {
        return {
          content: [{ 
            type: "text", 
            text: "No migration performed. Set force=true to force migration." 
          }]
        };
      }
    }
  );

  // Database info tool
  server.tool(
    "get_database_info",
    "Get information about the database", 
    z.object({}),
    async () => {
      try {
        const config = getConfig();
        const info = {
          storage: config.storage.type,
          path: config.storage.type === 'file' ? config.storage.promptsDir : undefined,
          connection: config.storage.type === 'postgres' ? 'PostgreSQL' : undefined,
          connected: await storageAdapter.isConnected(),
        };
        
        return {
          content: [{ 
            type: "text", 
            text: JSON.stringify(info, null, 2) 
          }]
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ 
            type: "text", 
            text: `Error getting database info: ${error.message}` 
          }]
        };
      }
    }
  );

  // Sync databases tool
  server.tool(
    "sync_databases",
    "Sync prompts between different storage types",
    z.object({
      sourceType: z.enum(['file', 'postgres']),
      targetType: z.enum(['file', 'postgres']),
      sourceConfig: z.object({
        promptsDir: z.string().optional(),
        pgConnectionString: z.string().optional(),
      }),
      targetConfig: z.object({
        promptsDir: z.string().optional(),
        pgConnectionString: z.string().optional(),
      }),
    }),
    async (args) => {
      try {
        const { sourceType, targetType, sourceConfig, targetConfig } = args;
        
        // Create source adapter
        let sourceAdapter: StorageAdapter;
        if (sourceType === 'file') {
          if (!sourceConfig.promptsDir) {
            throw new Error('promptsDir is required for file source');
          }
          sourceAdapter = new FileAdapter(sourceConfig.promptsDir);
        } else if (sourceType === 'postgres') {
          if (!sourceConfig.pgConnectionString) {
            throw new Error('pgConnectionString is required for postgres source');
          }
          sourceAdapter = new PostgresAdapter(sourceConfig.pgConnectionString);
        } else {
          throw new Error(`Unknown source type: ${sourceType}`);
        }
        
        // Create target adapter
        let targetAdapter: StorageAdapter;
        if (targetType === 'file') {
          if (!targetConfig.promptsDir) {
            throw new Error('promptsDir is required for file target');
          }
          targetAdapter = new FileAdapter(targetConfig.promptsDir);
        } else if (targetType === 'postgres') {
          if (!targetConfig.pgConnectionString) {
            throw new Error('pgConnectionString is required for postgres target');
          }
          targetAdapter = new PostgresAdapter(targetConfig.pgConnectionString);
        } else {
          throw new Error(`Unknown target type: ${targetType}`);
        }
        
        // Connect to both adapters
        await sourceAdapter.connect();
        await targetAdapter.connect();
        
        // Get all prompts from source
        const prompts = await sourceAdapter.getAllPrompts();
        
        // Sync prompts to target (save only if different or does not exist)
        let syncedCount = 0;
        for (const prompt of prompts) {
          try {
            const existingPrompt = await targetAdapter.getPrompt(prompt.id);
            if (!existingPrompt || JSON.stringify(existingPrompt) !== JSON.stringify(prompt)) {
              await targetAdapter.savePrompt(prompt);
              syncedCount++;
            }
          } catch (error) {
            await targetAdapter.savePrompt(prompt);
            syncedCount++;
          }
        }
        
        // Disconnect from both adapters
        await sourceAdapter.disconnect();
        await targetAdapter.disconnect();
        
        return {
          content: [{ 
            type: "text", 
            text: `Synced ${syncedCount} prompts from ${sourceType} to ${targetType}` 
          }]
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ 
            type: "text", 
            text: `Error syncing databases: ${error.message}` 
          }]
        };
      }
    }
  );
}