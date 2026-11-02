import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { PromptStore } from './prompt-store';

// The Claude Code plugin in claude-plugin/ must keep its pinned server version, its launcher and its
// starter prompts consistent with each other.

const pluginRoot = path.join(process.cwd(), 'claude-plugin');
const readJson = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8'));

describe('claude-plugin', () => {
  const manifest = readJson(path.join(pluginRoot, '.claude-plugin', 'plugin.json'));
  const launcher = fs.readFileSync(path.join(pluginRoot, 'bin', 'start-mcp-prompts.sh'), 'utf8');

  it('pins the same server version in the manifest and the launcher', () => {
    const pinned = launcher.match(/^version=(\S+)$/m)?.[1];
    expect(pinned).toBe(manifest.version);
    expect(launcher).toContain('npx -y "@sparesparrow/mcp-prompts@$version"');
  });

  it('is started through the launcher, which resolves the plugin root', () => {
    const mcp = readJson(path.join(pluginRoot, '.mcp.json'));
    expect(mcp.mcpServers['mcp-prompts'].command).toBe('${CLAUDE_PLUGIN_ROOT}/bin/start-mcp-prompts.sh');
    expect(fs.statSync(path.join(pluginRoot, 'bin', 'start-mcp-prompts.sh')).mode & 0o111).not.toBe(0);
  });

  it('ships a skill whose frontmatter names it', () => {
    const skill = fs.readFileSync(path.join(pluginRoot, 'skills', 'prompt-library', 'SKILL.md'), 'utf8');
    expect(skill).toMatch(/^---\nname: prompt-library\ndescription: .+\n---\n/);
  });

  it('lists the plugin in the marketplace with the same version and a source that exists', () => {
    const marketplace = readJson(path.join(process.cwd(), '.claude-plugin', 'marketplace.json'));
    const entry = marketplace.plugins.find((p: { name: string }) => p.name === 'mcp-prompts');
    expect(entry.version).toBe(manifest.version);
    expect(fs.existsSync(path.join(process.cwd(), entry.source, '.claude-plugin', 'plugin.json'))).toBe(true);
  });

  it('loads every starter prompt and fills its template', () => {
    const store = new PromptStore();
    const dir = path.join(pluginRoot, 'prompts');
    expect(store.loadDirectory(dir)).toBe(fs.readdirSync(dir).filter(f => f.endsWith('.json')).length);

    for (const summary of store.list({})) {
      const prompt = store.get(summary.id);
      if (!prompt.isTemplate) continue;
      const declared = (prompt.variables ?? []).map(v => (typeof v === 'string' ? v : v.name));
      const placeholders = [...prompt.content.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]);
      expect(new Set(placeholders)).toEqual(new Set(declared));

      const values = Object.fromEntries(declared.map(name => [name, `<${name}>`]));
      const filled = store.applyTemplate(prompt.id, values);
      expect(filled).not.toMatch(/\{\{\w+\}\}/);
    }
  });
});
