-- Migration: Add agent orchestration fields to prompts table
-- Date: 2026-01-09
-- Purpose: Support subagent registry, main agent templates, and project orchestration

-- Add new columns for agent orchestration
ALTER TABLE prompts
  ADD COLUMN IF NOT EXISTS prompt_type VARCHAR(50) DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS agent_model VARCHAR(50),
  ADD COLUMN IF NOT EXISTS agent_system_prompt TEXT,
  ADD COLUMN IF NOT EXISTS agent_tools JSONB,
  ADD COLUMN IF NOT EXISTS agent_mcp_servers JSONB,
  ADD COLUMN IF NOT EXISTS agent_subagents JSONB,
  ADD COLUMN IF NOT EXISTS agent_compatible_with JSONB,
  ADD COLUMN IF NOT EXISTS agent_source_url VARCHAR(500),
  ADD COLUMN IF NOT EXISTS agent_execution_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS agent_success_rate NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS agent_last_executed_at TIMESTAMP;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_prompts_prompt_type ON prompts(prompt_type);
CREATE INDEX IF NOT EXISTS idx_prompts_agent_model ON prompts(agent_model);
CREATE INDEX IF NOT EXISTS idx_prompts_category_type ON prompts(category, prompt_type);

-- Add check constraint for prompt_type
ALTER TABLE prompts
  ADD CONSTRAINT IF NOT EXISTS chk_prompt_type
  CHECK (prompt_type IN ('standard', 'subagent_registry', 'main_agent_template', 'project_orchestration_template'));

-- Add check constraint for agent_model
ALTER TABLE prompts
  ADD CONSTRAINT IF NOT EXISTS chk_agent_model
  CHECK (agent_model IS NULL OR agent_model IN ('claude-opus', 'claude-sonnet', 'claude-haiku'));

-- Add comments for documentation
COMMENT ON COLUMN prompts.prompt_type IS 'Type of prompt: standard, subagent_registry, main_agent_template, or project_orchestration_template';
COMMENT ON COLUMN prompts.agent_model IS 'Claude model to use for agent execution: opus, sonnet, or haiku';
COMMENT ON COLUMN prompts.agent_system_prompt IS 'Full system prompt for the agent';
COMMENT ON COLUMN prompts.agent_tools IS 'Array of tool names the agent can use';
COMMENT ON COLUMN prompts.agent_mcp_servers IS 'Array of MCP server names available to the agent';
COMMENT ON COLUMN prompts.agent_subagents IS 'Array of subagent IDs for main agent templates';
COMMENT ON COLUMN prompts.agent_compatible_with IS 'Array of project types this agent is compatible with';
COMMENT ON COLUMN prompts.agent_source_url IS 'Source repository URL for this agent definition';
COMMENT ON COLUMN prompts.agent_execution_count IS 'Number of times this agent has been executed';
COMMENT ON COLUMN prompts.agent_success_rate IS 'Success rate percentage (0-100)';
COMMENT ON COLUMN prompts.agent_last_executed_at IS 'Timestamp of last execution';
