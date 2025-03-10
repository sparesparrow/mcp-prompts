// src/index.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupPromptTools } from "./tools/prompt-tools.js";
import { setupDatabaseTools } from "./tools/database-tools.js";
import { initDatabase } from "./utils/db.js";

async function main() {
  try {
    // Initialize the server
    const server = new McpServer({
      name: "Prompt Manager",
      version: "1.1.0"
    });
    
    // Register existing prompt tools
    setupPromptTools(server);
    
    // Register new database tools
    setupDatabaseTools(server);
    
    // Initialize database connection
    console.log("Initializing database connection...");
    await initDatabase();
    
    // Connect to transport
    console.log("Starting MCP server on stdio transport...");
    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    console.log("Server started successfully.");
  } catch (error) {
    console.error("Error starting server:", error);
    process.exit(1);
  }
}

main();
