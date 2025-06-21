-- Initialize PostgreSQL for MCP Prompts
-- This script sets up the database schema for MCP Prompts

-- Create schema
CREATE SCHEMA IF NOT EXISTS mcp_prompts;

-- Create prompts table
CREATE TABLE IF NOT EXISTS mcp_prompts.prompts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    content TEXT NOT NULL,
    is_template BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create tags table
CREATE TABLE IF NOT EXISTS mcp_prompts.tags (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
);

-- Create prompt_tags join table
CREATE TABLE IF NOT EXISTS mcp_prompts.prompt_tags (
    prompt_id INTEGER REFERENCES mcp_prompts.prompts(id) ON DELETE CASCADE,
    tag_id INTEGER REFERENCES mcp_prompts.tags(id) ON DELETE CASCADE,
    PRIMARY KEY (prompt_id, tag_id)
);

-- Create template_variables table
CREATE TABLE IF NOT EXISTS mcp_prompts.template_variables (
    id SERIAL PRIMARY KEY,
    prompt_id INTEGER REFERENCES mcp_prompts.prompts(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    default_value TEXT,
    UNIQUE(prompt_id, name)
);

-- Create workflow_executions table for workflow state persistence
CREATE TABLE IF NOT EXISTS mcp_prompts.workflow_executions (
    id TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL,
    status TEXT NOT NULL,
    context JSONB DEFAULT '{}'::jsonb,
    current_step_id TEXT,
    history JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create views
CREATE OR REPLACE VIEW mcp_prompts.prompts_with_tags AS
    SELECT 
        p.id,
        p.name,
        p.description,
        p.content,
        p.is_template,
        p.metadata,
        p.created_at,
        p.updated_at,
        COALESCE(
            json_agg(t.name) FILTER (WHERE t.name IS NOT NULL),
            '[]'::json
        ) as tags
    FROM 
        mcp_prompts.prompts p
    LEFT JOIN 
        mcp_prompts.prompt_tags pt ON p.id = pt.prompt_id
    LEFT JOIN 
        mcp_prompts.tags t ON pt.tag_id = t.id
    GROUP BY 
        p.id;

-- Create functions for updating timestamps
CREATE OR REPLACE FUNCTION mcp_prompts.update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER update_prompts_timestamp
BEFORE UPDATE ON mcp_prompts.prompts
FOR EACH ROW
EXECUTE FUNCTION mcp_prompts.update_timestamp();

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_prompts_name ON mcp_prompts.prompts(name);
CREATE INDEX IF NOT EXISTS idx_prompts_is_template ON mcp_prompts.prompts(is_template);
CREATE INDEX IF NOT EXISTS idx_tags_name ON mcp_prompts.tags(name);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_id ON mcp_prompts.workflow_executions(workflow_id);

-- Create a search function
CREATE OR REPLACE FUNCTION mcp_prompts.search_prompts(search_text TEXT)
RETURNS TABLE (
    id INTEGER,
    name VARCHAR(255),
    description TEXT,
    content TEXT,
    is_template BOOLEAN,
    tags JSON
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.name,
        p.description,
        p.content,
        p.is_template,
        COALESCE(
            json_agg(t.name) FILTER (WHERE t.name IS NOT NULL),
            '[]'::json
        ) as tags
    FROM 
        mcp_prompts.prompts p
    LEFT JOIN 
        mcp_prompts.prompt_tags pt ON p.id = pt.prompt_id
    LEFT JOIN 
        mcp_prompts.tags t ON pt.tag_id = t.id
    WHERE 
        p.name ILIKE '%' || search_text || '%' OR
        p.description ILIKE '%' || search_text || '%' OR
        p.content ILIKE '%' || search_text || '%'
    GROUP BY 
        p.id
    ORDER BY 
        p.name;
END;
$$ LANGUAGE plpgsql; 