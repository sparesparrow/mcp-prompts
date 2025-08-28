# MCP Prompts Server Application Rules

## 🎯 **Účel & Role**

### **Hexagonální architektura**
- **Primary/Driving Adapter** - MCP server pro externí komunikaci
- **Composition Root** - propojuje všechny porty a adaptéry
- **Transport Layer** - stdio, HTTP, SSE pro MCP protokol
- **Dependency Injection** - konfiguruje a propojuje všechny komponenty

### **MCP Server Role**
- **Model Context Protocol** implementace
- **Tools & Resources** registrace
- **Transport management** (stdio, HTTP, SSE)
- **Health checks** a monitoring

## 📁 **Struktura modulů**

```
src/
├── server/            # MCP server implementace
│   ├── mcp.server.ts # Hlavní MCP server
│   ├── tools/        # MCP tools implementace
│   │   ├── prompt.tools.ts
│   │   └── template.tools.ts
│   ├── resources/    # MCP resources
│   │   └── prompt.resources.ts
│   └── transport/    # Transport vrstvy
│       ├── stdio.transport.ts
│       ├── http.transport.ts
│       └── sse.transport.ts
├── composition/       # Dependency injection
│   ├── container.ts  # DI container
│   ├── factories.ts  # Factory funkce
│   └── bindings.ts   # Service bindings
├── config/           # Konfigurace
│   ├── server.config.ts
│   ├── mcp.config.ts
│   └── transport.config.ts
├── health/           # Health checks
│   ├── health.service.ts
│   └── health.endpoints.ts
├── middleware/       # HTTP middleware
│   ├── cors.middleware.ts
│   ├── logging.middleware.ts
│   └── error.middleware.ts
└── index.ts          # Entry point
```

## 🔧 **MCP SDK Integration**

### **Server setup**
```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { HttpServerTransport } from "@modelcontextprotocol/sdk/server/http.js";

export class MCPServer {
  private server: McpServer;
  
  constructor() {
    this.server = new McpServer({
      name: "mcp-prompts",
      version: "3.0.0"
    }, {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {}
      }
    });
  }

  async start(transport: 'stdio' | 'http' | 'sse') {
    switch (transport) {
      case 'stdio':
        await this.server.connect(new StdioServerTransport());
        break;
      case 'http':
        await this.server.connect(new HttpServerTransport({
          port: 3003,
          host: '0.0.0.0'
        }));
        break;
    }
  }
}
```

### **Tool registration**
```typescript
// src/server/tools/prompt.tools.ts
export function registerPromptTools(server: McpServer, promptService: IPromptApplication) {
  server.tool(
    "mcp-prompts/createPrompt",
    {
      title: "Create Prompt",
      description: "Create a new prompt with template support",
      inputSchema: z.object({
        name: z.string(),
        content: z.string(),
        isTemplate: z.boolean().optional(),
        variables: z.array(z.string()).optional()
      })
    },
    async ({ name, content, isTemplate, variables }) => {
      try {
        const prompt = await promptService.createPrompt({
          name,
          content,
          isTemplate: isTemplate ?? false,
          variables: variables ?? []
        });
        
        return {
          content: [{
            type: "text",
            text: `Prompt created successfully: ${prompt.id}`
          }]
        };
      } catch (error) {
        throw new Error(`Failed to create prompt: ${error.message}`);
      }
    }
  );
}
```

### **Resource registration**
```typescript
// src/server/resources/prompt.resources.ts
export function registerPromptResources(server: McpServer, promptService: IPromptApplication) {
  server.resource(
    "mcp-prompts/prompts",
    "prompt://{id}",
    async (uri: URL) => {
      const id = uri.pathname.split('/').pop();
      if (!id) {
        throw new Error('Invalid prompt ID');
      }
      
      const prompt = await promptService.getPrompt(id);
      if (!prompt) {
        throw new Error(`Prompt with ID '${id}' not found`);
      }
      
      return {
        contents: [{
          uri: uri.toString(),
          text: JSON.stringify(prompt, null, 2)
        }]
      };
    }
  );
}
```

## 🚀 **Transport Configuration**

### **Transport selection**
```typescript
// src/server/transport/transport.factory.ts
export class TransportFactory {
  static createTransport(type: TransportType, config: TransportConfig) {
    switch (type) {
      case 'stdio':
        return new StdioServerTransport();
      case 'http':
        return new HttpServerTransport({
          port: config.port ?? 3003,
          host: config.host ?? '0.0.0.0'
        });
      case 'sse':
        return new HttpServerTransport({
          port: config.port ?? 3003,
          host: config.host ?? '0.0.0.0',
          enableSSE: true
        });
      default:
        throw new Error(`Unsupported transport type: ${type}`);
    }
  }
}
```

