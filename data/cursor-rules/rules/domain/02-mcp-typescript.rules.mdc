---
description: Standards for developing Model Context Protocol (MCP) servers and clients with TypeScript
globs: ["**/mcp/**/*.ts", "**/modelcontextprotocol/**/*.ts"]
priority: 25
dependencies: ["02-typescript.rules.md"]
---

# MCP TypeScript Development Standards

## Core Principles

### Protocol Compliance
- Implement MCP specification correctly
- Handle all required message types
- Maintain proper state management

### Client/Server Architecture
- Clear separation of concerns
- Proper transport abstraction
- Robust connection handling

### Message Handling
- Type-safe message processing
- Proper error propagation
- Efficient message routing

## Code Standards

### Server Implementation
```typescript
// Good: Proper MCP server implementation
class MCPServer implements Server {
  private clients: Map<string, Client> = new Map();
  
  async handleMessage(message: Message, client: Client): Promise<void> {
    try {
      switch (message.method) {
        case 'tools/list':
          return this.handleToolsList(message, client);
        case 'tools/call':
          return this.handleToolCall(message, client);
        default:
          throw new MCPError('method_not_found', `Unknown method: ${message.method}`);
      }
    } catch (error) {
      if (error instanceof MCPError) {
        await client.sendError(message.id, error);
      } else {
        await client.sendError(message.id, new MCPError('internal_error', 'Internal server error'));
      }
    }
  }
}

// Bad: Poor MCP implementation
class BadServer {
  handleMessage(msg: any) { // ❌ Untyped messages
    if (msg.type === 'tool') {
      this.handleTool(msg);
    }
  }
}
```

### Client Implementation
```typescript
// Good: Robust MCP client
class MCPClient {
  constructor(
    private transport: Transport,
    private config: ClientConfig
  ) {}

  async connect(): Promise<void> {
    await this.transport.connect();
    await this.sendHandshake();
    this.setupMessageHandling();
  }

  private async sendHandshake(): Promise<void> {
    const response = await this.transport.send({
      method: 'handshake',
      params: {
        name: this.config.name,
        version: this.config.version,
        capabilities: this.config.capabilities
      }
    });
    this.validateHandshakeResponse(response);
  }
}

// Bad: Unreliable client
class BadClient {
  connect() {
    this.socket.connect(); // ❌ No handshake
    this.socket.on('message', this.handle); // ❌ No error handling
  }
}
```

### Transport Layer
```typescript
// Good: Clean transport abstraction
interface Transport {
  connect(): Promise<void>;
  send(message: Message): Promise<Response>;
  onMessage(handler: MessageHandler): void;
  close(): Promise<void>;
}

class StdioTransport implements Transport {
  private process: ChildProcess;
  
  constructor(config: TransportConfig) {
    this.process = spawn(config.command, config.args, {
      env: config.env,
      stdio: ['pipe', 'pipe', 'pipe']
    });
  }
  
  async send(message: Message): Promise<Response> {
    return new Promise((resolve, reject) => {
      // Implementation with proper error handling
    });
  }
}

// Bad: Poor transport implementation
class BadTransport {
  send(msg: string) { // ❌ Untyped messages
    process.stdout.write(msg);
  }
}
```

## Validation Rules

```typescript
const MCPRules = {
  // Ensure proper message typing
  messageTyping: {
    pattern: /interface\s+Message|type\s+Message/,
    message: "Define proper message type interfaces"
  },
  
  // Validate error handling
  mcpErrorHandling: {
    pattern: /catch.*instanceof\s+MCPError/,
    message: "Implement MCP-specific error handling"
  },
  
  // Check transport implementation
  transportInterface: {
    pattern: /implements\s+Transport/,
    message: "Transport classes should implement Transport interface"
  }
};
```

## Configuration

### Transport Configuration
```typescript
interface TransportConfig {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  timeout?: number;
}

const defaultConfig: TransportConfig = {
  timeout: 30000,
  env: process.env
};
```

## Best Practices

1. Message Handling
   - Type all messages properly
   - Validate message format
   - Handle all message types

2. Connection Management
   - Implement proper reconnection
   - Handle connection timeouts
   - Clean up resources properly

3. Error Handling
   - Use MCP-specific errors
   - Proper error propagation
   - Meaningful error messages

## Security Considerations

1. Message Validation
   - Validate all incoming messages
   - Sanitize message content
   - Check message size limits

2. Connection Security
   - Implement proper authentication
   - Use secure transport when needed
   - Handle connection limits

3. Resource Protection
   - Implement rate limiting
   - Monitor resource usage
   - Handle DoS protection 