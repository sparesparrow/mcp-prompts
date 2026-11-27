#!/usr/bin/env node
// Re-derives every answer in the evaluation files through a real MCP client against the built
// server (pnpm run build first) and fails when one no longer holds, e.g. after the library changed.
//   node evaluations/verify.mjs
// mcp-prompts.xml runs against the whole bundled library; liberty-citations.xml against
// --profile liberty-citations.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const here = dirname(fileURLToPath(import.meta.url));

async function connect(serverArgs) {
  const client = new Client({ name: 'evaluation-verify', version: '1.0.0' });
  await client.connect(new StdioClientTransport({
    command: process.execPath,
    args: [join(here, '..', 'dist', 'mcp-server-standalone.js'), ...serverArgs],
    env: { ...process.env, LOG_LEVEL: 'silent' },
    stderr: 'ignore',
  }));
  const call = async (name, args = {}) => {
    const result = await client.callTool({ name, arguments: args });
    if (result.isError) throw new Error(`${name}: ${result.content[0].text}`);
    return result.structuredContent;
  };
  // list_prompts returns at most 50 a page: follow next_offset to the end.
  const list = async filter => {
    const prompts = [];
    for (let offset = 0; ;) {
      const page = await call('list_prompts', { ...filter, limit: 50, offset });
      prompts.push(...page.prompts);
      if (!page.has_more) return prompts;
      offset = page.next_offset;
    }
  };
  const get = id => call('get_prompt', { id });
  return { client, call, list, get };
}

const variables = prompt => (prompt.variables ?? []).map(v => (typeof v === 'string' ? v : v.name));
const mostVariables = async (get, prompts) => {
  const full = await Promise.all(prompts.filter(p => p.isTemplate).map(p => get(p.id)));
  return full.sort((a, b) => variables(b).length - variables(a).length)[0].id;
};

// The rows of the "## Menu" table of a router prompt, as arrays of cells.
const menuRows = content => {
  const lines = content.split('\n');
  const start = lines.findIndex(l => l.trim() === '## Menu');
  const rows = [];
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith('|')) rows.push(line.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim()));
    else if (rows.length) break;
  }
  return rows.slice(2);
};
const unquote = cell => cell.replace(/^`([^`]*)`$/, '$1');

async function library() {
  const { client, call, list, get } = await connect([]);
  const router = await get((await list({ search: 'Routing Decision Tree' }))[0].id);
  const lights = await get((await list({ tags: ['lights'], search: 'pipeline phase' }))[0].id);
  const gpio = (await list({ tags: ['gpio'] }))[0].id;
  const gpioPrompt = await get(gpio);
  const pinsObject = /"pins":\s*\{([^}]*)\}/.exec(gpioPrompt.content)[1];
  const car = await list({ category: 'mia-car' });
  const navigation = variables(await get(car.find(p => p.tags.includes('navigation')).id));
  const emergency = variables(await get(car.find(p => p.tags.includes('emergency')).id));

  const derived = [
    /audio analysis[^\n]*\*\*([a-z-]+)\*\*/.exec(router.content)[1],
    /`processing`[\s\S]*?"mood":"([a-z]+)"/.exec(lights.content)[1],
    await mostVariables(get, car),
    await mostVariables(get, await list({ tags: ['voice'] })),
    (await list({ category: 'voice-intelligence', isTemplate: false })).map(p => p.id).join(','),
    String((await list({ category: 'main-agents', isTemplate: false })).length),
    (await list({})).filter(p => p.version === '2.0.0').map(p => p.id).join(','),
    String([...pinsObject.matchAll(/"[a-z_]+":/g)].length),
    String((await call('apply_template', { id: gpio, variables: { pi_model: 'Pi 5' } })).missing.length),
    navigation.filter(name => emergency.includes(name)).join(','),
  ];
  await client.close();
  return derived;
}

async function libertyCitations() {
  const { client, call, list, get } = await connect(['--profile', 'liberty-citations']);
  const category = await list({ category: 'liberty-citations' });
  const router = await get((await list({ tags: ['router'] }))[0].id);
  const rows = menuRows(router.content);
  const leaf = path => rows.find(r => unquote(r[0]) === path);
  const reference = await get((await list({ tags: ['reference'] }))[0].id);
  const dabing = await get((await list({ tags: ['srt'] }))[0].id);
  const publishers = await list({ tags: ['publish'] });
  const stokyPublish = publishers.find(p => p.tags.includes('stoky'));
  const stoky = await get(stokyPublish.id);
  const both = (await Promise.all(publishers.map(p => get(p.id)))).map(variables);

  const derived = [
    String(rows.filter(r => unquote(r[4]) === 'yes-exact').length),
    rows.find(r => unquote(r[0]).includes('Check a quote'))[2],
    await mostVariables(get, category),
    String(category.filter(p => !p.isTemplate).length),
    /`([\w.-]+)` when verifying a quote window/.exec(reference.content)[1],
    /at most 2 lines of (\d+) characters/.exec(dabing.content)[1],
    /title \(at most (\d+) characters\)/.exec(stoky.content)[1],
    String((await call('apply_template', { id: stokyPublish.id, variables: { kind: 'post', text: 'x' } })).missing.length),
    both[0].filter(name => both.slice(1).every(other => other.includes(name))).sort().join(','),
    leaf('Setup > First corpus build')[3].split(',').map(s => s.trim()).filter(t => t !== 'job_status').join(','),
  ];
  await client.close();
  return derived;
}

let failed = 0;
for (const [file, derive] of [['mcp-prompts.xml', library], ['liberty-citations.xml', libertyCitations]]) {
  const expected = [...readFileSync(join(here, file), 'utf8').matchAll(/<answer>([^<]*)<\/answer>/g)].map(m => m[1]);
  const derived = await derive();
  console.log(file);
  derived.forEach((answer, i) => {
    const ok = answer === expected[i];
    if (!ok) failed++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${String(i + 1).padStart(2)}. expected "${expected[i]}", derived "${answer}"`);
  });
  if (expected.length !== derived.length) {
    failed++;
    console.log(`FAIL ${file} has ${expected.length} answers, this script derives ${derived.length}`);
  }
}
process.exit(failed === 0 ? 0 : 1);
