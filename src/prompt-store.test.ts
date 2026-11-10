import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  CreatePromptParams,
  PromptConflictError,
  PromptNotFoundError,
  PromptStorageError,
  PromptStore,
  PromptUsageError,
  SELECT_ALL,
  UpdatePromptParams,
  nextVersion,
  renderTemplate,
  type Selection,
} from './prompt-store';
import { makeFixtureLibrary, type FixtureLibrary } from './testing/fixture-library';

describe('PromptStore', () => {
  it('keeps isTemplate and tags when an update leaves them out', () => {
    const store = new PromptStore();
    const p = store.add({ name: 'T', content: 'Hi {{x}}', isTemplate: true, tags: ['a'] });
    const updated = store.update(p.id, UpdatePromptParams.parse({ name: 'T2' }));
    expect(updated).toMatchObject({ name: 'T2', isTemplate: true, tags: ['a'], version: 2 });
  });

  it('fills placeholders literally, including names with regex characters', () => {
    const store = new PromptStore();
    const p = store.add({ name: 'T', content: '{{a.b}} and {{a.b}} and {{c}}', isTemplate: true, tags: [] });
    expect(store.applyTemplate(p.id, { 'a.b': 'X', c: 1 })).toBe('X and X and 1');
  });

  it('refuses to apply a prompt that is not a template', () => {
    const store = new PromptStore();
    const p = store.add({ name: 'Plain', content: 'x', isTemplate: false, tags: [] });
    expect(() => store.applyTemplate(p.id, {})).toThrow(PromptUsageError);
  });

  it('reports missing prompts with PromptNotFoundError', () => {
    const store = new PromptStore();
    expect(() => store.get('nope')).toThrow(PromptNotFoundError);
    expect(() => store.delete('nope')).toThrow(PromptNotFoundError);
  });

  it('filters by any matching tag and by search text', () => {
    const store = new PromptStore();
    store.add({ name: 'Alpha', content: 'first', isTemplate: false, tags: ['x'] });
    store.add({ name: 'Beta', content: 'second', isTemplate: false, tags: ['y'] });
    expect(store.list({ tags: ['y', 'z'] }).map(p => p.name)).toEqual(['Beta']);
    expect(store.list({ search: 'FIRST' }).map(p => p.name)).toEqual(['Alpha']);
    expect(store.stats()).toMatchObject({ total: 2, templates: 0, regular: 2 });
  });

  it('loads prompts recursively from a directory, skipping index.json', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prompts-'));
    fs.mkdirSync(path.join(dir, 'sub'));
    fs.writeFileSync(path.join(dir, 'a.json'), JSON.stringify({ id: 'a', name: 'A', content: 'a', tags: [] }));
    fs.writeFileSync(path.join(dir, 'sub', 'b.json'), JSON.stringify({ id: 'b', name: 'B', content: 'b', tags: [] }));
    fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify({ ignored: true }));
    const store = new PromptStore();
    expect(store.loadDirectory(dir)).toBe(2);
    expect(store.get('b').name).toBe('B');
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe('PromptStore selections', () => {
  let fixture: FixtureLibrary;
  let base: PromptStore;

  beforeAll(() => {
    fixture = makeFixtureLibrary();
    base = new PromptStore();
    base.load({ promptsDir: fixture.library, dirs: [fixture.own] });
  });
  afterAll(() => fixture.cleanup());

  const select = (selection: Partial<Selection>) => base.select({ ...SELECT_ALL, ...selection });
  const ids = (store: PromptStore) => store.all().map(p => p.id).sort();

  it('groups library prompts by directory', () => {
    const groups = base.catalog().groups.map(row => row.group);
    expect(groups).toEqual(['', 'alpha', 'alpha/deep', 'beta']);
  });

  it('chooses plain prompts and templates with separate lists', () => {
    expect(ids(select({ prompts: ['alpha'], templates: [] }))).toEqual(['a-plain', 'b-plain', 'o-tmpl']);
    expect(ids(select({ prompts: [], templates: ['beta'] }))).toEqual(['b-plain', 'b-tmpl', 'o-tmpl']);
  });

  it('matches subgroups, ids and tags', () => {
    expect(ids(select({ prompts: [], templates: ['alpha'] }))).toEqual(['a-deep', 'a-greet', 'b-plain', 'o-tmpl']);
    expect(ids(select({ prompts: [], templates: ['alpha/deep'] }))).toEqual(['a-deep', 'b-plain', 'o-tmpl']);
    expect(ids(select({ prompts: ['root-note'], templates: ['tag:x'] }))).toEqual(['b-plain', 'b-tmpl', 'o-tmpl', 'root-note']);
  });

  it('applies exclude to both lists', () => {
    expect(ids(select({ exclude: ['alpha', 'tag:x'] }))).toEqual(['b-plain', 'o-tmpl']);
  });

  it('always serves the user\'s own directories, whose prompts replace library ones with the same id', () => {
    const none = select({ prompts: [], templates: [] });
    expect(ids(none)).toEqual(['b-plain', 'o-tmpl']);
    expect(none.get('b-plain').name).toBe('My b-plain');
  });

  it('hides unselected prompts from every operation', () => {
    const view = select({ prompts: [], templates: ['a-greet'] });
    expect(() => view.get('a-plain')).toThrow(PromptNotFoundError);
    expect(() => view.update('a-plain', {})).toThrow(PromptNotFoundError);
    expect(() => view.delete('a-plain')).toThrow(PromptNotFoundError);
    expect(view.applyTemplate('a-greet', { who: 'you', place: 'here' })).toBe('Hello you from here');
    expect(view.stats()).toMatchObject({ total: 3, templates: 2, regular: 1 });
    expect(view.size).toBe(3);
  });

  it('serves prompts added at runtime through any view, to every view', () => {
    const store = new PromptStore();
    store.load({ promptsDir: fixture.library });
    const narrow = store.select({ ...SELECT_ALL, prompts: [], templates: [] });
    const added = narrow.add({ name: 'New', content: 'n', isTemplate: false, tags: [] });
    expect(narrow.get(added.id).name).toBe('New');
    expect(store.select({ ...SELECT_ALL, prompts: ['beta'] }).get(added.id).name).toBe('New');
  });

  it('narrows a view again by intersection', () => {
    const view = select({ templates: ['alpha'] }).select({ ...SELECT_ALL, templates: ['beta', 'a-greet'] });
    expect(ids(view).filter(id => !['a-plain', 'b-plain', 'root-note', 'o-tmpl'].includes(id))).toEqual(['a-greet']);
  });

  it('counts total and selected prompts per group in the catalog', () => {
    const catalog = select({ prompts: ['alpha'], templates: ['a-greet'] }).catalog();
    expect(catalog.library).toBe(fixture.library);
    // b-plain is the user's own now, so the library keeps two plain prompts.
    expect(catalog.totals).toEqual({ prompts: 2, templates: 3, selectedPrompts: 1, selectedTemplates: 1 });
    expect(catalog.groups.find(row => row.group === 'alpha')).toEqual({
      group: 'alpha', prompts: { total: 1, selected: 1 }, templates: { total: 1, selected: 1 },
    });
    expect(catalog.served.find(p => p.id === 'o-tmpl')).toMatchObject({ source: 'user', template: true });
  });

  it('warns about entries that select nothing or name the other kind', () => {
    expect(base.selectionWarnings({ prompts: ['alpha/deep', 'nope'], templates: ['root-note'], exclude: ['gone'] })).toEqual([
      'prompts: "alpha/deep" matches only templates (1); list it under templates instead',
      'prompts: "nope" matches no group, id or tag in the library',
      'templates: "root-note" matches only plain prompts (1); list it under prompts instead',
      'exclude: "gone" matches no group, id or tag in the library',
    ]);
    expect(base.selectionWarnings({ prompts: ['alpha'], templates: 'all', exclude: [] })).toEqual([]);
  });

  it('skips prompt files without an id', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prompts-'));
    fs.writeFileSync(path.join(dir, 'no-id.json'), JSON.stringify({ name: 'No id', content: 'x' }));
    const store = new PromptStore();
    expect(store.loadDirectory(dir)).toBe(0);
    expect(store.size).toBe(0);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe('PromptStore fields and versions', () => {
  it('keeps description and category through create and update', () => {
    const store = new PromptStore();
    const added = store.add(CreatePromptParams.parse({ name: 'N', content: 'c', description: 'what it is for', category: 'ops' }));
    expect(added).toMatchObject({ description: 'what it is for', category: 'ops' });
    expect(store.list()[0]).toMatchObject({ description: 'what it is for', category: 'ops' });
    const updated = store.update(added.id, UpdatePromptParams.parse({ description: 'new words' }));
    expect(updated).toMatchObject({ description: 'new words', category: 'ops', name: 'N' });
  });

  it('rejects an empty name or content, on create and on update', () => {
    expect(CreatePromptParams.safeParse({ name: '', content: 'c' }).success).toBe(false);
    expect(CreatePromptParams.safeParse({ name: 'n', content: '' }).success).toBe(false);
    expect(UpdatePromptParams.safeParse({ content: '' }).success).toBe(false);
  });

  it('refuses an update that changes nothing', () => {
    const store = new PromptStore();
    const p = store.add({ name: 'N', content: 'c', isTemplate: false, tags: [] });
    expect(() => store.update(p.id, {})).toThrow(/Nothing to update/);
    expect(store.get(p.id).version).toBe(1);
  });

  it('raises a version the way its form asks for', () => {
    expect(nextVersion(1)).toBe(2);
    expect(nextVersion('1.0.0')).toBe('1.0.1');
    expect(nextVersion('2.3.9')).toBe('2.3.10');
    expect(nextVersion('7')).toBe('8');
    expect(nextVersion('draft')).toBe('draft');
  });

  it('bumps the patch number of a library prompt whose version is a semver string', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prompts-'));
    fs.writeFileSync(path.join(dir, 'a.json'), JSON.stringify({ id: 'a', name: 'A', content: 'a', version: '1.0.0' }));
    const store = new PromptStore();
    store.loadDirectory(dir);
    expect(store.update('a', { name: 'A2' }).version).toBe('1.0.1');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('accepts a caller-chosen id and refuses one that is taken or unsafe', () => {
    const store = new PromptStore();
    expect(store.add(CreatePromptParams.parse({ id: 'release-notes', name: 'N', content: 'c' })).id).toBe('release-notes');
    expect(() => store.add(CreatePromptParams.parse({ id: 'release-notes', name: 'M', content: 'd' }))).toThrow(PromptConflictError);
    for (const id of ['../escape', 'a/b', '.hidden', '', 'x'.repeat(129), 'sp ace']) {
      expect(CreatePromptParams.safeParse({ id, name: 'N', content: 'c' }).success, id).toBe(false);
    }
  });

  it('treats an id hidden by a selection as taken', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prompts-'));
    fs.writeFileSync(path.join(dir, 'hidden.json'), JSON.stringify({ id: 'hidden', name: 'Hidden', content: 'h' }));
    const store = new PromptStore();
    store.load({ promptsDir: dir });
    const view = store.select({ ...SELECT_ALL, prompts: [], templates: [] });
    expect(() => view.get('hidden')).toThrow(PromptNotFoundError);
    expect(() => view.add({ id: 'hidden', name: 'Clash', content: 'c', isTemplate: false, tags: [] })).toThrow(PromptConflictError);
    expect(store.get('hidden').name).toBe('Hidden');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('counts categories from the top-level field as well as metadata, and searches descriptions', () => {
    const store = new PromptStore();
    store.add({ name: 'One', content: 'x', description: 'about turbines', category: 'embedded', isTemplate: false, tags: ['b', 'a'] });
    store.add({ name: 'Two', content: 'y', metadata: { category: 'cognitive/meta' }, isTemplate: true, tags: ['a'] });
    expect(store.stats()).toMatchObject({ categories: ['cognitive/meta', 'embedded'], tags: ['a', 'b'], storage: 'memory' });
    expect(store.list({ search: 'TURBINES' }).map(p => p.name)).toEqual(['One']);
    expect(store.list({ category: 'cognitive/meta' }).map(p => p.name)).toEqual(['Two']);
    expect(store.list({ isTemplate: false }).map(p => p.name)).toEqual(['One']);
  });

  it('pages a listing and says where the next page starts', () => {
    const store = new PromptStore();
    for (const n of [1, 2, 3, 4, 5]) store.add({ name: `P${n}`, content: 'c', isTemplate: false, tags: [] });
    expect(store.page({}, { limit: 2 })).toMatchObject({ total: 5, count: 2, offset: 0, limit: 2, has_more: true, next_offset: 2 });
    const last = store.page({}, { limit: 2, offset: 4 });
    expect(last).toMatchObject({ total: 5, count: 1, has_more: false });
    expect(last.next_offset).toBeUndefined();
    expect(last.prompts.map(p => p.name)).toEqual(['P5']);
    expect(store.page({}, { limit: 2, offset: 9 })).toMatchObject({ total: 5, count: 0, has_more: false });
    expect(store.page().count).toBe(5);
  });
});

describe('PromptStore loading', () => {
  it('skips files that cannot be served, and one bad file no longer breaks search', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prompts-'));
    const write = (name: string, data: unknown) => fs.writeFileSync(path.join(dir, name), typeof data === 'string' ? data : JSON.stringify(data));
    write('ok.json', { id: 'ok', name: 'Ok', content: 'hello', extra: { kept: true } });
    write('no-content.json', { id: 'no-content', name: 'No content' });
    write('no-name.json', { id: 'no-name', content: 'x' });
    write('tags-not-array.json', { id: 'bad-tags', name: 'Bad tags', content: 'x', tags: 'one' });
    write('array.json', [{ id: 'in-array', name: 'A', content: 'x' }]);
    write('broken.json', '{ not json');
    const store = new PromptStore();
    expect(store.loadDirectory(dir)).toBe(1);
    expect(store.list({ search: 'hello' }).map(p => p.id)).toEqual(['ok']);
    expect(store.list({ tags: ['one'] })).toEqual([]);
    // Unknown keys survive, and the fields operations rely on are filled in.
    expect(store.get('ok')).toMatchObject({ extra: { kept: true }, isTemplate: false, tags: [], version: 1 });
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('serves every prompt file bundled with the package', () => {
    const bundled = path.join(__dirname, '..', 'data', 'prompts');
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) walk(path.join(dir, entry.name));
        else if (entry.name.endsWith('.json') && entry.name !== 'index.json') files.push(entry.name);
      }
    };
    walk(bundled);
    const store = new PromptStore();
    expect(store.loadDirectory(bundled)).toBe(files.length);
    expect(files.length).toBeGreaterThan(0);
  });
});

describe('PromptStore loading from links and duplicates', () => {
  let root: string;
  beforeAll(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'prompts-links-'));
  });
  afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

  const prompt = (id: string, name = id) => JSON.stringify({ id, name, content: `${id} content` });
  const load = (dir: string) => {
    const store = new PromptStore();
    const count = store.load({ promptsDir: dir });
    return { store, count };
  };

  it('follows symbolic links to files and directories', () => {
    const lib = path.join(root, 'linked');
    const elsewhere = path.join(root, 'elsewhere');
    fs.mkdirSync(path.join(lib, 'team'), { recursive: true });
    fs.mkdirSync(elsewhere);
    fs.writeFileSync(path.join(elsewhere, 'far.json'), prompt('far'));
    fs.writeFileSync(path.join(elsewhere, 'single.json'), prompt('single'));
    fs.symlinkSync(path.join(elsewhere, 'single.json'), path.join(lib, 'team', 'single.json'));
    fs.symlinkSync(elsewhere, path.join(lib, 'shared'));
    fs.symlinkSync(path.join(root, 'no-such-file.json'), path.join(lib, 'broken.json'));

    const { store, count } = load(lib);
    // The linked directory also holds single.json; one id is one prompt.
    expect(count).toBe(2);
    expect(store.catalog().served).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'far', group: 'shared' }),
      expect.objectContaining({ id: 'single' }),
    ]));
  });

  it('reads a Kubernetes ConfigMap mount, whose files are links into hidden directories', () => {
    const mount = path.join(root, 'configmap');
    const generation = '..2026_11_10_09_00_00.1234567890';
    fs.mkdirSync(path.join(mount, generation), { recursive: true });
    fs.writeFileSync(path.join(mount, generation, 'hello.json'), prompt('hello'));
    fs.symlinkSync(generation, path.join(mount, '..data'));
    fs.symlinkSync(path.join('..data', 'hello.json'), path.join(mount, 'hello.json'));

    const { store, count } = load(mount);
    expect(count).toBe(1);
    // In the root group, not in a group named after the mount's current generation.
    expect(store.catalog().served).toEqual([{ id: 'hello', name: 'hello', template: false, source: 'library', group: '' }]);
  });

  it('stops at a link that leads back up the tree', () => {
    const lib = path.join(root, 'cycle');
    fs.mkdirSync(path.join(lib, 'a'), { recursive: true });
    fs.writeFileSync(path.join(lib, 'a', 'one.json'), prompt('one'));
    fs.symlinkSync(lib, path.join(lib, 'a', 'back'));
    expect(load(lib).count).toBe(1);
  });

  it('skips hidden files and directories', () => {
    const lib = path.join(root, 'hidden');
    fs.mkdirSync(path.join(lib, '.drafts'), { recursive: true });
    fs.writeFileSync(path.join(lib, '.drafts', 'draft.json'), prompt('draft'));
    fs.writeFileSync(path.join(lib, '.swap.json'), prompt('swap'));
    fs.writeFileSync(path.join(lib, 'kept.json'), prompt('kept'));
    expect(load(lib).store.all().map(p => p.id)).toEqual(['kept']);
  });

  it('loads in name order whatever order the file system lists in', () => {
    const lib = path.join(root, 'ordered');
    fs.mkdirSync(path.join(lib, 'm'), { recursive: true });
    for (const name of ['zulu', 'alpha', 'november']) fs.writeFileSync(path.join(lib, `${name}.json`), prompt(name));
    fs.writeFileSync(path.join(lib, 'm', 'mike.json'), prompt('mike'));
    expect(load(lib).store.all().map(p => p.id)).toEqual(['alpha', 'mike', 'november', 'zulu']);
  });

  it('counts two files with one id once and serves the later file', () => {
    const lib = path.join(root, 'duplicates');
    fs.mkdirSync(path.join(lib, 'a'), { recursive: true });
    fs.mkdirSync(path.join(lib, 'b'), { recursive: true });
    fs.writeFileSync(path.join(lib, 'a', 'first.json'), prompt('same', 'First'));
    fs.writeFileSync(path.join(lib, 'b', 'second.json'), prompt('same', 'Second'));
    const { store, count } = load(lib);
    expect(count).toBe(1);
    expect(store.size).toBe(1);
    expect(store.get('same').name).toBe('Second');
  });
});

