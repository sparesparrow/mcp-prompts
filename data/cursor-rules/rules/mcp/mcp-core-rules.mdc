---
description: Guidelines for implementing core MCP functionality in Podman Desktop extensions
globs: ["src/mcp/**/*.ts"]
---

# MCP Core Implementation Rules

## Resource Implementation

### Resource URI Structure
```typescript
// Define resource URIs clearly and consistently
interface ResourceDefinition {
  uri: string;           // e.g., "podman://containers/list"
  name: string;          // Human-readable name
  description?: string;  // Optional description
  mimeType?: string;     // Optional MIME type
}

// Example implementation
class PodmanResources {
  async listResources(): Promise<ResourceDefinition[]> {
    return [
      {
        uri: "podman://containers/list",
        name: "Container List",
        description: "List of all Podman containers",
        mimeType: "application/json"
      },
      {
        uri: "podman://images/list",
        name: "Image List",
        description: "List of all Podman images",
        mimeType: "application/json"
      }
    ];
  }
}
```

### Resource Content Handling
```typescript
interface ResourceContent {
  uri: string;
  mimeType?: string;
  text?: string;    // For text resources
  blob?: string;    // For binary resources (base64)
}

class ResourceHandler {
  async readResource(uri: string): Promise<ResourceContent[]> {
    try {
      if (uri.startsWith("podman://containers/")) {
        const containers = await this.podmanClient.listContainers();
        return [{
          uri,
          mimeType: "application/json",
          text: JSON.stringify(containers, null, 2)
        }];
      }
      throw new Error(`Unsupported resource URI: ${uri}`);
    } catch (error) {
      throw new Error(`Failed to read resource: ${error.message}`);
    }
  }
}
```

## Tool Implementation

### Tool Definition
```typescript
interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
  };
}

class PodmanTools {
  getToolDefinitions(): ToolDefinition[] {
    return [
      {
        name: "start-container",
        description: "Start a Podman container",
        inputSchema: {
          type: "object",
          properties: {
            containerId: {
              type: "string",
              description: "Container ID or name"
            }
          },
          required: ["containerId"]
        }
      }
    ];
  }
}
```

### Tool Execution
```typescript
class ToolExecutor {
  async executeTool(name: string, args: unknown): Promise<{
    content: Array<{ type: "text"; text: string }>;
  }> {
    try {
      switch (name) {
        case "start-container": {
          const { containerId } = args as { containerId: string };
          await this.podmanClient.startContainer(containerId);
          return {
            content: [{
              type: "text",
              text: `Container ${containerId} started successfully`
            }]
          };
        }
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error: ${error.message}`
        }]
      };
    }
  }
}
```

## Prompt Implementation

### Prompt Definition
```typescript
interface PromptDefinition {
  name: string;
  description: string;
  arguments?: Array<{
    name: string;
    description: string;
    required?: boolean;
  }>;
}

