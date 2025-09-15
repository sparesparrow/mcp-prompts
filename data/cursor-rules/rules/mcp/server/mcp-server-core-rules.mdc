---
description: Core rules for MCP server implementation and lifecycle management
globs: ["src/**/server/**/*.{ts,js,tsx,jsx}"]
---

# MCP Server Core Implementation Rules

## Server Class Structure

1. Server implementation MUST extend or implement core MCP interfaces:

```typescript
import { Server } from "@modelcontextprotocol/sdk/server";

class CustomServer extends Server {
  constructor(
    serverInfo: Implementation,
    options: ServerOptions
  ) {
    super(serverInfo, options);
  }
}
```

2. All servers MUST implement proper initialization:

```typescript
const server = new Server(
  {
    name: "example-server",
    version: "1.0.0"
  },
  {
    capabilities: {
      // Declare supported capabilities
      resources: { subscribe: true },
      tools: { listChanged: true },
      prompts: {}
    }
  }
);
```

## Lifecycle Management

1. Server startup MUST follow this sequence:
```typescript
async function startServer() {
  // 1. Initialize core components
  await initializeComponents();

  // 2. Set up request handlers
  server.setRequestHandler(ListResourcesRequestSchema, handleListResources);
  server.setRequestHandler(ListToolsRequestSchema, handleListTools);

  // 3. Connect transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // 4. Log successful startup
  logger.info("Server started successfully");
}
```

2. Shutdown MUST be handled gracefully:
```typescript
async function shutdownServer() {
  // 1. Stop accepting new requests
  await server.stopAcceptingRequests();

  // 2. Wait for pending requests to complete
  await server.waitForPendingRequests();

  // 3. Clean up resources
  await cleanup();

  // 4. Disconnect transport
  await server.disconnect();
}
```

## Request Handling

1. All request handlers MUST follow this pattern:
```typescript
const handleRequest = async (request: Request): Promise<Result> => {
  try {
    // 1. Validate request
    validateRequest(request);

    // 2. Process request
    const result = await processRequest(request);

    // 3. Validate result
    validateResult(result);

    return result;
  } catch (error) {
    // Handle errors appropriately
    return handleError(error);
  }
};
```

2. Progress reporting MUST be implemented when available:
```typescript
const handleLongRequest = async (
  request: Request,
  progress: ProgressToken
): Promise<Result> => {
  let completed = 0;
  const total = calculateTotal(request);

  // Report progress periodically
  const reportProgress = async () => {
    await server.sendProgress(progress, completed, total);
  };

  // Process with progress updates
  while (completed < total) {
    await processChunk();
    completed++;
    await reportProgress();
  }

  return result;
};
```

## Error Handling

1. Errors MUST be categorized and handled appropriately:
```typescript
const handleError = (error: unknown): Result => {
  if (error instanceof ValidationError) {
    return {
      isError: true,
      content: [{
        type: "text",
        text: `Invalid request: ${error.message}`
      }]
    };
  }

  if (error instanceof ProcessingError) {
    return {
      isError: true,
      content: [{
        type: "text",
        text: `Processing failed: ${error.message}`
      }]
    };
  }

  // Log unexpected errors but don't expose details
  logger.error("Unexpected error:", error);
  return {
    isError: true,
    content: [{
      type: "text",
      text: "An internal error occurred"
    }]
  };
};
```

## Logging

1. Server MUST implement proper logging:
```typescript
const logger = {
  debug: (msg: string, ...args: any[]) => {
    server.sendLogMessage("debug", msg, ...args);
  },
  info: (msg: string, ...args: any[]) => {
    server.sendLogMessage("info", msg, ...args);
  },
  warn: (msg: string, ...args: any[]) => {
    server.sendLogMessage("warning", msg, ...args);
  },
  error: (msg: string, ...args: any[]) => {
    server.sendLogMessage("error", msg, ...args);
  }
};
```

## Connection Management

1. Server MUST handle connection state:
```typescript
class ConnectionManager {
  private connected = false;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 3;

  async handleDisconnect() {
    this.connected = false;
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      await this.attemptReconnect();
    } else {
      await this.handlePermanentDisconnect();
    }
  }

  private async attemptReconnect() {
    try {
      await this.transport.reconnect();
      this.connected = true;
      this.reconnectAttempts = 0;
    } catch (error) {
      this.reconnectAttempts++;
      throw error;
    }
  }
}
```

## Testing Requirements

1. Core server functionality MUST be tested:
```typescript
describe('Server Core', () => {
  it('initializes with correct capabilities', () => {
    const server = new Server({ ... });
    expect(server.capabilities).toEqual({ ... });
  });

  it('handles requests properly', async () => {
    const result = await server.handleRequest({ ... });
    expect(result).toEqual({ ... });
  });

  it('manages lifecycle correctly', async () => {
    await server.start();
    expect(server.isRunning()).toBe(true);
    await server.stop();
    expect(server.isRunning()).toBe(false);
  });
});
```

## Documentation Requirements

1. All server implementations MUST include:
- API documentation
- Capability documentation
- Example usage
- Error handling documentation
- Performance characteristics

Example:
```typescript
/**
 * Example Server Implementation
 * 
 * This server provides basic MCP capabilities including:
 * - Resource management
 * - Tool execution
 * - Prompt templates
 *
 * @example
 * ```typescript
 * const server = new ExampleServer({
 *   name: "example",
 *   version: "1.0.0"
 * });
 * 
 * await server.start();
 * ```
 *
 * @see {@link https://modelcontextprotocol.io} for protocol details
 */
```