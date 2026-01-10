-- Migration tracking table
-- This table keeps track of which migrations have been applied

CREATE TABLE IF NOT EXISTS migration_history (
  id SERIAL PRIMARY KEY,
  migration_name VARCHAR(255) NOT NULL UNIQUE,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  description TEXT,
  checksum VARCHAR(64)
);

-- Create index on migration name
CREATE INDEX IF NOT EXISTS idx_migration_history_name ON migration_history(migration_name);

-- Add comment
COMMENT ON TABLE migration_history IS 'Tracks which database migrations have been applied';

-- Insert initial migration
INSERT INTO migration_history (migration_name, description)
VALUES ('000_migration_tracking', 'Initial migration tracking table')
ON CONFLICT (migration_name) DO NOTHING;
