import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { PromptStore, renderTemplate } from './prompt-store';

// The liberty-citations pack: prompts and templates for the liberty-citations skill, whose toolkit
// is the `liberty` MCP server and CLI. These checks keep the pack, its router menu and the skill's
// tools in step: every tool of the server is reachable from the menu, every leaf points at a
// prompt that really uses the tools the menu names, and nothing that publishes under the user's
// name is reachable without the yes-exact gate.

const PROMPTS_DIR = path.join(__dirname, '..', 'data', 'prompts');
const GROUP_DIR = path.join(PROMPTS_DIR, 'liberty-citations');
const FIXTURE_FILE = path.join(__dirname, 'testing', 'fixtures', 'liberty-citations-router.menu.json');

/** Every tool the liberty MCP server registers (scripts/mcp_server.py in the skill). */
const LIBERTY_TOOLS = [
  'liberty_status', 'search_quotes', 'get_passage', 'stoky_search', 'stoky_post', 'stoky_sync',
  'library_setup', 'misescz_sync', 'youtube_find', 'youtube_catalog', 'transcribe', 'job_status',
  'add_source',
];
/** Tools that start a background job. */
const JOB_TOOLS = ['library_setup', 'stoky_sync', 'misescz_sync', 'transcribe'];
const BRANCHES = ['Cite', 'Write', 'Stoky', 'Forum', 'Video', 'Corpus', 'Setup', 'Never'];
const COLUMNS = ['Menu path', 'Does', 'Prompt id', 'Tool or agent', 'Gate'];
const GATES = ['none', 'job', 'yes-exact', 'never'];

interface PackPrompt {
  id: string;
  name: string;
  description: string;
  content: string;
  isTemplate: boolean;
  variables?: Array<{ name: string; description?: string; required?: boolean }>;
  tags: string[];
  category: string;
  metadata: { skill: string; mcpServer: string; tools: string[]; chrome?: boolean; evalCases?: string[] };
}
interface Leaf {
  path: string;
  branch: string;
  promptId: string;
  tools: string[];
  chromeTools: string[];
  gate: string;
}
interface Fixture {
  request: string;
  menuPath: string;
  promptId: string;
  gate: string;
  publishes: boolean;
}

const pack: PackPrompt[] = fs.readdirSync(GROUP_DIR)
  .filter(name => name.endsWith('.json'))
  .map(name => JSON.parse(fs.readFileSync(path.join(GROUP_DIR, name), 'utf8')));
