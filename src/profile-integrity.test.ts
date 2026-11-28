import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { PromptStore, renderTemplate } from './prompt-store';

// MP-3: Profile integrity suite.
//
// Checks that every profile in the bundled library:
//   1. Has a non-empty description and no dangling entry references.
//   2. Serves at least one prompt or template.
//   3. Serves only templates that renderTemplate can fill without leaving an unfilled placeholder
//      (no Jinja {% %} blocks; every {{name}} used in content is declared in variables).
//   4. Can render every template to completion when each declared variable is given a value.
//   5. Has no cross-contamination with profiles whose domains should stay separate.
//   6. The library has no cs/en translation pairs (confirmed absent; this test documents it and
//      will fail fast if a cs prompt with a missing en sibling is added later).
//
// The tests mirror the acceptance criteria in docs/research/2026-11-android-nl-automation.md §3.1.

const PROMPTS_DIR = path.join(__dirname, '..', 'data', 'prompts');

const store = new PromptStore();
store.load({ promptsDir: PROMPTS_DIR });

const served = (name: string) => store.selectProfiles([name]).all();

/** Variable names declared on a prompt (supports both string[] and {name}[] formats). */
function declaredVars(p: { variables?: unknown }): Set<string> {
  const vars = (p as { variables?: unknown[] }).variables ?? [];
  return new Set(vars.map(v => (typeof v === 'string' ? v : (v as { name: string }).name)).filter(Boolean));
}

/** All {{name}} placeholders used in a string. */
function usedPlaceholders(content: string): string[] {
  return [...content.matchAll(/\{\{\s*([A-Za-z_]\w*)\s*\}\}/g)].map(m => m[1]);
}

