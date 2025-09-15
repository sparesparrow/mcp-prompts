---
description: Guidelines for implementing MCP server capabilities and feature flags
globs: ["src/**/capabilities/**/*.{ts,js,tsx,jsx}"]
---

# MCP Server Capabilities Implementation Rules

## Capability Declaration

1. Capabilities MUST be declared during server initialization:
```typescript
const server = new Server({
  name: "example-server",
  version: "1.0.0"
}, {
  capabilities: {
    resources: {
      subscribe: true,
      listChanged: true
    },
    prompts: {
      listChanged: true
    },
    tools: {
      listChanged: true
    },
    logging: {}
  }
});
```

2. Only declare capabilities that are fully implemented:
```typescript
// GOOD: Only declare supported features
const capabilities = {
  resources: {
    // Only declare subscribe if resource updates are implemented
    subscribe: hasSubscribeSupport(),
    // Only declare listChanged if resource list updates are tracked
    listChanged: hasListChangeSupport()
  }
};

// BAD: Don't declare unsupported features
const capabilities = {
  resources: {
    // Don't declare subscribe without implementation
    subscribe: true
  }
};
```

## Resource Capability

1. Resource capability implementation MUST:
```typescript
interface ResourceCapability {
  // Required methods
  async listResources(): Promise<Resource[]>;
  async readResource(uri: string): Promise<ResourceContent[]>;
  
  // Optional methods for subscribe support
  async subscribeResource?(uri: string): Promise<void>;
  async unsubscribeResource?(uri: string): Promise<void>;
  
  // Optional methods for listChanged support
  async notifyResourceListChanged?(): Promise<void>;
  async notifyResourceUpdated?(uri: string): Promise<void>;
}
```

2. Resource subscriptions MUST be tracked:
```typescript
class ResourceManager {
  private subscriptions = new Map<string, Set<string>>();

  async subscribe(uri: string, clientId: string): Promise<void> {
    const subs = this.subscriptions.get(uri) ?? new Set();
    subs.add(clientId);
    this.subscriptions.set(uri, subs);
  }

  async unsubscribe(uri: string, clientId: string): Promise<void> {
    const subs = this.subscriptions.get(uri);
    subs?.delete(clientId);
    if (subs?.size === 0) {
      this.subscriptions.delete(uri);
    }
  }
}
```

## Tool Capability

1. Tool capability implementation MUST:
```typescript
interface ToolCapability {
  // Required methods
  async listTools(): Promise<Tool[]>;
  async callTool(name: string, args: unknown): Promise<ToolResult>;
  
  // Optional methods for listChanged support
  async notifyToolListChanged?(): Promise<void>;
}
```

2. Tool registration MUST be validated:
```typescript
class ToolRegistry {
  private tools = new Map<string, Tool>();

  registerTool(tool: Tool): void {
    // Validate tool definition
    validateToolSchema(tool);
    
    // Check for naming conflicts
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool ${tool.name} already registered`);
    }
    
    this.tools.set(tool.name, tool);
  }
}
```

## Prompt Capability

1. Prompt capability implementation MUST:
```typescript
interface PromptCapability {
  // Required methods
  async listPrompts(): Promise<Prompt[]>;
  async getPrompt(name: string, args?: Record<string, string>): Promise<PromptResult>;
  
  // Optional methods for listChanged support
  async notifyPromptListChanged?(): Promise<void>;
}
```

2. Prompt templates MUST be validated:
```typescript
class PromptRegistry {
  validatePrompt(prompt: Prompt): void {
    // Validate prompt name
    if (!isValidPromptName(prompt.name)) {
      throw new Error(`Invalid prompt name: ${prompt.name}`);
    }
    
    // Validate arguments
    if (prompt.arguments) {
      for (const arg of prompt.arguments) {
        this.validateArgument(arg);
      }
    }
  }
}
```

## Logging Capability

1. Logging capability implementation MUST:
```typescript
interface LoggingCapability {
  async setLevel(level: LoggingLevel): Promise<void>;
  async log(level: LoggingLevel, message: string, data?: unknown): Promise<void>;
}
```

2. Log levels MUST be respected:
```typescript
class Logger {
  private currentLevel: LoggingLevel = "info";

  async log(level: LoggingLevel, message: string): Promise<void> {
    if (this.shouldLog(level)) {
      await this.server.sendLogMessage(level, message);
    }
  }

  private shouldLog(level: LoggingLevel): boolean {
    const levels: Record<LoggingLevel, number> = {
      debug: 0,
      info: 1,
      notice: 2,
      warning: 3,
      error: 4,
      critical: 5,
      alert: 6,
      emergency: 7
    };
    
    return levels[level] >= levels[this.currentLevel];
  }
}
```

## Experimental Capabilities

1. Experimental capabilities MUST be clearly marked:
```typescript
const capabilities = {
  experimental: {
    myFeature: {
      enabled: true,
      warning: "This feature is experimental and may change"
    }
  }
};
```

2. Experimental features MUST be documented:
```typescript
/**
 * Experimental Feature: Custom Resource Types
 * 
 * @experimental This feature is experimental and may change
 * 
 * Allows defining custom resource types with specialized
 * handling and validation.
 */
interface CustomResourceType {
  // Feature implementation
}
```

## Capability Testing

1. Each capability MUST be tested:
```typescript
describe('Server Capabilities', () => {
  describe('Resources', () => {
    it('lists resources correctly', async () => {
      const resources = await server.listResources();
      expect(resources).toMatchSchema(resourceListSchema);
    });

    it('handles subscriptions', async () => {
      await server.subscribe('test://resource');
      // Verify subscription tracking
    });
  });

  describe('Tools', () => {
    it('registers tools correctly', () => {
      server.registerTool(testTool);
      const tools = server.listTools();
      expect(tools).toContain(testTool);
    });
  });
});
```

## Capability Documentation

1. All capabilities MUST be documented:
```typescript
/**
 * Resource Capability Implementation
 * 
 * Supported features:
 * - Resource listing
 * - Resource reading
 * - Resource subscriptions
 * - List change notifications
 * 
 * @example
 * ```typescript
 * const resources = await server.listResources();
 * const content = await server.readResource("example://resource");
 * ```
 */
```

2. Capability limitations MUST be documented:
```typescript
/**
 * Tool Capability Implementation
 * 
 * Limitations:
 * - Maximum argument count: 10
 * - Maximum execution time: 30 seconds
 * - Network access: Restricted to allowlisted domains
 * 
 * @example
 * ```typescript
 * const result = await server.callTool("example", { arg: "value" });
 * ```
 */
```