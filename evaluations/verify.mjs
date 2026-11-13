#!/usr/bin/env node
// Re-derives every answer in mcp-prompts.xml through a real MCP client against the built server
// (pnpm run build first) and fails when one no longer holds, e.g. after the library changed.
//   node evaluations/verify.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const here = dirname(fileURLToPath(import.meta.url));
const expected = [...readFileSync(join(here, 'mcp-prompts.xml'), 'utf8').matchAll(/<answer>([^<]*)<\/answer>/g)].map(m => m[1]);

const client = new Client({ name: 'evaluation-verify', version: '1.0.0' });
await client.connect(new StdioClientTransport({
  command: process.execPath,
  args: [join(here, '..', 'dist', 'mcp-server-standalone.js')],
  env: { ...process.env, LOG_LEVEL: 'silent' },
  stderr: 'ignore',
}));
const call = async (name, args = {}) => {
  const result = await client.callTool({ name, arguments: args });
  if (result.isError) throw new Error(`${name}: ${result.content[0].text}`);
  return result.structuredContent;
};
const list = async filter => (await call('list_prompts', { limit: 100, ...filter })).prompts;
const get = id => call('get_prompt', { id });
const variables = prompt => (prompt.variables ?? []).map(v => (typeof v === 'string' ? v : v.name));
const mostVariables = async prompts => {
  const full = await Promise.all(prompts.filter(p => p.isTemplate).map(p => get(p.id)));
  return full.sort((a, b) => variables(b).length - variables(a).length)[0].id;
};

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
  await mostVariables(car),
  await mostVariables(await list({ tags: ['voice'] })),
  (await list({ category: 'voice-intelligence', isTemplate: false })).map(p => p.id).join(','),
  String((await list({ category: 'main-agents', isTemplate: false })).length),
  (await list({})).filter(p => p.version === '2.0.0').map(p => p.id).join(','),
  String([...pinsObject.matchAll(/"[a-z_]+":/g)].length),
  String((await call('apply_template', { id: gpio, variables: { pi_model: 'Pi 5' } })).missing.length),
  navigation.filter(name => emergency.includes(name)).join(','),
];
await client.close();

let failed = 0;
derived.forEach((answer, i) => {
  const ok = answer === expected[i];
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${String(i + 1).padStart(2)}. expected "${expected[i]}", derived "${answer}"`);
});
if (expected.length !== derived.length) {
  failed++;
  console.log(`FAIL the file has ${expected.length} answers, this script derives ${derived.length}`);
}
process.exit(failed === 0 ? 0 : 1);