### **Environment configuration**
```typescript
// src/config/transport.config.ts
export const transportConfig = {
  type: process.env.MCP_TRANSPORT || 'stdio',
  http: {
    port: parseInt(process.env.MCP_HTTP_PORT || '3003'),
    host: process.env.MCP_HTTP_HOST || '0.0.0.0',
    enableSSE: process.env.MCP_ENABLE_SSE === 'true'
  },
  stdio: {
    enableLogging: process.env.MCP_STDIO_LOGGING === 'true'
  }
} as const;
```

## 🧪 **Testing Strategy**

### **Test framework**
- **Vitest** pro unit testy
- **Playwright** pro e2e testy
- **MCP Inspector** pro protocol testing
- **Integration tests** s real adaptéry

### **Test struktura**
```
tests/
├── unit/
│   ├── server/
│   ├── tools/
│   └── resources/
├── integration/
│   ├── mcp.protocol.test.ts
│   └── transport.test.ts
├── e2e/
│   └── mcp.inspector.test.ts
└── fixtures/
    ├── prompts.fixture.ts
    └── mcp.requests.fixture.ts
```

### **MCP Inspector testing**
```typescript
// tests/e2e/mcp.inspector.test.ts
import { test, expect } from '@playwright/test';

test('MCP Server responds to tools/list', async ({ page }) => {
  // Start MCP server
  const server = await startMCPServer();
  
  // Test with MCP Inspector
  await page.goto('http://localhost:6274');
  
  // Verify tools are registered
  const toolsList = await page.locator('[data-testid="tools-list"]');
  await expect(toolsList).toContainText('mcp-prompts/createPrompt');
});
```

## 📦 **Dependency Injection**

### **Container setup**
```typescript
// src/composition/container.ts
import { container } from 'tsyringe';
import { PromptService } from '@sparesparrow/mcp-prompts-core';
import { FilePromptRepository } from '@sparesparrow/mcp-prompts-adapters-file';
import { HandlebarsTemplatingEngine } from '@sparesparrow/mcp-prompts-core';

export function setupContainer() {
  // Register core services
  container.register('IPromptRepository', {
    useClass: FilePromptRepository
  });
  
  container.register('ITemplatingEngine', {
    useClass: HandlebarsTemplatingEngine
  });
  
  container.register('IPromptApplication', {
    useClass: PromptService
  });
}
```

### **Service resolution**
```typescript
// src/server/mcp.server.ts
export class MCPServer {
  constructor() {
    const promptService = container.resolve<IPromptApplication>('IPromptApplication');
    
    // Register tools and resources
    registerPromptTools(this.server, promptService);
    registerPromptResources(this.server, promptService);
  }
}
```

## 🚫 **Co NEDĚLAT**

- ❌ Implementovat business logiku (použij core)
- ❌ Hardcodovat transport konfiguraci
- ❌ Ignorovat error handling
- ❌ Používat console.log (použij Pino)
- ❌ Míchat transport concerns s business logic

## ✅ **Co DĚLAT**

- ✅ Používat MCP SDK pro všechny operace
- ✅ Implementovat robustní error handling
- ✅ Používat dependency injection
- ✅ Logovat všechny operace
- ✅ Implementovat health checks
- ✅ Používat Zod pro validaci

## 📋 **Code Quality**

### **Error handling**
```typescript
export class MCPServerError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'MCPServerError';
  }
}

// Usage in tools
server.tool("mcp-prompts/createPrompt", {
  // ... schema
}, async (params) => {
  try {
    // Implementation
  } catch (error) {
    if (error instanceof DomainError) {
      throw new MCPServerError(
        error.message,
        'DOMAIN_ERROR',
        { details: error.details }
      );
    }
    throw new MCPServerError(
      'Internal server error',
      'INTERNAL_ERROR'
    );
  }
});
```

### **Logging**
```typescript
import { logger } from '@sparesparrow/mcp-prompts-core';

export class MCPServer {
  async start(transport: Transport) {
    logger.info('Starting MCP server', { transport: transport.type });
    
    try {
      await this.server.connect(transport);
      logger.info('MCP server started successfully');
    } catch (error) {
      logger.error('Failed to start MCP server', { error });
      throw error;
    }
  }
}
```

---

*Server aplikace implementuje MCP protokol a propojuje všechny komponenty.* 