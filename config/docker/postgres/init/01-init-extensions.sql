-- Enable required extensions for PGAI
CREATE EXTENSION IF NOT EXISTS vector;

-- Note: In a real environment, you would need to install the PGAI extension
-- This is a placeholder for the actual PGAI extension installation
-- CREATE EXTENSION IF NOT EXISTS pgai;

-- Create schema for MCP prompts
CREATE SCHEMA IF NOT EXISTS mcp_prompts;

-- Grant privileges
GRANT ALL PRIVILEGES ON SCHEMA mcp_prompts TO postgres;

-- Create prompts table with vector support
CREATE TABLE IF NOT EXISTS mcp_prompts.prompts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    content TEXT NOT NULL,
    tags TEXT[],
    is_template BOOLEAN DEFAULT FALSE,
    variables TEXT[],
    complexity INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    embedding VECTOR(1536)
);

-- Create index on tags for faster filtering
CREATE INDEX IF NOT EXISTS idx_prompts_tags ON mcp_prompts.prompts USING GIN (tags);

-- Create index on embedding for vector similarity search
CREATE INDEX IF NOT EXISTS idx_prompts_embedding ON mcp_prompts.prompts USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION mcp_prompts.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update the updated_at timestamp
CREATE TRIGGER update_prompts_updated_at
BEFORE UPDATE ON mcp_prompts.prompts
FOR EACH ROW
EXECUTE FUNCTION mcp_prompts.update_updated_at(); 