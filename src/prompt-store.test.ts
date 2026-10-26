import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PromptNotFoundError, PromptStore, PromptUsageError, UpdatePromptParams } from './prompt-store';

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
