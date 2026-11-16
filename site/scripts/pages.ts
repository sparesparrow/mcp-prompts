// Writes ../index.html, the page GitHub Pages serves at https://sparesparrow.github.io/mcp-prompts/,
// from bundle.html. Pages builds the repository's main branch with Jekyll: the front matter
// makes the page a Jekyll page (so the README is not also turned into the site's index), and
// {% raw %} keeps Jekyll's Liquid away from the bundled JavaScript.

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const bundle = fs.readFileSync(path.join(here, '..', 'bundle.html'), 'utf8');

if (/\{%-?\s*endraw\s*-?%\}/.test(bundle)) {
  console.error('pages: bundle.html contains an endraw tag, which would end the raw block early');
  process.exit(1);
}
const marked = bundle.replace(
  /<html[^>]*>/i,
  match => `${match}<!-- Generated from site/ by "pnpm run site" in the repository root. Edit site/src, not this file. -->`
);
if (marked === bundle) {
  console.error('pages: bundle.html has no <html> tag');
  process.exit(1);
}

const out = path.resolve(here, '..', '..', 'index.html');
fs.writeFileSync(out, `---\nlayout: null\n---\n{% raw %}${marked}{% endraw %}\n`);
console.log(`pages: ${path.relative(process.cwd(), out)} (${Math.round(fs.statSync(out).size / 1024)} KB)`);
