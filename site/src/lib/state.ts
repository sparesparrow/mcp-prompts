// The page's choices, kept in its own address so a set-up can be shared as a link. The
// selection parameters have the names and syntax of the server's /mcp URL (profile, prompts,
// templates, exclude, expose, readOnly); the rest describe how the server is run.

import { CAPABILITIES, type Capability, type InstallOptions, type Runner } from './install.ts';
import type { Selector } from './library.ts';

export interface PageState {
  profiles: string[];
  prompts: Selector;
  templates: Selector;
  exclude: string[];
  expose: Capability[];
  readOnly: boolean;
  runner: Runner;
  name: string;
  baseUrl: string;
  token: boolean;
  dir: string;
  stateDir: string;
}

export const DEFAULT_STATE: PageState = {
  profiles: [],
  prompts: 'all',
  templates: 'all',
  exclude: [],
  expose: ['tools'],
  readOnly: false,
  runner: 'global',
  name: 'mcp-prompts',
  baseUrl: 'http://localhost:3003',
  token: false,
  dir: '',
  stateDir: '',
};

const RUNNERS: Runner[] = ['global', 'npx', 'docker', 'http'];

function entries(value: string | null): string[] {
  return value === null ? [] : Array.from(new Set(value.split(',').map(entry => entry.trim()).filter(Boolean)));
}

function selector(value: string | null): Selector {
  const list = entries(value);
  if (value === null || list.length === 0 || list.includes('all')) return 'all';
  if (list.includes('none')) return [];
  return list;
}

export function stateFromQuery(search: string): PageState {
  const query = new URLSearchParams(search);
  const expose = entries(query.get('expose')).filter((item): item is Capability => (CAPABILITIES as readonly string[]).includes(item));
  const runner = query.get('run') as Runner | null;
  return {
    profiles: entries(query.get('profile')),
    prompts: selector(query.get('prompts')),
    templates: selector(query.get('templates')),
    exclude: entries(query.get('exclude')),
    expose: expose.length > 0 ? CAPABILITIES.filter(item => expose.includes(item)) : DEFAULT_STATE.expose,
    readOnly: ['true', '1', 'yes', 'on'].includes((query.get('readOnly') ?? '').toLowerCase()),
    runner: runner && RUNNERS.includes(runner) ? runner : DEFAULT_STATE.runner,
    name: query.get('name')?.trim() || DEFAULT_STATE.name,
    baseUrl: query.get('url')?.trim() || DEFAULT_STATE.baseUrl,
    token: query.get('token') === '1',
    dir: query.get('dir')?.trim() ?? '',
    stateDir: query.get('stateDir')?.trim() ?? '',
  };
}

const selectorText = (value: Selector) => (value === 'all' ? null : value.length === 0 ? 'none' : value.join(','));

export function queryFromState(state: PageState): string {
  const pairs: Array<[string, string | null]> = [
    ['profile', state.profiles.length > 0 ? state.profiles.join(',') : null],
    ['prompts', selectorText(state.prompts)],
    ['templates', selectorText(state.templates)],
    ['exclude', state.exclude.length > 0 ? state.exclude.join(',') : null],
    ['expose', state.expose.join(',') !== DEFAULT_STATE.expose.join(',') ? state.expose.join(',') : null],
    ['readOnly', state.readOnly ? 'true' : null],
    ['run', state.runner !== DEFAULT_STATE.runner ? state.runner : null],
    ['name', state.name !== DEFAULT_STATE.name ? state.name : null],
    ['url', state.runner === 'http' && state.baseUrl !== DEFAULT_STATE.baseUrl ? state.baseUrl : null],
    ['token', state.runner === 'http' && state.token ? '1' : null],
    ['dir', state.dir || null],
    ['stateDir', state.stateDir || null],
  ];
  const text = pairs
    .filter((pair): pair is [string, string] => pair[1] !== null)
    .map(([key, value]) => `${key}=${encodeURIComponent(value).replace(/%2C/gi, ',').replace(/%3A/gi, ':').replace(/%2F/gi, '/')}`)
    .join('&');
  return text ? `?${text}` : '';
}

/** The install options of a page state, keeping only profiles the library defines. */
export function installOptions(state: PageState, knownProfiles: string[]): InstallOptions {
  return {
    profiles: state.profiles.filter(name => knownProfiles.includes(name)),
    selection: { prompts: state.prompts, templates: state.templates, exclude: state.exclude },
    expose: state.expose,
    readOnly: state.readOnly,
    dirs: state.dir ? [state.dir] : [],
    stateDir: state.stateDir || undefined,
  };
}