class PodmanPrompts {
  getPromptDefinitions(): PromptDefinition[] {
    return [
      {
        name: "analyze-container",
        description: "Analyze container resource usage",
        arguments: [
          {
            name: "containerId",
            description: "Container ID or name",
            required: true
          },
          {
            name: "timeframe",
            description: "Analysis timeframe in minutes",
            required: false
          }
        ]
      }
    ];
  }
}
```

### Prompt Generation
```typescript
class PromptGenerator {
  async generatePrompt(name: string, args: Record<string, unknown>): Promise<{
    messages: Array<{
      role: "user" | "assistant";
      content: { type: "text"; text: string };
    }>;
  }> {
    if (name === "analyze-container") {
      const { containerId, timeframe = 5 } = args;
      const stats = await this.podmanClient.getContainerStats(containerId);
      
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Analyze these container stats for ${containerId} over the last ${timeframe} minutes:\n\n${JSON.stringify(stats, null, 2)}`
            }
          }
        ]
      };
    }
    throw new Error(`Unknown prompt: ${name}`);
  }
}
```

## Transport Implementation

### Stdio Transport
```typescript
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

class PodmanTransport {
  async createStdioTransport(serverPath: string): Promise<StdioClientTransport> {
    const transport = new StdioClientTransport({
      command: "node",
      args: [serverPath]
    });

    transport.onerror = (error) => {
      console.error("Transport error:", error);
    };

    transport.onclose = () => {
      console.log("Transport closed");
    };

    return transport;
  }
}
```

### SSE Transport
```typescript
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

class SSETransportManager {
  async createSSETransport(serverUrl: string): Promise<SSEClientTransport> {
    const transport = new SSEClientTransport(
      new URL(serverUrl)
    );

    // Add error handling
    transport.onerror = async (error) => {
      await podmanDesktopAPI.window.showErrorMessage(
        `Transport error: ${error.message}`
      );
    };

    return transport;
  }
}
```

## Integration with Podman Desktop

### Extension Activation
```typescript
export async function activate(context: podmanDesktopAPI.ExtensionContext): Promise<void> {
  // Initialize MCP components
  const resources = new PodmanResources();
  const tools = new PodmanTools();
  const prompts = new PodmanPrompts();
  
  // Create MCP client
  const client = new Client(
    {
      name: "podman-desktop-mcp",
      version: "1.0.0"
    },
    {
      capabilities: {
        resources: {},
        tools: {},
        prompts: {}
      }
    }
  );

  // Register handlers
  client.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: await resources.listResources()
  }));

  client.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.getToolDefinitions()
  }));

  client.setRequestHandler(ListPromptsRequestSchema, async () => ({
    prompts: prompts.getPromptDefinitions()
  }));

  // Store in context
  context.subscriptions.push(client);
}
```

## Best Practices

### Error Handling
```typescript
// DO
try {
  await operation();
} catch (error) {
  await podmanDesktopAPI.window.showErrorMessage(
    `Operation failed: ${error.message}`
  );
  console.error('Detailed error:', error);
}

// DON'T
try {
  await operation();
} catch {
  console.log('Error occurred');
}
```

### Resource Management
```typescript
// DO
class ResourceManager {
  private subscriptions = new Set<() => void>();

  async subscribe(uri: string, callback: () => void): Promise<void> {
    this.subscriptions.add(callback);
  }

  async cleanup(): Promise<void> {
    this.subscriptions.clear();
  }
}

// DON'T
let callbacks: Array<() => void> = [];
function subscribe(callback: () => void) {
  callbacks.push(callback);
}
```

### Security
```typescript
// DO
function validateResourceUri(uri: string): boolean {
  const allowedSchemes = ['podman:', 'file:'];
  try {
    const url = new URL(uri);
    return allowedSchemes.includes(url.protocol);
  } catch {
    return false;
  }
}

// DON'T
function readResource(uri: string) {
  // Directly use uri without validation
}
```

## Testing

### Unit Tests
```typescript
describe('PodmanResources', () => {
  let resources: PodmanResources;

  beforeEach(() => {
    resources = new PodmanResources();
  });

  test('lists available resources', async () => {
    const result = await resources.listResources();
    expect(result).toContainEqual(expect.objectContaining({
      uri: 'podman://containers/list'
    }));
  });
});
```

### Integration Tests
```typescript
describe('MCP Client Integration', () => {
  test('connects to server and lists tools', async () => {
    const client = new Client({/* config */});
    await client.connect(transport);
    
    const response = await client.request(
      { method: 'tools/list' },
      ListToolsResultSchema
    );
    
    expect(response.tools).toBeDefined();
  });
});
```

## Performance Considerations

### Caching
```typescript
class ResourceCache {
  private cache = new Map<string, {
    content: ResourceContent[];
    timestamp: number;
  }>();
  
  async getResource(uri: string): Promise<ResourceContent[]> {
    const cached = this.cache.get(uri);
    if (cached && Date.now() - cached.timestamp < 5000) {
      return cached.content;
    }
    
    const content = await this.fetchResource(uri);
    this.cache.set(uri, {
      content,
      timestamp: Date.now()
    });
    return content;
  }
}
```

### Resource Cleanup
```typescript
export async function deactivate(): Promise<void> {
  await Promise.all([
    resourceManager.cleanup(),
    toolExecutor.cleanup(),
    client.disconnect()
  ]);
}
```
