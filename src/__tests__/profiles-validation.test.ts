import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { matchesEntry, PromptStore } from '../prompt-store';

const LIBRARY = path.join(__dirname, '..', '..', 'data', 'prompts');
const PROFILES_PATH = path.join(LIBRARY, 'profiles.json');
const KNOWN_JINJA = 'ai-self-improvement-orchestrator';

type Selector = 'all' | 'none' | string[];

interface ProfilesFile {
  profiles: Record<string, {
    description?: string;
    prompts?: Selector;
    templates?: Selector;
    exclude?: string[];
  }>;
}

interface LibraryPrompt {
  id: string;
  group: string;
  template: boolean;
  tags: string[];
}

function entries(selector: Selector | undefined): string[] {
  return Array.isArray(selector) ? selector : [];
}

function languageOf(prompt: { metadata?: Record<string, unknown> }): string | undefined {
  const value = prompt.metadata?.language;
  return typeof value === 'string' ? value.toLowerCase() : undefined;
}

describe('bundled profiles validation', () => {
  const store = new PromptStore();
  store.load({ promptsDir: LIBRARY });

  const catalog = store.catalog();
  const byId = new Map(store.all().map(prompt => [prompt.id, prompt]));
  const library: LibraryPrompt[] = catalog.served
    .filter(prompt => prompt.source === 'library')
    .map(prompt => ({
      id: prompt.id,
      group: prompt.group ?? '',
      template: prompt.template,
      tags: byId.get(prompt.id)?.tags ?? [],
    }));
  const profiles = JSON.parse(fs.readFileSync(PROFILES_PATH, 'utf8')) as ProfilesFile;

  it('references only ids, groups and tags that exist, under the right key', () => {
    for (const [name, profile] of Object.entries(profiles.profiles)) {
      for (const [key, selector] of [['prompts', profile.prompts], ['templates', profile.templates]] as const) {
        const wantTemplate = key === 'templates';
        for (const entry of entries(selector)) {
          const matches = library.filter(prompt => matchesEntry(entry, prompt, prompt.group));
          expect(matches, `${name} ${key}: "${entry}" matches nothing`).not.toHaveLength(0);
          expect(
            matches.filter(prompt => prompt.template === wantTemplate),
            `${name} ${key}: "${entry}" matches only ${wantTemplate ? 'plain prompts' : 'templates'}`,
          ).not.toHaveLength(0);
        }
      }
      for (const entry of profile.exclude ?? []) {
        expect(
          library.filter(prompt => matchesEntry(entry, prompt, prompt.group)),
          `${name} exclude: "${entry}" matches nothing`,
        ).not.toHaveLength(0);
      }
    }
  });

  it('serves android-phone from exactly the expected ids', () => {
    expect(store.selectProfiles(['android-phone']).all().map(prompt => prompt.id).sort()).toEqual([
      'android-app-agent-calibrate',
      'android-app-agent-design',
      'android-app-agent-eval',
      'android-app-agent-use',
      'android-automation-router',
      'android-browser-agent',
      'android-event-bus',
      'android-proot-phone-ops',
      'android-split-screen-two-apps',
      'deep-research-ai-ecosystem-consolidation',
      'gemini-advisor-brief',
      'phone-agent-handoff',
      'phone-voice-assistant',
      'scenario-deep-research-to-notebook',
      'scenario-multi-ai-pr-review',
      'tasker-config-audit',
      'tasker-direct-edit',
      'tasker-profile-builder',
      'tasker-project-architecture',
      'tasker-scene-builder',
      'tasker-scene-xml',
      'tasker-task-actions',
      'tasker-variables',
      'termux-api-commands',
      'termux-proot-bridge',
    ]);
  });

  it('uses only mustache placeholders that apply_template can fill', () => {
    for (const prompt of store.all()) {
      if (!prompt.isTemplate || prompt.id === KNOWN_JINJA) continue;
      const content = String(prompt.content ?? '');
      expect(content, `${prompt.id}: Jinja block`).not.toMatch(/\{%|%\}/);
      const declared = new Set((prompt.variables ?? []).map(variable => (typeof variable === 'string' ? variable : variable.name)));
      for (const match of content.matchAll(/\{\{([^{}]*)\}\}/g)) {
        const raw = match[1].trim();
        if (raw === '') continue;
        expect(raw, `${prompt.id}: {{${raw}}} is not a mustache variable`).toMatch(/^[A-Za-z_]\w*\^?$/);
        const name = raw.endsWith('^') ? raw.slice(0, -1) : raw;
        expect(declared.has(name), `${prompt.id}: {{${name}}} is not declared in variables`).toBe(true);
      }
    }
  });

  it('keeps Jinja out of every template but the known unprofiled one', () => {
    const offenders = store.all()
      .filter(prompt => prompt.isTemplate && /\{%|%\}/.test(String(prompt.content ?? '')))
      .map(prompt => prompt.id)
      .filter(id => id !== KNOWN_JINJA);
    expect(offenders).toEqual([]);
  });

  it('keeps cs/cz and en prompt pairs consistent', () => {
    const pairs = new Map<string, { cs?: LibraryPrompt; en?: LibraryPrompt }>();
    for (const prompt of library) {
      const match = /^(.*?)([._-])(cs|cz|en)$/i.exec(prompt.id);
      if (!match) continue;
      const key = `${match[1]}${match[2]}`;
      const pair = pairs.get(key) ?? {};
      if (match[3].toLowerCase() === 'en') pair.en = prompt;
      else pair.cs = prompt;
      pairs.set(key, pair);
    }
    for (const [key, pair] of pairs) {
      if (!pair.cs || !pair.en) continue;
      expect(languageOf(byId.get(pair.cs.id)!), `${key}: Czech prompt language`).toBe('cs');
      expect(languageOf(byId.get(pair.en.id)!), `${key}: English prompt language`).toBe('en');
    }
  });
});