const byId = new Map(pack.map(p => [p.id, p]));
const router = byId.get('liberty-router')!;
const reference = byId.get('liberty-tools-reference')!;
const unquote = (cell: string): string => cell.trim().replace(/^`([^`]*)`$/, '$1');

function parseMenu(): { header: string[]; leaves: Leaf[] } {
  const lines = router.content.split('\n');
  const start = lines.findIndex(l => l.trim() === '## Menu');
  expect(start).toBeGreaterThanOrEqual(0);
  const rows: string[][] = [];
  let inTable = false;
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith('|')) {
      inTable = true;
      rows.push(line.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim()));
    } else if (inTable) break;
  }
  const [header, , ...body] = rows;
  const leaves = body.map(cells => {
    const p = unquote(cells[0]);
    const toolCell = cells[3];
    const chrome = toolCell.startsWith('Chrome:');
    const names = (chrome ? toolCell.slice('Chrome:'.length) : toolCell).split(',').map(s => s.trim()).filter(s => s && s !== '-');
    return {
      path: p,
      branch: p.split(' > ')[0],
      promptId: cells[2],
      tools: chrome ? [] : names,
      chromeTools: chrome ? names : [],
      gate: unquote(cells[4]),
    };
  });
  return { header, leaves };
}

const { header, leaves } = parseMenu();
const byPath = new Map(leaves.map(l => [l.path, l]));
const fixtures: Fixture[] = JSON.parse(fs.readFileSync(FIXTURE_FILE, 'utf8'));
const variableNames = (p: PackPrompt) => (p.variables ?? []).map(v => v.name);

describe('liberty-citations pack', () => {
  it('holds fifteen prompts of one category, all tied to the skill', () => {
    expect(pack.length).toBe(15);
    for (const p of pack) {
      expect(p.category, p.id).toBe('liberty-citations');
      expect(p.id.startsWith('liberty-'), p.id).toBe(true);
      expect(p.tags, p.id).toEqual(expect.arrayContaining(['liberty-citations', 'libertarian']));
      expect(p.metadata.skill, p.id).toBe('liberty-citations');
      expect(p.metadata.mcpServer, p.id).toBe('liberty');
      // The first sentence is what list_prompts shows (110 characters), so it has to say what the prompt is for.
      expect(p.description.length, p.id).toBeGreaterThan(200);
      expect(p.description.length, p.id).toBeLessThanOrEqual(1024);
    }
    expect(pack.filter(p => !p.isTemplate).map(p => p.id).sort()).toEqual(['liberty-citation-rules', 'liberty-tools-reference']);
  });

  it('names only tools the liberty server has, and uses each tool it names', () => {
    for (const p of pack) {
      for (const tool of p.metadata.tools) {
        expect(LIBERTY_TOOLS, `${p.id}: ${tool}`).toContain(tool);
        expect(p.content, `${p.id} names ${tool} in metadata but not in its text`).toContain(tool);
      }
    }
  });

  it('documents every tool of the liberty server in the reference, with its CLI command', () => {
    for (const tool of LIBERTY_TOOLS) expect(reference.content, tool).toMatch(new RegExp('\\| `' + tool + '` \\|[^\\n]*\\| `liberty '));
  });

  it('declares exactly the placeholders each template uses, each with a description', () => {
    for (const p of pack.filter(q => q.isTemplate)) {
      const used = new Set([...p.content.matchAll(/\{\{\s*([A-Za-z_]\w*)\s*\}\}/g)].map(m => m[1]));
      expect([...used].sort(), p.id).toEqual([...variableNames(p)].sort());
      for (const v of p.variables!) expect(v.description?.length ?? 0, `${p.id}.${v.name}`).toBeGreaterThan(10);
      expect(p.content, p.id).not.toMatch(/\{%/);
    }
    for (const p of pack.filter(q => !q.isTemplate)) expect(p.content, p.id).not.toContain('{{');
  });

  it('renders every template completely when every variable is given', () => {
    for (const p of pack.filter(q => q.isTemplate)) {
      const values = Object.fromEntries(variableNames(p).map(name => [name, `<${name}>`]));
      const out = renderTemplate(p.content, values);
      expect(out.missing, p.id).toEqual([]);
      expect(out.unused, p.id).toEqual([]);
      expect(out.text, p.id).not.toContain('{{');
    }
  });

  it('points every prompt that quotes at the citation rules', () => {
    for (const p of pack.filter(q => q.tags.includes('quotes') || q.tags.includes('writing') || q.tags.includes('publish'))) {
      if (p.id === 'liberty-citation-rules') continue;
      expect(p.content, p.id).toContain('liberty-citation-rules');
    }
  });

  it('keeps the eval cases of the skill attached to the prompts that answer them', () => {
    const cases = new Set(pack.flatMap(p => p.metadata.evalCases ?? []));
    expect([...cases].sort()).toEqual(['drug-prohibition-citations-cs', 'stoky-post-from-idea', 'urza-video-timestamp-quote']);
  });
});

