// Checks the page against the real server, so what the page shows is what an install does:
//   - for each case, the prompts the page says are served equal `mcp-prompts catalog --json`
//     (same ids, same order);
//   - formatInstallSnippets equals `mcp-prompts config` byte for byte.
// Needs the server built: run `pnpm run build` in the repository root first.

import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SELECT_ALL, servedPrompts, type Selection } from '../src/lib/library.ts';
import { formatInstallSnippets, optionArgs, type InstallOptions } from '../src/lib/install.ts';
import type { Snapshot } from '../src/lib/load.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..');
const cli = path.join(repo, 'dist', 'mcp-server-standalone.js');
if (!fs.existsSync(cli)) {
  console.error(`verify: ${path.relative(process.cwd(), cli)} is missing; run "pnpm run build" in the repository root first`);
  process.exit(1);
}
const snapshot = JSON.parse(fs.readFileSync(path.join(here, '..', 'src', 'data', 'snapshot.json'), 'utf8')) as Snapshot;

function run(args: string[]): string {
  return execFileSync(process.execPath, [cli, ...args], {
    cwd: repo,
    encoding: 'utf8',
    env: { ...process.env, LOG_LEVEL: 'silent' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-prompts-site-verify-'));
const own = path.join(temp, 'own prompts');
fs.mkdirSync(own);

const option = (partial: Partial<InstallOptions> & { selection?: Partial<Selection> }): InstallOptions => ({
  profiles: [],
  expose: ['tools'],
  readOnly: false,
  dirs: [],
  ...partial,
  selection: { ...SELECT_ALL, ...partial.selection },
});

const cases: Array<[string, InstallOptions]> = [
  ['whole library', option({})],
  ...snapshot.profiles.map(profile => [`profile ${profile.name}`, option({ profiles: [profile.name] })] as [string, InstallOptions]),
  ['every profile', option({ profiles: snapshot.profiles.map(profile => profile.name) })],
  ['two profiles narrowed', option({ profiles: ['software-dev', 'voice-home'], selection: { templates: [] }, expose: ['tools', 'prompts'] })],
  ['templates only, by group and tag', option({ selection: { prompts: [], templates: ['mia-car', 'tag:openclaw'] } })],
  ['parent group and an id', option({ selection: { prompts: ['cognitive', 'mia-system-identity'], templates: [] } })],
  ['exclude by id, group and tag', option({ selection: { exclude: ['mia-car-emergency-response', 'subagents', 'tag:voice'] } })],
  ['nothing at all', option({ selection: { prompts: [], templates: [] } })],
  ['every option', option({
    profiles: ['embedded-iot'],
    selection: { prompts: ['subagents'], exclude: ['orchestration_test_analyst'] },
    expose: ['prompts', 'resources'],
    readOnly: true,
    promptsDir: path.join(repo, 'data', 'prompts'),
    dirs: [own],
    stateDir: path.join(temp, 'state'),
  })],
];

let failures = 0;
for (const [label, options] of cases) {
  const args = optionArgs(options);

  // Served prompts: compare with what the server's catalog serves from its library.
  const catalog = JSON.parse(run(['catalog', '--json', ...args])) as { served: Array<{ id: string; source: string }> };
  const expected = catalog.served.filter(item => item.source === 'library').map(item => item.id);
  const actual = servedPrompts(snapshot, options.profiles, options.selection).map(prompt => prompt.id);
  if (expected.join('\n') !== actual.join('\n')) {
    failures++;
    console.error(`FAIL served (${label}): server ${expected.length} [${expected.join(', ')}]\n      page   ${actual.length} [${actual.join(', ')}]`);
  }

  // Snippets: compare with what `mcp-prompts config` prints, name and URL included.
  const name = label.includes('every option') ? 'my prompts' : 'mcp-prompts';
  const base = label.includes('every option') ? 'https://prompts.example.com/' : 'http://localhost:3003';
  const config = run(['config', ...args, '--name', name, '--url', base]).replace(/\n$/, '');
  const ours = formatInstallSnippets(options, name, base);
  if (config !== ours) {
    failures++;
    const lines = [config.split('\n'), ours.split('\n')];
    const at = lines[0].findIndex((line, i) => line !== lines[1][i]);
    console.error(`FAIL config (${label}) at line ${at + 1}:\n  server: ${lines[0][at]}\n  page:   ${lines[1][at]}`);
  }
  if (!failures) console.log(`ok  ${label}: ${actual.length} served`);
}

fs.rmSync(temp, { recursive: true, force: true });
if (failures) {
  console.error(`verify: ${failures} mismatch(es) with the server`);
  process.exit(1);
}
console.log(`verify: the page matches the server in ${cases.length} cases`);
