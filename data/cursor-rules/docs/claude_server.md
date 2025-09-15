# Using Claude Server in Claude Desktop

## Integration Overview

The claude-server is integrated with Claude Desktop through the MCP (Model Context Protocol) configuration. When you start Claude Desktop, it automatically launches the claude-server as an MCP server, making its context management tools available to all conversations.

## Configuration

The server is configured in Claude Desktop's configuration file at:
`~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "claude-server": {
      "command": "node",
      "args": ["/Users/davidteren/Documents/Cline/MCP/claude-server/build/index.js"]
    }
  }
}
```

## Using Context Management in Conversations

### 1. Saving Important Information

During a conversation with Claude, you can save important information for future reference:

```
Human: Save this project discussion for later reference.

Claude: I'll save the context of our discussion.

use_mcp_tool({
  server_name: "claude-server",
  tool_name: "save_context",
  arguments: {
    id: "project-discussion-2024-01",
    content: "Our conversation content...",
    tags: ["project", "planning"]
  }
});
```

### 2. Retrieving Previous Context

In a new conversation, you can ask Claude to recall previous discussions:

```
Human: What did we discuss about the project earlier?

Claude: Let me retrieve our previous discussion.

use_mcp_tool({
  server_name: "claude-server",
  tool_name: "get_context",
  arguments: {
    id: "project-discussion-2024-01"
  }
});

Based on our previous discussion...
```

### 3. Managing Multiple Contexts

You can organize and track multiple conversations:

```
Human: Show me all our project-related discussions.

Claude: I'll list all contexts tagged with "project".

use_mcp_tool({
  server_name: "claude-server",
  tool_name: "list_contexts",
  arguments: {
    tag: "project"
  }
});
```

## Practical Use Cases

1. **Project Continuity**
   - Save project requirements
   - Store design decisions
   - Track progress discussions

2. **Knowledge Management**
   - Save research findings
   - Store technical explanations
   - Keep code examples

3. **Task Management**
   - Save task lists
   - Track progress updates
   - Store completion criteria

## Tips for Claude Desktop Users

1. **Session Management**
   - Start new sessions with context retrieval
   - Save important conclusions before ending
   - Link related conversations with tags

2. **Organization**
   - Use consistent ID patterns for easy recall
   - Apply relevant tags for better searchability
   - Update contexts as discussions evolve

3. **Effective Retrieval**
   - Reference specific context IDs
   - Use tag filtering for broader searches
   - Chain related contexts together

## Example Workflow

1. **Starting a New Project**
   ```
   Human: Let's start planning our new project.
   
   Claude: I'll create a new context for this project.
   
   use_mcp_tool({
     server_name: "claude-server",
     tool_name: "save_context",
     arguments: {
       id: "new-project-init",
       content: "Initial project planning...",
       tags: ["project", "planning", "initial"]
     }
   });
   ```

2. **Continuing Later**
   ```
   Human: Let's continue our project discussion from last time.
   
   Claude: I'll retrieve our previous planning session.
   
   use_mcp_tool({
     server_name: "claude-server",
     tool_name: "get_context",
     arguments: {
       id: "new-project-init"
     }
   });
   ```

3. **Updating Progress**
   ```
   Human: Update our project status with today's progress.
   
   Claude: I'll save our progress update.
   
   use_mcp_tool({
     server_name: "claude-server",
     tool_name: "save_context",
     arguments: {
       id: "new-project-progress-1",
       content: "Progress update: ...",
       tags: ["project", "progress", "update"]
     }
   });
   ```

## Best Practices for Claude Desktop

1. **Context Naming**
   - Use descriptive, date-based IDs
   - Include project or topic prefixes
   - Use consistent naming patterns

2. **Tagging Strategy**
   - Tag by project name
   - Tag by conversation type
   - Tag by status or phase

3. **Content Organization**
   - Structure content clearly
   - Include relevant metadata
   - Reference related contexts

4. **Regular Maintenance**
   - Review and update contexts
   - Archive completed discussions
   - Clean up outdated information

## Troubleshooting in Claude Desktop

1. **Server Issues**
   - Check Claude Desktop configuration
   - Verify server installation
   - Restart Claude Desktop if needed

2. **Context Access**
   - Confirm context ID spelling
   - Check file permissions
   - Verify storage directory exists

3. **Performance**
   - Manage context file sizes
   - Regular cleanup of old contexts
   - Optimize tag usage
