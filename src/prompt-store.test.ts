import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PromptNotFoundError, PromptStore, PromptUsageError, SELECT_ALL, UpdatePromptParams, type Selection } from './prompt-store';
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
