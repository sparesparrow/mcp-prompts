// Prompt entity for MCP
export interface Prompt {
  id: string; // UUID v7
  name: string;
  content: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}
