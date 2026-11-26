import { afterEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PromptStore, type StoredPrompt } from './prompt-store';
import { checkSkill, exportSkills, promptToSkill, shortenDescription, skillNameFor, skillToPrompt, SKILL_DESCRIPTION_MAX } from './skills';
import { main } from './mcp-server-standalone';

const LIBRARY = path.join(__dirname, '..', 'data', 'prompts');
const temps: string[] = [];

function tempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-prompts-skills-'));
  temps.push(dir);
  return dir;
}

/** A store holding only what dirs hold: an empty library, then the given directories. */
function storeOf(dirs: string[]): PromptStore {
  const store = new PromptStore();
  store.load({ promptsDir: tempDir(), dirs });
  return store;
}

function prompt(fields: Partial<StoredPrompt> & { id: string }): StoredPrompt {
  return {
    name: `${fields.id} name`,
    content: `${fields.id} content\n`,
    isTemplate: false,
    tags: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    version: 1,
    ...fields,
  } as StoredPrompt;
}

afterEach(() => {
  for (const dir of temps.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe('export and import of Agent Skills', () => {
  it('gives back every prompt of the bundled library after an export and an import', () => {
    const library = new PromptStore();
    library.load({ promptsDir: LIBRARY });
    const prompts = library.all();
    expect(prompts.length).toBeGreaterThan(50);

    const dir = tempDir();
    const result = exportSkills(prompts, dir);
    expect(result.skipped).toEqual([]);
    expect(result.written).toHaveLength(prompts.length);

    const imported = storeOf([dir]);
    expect(imported.all()).toHaveLength(prompts.length);
    for (const original of prompts) expect(imported.get(original.id)).toEqual(original);
  }, 60_000);

  it('writes skills that meet the Agent Skills specification', () => {
    const library = new PromptStore();
    library.load({ promptsDir: LIBRARY });
    const dir = tempDir();
    exportSkills(library.all(), dir);
    for (const name of fs.readdirSync(dir)) {
      expect(checkSkill(fs.readFileSync(path.join(dir, name, 'SKILL.md'), 'utf8'), name), name).toEqual([]);
    }
  }, 60_000);

  it('keeps ids, long descriptions and "---" that a skill cannot hold as they are', () => {
    const long = `${'First sentence is here. '.repeat(60)}Last one.`;
    const prompts = [
      prompt({ id: 'Under_Score.v2', description: 'Has --- three hyphens and a "quote"' }),
      prompt({ id: 'under-score-v2', description: long, content: 'no newline at the end' }),
      prompt({ id: 'no-description', description: undefined }),
      prompt({ id: 'tmpl', isTemplate: true, content: 'Hi {{who}} from {{where}}', variables: ['who', { name: 'where', description: 'A city', required: false, type: 'string' as const }] }),
    ];
    const dir = tempDir();
    const result = exportSkills(prompts, dir);
    expect(result.written.map(w => w.skill)).toEqual(['under-score-v2', 'under-score-v2-2', 'no-description', 'tmpl']);
    for (const { skill } of result.written) {
      expect(checkSkill(fs.readFileSync(path.join(dir, skill, 'SKILL.md'), 'utf8'), skill)).toEqual([]);
    }

    const imported = storeOf([dir]);
    for (const original of prompts) {
      const back = imported.get(original.id);
      expect(back).toEqual(JSON.parse(JSON.stringify(original)));
    }
  });

  it('starts a template with a Parameters section that names each variable', () => {
    const { text } = promptToSkill(prompt({
      id: 'tmpl', isTemplate: true, content: 'Hi {{who}} from {{where}}',
      variables: ['who', { name: 'where', description: 'A city', required: false, type: 'string' as const }],
    }));
    const body = text.slice(text.indexOf('\n---\n') + 5);
    expect(body).toMatch(/^\n<!-- mcp-prompts:parameters -->\n## Parameters\n/);
    expect(body).toContain('- `who`\n');
    expect(body).toContain('- `where` (optional): A city\n');
    expect(body.endsWith('Hi {{who}} from {{where}}')).toBe(true);
    expect(promptToSkill(prompt({ id: 'plain' })).text).not.toContain('## Parameters');
  });

  it('reads a SKILL.md written by hand, and nothing else in its folder', () => {
    const dir = tempDir();
    const skill = path.join(dir, 'pdf-tools');
    fs.mkdirSync(path.join(skill, 'scripts'), { recursive: true });
    fs.writeFileSync(path.join(skill, 'SKILL.md'), [
      '---',
      'name: pdf-tools',
      'description: >',
      '  Fill and merge PDF files.',
      'license: MIT',
      'metadata:',
      '  author: someone',
      '---',
      '',
      '# PDF tools',
      '',
      'Run scripts/fill.py.',
      '',
    ].join('\n'));
    // A JSON file inside a skill belongs to the skill, even when it looks like a prompt.
    fs.writeFileSync(path.join(skill, 'scripts', 'decoy.json'), JSON.stringify({ id: 'decoy', name: 'd', content: 'd' }));

    const store = storeOf([dir]);
    expect(store.all().map(p => p.id)).toEqual(['pdf-tools']);
    expect(store.get('pdf-tools')).toMatchObject({
      name: 'pdf-tools',
      description: 'Fill and merge PDF files.\n',
      content: '# PDF tools\n\nRun scripts/fill.py.\n',
      isTemplate: false,
      tags: ['skill'],
      metadata: { skill: { license: 'MIT', metadata: { author: 'someone' } } },
    });
  });

  it('skips a SKILL.md without frontmatter and loads the rest', () => {
    const dir = tempDir();
    fs.mkdirSync(path.join(dir, 'broken'));
    fs.writeFileSync(path.join(dir, 'broken', 'SKILL.md'), '# no frontmatter\n');
    fs.writeFileSync(path.join(dir, 'p.json'), JSON.stringify({ id: 'p', name: 'p', content: 'p' }));
    expect(storeOf([dir]).all().map(p => p.id)).toEqual(['p']);
    expect(() => skillToPrompt('# no frontmatter\n', 'broken')).toThrow(/frontmatter/);
  });

  it('replaces its own earlier export but never a skill written by hand or for another prompt', () => {
    const dir = tempDir();
    exportSkills([prompt({ id: 'mine', content: 'one' })], dir);
    expect(exportSkills([prompt({ id: 'mine', content: 'two' })], dir).written).toHaveLength(1);
    expect(fs.readFileSync(path.join(dir, 'mine', 'SKILL.md'), 'utf8').endsWith('two')).toBe(true);

    fs.mkdirSync(path.join(dir, 'hand'));
    const handWritten = '---\nname: hand\ndescription: by hand\n---\nbody\n';
    fs.writeFileSync(path.join(dir, 'hand', 'SKILL.md'), handWritten);
    const result = exportSkills([prompt({ id: 'hand' }), prompt({ id: 'MINE' })], dir);
    expect(result.written).toEqual([]);
    expect(result.skipped.map(s => s.id)).toEqual(['hand', 'MINE']);
    expect(result.skipped[1].reason).toContain('holds the prompt mine');
    expect(fs.readFileSync(path.join(dir, 'hand', 'SKILL.md'), 'utf8')).toBe(handWritten);
  });
});

describe('skill names and descriptions', () => {
  it('rewrites ids into the skill alphabet', () => {
    expect(skillNameFor('orchestration_main_web_backend')).toBe('orchestration-main-web-backend');
    expect(skillNameFor('--A..b__C--')).toBe('a-b-c');
    expect(skillNameFor('___')).toBe('prompt');
    expect(skillNameFor('x'.repeat(63) + '-y')).toBe('x'.repeat(63));
  });

  it('shortens a long description at a sentence', () => {
    const text = `${'Short sentence. '.repeat(100)}`;
    const short = shortenDescription(text);
    expect(short.length).toBeLessThanOrEqual(SKILL_DESCRIPTION_MAX);
    expect(short.endsWith('sentence.')).toBe(true);
    const words = shortenDescription('word '.repeat(400));
    expect(words.length).toBeLessThanOrEqual(SKILL_DESCRIPTION_MAX);
    expect(words.endsWith('word…')).toBe(true);
  });
});

describe('mcp-prompts export', () => {
  function run(args: string[]): Promise<{ code: number | undefined; out: string; err: string }> {
    let out = '';
    let err = '';
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(chunk => { out += String(chunk); return true; });
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(chunk => { err += String(chunk); return true; });
    return main(args, { LOG_LEVEL: 'silent' }, process.cwd())
      .then(code => ({ code, out, err }))
      .finally(() => { stdout.mockRestore(); stderr.mockRestore(); });
  }

  it('writes the selected prompts as skills', async () => {
    const dir = tempDir();
    const { code, out } = await run(['export', '--skills', dir, '--profile', 'android-automation', '--json']);
    expect(code).toBe(0);
    const result = JSON.parse(out);
    expect(result.written.map((w: { id: string }) => w.id)).toContain('android-automation-router');
    expect(fs.existsSync(path.join(dir, 'android-automation-router', 'SKILL.md'))).toBe(true);
    expect(fs.readdirSync(dir)).toHaveLength(result.written.length);
  });

  it('needs --skills, and --skills needs export', async () => {
    expect((await run(['export'])).code).toBe(2);
    const misplaced = await run(['catalog', '--skills', tempDir()]);
    expect(misplaced.code).toBe(2);
    expect(misplaced.err).toContain('--skills goes with the export command');
  });

  it('exits 1 when a prompt was skipped', async () => {
    const dir = tempDir();
    fs.mkdirSync(path.join(dir, 'android-automation-router'));
    fs.writeFileSync(path.join(dir, 'android-automation-router', 'SKILL.md'), '---\nname: android-automation-router\ndescription: mine\n---\n');
    const { code, err } = await run(['export', '--skills', dir, '--prompts', 'none', '--templates', 'android-automation-router']);
    expect(code).toBe(1);
    expect(err).toContain('not written by mcp-prompts');
  });
});
