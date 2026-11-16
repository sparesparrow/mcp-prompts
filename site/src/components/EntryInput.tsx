import { useId, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/** Removable chips for list entries, and an input with suggestions to add more. */
export function EntryInput({
  entries,
  suggestions,
  onChange,
  placeholder,
  unmatched = [],
  chipClassName,
}: {
  entries: string[];
  suggestions: string[];
  onChange: (entries: string[]) => void;
  placeholder: string;
  /** Entries that match nothing, shown as warnings. */
  unmatched?: string[];
  chipClassName?: string;
}) {
  const [draft, setDraft] = useState('');
  const listId = useId();
  const add = () => {
    const values = draft.split(',').map(value => value.trim()).filter(Boolean);
    if (values.length === 0) return;
    onChange(Array.from(new Set([...entries, ...values])));
    setDraft('');
  };
  return (
    <div className="space-y-2">
      {entries.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {entries.map(entry => (
            <li
              key={entry}
              className={cn(
                'inline-flex items-center gap-1 rounded-sm border bg-card py-0.5 pl-2 pr-1 font-mono text-xs',
                unmatched.includes(entry) && 'border-destructive/60 text-destructive',
                chipClassName
              )}
              title={unmatched.includes(entry) ? 'Matches nothing in the library' : undefined}
            >
              {entry}
              <button
                type="button"
                onClick={() => onChange(entries.filter(item => item !== entry))}
                className="rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={`Remove ${entry}`}
              >
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="flex gap-1.5"
        onSubmit={event => {
          event.preventDefault();
          add();
        }}
      >
        <Input
          value={draft}
          onChange={event => setDraft(event.target.value)}
          list={listId}
          placeholder={placeholder}
          className="h-8 font-mono text-xs"
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
        />
        <datalist id={listId}>
          {suggestions.filter(item => !entries.includes(item)).map(item => (
            <option key={item} value={item} />
          ))}
        </datalist>
        <button
          type="submit"
          className="inline-flex h-8 shrink-0 items-center gap-1 rounded-sm border bg-card px-2.5 text-xs font-medium hover:bg-muted disabled:opacity-40"
          disabled={!draft.trim()}
        >
          <Plus className="size-3.5" /> Add
        </button>
      </form>
    </div>
  );
}