describe('liberty-router menu', () => {
  it('has the five columns in order and the eight branches in order', () => {
    expect(header).toEqual(COLUMNS);
    expect(leaves.map(l => l.branch).filter((b, i, all) => all.indexOf(b) === i)).toEqual(BRANCHES);
  });

  it('uses only known gates', () => {
    for (const l of leaves) expect(GATES, l.path).toContain(l.gate);
  });

  it('reaches every prompt of the pack, and only prompts of the pack', () => {
    for (const l of leaves.filter(l => l.gate !== 'never')) expect(byId.has(l.promptId), `${l.path}: ${l.promptId}`).toBe(true);
    const reached = new Set(leaves.map(l => l.promptId));
    for (const p of pack.filter(q => q.id !== 'liberty-router')) {
      expect(reached.has(p.id) || router.content.includes(`\`${p.id}\``), p.id).toBe(true);
    }
  });

  it('reaches every tool of the liberty server', () => {
    const named = new Set(leaves.flatMap(l => l.tools));
    for (const tool of LIBERTY_TOOLS) expect(named.has(tool), tool).toBe(true);
  });

  it('points each leaf at a prompt that uses the tools the leaf names', () => {
    for (const l of leaves.filter(l => l.gate !== 'never')) {
      const p = byId.get(l.promptId)!;
      for (const tool of l.tools.filter(t => LIBERTY_TOOLS.includes(t))) expect(p.metadata.tools, `${l.path}: ${tool}`).toContain(tool);
      for (const tool of l.chromeTools) expect(p.content, `${l.path}: ${tool}`).toContain(`\`${tool}\``);
      if (l.chromeTools.length) expect(p.metadata.chrome, l.path).toBe(true);
    }
  });

  it('puts every leaf that fills a form in Chrome behind yes-exact, and nothing else', () => {
    for (const l of leaves) expect(l.chromeTools.includes('form_input'), l.path).toBe(l.gate === 'yes-exact');
    for (const p of pack.filter(q => q.tags.includes('publish'))) {
      expect(p.content, p.id).toContain('yes-exact');
      expect(variableNames(p), p.id).toContain('approval');
    }
  });

  it('puts every leaf that starts a background job behind the job gate', () => {
    for (const l of leaves) if (l.tools.some(t => JOB_TOOLS.includes(t))) expect(l.gate, l.path).toBe('job');
    for (const l of leaves.filter(l => l.gate === 'job')) expect(l.tools.some(t => JOB_TOOLS.includes(t)), l.path).toBe(true);
  });

  it('refuses the never leaves without a prompt or a tool', () => {
    const never = leaves.filter(l => l.gate === 'never');
    expect(never.length).toBe(4);
    for (const l of never) {
      expect(l.branch, l.path).toBe('Never');
      expect(l.promptId, l.path).toBe('-');
      expect([...l.tools, ...l.chromeTools], l.path).toEqual([]);
    }
  });

  it('fills every placeholder', () => {
    const out = renderTemplate(router.content, { request: 'Cite > Find quotes', environment: 'claude-code', constraints: '-' });
    expect(out.missing).toEqual([]);
    expect(out.text).not.toContain('{{');
  });
});

describe('liberty-router menu fixtures', () => {
  it('are not loaded as prompts', () => {
    expect(path.relative(PROMPTS_DIR, FIXTURE_FILE).startsWith('..')).toBe(true);
  });

  it('cover every branch, and mostly Czech requests', () => {
    for (const b of BRANCHES) expect(fixtures.filter(f => f.menuPath.split(' > ')[0] === b).length, b).toBeGreaterThanOrEqual(1);
    expect(fixtures.filter(f => /[ěščřžýáíéůúň]/i.test(f.request)).length).toBeGreaterThan(fixtures.length / 2);
  });

  it('match the gate and prompt id of their leaf', () => {
    for (const f of fixtures) {
      const leaf = byPath.get(f.menuPath);
      expect(leaf, f.menuPath).toBeDefined();
      expect(f.gate, f.menuPath).toBe(leaf!.gate);
      expect(f.promptId, f.menuPath).toBe(leaf!.promptId);
    }
  });

  it('never route a request that publishes to a gate weaker than yes-exact', () => {
    for (const f of fixtures.filter(f => f.publishes)) expect(['yes-exact', 'never'], f.request).toContain(f.gate);
  });
});

describe('liberty-citations profile', () => {
  const store = new PromptStore();
  store.load({ promptsDir: PROMPTS_DIR });
  const served = (names: string[]) => store.selectProfiles(names).all().map(p => p.id).sort();

  it('serves exactly the pack', () => {
    expect(served(['liberty-citations'])).toEqual(pack.map(p => p.id).sort());
  });

  it('is in no other profile, and takes no other profile\'s prompts', () => {
    for (const name of store.profileNames.filter(n => n !== 'liberty-citations')) {
      expect(served([name]).filter(id => byId.has(id)), name).toEqual([]);
    }
  });

  it('lists its two plain prompts and thirteen templates', () => {
    const profile = store.profiles().find(p => p.name === 'liberty-citations')!;
    expect({ prompts: profile.prompts, templates: profile.templates }).toEqual({ prompts: 2, templates: 13 });
  });
});
