import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { renderTemplate } from './prompt-store';

const PROMPTS_DIR = path.join(__dirname, '..', 'data', 'prompts');
const FIXTURE_FILE = path.join(__dirname, 'testing', 'fixtures', 'android-automation-router.menu.json');
const ROUTER_FILE = path.join(PROMPTS_DIR, 'android-automation', 'android-automation-router.json');

const BRANCHES = ['Ask', 'Research', 'Review', 'Tasker', 'Lights', 'Voice', 'Phone settings', 'Diagnostics'];
const COLUMNS = ['Menu path', 'Does', 'Prompt id', 'Tool or agent', 'Gate'];
const GATES = ['none', 'token', 'yes-exact', 'never'];
const MODALITIES = ['typed', 'spoken', 'agent'];

interface Leaf {
  path: string;
  branch: string;
  promptId: string;
  gate: string;
}
interface Fixture {
  request: string;
  modality: string;
  menuPath: string;
  promptId: string;
  toolOrAgent: string;
  gate: string;
  stateChanging: boolean;
}

const router = JSON.parse(fs.readFileSync(ROUTER_FILE, 'utf8'));
const content: string = router.content;

const unquote = (cell: string): string => cell.trim().replace(/^`([^`]*)`$/, '$1');

function parseMenu(): { header: string[]; leaves: Leaf[] } {
  const lines = content.split('\n');
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
    return { path: p, branch: p.split(' > ')[0], promptId: cells[2], gate: unquote(cells[4]) };
  });
  return { header, leaves };
}

function promptIdsOnDisk(): Set<string> {
  const ids = new Set<string>();
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.json') && entry.name !== 'profiles.json' && entry.name !== 'index.json') {
        const data = JSON.parse(fs.readFileSync(full, 'utf8'));
        if (data && typeof data.id === 'string') ids.add(data.id);
      }
    }
  };
  walk(PROMPTS_DIR);
  return ids;
}

const { header, leaves } = parseMenu();
const byPath = new Map(leaves.map(l => [l.path, l]));
const fixtures: Fixture[] = JSON.parse(fs.readFileSync(FIXTURE_FILE, 'utf8'));
const promptIdsOf = (cell: string): string[] => (cell === '-' ? [] : cell.split(',').map(unquote));

describe('android-automation-router menu', () => {
  it('has the five columns in order and the eight branches in order', () => {
    expect(header).toEqual(COLUMNS);
    const order = leaves.map(l => l.branch).filter((b, i, all) => all.indexOf(b) === i);
    expect(order).toEqual(BRANCHES);
  });

  it('has at least 28 leaves and 3 per branch', () => {
    expect(leaves.length).toBeGreaterThanOrEqual(28);
    for (const b of BRANCHES) expect(leaves.filter(l => l.branch === b).length).toBeGreaterThanOrEqual(3);
  });

  it('uses only known gates', () => {
    for (const l of leaves) expect(GATES, l.path).toContain(l.gate);
  });

  it('refers only to prompt ids that exist', () => {
    const ids = promptIdsOnDisk();
    for (const l of leaves) for (const id of promptIdsOf(l.promptId)) expect(ids.has(id), `${l.path}: ${id}`).toBe(true);
  });

  it('sets the light gates', () => {
    for (const p of ['Lights > Mood', 'Lights > Effect', 'Lights > Off']) expect(byPath.get(p)?.gate).toBe('none');
    expect(byPath.get('Lights > Zigbee device')?.gate).toBe('token');
  });

  it('does not say that mia/lights/* or a room topic publishes directly', () => {
    expect(content).not.toContain('mia/lights/*');
    expect(content).not.toContain('mia/lights/<room>');
  });

  it('fills every placeholder', () => {
    const out = renderTemplate(content, {
      request: 'Lights > Mood: calm',
      modality: 'typed',
      'user_prefs': 'English',
      'available_layers': 'all'
    });
    expect(out.missing).toEqual([]);
    expect(out.text).not.toContain('{{');
  });
});

describe('android-automation-router menu fixtures', () => {
  it('are not loaded as prompts', () => {
    expect(path.relative(PROMPTS_DIR, FIXTURE_FILE).startsWith('..')).toBe(true);
  });

  it('are well formed and cover the menu', () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(24);
    for (const b of BRANCHES) {
      expect(fixtures.filter(f => f.menuPath.split(' > ')[0] === b).length, b).toBeGreaterThanOrEqual(2);
    }
    for (const m of MODALITIES) expect(fixtures.some(f => f.modality === m), m).toBe(true);
    expect(fixtures.some(f => f.gate === 'never')).toBe(true);
    expect(fixtures.some(f => f.menuPath === 'Voice > Speak' && f.gate === 'none' && /ignore/i.test(f.request))).toBe(true);
    expect(fixtures.filter(f => /[ěščřžýáíéůúň]/i.test(f.request)).length).toBeGreaterThanOrEqual(2);
  });

  it('match the gate and prompt id of their leaf', () => {
    for (const f of fixtures) {
      const leaf = byPath.get(f.menuPath);
      expect(leaf, f.menuPath).toBeDefined();
      expect(GATES).toContain(f.gate);
      expect(f.gate, f.menuPath).toBe(leaf!.gate);
      const leafIds = promptIdsOf(leaf!.promptId);
      expect(leafIds.length ? leafIds : ['-'], f.menuPath).toContain(f.promptId);
    }
  });

  it('keep state-changing requests off the none gate', () => {
    // stateChanging means the request needs a gate stronger than none.
    for (const f of fixtures) if (f.stateChanging) expect(['token', 'yes-exact', 'never'], f.request).toContain(f.gate);
    const used = new Set(fixtures.filter(f => f.stateChanging).map(f => f.menuPath));
    for (const l of leaves) if (l.gate === 'none') expect(used.has(l.path), l.path).toBe(false);
  });
});
