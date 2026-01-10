-- Migration: Create table for agent execution records
-- Date: 2026-01-09
-- Purpose: Track agent execution history, performance metrics, and feedback

CREATE TABLE IF NOT EXISTS agent_execution_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id VARCHAR(255) NOT NULL,
  agent_type VARCHAR(50) NOT NULL CHECK (agent_type IN ('subagent', 'main_agent')),
  project_id VARCHAR(255),
  project_type VARCHAR(100),
  execution_started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  execution_completed_at TIMESTAMP,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'executing', 'succeeded', 'failed', 'timeout')),
  input_tokens INTEGER,
  output_tokens INTEGER,
  estimated_cost NUMERIC(10,4),
  result_summary TEXT,
  error_message TEXT,
  feedback JSONB,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for query performance
CREATE INDEX IF NOT EXISTS idx_execution_records_agent_id ON agent_execution_records(agent_id);
CREATE INDEX IF NOT EXISTS idx_execution_records_agent_type ON agent_execution_records(agent_type);
CREATE INDEX IF NOT EXISTS idx_execution_records_status ON agent_execution_records(status);
CREATE INDEX IF NOT EXISTS idx_execution_records_project_id ON agent_execution_records(project_id);
CREATE INDEX IF NOT EXISTS idx_execution_records_project_type ON agent_execution_records(project_type);
CREATE INDEX IF NOT EXISTS idx_execution_records_started_at ON agent_execution_records(execution_started_at);
CREATE INDEX IF NOT EXISTS idx_execution_records_completed_at ON agent_execution_records(execution_completed_at);

-- Add comments for documentation
COMMENT ON TABLE agent_execution_records IS 'Records of agent execution for analytics and feedback';
COMMENT ON COLUMN agent_execution_records.agent_id IS 'ID of the agent that was executed';
COMMENT ON COLUMN agent_execution_records.agent_type IS 'Type of agent: subagent or main_agent';
COMMENT ON COLUMN agent_execution_records.project_id IS 'Optional project identifier';
COMMENT ON COLUMN agent_execution_records.project_type IS 'Type of project (e.g., python_backend, cpp_backend)';
COMMENT ON COLUMN agent_execution_records.status IS 'Execution status: pending, executing, succeeded, failed, or timeout';
COMMENT ON COLUMN agent_execution_records.input_tokens IS 'Number of input tokens used';
COMMENT ON COLUMN agent_execution_records.output_tokens IS 'Number of output tokens generated';
COMMENT ON COLUMN agent_execution_records.estimated_cost IS 'Estimated cost in USD';
COMMENT ON COLUMN agent_execution_records.result_summary IS 'Summary of execution results';
COMMENT ON COLUMN agent_execution_records.error_message IS 'Error message if execution failed';
COMMENT ON COLUMN agent_execution_records.feedback IS 'JSON object with user feedback (rating, comments, improvements)';
COMMENT ON COLUMN agent_execution_records.metadata IS 'Additional metadata about execution';

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_agent_execution_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER trg_agent_execution_updated_at
  BEFORE UPDATE ON agent_execution_records
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_execution_updated_at();