describe('renderTemplate', () => {
  it('fills in one pass, so a value containing a placeholder is inserted as written', () => {
    const rendered = renderTemplate('A={{a}} B={{b}}', { a: '{{b}}', b: 'SECRET' });
    expect(rendered.text).toBe('A={{b}} B=SECRET');
    expect(rendered.missing).toEqual([]);
  });

  it('accepts spaces inside the braces and upper-cases the first letter for {{name^}}', () => {
    expect(renderTemplate('{{ who }} runs assemble{{variant^}} for {{variant}}', { who: 'CI', variant: 'debug' }).text)
      .toBe('CI runs assembleDebug for debug');
  });

  it('names placeholders left unfilled and values the template does not use', () => {
    const rendered = renderTemplate('{{a}} {{b}} {{b}} {{c}}', { a: 1, c: null, typo: 'x' });
    expect(rendered.text).toBe('1 {{b}} {{b}} {{c}}');
    expect(rendered.missing).toEqual(['b', 'c']);
    expect(rendered.unused).toEqual(['c', 'typo']);
  });

  it('writes objects and arrays as JSON rather than [object Object]', () => {
    expect(renderTemplate('{{o}} {{l}} {{t}}', { o: { x: 1 }, l: [1, 2], t: true }).text).toBe('{"x":1} [1,2] true');
  });

  it('does not treat inherited properties as values', () => {
    expect(renderTemplate('{{toString}} {{constructor}}', {}).missing).toEqual(['toString', 'constructor']);
  });
});

