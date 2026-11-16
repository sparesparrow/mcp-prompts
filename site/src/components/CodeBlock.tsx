import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Clipboard API refused (insecure context, iframe): fall back to a selection copy.
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  }
}

export function CopyButton({ text, className, label = 'Copy' }: { text: string; className?: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        if (await copyText(text)) {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1600);
        }
      }}
      className={cn(
        'inline-flex h-7 items-center gap-1.5 rounded-sm border border-white/15 bg-white/10 px-2.5 font-mono text-[11px] text-white/90 backdrop-blur transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
        className
      )}
      aria-label={copied ? 'Copied' : `${label} to clipboard`}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {copied ? 'Copied' : label}
    </button>
  );
}

/** Code to paste somewhere, with what it is and a copy button. */
export function CodeBlock({ code, caption, wrap = false }: { code: string; caption?: React.ReactNode; wrap?: boolean }) {
  return (
    <figure className="space-y-1.5">
      {caption && <figcaption className="text-xs leading-snug text-muted-foreground">{caption}</figcaption>}
      <div className="relative">
        <pre
          className={cn(
            'code-block max-h-[22rem] overflow-auto rounded-sm px-4 py-3 pr-24 font-mono text-[12.5px] leading-relaxed',
            wrap ? 'whitespace-pre-wrap break-words' : 'whitespace-pre'
          )}
        >
          <code>{code}</code>
        </pre>
        <CopyButton text={code} className="absolute right-2 top-2" />
      </div>
    </figure>
  );
}
