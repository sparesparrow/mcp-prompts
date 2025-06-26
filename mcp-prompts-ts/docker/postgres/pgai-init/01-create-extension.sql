-- Initialize PGAI for MCP Prompts
-- This script sets up the PGAI extension and creates necessary tables

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgai;

-- Create schema for MCP prompts
CREATE SCHEMA IF NOT EXISTS mcp_prompts;

-- Create tables for storing prompts with vector embeddings
CREATE TABLE IF NOT EXISTS mcp_prompts.prompts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    content TEXT NOT NULL,
    is_template BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    embedding vector(1536)
);

-- Create a function to update the embedding when a prompt is inserted or updated
CREATE OR REPLACE FUNCTION mcp_prompts.update_prompt_embedding()
RETURNS TRIGGER AS $$
BEGIN
    -- Generate embedding for combined name, description and content
    NEW.embedding = pgai.embed_text(
        COALESCE(NEW.name, '') || ' ' || 
        COALESCE(NEW.description, '') || ' ' || 
        COALESCE(NEW.content, '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update embeddings
DROP TRIGGER IF EXISTS update_prompt_embedding ON mcp_prompts.prompts;
CREATE TRIGGER update_prompt_embedding
BEFORE INSERT OR UPDATE ON mcp_prompts.prompts
FOR EACH ROW
EXECUTE FUNCTION mcp_prompts.update_prompt_embedding();

-- Create a search function using PGAI
CREATE OR REPLACE FUNCTION mcp_prompts.search_prompts(query_text TEXT, limit_results INT DEFAULT 10)
RETURNS TABLE (
    id INT,
    name VARCHAR(255),
    description TEXT,
    content TEXT,
    is_template BOOLEAN,
    similarity FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        p.name,
        p.description,
        p.content,
        p.is_template,
        1 - (p.embedding <=> pgai.embed_text(query_text)) AS similarity
    FROM
        mcp_prompts.prompts p
    ORDER BY
        p.embedding <=> pgai.embed_text(query_text)
    LIMIT limit_results;
END;
$$ LANGUAGE plpgsql; 