describe('PromptStore state directory', () => {
  let root: string;
  let library: string;
  let state: string;

  beforeAll(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'prompts-state-'));
    library = path.join(root, 'library');
    state = path.join(root, 'state');
    fs.mkdirSync(path.join(library, 'ops'), { recursive: true });
    fs.writeFileSync(path.join(library, 'ops', 'lib-a.json'), JSON.stringify({ id: 'lib-a', name: 'Library A', content: 'a', tags: ['x'] }));
    fs.writeFileSync(path.join(library, 'ops', 'lib-b.json'), JSON.stringify({ id: 'lib-b', name: 'Library B', content: 'b', isTemplate: true }));
  });
  afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

  const open = (options: { readOnly?: boolean } = {}) => {
    const store = new PromptStore();
    store.load({ promptsDir: library });
    store.openStateDir(state, options);
    return store;
  };

  it('saves added, updated and deleted prompts and loads them at the next start', () => {
    const first = open();
    expect(first.stats().storage).toBe('file');
    const added = first.add(CreatePromptParams.parse({ id: 'mine', name: 'Mine', content: 'm', description: 'd' }));
    first.update('lib-a', { name: 'Library A, edited' });
    first.delete('lib-b');

    const second = open();
    expect(second.get('mine')).toMatchObject({ name: 'Mine', description: 'd', createdAt: added.createdAt });
    expect(second.get('lib-a')).toMatchObject({ name: 'Library A, edited', version: 2 });
    expect(() => second.get('lib-b')).toThrow(PromptNotFoundError);
    expect(second.size).toBe(2);
    // The library itself is never written to.
    expect(JSON.parse(fs.readFileSync(path.join(library, 'ops', 'lib-a.json'), 'utf8')).name).toBe('Library A');
    expect(fs.readdirSync(state).filter(name => name.endsWith('.tmp'))).toEqual([]);
  });

  it('keeps a saved edit of a library prompt inside its group, so selections still apply', () => {
    const store = open();
    expect(store.select({ ...SELECT_ALL, prompts: [], templates: [] }).all().map(p => p.id)).toEqual(['mine']);
    expect(store.catalog().served.find(p => p.id === 'lib-a')).toMatchObject({ source: 'library', group: 'ops' });
  });

  it('lets a deleted id be added again and forgets a deleted runtime prompt', () => {
    const store = open();
    store.add(CreatePromptParams.parse({ id: 'lib-b', name: 'B again', content: 'b2' }));
    store.delete('mine');
    const next = open();
    expect(next.get('lib-b').name).toBe('B again');
    expect(() => next.get('mine')).toThrow(PromptNotFoundError);
    expect(fs.existsSync(path.join(state, 'mine.json'))).toBe(false);
  });

  it('gives ids that are not plain lower-case names a hashed file, never a path', () => {
    const store = open();
    store.add({ id: 'MixedCase', name: 'Mixed', content: 'c', isTemplate: false, tags: [] });
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prompts-odd-'));
    fs.writeFileSync(path.join(dir, 'odd.json'), JSON.stringify({ id: '../../outside', name: 'Odd id', content: 'c' }));
    store.loadDirectory(dir, 'user');
    store.update('../../outside', { name: 'Odd id, edited' });
    const names = fs.readdirSync(state);
    expect(names.filter(name => name.startsWith('x-')).length).toBe(2);
    expect(names).not.toContain('MixedCase.json');
    expect(fs.existsSync(path.join(root, 'outside.json'))).toBe(false);
    expect(open().get('MixedCase').name).toBe('Mixed');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('reads the directory without writing to it when read-only', () => {
    const store = open({ readOnly: true });
    expect(store.get('lib-a').name).toBe('Library A, edited');
    expect(store.stateDir).toBeUndefined();
    expect(store.stats().storage).toBe('memory');
  });

  it('fails at start when the directory cannot be written', () => {
    const file = path.join(root, 'a-file');
    fs.writeFileSync(file, '');
    const store = new PromptStore();
    expect(() => store.openStateDir(path.join(file, 'state'))).toThrow(PromptStorageError);
  });

  it('leaves the prompt as it was when a save fails', () => {
    const dir = path.join(root, 'vanishing');
    const store = new PromptStore();
    store.openStateDir(dir);
    const kept = store.add({ id: 'kept', name: 'Kept', content: 'c', isTemplate: false, tags: [] });
    // The directory is replaced by a file, so every later write fails.
    fs.rmSync(dir, { recursive: true, force: true });
    fs.writeFileSync(dir, '');
    expect(() => store.add({ name: 'Lost', content: 'c', isTemplate: false, tags: [] })).toThrow(PromptStorageError);
    expect(() => store.update('kept', { name: 'Changed' })).toThrow(/nothing was changed/);
    expect(() => store.delete('kept')).toThrow(PromptStorageError);
    expect(store.get('kept')).toEqual(kept);
    expect(store.size).toBe(1);
    fs.rmSync(dir, { force: true });
  });
});

