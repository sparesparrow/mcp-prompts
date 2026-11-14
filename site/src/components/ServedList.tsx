import { useMemo, useState } from 'react';
import { ChevronRight, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { LibraryPrompt } from '@/lib/library';
import { cn } from '@/lib/utils';

type Kind = 'all' | 'plain' | 'templates';

/** The prompts an install serves, searchable, each one excludable. */
export function ServedList({ prompts, onExclude }: { prompts: LibraryPrompt[]; onExclude: (id: string) => void }) {
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<Kind>('all');
  const [open, setOpen] = useState<string | null>(null);
  const shown = useMemo(() => {
    const text = query.trim().toLowerCase();
    return prompts.filter(
      prompt =>
        (kind === 'all' || (kind === 'templates') === prompt.isTemplate) &&
        (!text ||
          [prompt.id, prompt.name, prompt.description ?? '', prompt.group, ...prompt.tags].some(field => field.toLowerCase().includes(text)))
    );
  }, [prompts, query, kind]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search id, name, group or tag"
            className="h-8 pl-8 text-xs"
            aria-label="Search the served prompts"
          />
        </div>
        <div role="radiogroup" aria-label="Kind" className="inline-flex rounded-sm border p-0.5">
          {(['all', 'plain', 'templates'] as Kind[]).map(option => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={kind === option}
              onClick={() => setKind(option)}
              className={cn(
                'rounded-[3px] px-2 py-0.5 text-xs capitalize',
                kind === option ? 'bg-secondary font-medium text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="rounded-sm border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
          {prompts.length === 0 ? 'This install serves no library prompts.' : 'Nothing matches the search.'}
        </p>
      ) : (
        <ul className="divide-y rounded-sm border bg-card">
          {shown.map(prompt => {
            const expanded = open === prompt.id;
            return (
              <li key={prompt.id} className="group">
                <div className="flex items-start gap-2 px-3 py-2">
                  <button
                    type="button"
                    onClick={() => setOpen(expanded ? null : prompt.id)}
                    className="flex min-w-0 flex-1 items-start gap-2 text-left"
                    aria-expanded={expanded}
                  >
                    <ChevronRight className={cn('mt-0.5 size-3.5 shrink-0 text-muted-foreground transition-transform', expanded && 'rotate-90')} />
                    <span className="min-w-0">
                      <span className="block truncate font-mono text-[12.5px]">{prompt.id}</span>
                      <span className="block truncate text-xs text-muted-foreground">{prompt.name}</span>
                    </span>
                  </button>
                  <span
                    className={cn(
                      'mt-0.5 shrink-0 rounded-sm px-1.5 py-px font-mono text-[10px] uppercase tracking-wide',
                      prompt.isTemplate ? 'bg-template text-template-foreground' : 'bg-secondary text-secondary-foreground'
                    )}
                  >
                    {prompt.isTemplate ? 'template' : 'prompt'}
                  </span>
                  <button
                    type="button"
                    onClick={() => onExclude(prompt.id)}
                    className="mt-0.5 shrink-0 rounded-sm p-0.5 text-muted-foreground opacity-60 hover:bg-muted hover:text-destructive hover:opacity-100 group-hover:opacity-100"
                    title={`Leave out ${prompt.id} (adds it to exclude)`}
                    aria-label={`Exclude ${prompt.id}`}
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
                {expanded && (
                  <div className="space-y-2 border-t border-dashed bg-muted/40 px-3 py-2.5 pl-8 text-xs">
                    {prompt.description && <p>{prompt.description}</p>}
                    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-muted-foreground">
                      <dt>group</dt>
                      <dd className="font-mono">{prompt.group || '(library root)'}</dd>
                      {prompt.tags.length > 0 && (
                        <>
                          <dt>tags</dt>
                          <dd className="font-mono">{prompt.tags.join(', ')}</dd>
                        </>
                      )}
                      {prompt.isTemplate && prompt.variables.length > 0 && (
                        <>
                          <dt>variables</dt>
                          <dd className="font-mono">{prompt.variables.join(', ')}</dd>
                        </>
                      )}
                    </dl>
                    {prompt.content && (
                      <pre className="code-block max-h-48 overflow-auto whitespace-pre-wrap rounded-sm p-2.5 font-mono text-[11.5px] leading-relaxed">
                        {prompt.content}
                      </pre>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
