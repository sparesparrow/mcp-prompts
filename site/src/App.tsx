import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Link2, Loader2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CodeBlock, CopyButton } from '@/components/CodeBlock';
import { EntryInput } from '@/components/EntryInput';
import { SelectorEditor } from '@/components/SelectorEditor';
import { ServedList } from '@/components/ServedList';
import { SELECT_ALL, servedPrompts, unmatchedEntries, type Snapshot } from '@/lib/library';
import { buildSnippets, CAPABILITIES, PACKAGE, type Capability, type Runner } from '@/lib/install';
import { loadLibrary, type LoadedLibrary } from '@/lib/load';
import { DEFAULT_STATE, installOptions, queryFromState, stateFromQuery, type PageState } from '@/lib/state';
import { cn } from '@/lib/utils';
import snapshotData from '@/data/snapshot.json';

const snapshot = snapshotData as Snapshot;
const REPO = 'https://github.com/sparesparrow/mcp-prompts';
const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

const RUNNERS: Array<{ value: Runner; label: string; detail: string }> = [
  { value: 'global', label: 'npm install', detail: 'the mcp-prompts command' },
  { value: 'npx', label: 'npx', detail: 'nothing to install' },
  { value: 'docker', label: 'Docker', detail: 'the stdio image' },
  { value: 'http', label: 'HTTP URL', detail: 'a running mcp-prompts-http' },
];

function Step({ n, title, hint, children }: { n: number; title: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="border-t pt-6">
      <div className="flex items-baseline gap-3">
        <span className="step-number">{String(n).padStart(2, '0')}</span>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      </div>
      {hint && <p className="mt-1 max-w-prose text-sm text-muted-foreground sm:pl-8">{hint}</p>}
      <div className="mt-4 sm:pl-8">{children}</div>
    </section>
  );
}

