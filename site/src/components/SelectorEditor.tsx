import { useMemo, useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { EntryInput } from '@/components/EntryInput';
import { matchesEntry, unmatchedEntries, type LibraryPrompt, type Selector } from '@/lib/library';
import { cn } from '@/lib/utils';

type Mode = 'all' | 'none' | 'choose';

interface GroupNode {
  group: string;
  count: number;
  children: GroupNode[];
}

/** Groups holding prompts of one kind, as a tree of top-level directories and their subdirectories. */
function groupTree(prompts: LibraryPrompt[]): GroupNode[] {
  const counts = new Map<string, number>();
  for (const prompt of prompts) {
    if (prompt.group === '') continue;
    const segments = prompt.group.split('/');
    for (let i = 1; i <= segments.length; i++) {
      const group = segments.slice(0, i).join('/');
      counts.set(group, (counts.get(group) ?? 0) + 1);
    }
  }
  const sorted = Array.from(counts.keys()).sort();
  const node = (group: string): GroupNode => ({
    group,
    count: counts.get(group) ?? 0,
    children: sorted.filter(other => other.startsWith(`${group}/`) && !other.slice(group.length + 1).includes('/')).map(node),
  });
  return sorted.filter(group => !group.includes('/')).map(node);
}

const isCovered = (group: string, entries: string[]) =>
  entries.some(entry => entry === group || group.startsWith(`${entry}/`));

/**
 * Chooses a prompts or templates list: all, none, or groups (directories), ids and tag:<tag>
 * entries. A group covers its subgroups, as on the server.
 */
export function SelectorEditor({
  title,
  prompts,
  selector,
  onChange,
}: {
  title: string;
  /** Library prompts of this list's kind. */
  prompts: LibraryPrompt[];
  selector: Selector;
  onChange: (selector: Selector) => void;
}) {
  const [choosing, setChoosing] = useState(false);
  const mode: Mode = selector === 'all' ? 'all' : selector.length > 0 || choosing ? 'choose' : 'none';
  const entries = selector === 'all' ? [] : selector;
  const tree = useMemo(() => groupTree(prompts), [prompts]);
  const groups = useMemo(() => new Set(tree.flatMap(function all(node): string[] { return [node.group, ...node.children.flatMap(all)]; })), [tree]);
  const others = entries.filter(entry => !groups.has(entry));
  const selected = prompts.filter(prompt => entries.some(entry => matchesEntry(entry, prompt))).length;
  const suggestions = useMemo(() => {
    const tags = Array.from(new Set(prompts.flatMap(prompt => prompt.tags))).sort().map(tag => `tag:${tag}`);
    return [...prompts.map(prompt => prompt.id).sort(), ...tags];
  }, [prompts]);

  const setMode = (next: Mode) => {
    setChoosing(next === 'choose');
    onChange(next === 'all' ? 'all' : next === 'none' ? [] : entries);
  };

  const toggle = (node: GroupNode, parents: GroupNode[]) => {
    if (entries.includes(node.group)) {
      onChange(entries.filter(entry => entry !== node.group));
      return;
    }
    const coveringParent = parents.find(parent => entries.includes(parent.group));
    if (coveringParent) {
      // Unticking a subgroup of a ticked group: list the rest of that group instead.
      const rest: string[] = [];
      const walk = (current: GroupNode) => {
        if (current.group === node.group) return;
        const isAncestor = node.group.startsWith(`${current.group}/`);
        if (!isAncestor) {
          rest.push(current.group);
          return;
        }
        // Prompts directly in an ancestor are listed by id; its other subgroups by name.
        rest.push(...prompts.filter(prompt => prompt.group === current.group).map(prompt => prompt.id));
        current.children.forEach(walk);
      };
      walk(coveringParent);
      onChange([...entries.filter(entry => entry !== coveringParent.group), ...rest]);
      return;
    }
    onChange([...entries.filter(entry => !entry.startsWith(`${node.group}/`)), node.group]);
  };

  const renderNode = (node: GroupNode, parents: GroupNode[], depth: number) => {
    const covered = isCovered(node.group, entries);
    const label = depth === 0 ? node.group : node.group.slice(node.group.lastIndexOf('/') + 1);
    return (
      <li key={node.group}>
        <label
          className={cn(
            'flex cursor-pointer items-center gap-2 rounded-sm px-1.5 py-1 text-sm hover:bg-muted',
            depth > 0 && 'ml-5'
          )}
        >
          <Checkbox checked={covered} onCheckedChange={() => toggle(node, parents)} />
          <span className="font-mono text-[13px]">{label}</span>
          <span className="ml-auto font-mono text-xs tabular-nums text-muted-foreground">{node.count}</span>
        </label>
        {node.children.length > 0 && <ul>{node.children.map(child => renderNode(child, [...parents, node], depth + 1))}</ul>}
      </li>
    );
  };

  return (
    <div className="flex flex-col rounded-sm border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-b px-3 py-2">
        <h3 className="whitespace-nowrap text-sm font-semibold">
          {title} <span className="font-normal text-muted-foreground">({prompts.length})</span>
        </h3>
        <div role="radiogroup" aria-label={title} className="inline-flex rounded-sm border p-0.5">
          {(['all', 'none', 'choose'] as Mode[]).map(option => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={mode === option}
              onClick={() => setMode(option)}
              className={cn(
                'rounded-[3px] px-2.5 py-0.5 text-xs capitalize transition-colors',
                mode === option ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {option}
            </button>
          ))}
        </div>
      </div>
      {mode === 'choose' ? (
        <div className="space-y-3 p-3">
          <ul className="space-y-0.5">{tree.map(node => renderNode(node, [], 0))}</ul>
          <div className="space-y-1.5 border-t pt-3">
            <p className="text-xs text-muted-foreground">Single prompts by id, or every prompt with a tag:</p>
            <EntryInput
              entries={others}
              suggestions={suggestions}
              onChange={next => onChange([...entries.filter(entry => groups.has(entry)), ...next])}
              placeholder="id or tag:voice"
              unmatched={unmatchedEntries({ prompts }, others, 'any')}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {selected} of {prompts.length} chosen{entries.length === 0 && ': choose a group, an id or a tag'}.
          </p>
        </div>
      ) : (
        <p className="px-3 py-3 text-xs text-muted-foreground">
          {mode === 'all' ? `Every ${title.toLowerCase().replace(/s$/, '')} the profiles allow.` : `No ${title.toLowerCase()}.`}
        </p>
      )}
    </div>
  );
}
