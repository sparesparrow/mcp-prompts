#!/usr/bin/env node
// Copies the prompts of a directory into the Postgres database in DATABASE_URL, for one owner.
// Run it once after `pnpm run build`. An id the owner already has is left as it is, so running it
// again changes nothing. It prints counts only, never the connection string or a prompt.
//
//   DATABASE_URL=... node scripts/seed-postgres.mjs <prompts-dir> --owner <owner>
import { parseArgs } from 'node:util';
import * as path from 'node:path';

const USAGE = 'Usage: DATABASE_URL=... node scripts/seed-postgres.mjs <prompts-dir> --owner <owner>';

function refuse(message) {
  process.stderr.write(`seed-postgres: ${message}\n${USAGE}\n`);
  process.exit(2);
}

let parsed;
try {
  parsed = parseArgs({ options: { owner: { type: 'string' }, help: { type: 'boolean', short: 'h' } }, allowPositionals: true });
} catch (error) {
  refuse(error.message.split('. ')[0]);
}
const { values, positionals } = parsed;

if (values.help) {
  process.stdout.write(`${USAGE}\n\nCopies the prompts under <prompts-dir> (read recursively, as the library is) into the database\nin DATABASE_URL for <owner>, skipping ids the owner already has. Prints counts only.\n`);
  process.exit(0);
}
const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) refuse('the environment variable DATABASE_URL is not set');
const owner = values.owner?.trim();
if (!owner) refuse('--owner is required: the owner whose prompts these become');
if (positionals.length !== 1) refuse('give the prompts directory to import');

try {
  const { seedFromDirectory } = await import('../dist/storage/seed.js');
  const counts = await seedFromDirectory({ databaseUrl, ownerSub: owner, dir: path.resolve(positionals[0]) });
  process.stdout.write(`imported ${counts.imported}, skipped ${counts.skipped} (already there), rejected ${counts.rejected}\n`);
} catch (error) {
  // Messages of this package's own errors carry no connection details; anything else is named by its type only.
  const own = error instanceof Error && ['PromptStorageError', 'Error'].includes(error.constructor.name) && /^Could not /.test(error.message);
  process.stderr.write(`seed-postgres: ${own ? error.message : `failed (${error instanceof Error ? error.name : 'error'}); did you run pnpm run build?`}\n`);
  process.exit(1);
}
