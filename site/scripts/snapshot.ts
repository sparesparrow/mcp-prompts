// Writes src/data/snapshot.json: the library in ../data/prompts as the server would load it.
// The page uses it when it cannot read the live library from GitHub Pages (opened from a file,
// or as a preview elsewhere). Run by `pnpm run build`; commit the result with the page.

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPrompts, parseProfiles } from '../src/lib/library.ts';
import type { Snapshot } from '../src/lib/load.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..');
const libraryDir = path.join(repo, 'data', 'prompts');
const PREVIEW_CHARS = 600;

// Every file, as the server's loader walks them: hidden entries are left out here, and
// buildPrompts applies the rest of its rules (index.json, profiles.json, load order).
function walk(dir: string, prefix = ''): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...walk(path.join(dir, entry.name), relative));
    else if (entry.isFile()) out.push(relative);
  }
  return out;
}

const files = walk(libraryDir)
  .filter(file => file.endsWith('.json'))
  .map(file => {
    let data: unknown;
    try {
      data = JSON.parse(fs.readFileSync(path.join(libraryDir, file), 'utf8'));
    } catch {
      data = undefined;
    }
    return { path: file, data };
  });

const { prompts, skipped } = buildPrompts(files);
const profilesFile = path.join(libraryDir, 'profiles.json');
const profiles = fs.existsSync(profilesFile) ? parseProfiles(JSON.parse(fs.readFileSync(profilesFile, 'utf8'))) : [];
const version = JSON.parse(fs.readFileSync(path.join(repo, 'package.json'), 'utf8')).version as string;

const snapshot: Snapshot = {
  version,
  prompts: prompts.map(prompt => ({
    ...prompt,
    content: prompt.content && prompt.content.length > PREVIEW_CHARS ? `${prompt.content.slice(0, PREVIEW_CHARS)}…` : prompt.content,
  })),
  profiles,
  skipped,
};

const out = path.join(here, '..', 'src', 'data', 'snapshot.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, `${JSON.stringify(snapshot, null, 1)}\n`);
console.log(`snapshot: ${prompts.length} prompts, ${profiles.length} profiles, ${skipped.length} skipped, version ${version} -> ${path.relative(process.cwd(), out)}`);
for (const file of skipped) console.log(`  skipped ${file.path}: ${file.reason}`);
