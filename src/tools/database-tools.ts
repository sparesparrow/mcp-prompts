import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
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

/**
 * Setup database tools for the MCP server
 * @param server MCP server instance
 */
export function setupDatabaseTools(server: McpServer): void {
  // Export all prompts to PostgreSQL database
  server.tool(
    "export_prompts_to_db",
    "Export all prompts to PostgreSQL database",
    {},
    async () => {
      try {
        // Create backup first
        const backupDir = await createBackup();
        console.log(`Created backup at: ${backupDir}`);

        // Initialize database
        await initDatabase();
        
        // Get all prompts from files
        const prompts = await getAllPromptsFromFiles();
        
        // Export each prompt to the database
        const results = await Promise.all(
          prompts.map(async (prompt) => {
            try {
              // Ensure prompt has an ID
              if (!prompt.id) {
                prompt.id = uuidv4();
              }
              
              const id = await savePromptToDb(prompt);
              return { name: prompt.name, id, success: true };
            } catch (err: any) {
              return { name: prompt.name, success: false, error: err.message };
            }
          })
        );
        
        // Generate summary
        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;
        
        return {
          content: [
            {
              type: "text",
              text: `Export completed.\n\nSummary:\n- Total prompts: ${prompts.length}\n- Successfully exported: ${successful}\n- Failed: ${failed}\n\n${failed > 0 ? 'Failures:\n' + results.filter(r => !r.success).map(r => `- ${r.name}: ${r.error}`).join('\n') : ''}`
            }
          ]
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error exporting prompts to database: ${err.message}`
            }
          ]
        };
      }
    }
  );

  // Import all prompts from PostgreSQL database
  server.tool(
    "import_prompts_from_db",
    "Import all prompts from PostgreSQL database",
    { 
      overwrite: z.boolean().optional().default(false),
    },
    async ({ overwrite }) => {
      try {
        // Create backup first
        const backupDir = await createBackup();
        console.log(`Created backup at: ${backupDir}`);

        // Initialize database
        await initDatabase();
        
        // Get all prompts from database
        const dbPrompts = await getAllPromptsFromDb();
        
        // Get existing prompt IDs
        const existingPrompts = new Set(
          (await getAllPromptsFromFiles())
            .filter(p => p.id)
            .map(p => p.id)
        );
        
        // Import results tracking
        const results = {
          imported: 0,
          skipped: 0,
          errors: 0,
          details: [] as Array<{ id: string | undefined; name: string; status: string; message?: string }>
        };
        
        // Process each prompt
        for (const prompt of dbPrompts) {
          try {
            if (!prompt.id) {
              continue; // Skip prompts without ID
            }
            
            // Skip if prompt exists and overwrite is false
            if (existingPrompts.has(prompt.id) && !overwrite) {
              results.skipped++;
              results.details.push({ id: prompt.id, name: prompt.name, status: 'skipped' });
              continue;
            }
            
            // Save to file
            await savePromptToFile(prompt.id, prompt);
            results.imported++;
            results.details.push({ id: prompt.id, name: prompt.name, status: 'imported' });
          } catch (err: any) {
            results.errors++;
            results.details.push({ id: prompt.id || 'unknown', name: prompt.name, status: 'error', message: err.message });
          }
        }
        
        return {
          content: [
            {
              type: "text",
              text: `Import completed.\n\nSummary:\n- Total prompts in database: ${dbPrompts.length}\n- Imported: ${results.imported}\n- Skipped (already exist): ${results.skipped}\n- Errors: ${results.errors}\n\n${results.errors > 0 ? 'Errors:\n' + results.details.filter(d => d.status === 'error').map(d => `- ${d.name}: ${d.message}`).join('\n') : ''}`
            }
          ]
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error importing prompts from database: ${err.message}`
            }
          ]
        };
      }
    }
  );

  // Synchronize prompts between file system and database
  server.tool(
    "sync_prompts",
    "Synchronize prompts between file system and database",
    {},
    async () => {
      try {
        // Create backup first
        const backupDir = await createBackup();
        console.log(`Created backup at: ${backupDir}`);

        // Initialize database
        await initDatabase();
        
        // Get prompts from both sources
        const filePrompts = await getAllPromptsFromFiles();
        const dbPrompts = await getAllPromptsFromDb();
        
        // Create maps for easier lookups
        const filePromptsMap = new Map(filePrompts.filter(p => p.id).map(p => [p.id, p]));
        const dbPromptsMap = new Map(dbPrompts.filter(p => p.id).map(p => [p.id, p]));
        
        // Tracking changes
        const changes = {
          added: { toFile: 0, toDb: 0 },
          updated: { inFile: 0, inDb: 0 },
          skipped: 0,
          errors: [] as Array<{ id: string | undefined; name: string; operation: string; message: string }>
        };
        
        // Function to compare prompts (simplified comparison)
        const arePromptsEqual = (a: any, b: any) => {
          // Convert to strings for comparison, excluding timestamps
          const aStr = JSON.stringify({
            name: a.name, 
            content: a.content,
            description: a.description,
            category: a.category,
            tags: a.tags,
            isTemplate: a.isTemplate,
            variables: a.variables
          });
          
          const bStr = JSON.stringify({
            name: b.name, 
            content: b.content,
            description: b.description,
            category: b.category,
            tags: b.tags,
            isTemplate: b.isTemplate,
            variables: b.variables
          });
          
          return aStr === bStr;
        };
        
        // Update database with file system prompts
        for (const filePrompt of filePrompts) {
          try {
            if (!filePrompt.id) {
              // Generate ID for prompts without one
              filePrompt.id = uuidv4();
              await savePromptToFile(filePrompt.id, filePrompt);
            }
            
            const dbPrompt = filePrompt.id ? dbPromptsMap.get(filePrompt.id) : undefined;
            
            if (!dbPrompt) {
              // Prompt exists in file but not in DB - add to DB
              await savePromptToDb(filePrompt);
              changes.added.toDb++;
            } else if (!arePromptsEqual(filePrompt, dbPrompt)) {
              // Prompts differ - use file version
              await savePromptToDb(filePrompt);
              changes.updated.inDb++;
            } else {
              changes.skipped++;
            }
          } catch (err: any) {
            changes.errors.push({ 
              id: filePrompt.id, 
              name: filePrompt.name, 
              operation: 'update-db', 
              message: err.message 
            });
          }
        }
        
        // Update file system with database prompts
        for (const dbPrompt of dbPrompts) {
          try {
            if (dbPrompt.id && !filePromptsMap.has(dbPrompt.id)) {
              // Prompt exists in DB but not in file - add to file
              await savePromptToFile(dbPrompt.id, dbPrompt);
              changes.added.toFile++;
            }
          } catch (err: any) {
            changes.errors.push({ 
              id: dbPrompt.id, 
              name: dbPrompt.name, 
              operation: 'update-file', 
              message: err.message 
            });
          }
        }
        
        return {
          content: [
            {
              type: "text",
              text: `Synchronization completed.\n\nSummary:\n- Added to database: ${changes.added.toDb}\n- Updated in database: ${changes.updated.inDb}\n- Added to file system: ${changes.added.toFile}\n- No changes needed: ${changes.skipped}\n- Errors: ${changes.errors.length}\n\n${changes.errors.length > 0 ? 'Errors:\n' + changes.errors.map(e => `- ${e.name} (${e.operation}): ${e.message}`).join('\n') : ''}`
            }
          ]
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error synchronizing prompts: ${err.message}`
            }
          ]
        };
      }
    }
  );

  // Create a backup of all prompts
  server.tool(
    "create_backup",
    "Create a backup of all prompts",
    {},
    async () => {
      try {
        const backupDir = await createBackup();
        return {
          content: [
            {
              type: "text",
              text: `Backup created successfully at: ${backupDir}`
            }
          ]
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error creating backup: ${err.message}`
            }
          ]
        };
      }
    }
  );

  // List available backups
  server.tool(
    "list_backups",
    "List available backups",
    {},
    async () => {
      try {
        const backups = await listBackups();
        
        if (backups.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "No backups found."
              }
            ]
          };
        }
        
        return {
          content: [
            {
              type: "text",
              text: `Available backups:\n\n${backups.map(b => `- ${b.timestamp}: ${b.count} prompts`).join('\n')}`
            }
          ]
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error listing backups: ${err.message}`
            }
          ]
        };
      }
    }
  );

  // Restore from backup
  server.tool(
    "restore_backup",
    "Restore prompts from a backup",
    {
      timestamp: z.string().describe("Timestamp of the backup to restore")
    },
    async ({ timestamp }) => {
      try {
        // Create backup of current state first
        const currentBackup = await createBackup();
        
        // Restore from specified backup
        const result = await restoreFromBackup(timestamp);
        
        return {
          content: [
            {
              type: "text",
              text: `Backup restored successfully.\n\n- Current state backed up to: ${currentBackup}\n- Restored ${result.count} prompts from backup: ${timestamp}`
            }
          ]
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error restoring backup: ${err.message}`
            }
          ]
        };
      }
    }
  );
}