declare module '@modelcontextprotocol/sdk/server/mcp' {
  import { z } from 'zod';
  
  export class McpServer {
    constructor(options: { name: string; version: string }, capabilities?: any);
    connect(transport: any): Promise<void>;
    close(): Promise<void>;
    
    // Tool method signatures for SDK 1.7.0
    tool(name: string, cb: (extra: any) => any): void;
    tool(name: string, description: string, cb: (extra: any) => any): void;
    tool<T>(
      name: string, 
      description: string, 
      paramsSchema: z.ZodSchema<T>, 
      cb: (args: T, extra: any) => any
    ): void;
  }
}

declare module '@modelcontextprotocol/sdk/server/stdio' {
  export class StdioServerTransport {
    constructor();
  }
}

// Additional z export to satisfy TS
import { z } from 'zod';
export { z }; 