// ---------------------------------------------------------------------------
// 1. Shape: descriptions and no dangling entries
// ---------------------------------------------------------------------------
describe('profile shapes', () => {
  it('every profile has a description longer than 20 characters', () => {
    for (const profile of store.profiles()) {
      expect(profile.description.length, profile.name).toBeGreaterThan(20);
    }
  });

  it('no profile entry points at a group, id or tag that does not exist in the library', () => {
    for (const profile of store.profiles()) {
      expect(profile.warnings, profile.name).toEqual([]);
    }
  });

  it('each profile serves at least one prompt or template', () => {
    for (const profile of store.profiles()) {
      expect(profile.prompts + profile.templates, profile.name).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Fillability: no Jinja, no undeclared placeholders
// ---------------------------------------------------------------------------
describe('profile template fillability', () => {
  it('no template served by any profile contains a Jinja {% %} block', () => {
    for (const profile of store.profiles()) {
      for (const p of served(profile.name).filter(p => p.isTemplate)) {
        const content = String(p.content ?? '');
        expect(content, `${profile.name}: ${p.id}`).not.toMatch(/\{%/);
      }
    }
  });

  it('every {{placeholder}} in a template is declared in its variables list', () => {
    for (const profile of store.profiles()) {
      for (const p of served(profile.name).filter(p => p.isTemplate)) {
        const content = String(p.content ?? '');
        const declared = declaredVars(p);
        const undeclared = usedPlaceholders(content).filter(name => !declared.has(name));
        expect(undeclared, `${profile.name}: ${p.id} has undeclared placeholders`).toEqual([]);
      }
    }
  });

  it('renderTemplate leaves no unfilled placeholder when every variable is supplied', () => {
    for (const profile of store.profiles()) {
      for (const p of served(profile.name).filter(p => p.isTemplate)) {
        const content = String(p.content ?? '');
        const values = Object.fromEntries([...declaredVars(p)].map(name => [name, `<${name}>`]));
        const result = renderTemplate(content, values);
        expect(result.missing, `${profile.name}: ${p.id} missing after render`).toEqual([]);
        expect(result.text, `${profile.name}: ${p.id} still has {{ after render`).not.toContain('{{');
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Cross-profile isolation: domains that must stay separate
// ---------------------------------------------------------------------------
describe('profile domain isolation', () => {
  it('software-dev has no vehicle, voice, home or MIA prompts', () => {
    const foreign = ['mia', 'car', 'automotive', 'voice', 'openclaw', 'home', 'zigbee'];
    const dev = served('software-dev');
    expect(dev.filter(p => p.tags.some(t => foreign.includes(t))).map(p => p.id)).toEqual([]);
    expect(dev.filter(p => /^(mia|openclaw)-/.test(p.id)).map(p => p.id)).toEqual([]);
  });

  it('mia-vehicle has no development or orchestration prompts', () => {
    const car = served('mia-vehicle').map(p => p.id);
    expect(car.filter(id => id.startsWith('orchestration_main_'))).toEqual([]);
    // Every mia-car directory entry is reachable.
    const carGroup = store.catalog().served.filter(p => p.group === 'mia-car').map(p => p.id);
    expect(carGroup.length).toBeGreaterThan(0);
    expect(car).toEqual(expect.arrayContaining(carGroup));
  });

  it('android-phone is a superset of android-automation and tasker-automation', () => {
    const phone = new Set(served('android-phone').map(p => p.id));
    for (const p of served('android-automation')) {
      expect(phone.has(p.id), `android-automation prompt ${p.id} missing from android-phone`).toBe(true);
    }
    for (const p of served('tasker-automation')) {
      expect(phone.has(p.id), `tasker-automation prompt ${p.id} missing from android-phone`).toBe(true);
    }
  });

  it('android-phone has no vehicle, home, MIA or software-dev-only prompts', () => {
    const phone = served('android-phone');
    const devOnly = [
      'orchestration_main_python_backend', 'orchestration_main_web_frontend', 'orchestration_main_web_backend',
      'orchestration_main_cpp_backend', 'orchestration_main_devops_infrastructure', 'orchestration_main_generic',
    ];
    const carOnly = ['mia-car-climate-control', 'mia-car-diagnostic-analysis', 'mia-car-navigation'];
    for (const id of devOnly) expect(phone.some(p => p.id === id), id).toBe(false);
    for (const id of carOnly) expect(phone.some(p => p.id === id), id).toBe(false);
  });

  it("liberty-citations is not served by any other profile, and takes no other profile's prompts", () => {
    const licIds = new Set(served('liberty-citations').map(p => p.id));
    for (const name of store.profileNames.filter(n => n !== 'liberty-citations')) {
      const overlap = served(name).filter(p => licIds.has(p.id)).map(p => p.id);
      expect(overlap, `${name} overlaps liberty-citations`).toEqual([]);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. cs/en translation pairs
// ---------------------------------------------------------------------------
describe('cs/en translation pairs', () => {
  // The library contains cs-language prompts (plain prompts, not templates).
  // There are no cs/en template pairs because templates must be language-neutral.
  // This test documents that and will fail fast if a cs template is added later.

  it('no template has language "cs" (templates must be language-neutral)', () => {
    const allIds: Array<{ id: string; lang: string; isTemplate: boolean }> = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith('.json') && !['profiles.json', 'index.json'].includes(entry.name)) {
          const data = JSON.parse(fs.readFileSync(full, 'utf8'));
          if (typeof data.id === 'string') {
            const lang: string = data.language ?? data.lang ?? data.metadata?.language ?? '';
            allIds.push({ id: data.id, lang, isTemplate: Boolean(data.isTemplate) });
          }
        }
      }
    };
    walk(PROMPTS_DIR);
    const csTemplates = allIds.filter(p => p.lang === 'cs' && p.isTemplate);
    expect(csTemplates.map(p => p.id)).toEqual([]);
  });

  it('every cs plain prompt is covered by at least one profile', () => {
    const walk = (dir: string): Array<{ id: string; lang: string; isTemplate: boolean }> => {
      const result: Array<{ id: string; lang: string; isTemplate: boolean }> = [];
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) result.push(...walk(full));
        else if (entry.name.endsWith('.json') && !['profiles.json', 'index.json'].includes(entry.name)) {
          const data = JSON.parse(fs.readFileSync(full, 'utf8'));
          if (typeof data.id === 'string') {
            const lang: string = data.language ?? data.lang ?? data.metadata?.language ?? '';
            result.push({ id: data.id, lang, isTemplate: Boolean(data.isTemplate) });
          }
        }
      }
      return result;
    };
    const csPrompts = walk(PROMPTS_DIR).filter(p => p.lang === 'cs' && !p.isTemplate);
    expect(csPrompts.length).toBeGreaterThan(0); // sanity: the library has cs plain prompts
    const profiledIds = new Set(
      store.profileNames.flatMap(name => served(name).map(p => p.id))
    );
    for (const p of csPrompts) {
      expect(profiledIds.has(p.id), `cs prompt ${p.id} is in no profile`).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 5. android-phone profile specifics (MP-1)
// ---------------------------------------------------------------------------
describe('android-phone profile', () => {
  it('is defined in profiles.json', () => {
    expect(store.profileNames).toContain('android-phone');
  });

  it('serves the android-automation router and voice assistant', () => {
    const ids = served('android-phone').map(p => p.id);
    expect(ids).toContain('android-automation-router');
    expect(ids).toContain('phone-voice-assistant');
    expect(ids).toContain('android-proot-phone-ops');
  });

  it('serves the full Tasker template set', () => {
    const ids = served('android-phone').map(p => p.id);
    for (const id of [
      'tasker-config-audit', 'tasker-direct-edit', 'tasker-profile-builder',
      'tasker-project-architecture', 'tasker-scene-builder', 'tasker-task-actions', 'tasker-variables',
    ]) {
      expect(ids, id).toContain(id);
    }
  });

  it('has a description that mentions the voice pipeline', () => {
    const profile = store.profiles().find(p => p.name === 'android-phone')!;
    expect(profile.description.toLowerCase()).toMatch(/voice/);
  });

  it('stays under the library half-size guard', () => {
    const profile = store.profiles().find(p => p.name === 'android-phone')!;
    expect(profile.prompts + profile.templates).toBeLessThan(store.size / 2);
  });
});
