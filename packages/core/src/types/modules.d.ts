// Patch for missing type declarations in external packages

declare module '@sparesparrow/mcp-prompts-contracts/dist/interfaces' {
  export * from '../../node_modules/@sparesparrow/mcp-prompts-contracts/dist/interfaces';
}
declare module '@sparesparrow/mcp-prompts-contracts/dist/schemas' {
  export * from '../../node_modules/@sparesparrow/mcp-prompts-contracts/dist/schemas';
}
declare module '@modelcontextprotocol/sdk/dist/esm/server' {
  export * from '../../node_modules/@modelcontextprotocol/sdk/dist/esm/server';
}
declare module '@modelcontextprotocol/sdk/dist/esm/server/sse' {
  export * from '../../node_modules/@modelcontextprotocol/sdk/dist/esm/server/sse';
}
declare module '@modelcontextprotocol/sdk/dist/esm/shared/transport' {
  export * from '../../node_modules/@modelcontextprotocol/sdk/dist/esm/shared/transport';
}

// Type patch for MCP SDK ESM import
// Allows TypeScript to resolve types for the ESM import with .js extension

declare module '@modelcontextprotocol/sdk/dist/esm/server/mcp.js' {
  import { McpServer } from '@modelcontextprotocol/sdk/dist/esm/server/mcp.d.ts';
  export { McpServer };
}

declare module '@modelcontextprotocol/sdk/dist/esm/server/index.js' {
  export * from '@modelcontextprotocol/sdk/dist/esm/server/index.d.ts';
}
declare module '@modelcontextprotocol/sdk/dist/esm/server/sse.js' {
  export * from '@modelcontextprotocol/sdk/dist/esm/server/sse.d.ts';
}
declare module '@modelcontextprotocol/sdk/dist/esm/shared/transport.js' {
  export * from '@modelcontextprotocol/sdk/dist/esm/shared/transport.d.ts';
}
declare module 'zlib/promises' {
  import { BrotliCompress, Deflate, Gzip } from 'zlib';
  export function gzip(buffer: Buffer | string): Promise<Buffer>;
  export function deflate(buffer: Buffer | string): Promise<Buffer>;
  export function brotliCompress(buffer: Buffer | string): Promise<Buffer>;
} 