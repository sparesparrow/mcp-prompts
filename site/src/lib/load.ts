// Where the page gets the library from. On GitHub Pages the site is the repository's main
// branch, so it reads the prompt files themselves: prompt-files.json (made by Jekyll from the
// files it publishes) lists them, and profiles.json and package.json sit beside them. Anywhere
// else, or when that fails, it uses the snapshot built with the page.

import { buildPrompts, parseProfiles, type Library } from './library.ts';

export interface Snapshot extends Library {
  version: string;
}

export interface LoadedLibrary extends Library {
  source: 'live' | 'snapshot';
  /** Why the live library could not be used, when it could not. */
  fallbackReason?: string;
}

const LIBRARY_PREFIX = '/data/prompts/';

async function fetchJson(url: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(url, { signal, cache: 'no-cache' });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.json();
}

/** Reads the live library relative to the page's own address. */
export async function loadLive(base: URL, signal: AbortSignal): Promise<Library> {
  const listing = await fetchJson(new URL('prompt-files.json', base).href, signal);
  if (!Array.isArray(listing)) throw new Error('prompt-files.json is not a list');
  // Jekyll gives paths from the site root, e.g. /data/prompts/mia-car/x.json.
  const paths = listing
    .filter((item): item is string => typeof item === 'string' && item.startsWith(LIBRARY_PREFIX))
    .map(item => item.slice(LIBRARY_PREFIX.length));
  if (paths.length === 0) throw new Error('prompt-files.json lists no prompt files');

  const [profilesRaw, pkg, files] = await Promise.all([
    fetchJson(new URL('data/prompts/profiles.json', base).href, signal).catch(() => undefined),
    fetchJson(new URL('package.json', base).href, signal).catch(() => undefined),
    Promise.all(
      paths.map(async file => ({
        path: file,
        data: await fetchJson(new URL(`data/prompts/${file.split('/').map(encodeURIComponent).join('/')}`, base).href, signal).catch(
          () => undefined
        ),
      }))
    ),
  ]);
  const { prompts, skipped } = buildPrompts(files);
  if (prompts.length === 0) throw new Error('no prompt file could be read');
  const version = typeof pkg === 'object' && pkg !== null && typeof (pkg as { version?: unknown }).version === 'string'
    ? (pkg as { version: string }).version
    : undefined;
  return { prompts, skipped, profiles: profilesRaw === undefined ? [] : parseProfiles(profilesRaw), version };
}

/** The live library when the page runs on a web server that has it, otherwise the snapshot. */
export async function loadLibrary(snapshot: Snapshot, signal: AbortSignal): Promise<LoadedLibrary> {
  if (!location.protocol.startsWith('http')) {
    return { ...snapshot, source: 'snapshot', fallbackReason: 'the page was opened from a file' };
  }
  try {
    const live = await loadLive(new URL('.', location.href), signal);
    return { ...live, version: live.version ?? snapshot.version, source: 'live' };
  } catch (error) {
    return { ...snapshot, source: 'snapshot', fallbackReason: error instanceof Error ? error.message : String(error) };
  }
}