export default function App() {
  const [library, setLibrary] = useState<LoadedLibrary>({ ...snapshot, source: 'snapshot' });
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<PageState>(() => stateFromQuery(window.location.search));
  const update = (patch: Partial<PageState>) => setState(current => ({ ...current, ...patch }));

  useEffect(() => {
    const controller = new AbortController();
    loadLibrary(snapshot, controller.signal).then(loaded => {
      setLibrary(loaded);
      setLoading(false);
    });
    return () => controller.abort();
  }, []);

  // Keep the address in step, so the page as it stands can be shared.
  useEffect(() => {
    try {
      window.history.replaceState(null, '', `${window.location.pathname}${queryFromState(state)}${window.location.hash}`);
    } catch {
      // Some previews do not allow it; the page works the same.
    }
  }, [state]);

  const profileNames = library.profiles.map(profile => profile.name);
  const options = installOptions(state, profileNames);
  const scope = useMemo(() => servedPrompts(library, options.profiles, SELECT_ALL), [library, options.profiles.join(',')]);
  const served = servedPrompts(library, options.profiles, options.selection);
  const snippets = buildSnippets(options, state.runner, state.name.trim() || DEFAULT_STATE.name, state.baseUrl, state.token);
  const plainScope = scope.filter(prompt => !prompt.isTemplate);
  const templateScope = scope.filter(prompt => prompt.isTemplate);
  const servedTemplates = served.filter(prompt => prompt.isTemplate).length;
  const excludeSuggestions = useMemo(() => {
    const groups = Array.from(new Set(scope.flatMap(prompt => prompt.group.split('/').map((_, i, all) => all.slice(0, i + 1).join('/'))).filter(Boolean)));
    const tags = Array.from(new Set(scope.flatMap(prompt => prompt.tags))).map(tag => `tag:${tag}`);
    return [...groups.sort(), ...scope.map(prompt => prompt.id).sort(), ...tags.sort()];
  }, [scope]);
  const unknownProfiles = state.profiles.filter(name => !profileNames.includes(name));
  const shareUrl = `${window.location.origin}${window.location.pathname}${queryFromState(state)}`;

  const toggleCapability = (capability: Capability, on: boolean) => {
    const next = CAPABILITIES.filter(item => (item === capability ? on : state.expose.includes(item)));
    if (next.length > 0) update({ expose: next });
  };

  return (
    <div className="min-h-screen">
      <header className="border-b bg-card/60">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
          <a href={REPO} className="font-mono text-[15px] font-semibold tracking-tight">
            mcp-prompts
          </a>
          {library.version && <span className="rounded-sm bg-secondary px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">v{library.version}</span>}
          <nav className="ml-auto flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
            {[
              ['README', `${REPO}#readme`],
              ['Profiles', `${REPO}/blob/main/deploy/README.md`],
              ['npm', `https://www.npmjs.com/package/${PACKAGE}`],
              ['GitHub', REPO],
            ].map(([label, href]) => (
              <a key={label} href={href} className="inline-flex items-center gap-0.5 hover:text-foreground">
                {label}
                <ArrowUpRight className="size-3" />
              </a>
            ))}
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="max-w-3xl py-10">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-primary">MCP server · prompts and templates</p>
          <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">Install only the prompts you need.</h1>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            Pick a profile or your own selection, decide how MCP clients see it (tools, slash commands, attachable resources), and copy
            the install command, client config, URL or config file. The page builds the same lines as{' '}
            <code className="rounded-sm bg-secondary px-1 py-0.5 font-mono text-[0.85em] text-foreground">mcp-prompts config</code>.
          </p>
          <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            {loading ? (
              <>
                <Loader2 className="size-3.5 animate-spin" /> Reading the library from main…
              </>
            ) : library.source === 'live' ? (
              <>
                <span className="size-1.5 rounded-full bg-primary" /> Library read from main: {library.prompts.length} prompts, {library.profiles.length}{' '}
                profiles{library.skipped.length > 0 && `, ${library.skipped.length} files the server skips`}.
              </>
            ) : (
              <>
                <span className="size-1.5 rounded-full bg-template" /> Built-in snapshot of v{snapshot.version} ({library.prompts.length} prompts):{' '}
                {library.fallbackReason ?? 'the live library is not available here'}.
              </>
            )}
          </p>
        </div>

        <main className="grid grid-cols-[minmax(0,1fr)] gap-x-10 gap-y-10 pb-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)]">
          <div className="min-w-0 space-y-8">
            <Step
              n={1}
              title="Profile"
              hint="A profile is a ready-made selection for one kind of work. Tick several to serve the prompts of any of them; tick none for the whole library."
            >
              <div className="grid gap-2 sm:grid-cols-2">
                {library.profiles.map(profile => {
                  const checked = state.profiles.includes(profile.name);
                  const inProfile = servedPrompts(library, [profile.name], SELECT_ALL);
                  const templates = inProfile.filter(prompt => prompt.isTemplate).length;
                  return (
                    <label
                      key={profile.name}
                      className={cn(
                        'relative flex cursor-pointer gap-3 rounded-sm border bg-card p-3 pl-4 transition-colors hover:border-primary/50',
                        checked && 'border-primary/70 bg-accent/60'
                      )}
                    >
                      <span className={cn('absolute inset-y-0 left-0 w-[3px] rounded-l-sm', checked ? 'bg-primary' : 'bg-transparent')} />
                      <Checkbox
                        className="mt-0.5"
                        checked={checked}
                        onCheckedChange={on =>
                          update({ profiles: on ? [...state.profiles, profile.name] : state.profiles.filter(name => name !== profile.name) })
                        }
                      />
                      <span className="min-w-0 space-y-1">
                        <span className="block font-mono text-sm font-medium">{profile.name}</span>
                        <span className="block text-xs leading-snug text-muted-foreground">{profile.description}</span>
                        <span className="block font-mono text-[11px] text-muted-foreground">
                          {plural(inProfile.length - templates, 'prompt')} · {plural(templates, 'template')}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
              {library.profiles.length === 0 && <p className="text-sm text-muted-foreground">This library defines no profiles.</p>}
              {unknownProfiles.length > 0 && (
                <p className="mt-2 text-xs text-destructive">
                  The library has no profile {unknownProfiles.join(', ')}; it is left out.
                </p>
              )}
            </Step>

            <Step
              n={2}
              title="Prompts and templates"
              hint={
                <>
                  Narrow further, or choose without a profile. Plain prompts and templates are separate lists. A group is a directory of the
                  library and covers its subdirectories.
                </>
              }
            >
              <div className="grid gap-3 md:grid-cols-2">
                <SelectorEditor title="Plain prompts" prompts={plainScope} selector={state.prompts} onChange={prompts => update({ prompts })} />
                <SelectorEditor title="Templates" prompts={templateScope} selector={state.templates} onChange={templates => update({ templates })} />
              </div>
              <div className="mt-4 space-y-2">
                <Label className="text-sm font-medium">Leave out</Label>
                <p className="text-xs text-muted-foreground">Ids, groups or tags to drop from both lists. The × beside a served prompt adds it here.</p>
                <EntryInput
                  entries={state.exclude}
                  suggestions={excludeSuggestions}
                  onChange={exclude => update({ exclude })}
                  placeholder="id, group or tag:…"
                  unmatched={unmatchedEntries(library, state.exclude, 'any')}
                />
              </div>
            </Step>

            <Step n={3} title="How clients see them" hint="MCP capabilities this install exposes. Keep at least one.">
              <div className="space-y-2">
                {CAPABILITIES.map(capability => {
                  const on = state.expose.includes(capability);
                  const name = state.name.trim() || DEFAULT_STATE.name;
                  const detail = {
                    tools: `list_prompts, get_prompt, apply_template, get_stats${state.readOnly ? '' : ', add_prompt, update_prompt, delete_prompt'}`,
                    prompts: `each prompt is a slash command, e.g. /mcp__${name}__<id>; a template's variables are its arguments`,
                    resources: 'each prompt is readable as prompts://<id>, to attach as context with @',
                  }[capability];
                  return (
                    <label key={capability} className={cn('flex cursor-pointer items-start gap-3 rounded-sm border bg-card p-3', on && 'border-primary/60')}>
                      <Checkbox className="mt-0.5" checked={on} onCheckedChange={value => toggleCapability(capability, value === true)} disabled={on && state.expose.length === 1} />
                      <span className="min-w-0">
                        <span className="font-mono text-sm font-medium">{capability}</span>
                        <span className="block text-xs leading-snug text-muted-foreground">{detail}</span>
                      </span>
                    </label>
                  );
                })}
                <label className="flex cursor-pointer items-center justify-between gap-3 rounded-sm border bg-card p-3">
                  <span>
                    <span className="text-sm font-medium">Read-only</span>
                    <span className="block text-xs text-muted-foreground">No add_prompt, update_prompt or delete_prompt.</span>
                  </span>
                  <Switch checked={state.readOnly} onCheckedChange={readOnly => update({ readOnly })} />
                </label>
              </div>
            </Step>

            <Step n={4} title="Run it with">
              <div role="radiogroup" aria-label="Run it with" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {RUNNERS.map(runner => (
                  <button
                    key={runner.value}
                    type="button"
                    role="radio"
                    aria-checked={state.runner === runner.value}
                    onClick={() => update({ runner: runner.value })}
                    className={cn(
                      'rounded-sm border bg-card px-3 py-2 text-left transition-colors hover:border-primary/50',
                      state.runner === runner.value && 'border-primary bg-primary text-primary-foreground hover:border-primary'
                    )}
                  >
                    <span className="block text-sm font-medium">{runner.label}</span>
                    <span className={cn('block text-[11px]', state.runner === runner.value ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                      {runner.detail}
                    </span>
                  </button>
                ))}
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="server-name" className="text-xs">Server name in the client</Label>
                  <Input id="server-name" value={state.name} onChange={event => update({ name: event.target.value })} className="h-8 font-mono text-xs" />
                </div>
                {state.runner === 'http' && (
                  <div className="space-y-1.5">
                    <Label htmlFor="base-url" className="text-xs">Server address</Label>
                    <Input id="base-url" value={state.baseUrl} onChange={event => update({ baseUrl: event.target.value })} className="h-8 font-mono text-xs" spellCheck={false} />
                  </div>
                )}
              </div>
              {state.runner === 'http' && (
                <label className="mt-3 flex cursor-pointer items-center justify-between gap-3 rounded-sm border bg-card p-3">
                  <span>
                    <span className="text-sm font-medium">The server needs a token</span>
                    <span className="block text-xs text-muted-foreground">Clients send it as a bearer token, read from an environment variable.</span>
                  </span>
                  <Switch checked={state.token} onCheckedChange={token => update({ token })} />
                </label>
              )}
              <details className="mt-4 rounded-sm border bg-card px-3 py-2 [&[open]>summary]:mb-3">
                <summary className="cursor-pointer text-sm font-medium">Your own prompts and saved changes</summary>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="own-dir" className="text-xs">Also serve every prompt in (--dir)</Label>
                    <Input id="own-dir" value={state.dir} onChange={event => update({ dir: event.target.value })} placeholder="/home/me/prompts" className="h-8 font-mono text-xs" spellCheck={false} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="state-dir" className="text-xs">Save changes to (--state-dir)</Label>
                    <Input id="state-dir" value={state.stateDir} onChange={event => update({ stateDir: event.target.value })} placeholder="~/.local/share/mcp-prompts" className="h-8 font-mono text-xs" spellCheck={false} />
                  </div>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Your directory is served in full and is not filtered. Without a state directory, added and changed prompts last until the server stops.
                </p>
              </details>
            </Step>
          </div>

          <aside className="min-w-0 space-y-6 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:self-start lg:overflow-y-auto lg:pb-4 lg:pr-1">
            <div className="rounded-sm border bg-card p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm">
                  Serves <strong className="font-semibold tabular-nums">{served.length}</strong> of {library.prompts.length} library prompts
                  <span className="text-muted-foreground">
                    {' '}
                    · {served.length - servedTemplates} plain, {plural(servedTemplates, 'template')}
                  </span>
                </p>
                <CopyButton text={shareUrl} label="Copy link to this set-up" className="border-border bg-secondary text-foreground hover:bg-muted" />
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {options.profiles.map(name => (
                  <span key={name} className="rounded-sm bg-accent px-1.5 py-0.5 font-mono text-[11px] text-accent-foreground">profile {name}</span>
                ))}
                {state.expose.map(capability => (
                  <span key={capability} className="rounded-sm bg-secondary px-1.5 py-0.5 font-mono text-[11px]">{capability}</span>
                ))}
                {state.readOnly && <span className="rounded-sm bg-secondary px-1.5 py-0.5 font-mono text-[11px]">read-only</span>}
              </div>
              {served.length === 0 && (
                <p className="mt-3 text-xs text-destructive">Nothing from the library is served: widen the profile or the lists.</p>
              )}
            </div>

            <section className="space-y-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                <Link2 className="size-4" /> Install
              </h2>
              {state.runner === 'global' && (
                <CodeBlock wrap code={`npm install -g ${PACKAGE}`} caption="First, once:" />
              )}
              <Tabs defaultValue="claude" className="w-full">
                <TabsList className="h-auto w-full flex-wrap justify-start gap-1 rounded-sm bg-secondary p-1">
                  <TabsTrigger value="claude" className="rounded-sm text-xs">Claude Code</TabsTrigger>
                  <TabsTrigger value="json" className="rounded-sm text-xs">Claude Desktop · Cursor</TabsTrigger>
                  <TabsTrigger value="vscode" className="rounded-sm text-xs">VS Code</TabsTrigger>
                  <TabsTrigger value="file" className="rounded-sm text-xs">Config file</TabsTrigger>
                  {snippets.server && <TabsTrigger value="server" className="rounded-sm text-xs">Server</TabsTrigger>}
                </TabsList>
                <TabsContent value="claude" className="mt-3">
                  <CodeBlock wrap code={snippets.claudeCode} caption="Adds the server for every project (-s user). Check it with claude mcp list." />
                </TabsContent>
                <TabsContent value="json" className="mt-3 space-y-3">
                  <CodeBlock
                    code={snippets.mcpServersJson}
                    caption={
                      state.runner === 'http'
                        ? '.mcp.json in a project, or ~/.cursor/mcp.json.'
                        : '.mcp.json in a project, claude_desktop_config.json, or ~/.cursor/mcp.json.'
                    }
                  />
                  <a href={snippets.cursorLink} className="inline-flex items-center gap-1.5 rounded-sm border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted">
                    Add to Cursor <ArrowUpRight className="size-3.5" />
                  </a>
                </TabsContent>
                <TabsContent value="vscode" className="mt-3 space-y-3">
                  <CodeBlock code={snippets.vscodeJson} caption=".vscode/mcp.json" />
                  <a href={snippets.vscodeLink} className="inline-flex items-center gap-1.5 rounded-sm border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted">
                    Add to VS Code <ArrowUpRight className="size-3.5" />
                  </a>
                </TabsContent>
                <TabsContent value="file" className="mt-3 space-y-3">
                  <CodeBlock code={snippets.configFile} caption="Save as mcp-prompts.json. Paths in it are relative to the file." />
                  <CodeBlock
                    wrap={state.runner === 'http'}
                    code={snippets.configFileLaunch}
                    caption={state.runner === 'http' ? 'Start the server with it:' : 'Point the client at it instead of the flags:'}
                  />
                </TabsContent>
                {snippets.server && (
                  <TabsContent value="server" className="mt-3">
                    <CodeBlock wrap code={snippets.server} caption="Start the server this URL talks to. The URL can only narrow what the server serves." />
                  </TabsContent>
                )}
              </Tabs>
              {snippets.notes.length > 0 && (
                <ul className="space-y-1 border-l-2 border-template/70 pl-3 text-xs text-muted-foreground">
                  {snippets.notes.map(note => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              )}
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">Served prompts ({served.length})</h2>
              <ServedList prompts={served} onExclude={id => update({ exclude: Array.from(new Set([...state.exclude, id])) })} />
            </section>
          </aside>
        </main>
      </div>

      <footer className="border-t">
        <div className="mx-auto flex max-w-7xl flex-wrap gap-x-6 gap-y-1 px-4 py-6 text-xs text-muted-foreground sm:px-6">
          <span>
            mcp-prompts is MIT licensed. This page lives in{' '}
            <a className="underline underline-offset-2 hover:text-foreground" href={`${REPO}/tree/main/site`}>site/</a>; it reads the prompts from the
            repository's main branch.
          </span>
          <span className="ml-auto">
            Check an install locally with <code className="font-mono">mcp-prompts catalog</code>.
          </span>
        </div>
      </footer>
    </div>
  );
}
