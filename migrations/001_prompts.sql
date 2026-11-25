-- Saved prompts, one owner at a time. Every row carries the owner it belongs to, and the primary
-- keys start with it, so two owners can use the same prompt id and one never reaches the other's.
-- Written to be run more than once; the migration runner also records what it has applied.

-- A saved prompt (a new one, or an edited copy of a library prompt). body is the whole prompt as
-- JSON; version is the prompt's version as text, which an update has to name to replace it.
CREATE TABLE IF NOT EXISTS prompts (
  owner_sub  text        NOT NULL,
  id         text        NOT NULL,
  body       jsonb       NOT NULL,
  version    text        NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_sub, id)
);

-- Library prompts this owner deleted: they stay deleted for this owner.
CREATE TABLE IF NOT EXISTS tombstones (
  owner_sub text NOT NULL,
  id        text NOT NULL,
  PRIMARY KEY (owner_sub, id)
);

-- Goes up with every change an owner makes, in the same transaction as the change. A server that
-- sees a new number reads the owner's prompts again. The row also serialises one owner's writes.
CREATE TABLE IF NOT EXISTS revisions (
  owner_sub text   PRIMARY KEY,
  rev       bigint NOT NULL DEFAULT 0
);