describe('PromptStore state directory shared by several servers', () => {
  let root: string;
  let library: string;
  let state: string;

  beforeAll(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'prompts-shared-'));
    library = path.join(root, 'library');
    state = path.join(root, 'state');
    fs.mkdirSync(path.join(library, 'ops'), { recursive: true });
    fs.writeFileSync(path.join(library, 'ops', 'lib-a.json'), JSON.stringify({ id: 'lib-a', name: 'Library A', content: 'a' }));
    fs.writeFileSync(path.join(library, 'ops', 'lib-b.json'), JSON.stringify({ id: 'lib-b', name: 'Library B', content: 'b' }));
  });
  afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

  const open = (options: { readOnly?: boolean } = {}) => {
    const store = new PromptStore();
    store.load({ promptsDir: library });
    store.openStateDir(state, options);
    return store;
  };
  const note = (id: string, name: string) => CreatePromptParams.parse({ id, name, content: `${name} content` });

  it('shows one server what another added, changed and deleted, without a restart', () => {
    const first = open();
    const second = open();
    first.add(note('shared-note', 'From the first'));
    expect(second.get('shared-note').name).toBe('From the first');
    expect(second.list().map(p => p.id)).toContain('shared-note');

    second.update('shared-note', { name: 'Edited by the second' });
    second.update('lib-a', { name: 'Library A, edited' });
    expect(first.get('shared-note')).toMatchObject({ name: 'Edited by the second', version: 2 });
    expect(first.get('lib-a').name).toBe('Library A, edited');

    first.delete('shared-note');
    first.delete('lib-b');
    expect(() => second.get('shared-note')).toThrow(PromptNotFoundError);
    expect(() => second.get('lib-b')).toThrow(PromptNotFoundError);
    expect(second.size).toBe(1);
  });

  it('refuses an id another server has taken instead of overwriting its prompt', () => {
    const first = open();
    const second = open();
    first.add(note('claimed', 'First come'));
    expect(() => second.add(note('claimed', 'Second come'))).toThrow(PromptConflictError);
    expect(JSON.parse(fs.readFileSync(path.join(state, 'claimed.json'), 'utf8')).name).toBe('First come');
    // A file this server has not read yet is protected too (here: one it cannot serve).
    fs.writeFileSync(path.join(state, 'unreadable.json'), '{ not json');
    expect(() => second.add(note('unreadable', 'Mine'))).toThrow(PromptConflictError);
    expect(fs.readFileSync(path.join(state, 'unreadable.json'), 'utf8')).toBe('{ not json');
    expect(fs.readdirSync(state).filter(name => name.endsWith('.tmp'))).toEqual([]);
    fs.rmSync(path.join(state, 'unreadable.json'));
  });

  it('keeps a library prompt deleted after it was added again and deleted again', () => {
    const store = open();
    // lib-b was deleted by the first test.
    store.add(note('lib-b', 'B, written anew'));
    expect(store.catalog().served.find(p => p.id === 'lib-b')).toMatchObject({ source: 'library', group: 'ops' });
    store.delete('lib-b');
    expect(() => open().get('lib-b')).toThrow(PromptNotFoundError);
  });

  it('lets a read-only server follow the changes and refuses changes through it', () => {
    const writer = open();
    const reader = open({ readOnly: true });
    writer.add(note('late', 'Added after the reader started'));
    expect(reader.get('late').name).toBe('Added after the reader started');
    expect(() => reader.add(note('nope', 'Nope'))).toThrow(PromptUsageError);
    expect(() => reader.update('late', { name: 'Changed' })).toThrow(/read-only/);
    expect(() => reader.delete('late')).toThrow(PromptUsageError);
    expect(writer.get('late').name).toBe('Added after the reader started');
  });

  it('applies saved changes to a directory loaded after the state directory was opened', () => {
    const own = path.join(root, 'own');
    fs.mkdirSync(own);
    fs.writeFileSync(path.join(own, 'mine.json'), JSON.stringify({ id: 'mine', name: 'Mine', content: 'm' }));
    const first = open();
    first.loadDirectory(own, 'user');
    first.update('mine', { name: 'Mine, edited' });
    const second = open();
    second.loadDirectory(own, 'user');
    expect(second.get('mine').name).toBe('Mine, edited');
    expect(second.catalog().served.find(p => p.id === 'mine')).toMatchObject({ source: 'user' });
  });

  it('removes only temporary files old enough to be abandoned when it opens the directory', () => {
    const abandoned = path.join(state, '.old.json.1.aaaa.tmp');
    const inProgress = path.join(state, '.new.json.2.bbbb.tmp');
    fs.writeFileSync(abandoned, 'x');
    fs.writeFileSync(inProgress, 'x');
    const hourAgo = new Date(Date.now() - 3_600_000);
    fs.utimesSync(abandoned, hourAgo, hourAgo);
    open();
    expect(fs.existsSync(abandoned)).toBe(false);
    expect(fs.existsSync(inProgress)).toBe(true);
    fs.rmSync(inProgress);
  });
});
