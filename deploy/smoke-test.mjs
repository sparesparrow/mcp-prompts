#!/usr/bin/env node
// Checks a running mcp-prompts deployment the way an MCP client uses it.
//
//   node deploy/smoke-test.mjs --max-prompts 15 -- mcp-prompts --profile software-dev
//   node deploy/smoke-test.mjs --max-prompts 15 --url "http://127.0.0.1:3003/mcp?profile=mia-vehicle"
//   node deploy/smoke-test.mjs --expect-read-only -- docker run -i --rm ghcr.io/sparesparrow/mcp-prompts:mcp --read-only
//   node deploy/smoke-test.mjs --write --expect-persistent -- mcp-prompts --state-dir ~/.local/share/mcp-prompts
//
// Everything after `--` is the command an MCP client would start (stdio). Exit code 0 when every
// check passes, 1 when one fails, 2 for bad arguments. Read-only unless --write is given; --write
// adds one prompt, changes it and deletes it again.

import { parseArgs } from 'node:util';
import { readFileSync } from 'node:fs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const HELP = `Usage:
  smoke-test.mjs --url <http(s)://host/mcp> [options]
  smoke-test.mjs [options] -- <command> [args...]

Options:
  --max-prompts <n>      fail if the install serves more than n prompts (a profile keeps it small)
  --token <token>        bearer token for an HTTP deployment (or the MCP_PROMPTS_AUTH_TOKEN variable)
  --token-file <file>    file holding the token
  --expect-read-only     fail if the server offers add_prompt, update_prompt or delete_prompt
  --expect-persistent    fail unless changes are saved to a state directory (get_stats storage "file")
  --write                add, update and delete one prompt (smoke-test-<random>)
  --allow-empty          do not fail when the server serves no prompts
  --timeout <seconds>    give up after this long (default 30)
  -h, --help             show this help
`;

const READ_TOOLS = ['list_prompts', 'get_prompt', 'apply_template', 'get_stats'];
const WRITE_TOOLS = ['add_prompt', 'update_prompt', 'delete_prompt'];

function usage(message) {
  process.stderr.write(`smoke-test: ${message}\n\n${HELP}`);
  process.exit(2);
}

const separator = process.argv.indexOf('--', 2);
const own = separator === -1 ? process.argv.slice(2) : process.argv.slice(2, separator);
const command = separator === -1 ? [] : process.argv.slice(separator + 1);

let values;
try {
  ({ values } = parseArgs({
    args: own,
    options: {
      url: { type: 'string' },
      'max-prompts': { type: 'string' },
      token: { type: 'string' },
      'token-file': { type: 'string' },
      'expect-read-only': { type: 'boolean' },
      'expect-persistent': { type: 'boolean' },
      write: { type: 'boolean' },
      'allow-empty': { type: 'boolean' },
      timeout: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
    strict: true,
  }));
} catch (error) {
  usage(error.message.split('. ')[0]);
}
if (values.help) {
  process.stdout.write(HELP);
  process.exit(0);
}
if (Boolean(values.url) === command.length > 0) usage('give either --url or a command after --');
if (values.write && values['expect-read-only']) usage('--write and --expect-read-only contradict each other');
if (!values.url && (values.token || values['token-file'])) usage('--token and --token-file go with --url');
if (values.token && values['token-file']) usage('give --token or --token-file, not both');
const maxPrompts = values['max-prompts'] === undefined ? undefined : Number(values['max-prompts']);
if (maxPrompts !== undefined && !(Number.isInteger(maxPrompts) && maxPrompts >= 0)) usage('--max-prompts must be a whole number');
const timeoutMs = Number(values.timeout ?? 30) * 1000;
if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) usage('--timeout must be a number of seconds');

let token = values.token ?? (values.url ? process.env.MCP_PROMPTS_AUTH_TOKEN : undefined);
if (values['token-file']) {
  try {
    token = readFileSync(values['token-file'], 'utf8').trim();
  } catch (error) {
    usage(`cannot read --token-file: ${error.message}`);
  }
}

let failures = 0;
const pass = message => process.stdout.write(`  ok    ${message}\n`);
const fail = message => {
  failures++;
  process.stdout.write(`  FAIL  ${message}\n`);
};
const check = (condition, message, detail = '') => (condition ? pass(message) : fail(detail ? `${message}: ${detail}` : message));

const textOf = result => (result.content ?? []).filter(block => block.type === 'text').map(block => block.text).join('\n');

/** Calls a tool and returns its structured result; a tool error is a failed check. */
async function call(client, name, args = {}) {
  const result = await client.callTool({ name, arguments: args });
  if (result.isError) {
    fail(`${name} answered with an error: ${textOf(result)}`);
    return undefined;
  }
  return result.structuredContent ?? {};
}

async function checkHttpEdges(url) {
  const base = new URL(url);
  const health = await fetch(new URL('/health', base)).catch(error => error);
  check(health instanceof Response && health.ok, 'GET /health answers 200 without credentials',
    health instanceof Response ? `HTTP ${health.status}` : String(health.cause?.message ?? health.message));
  if (!token) return;
  const init = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }),
  };
  const anonymous = await fetch(base, init).catch(error => error);
  check(anonymous instanceof Response && anonymous.status === 401, 'a request without the token is refused with 401',
    anonymous instanceof Response ? `HTTP ${anonymous.status}` : String(anonymous.message));
  const wrong = await fetch(base, { ...init, headers: { ...init.headers, Authorization: 'Bearer not-the-token' } }).catch(error => error);
  check(wrong instanceof Response && wrong.status === 401, 'a request with a wrong token is refused with 401',
    wrong instanceof Response ? `HTTP ${wrong.status}` : String(wrong.message));
}

async function run() {
  const client = new Client({ name: 'mcp-prompts-smoke-test', version: '1.0.0' });
  let transport;
  if (values.url) {
    process.stdout.write(`Checking ${values.url}\n`);
    await checkHttpEdges(values.url);
    transport = new StreamableHTTPClientTransport(new URL(values.url), {
      requestInit: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
    });
  } else {
    process.stdout.write(`Checking the stdio server started by: ${command.join(' ')}\n`);
    transport = new StdioClientTransport({ command: command[0], args: command.slice(1), env: process.env, stderr: 'inherit' });
  }

  try {
    await client.connect(transport);
  } catch (error) {
    fail(`could not connect: ${error.message}`);
    return;
  }
  const server = client.getServerVersion();
  check(server?.name === 'mcp-prompts', `connected to ${server?.name} ${server?.version}`, 'the server does not call itself mcp-prompts');
  check((client.getInstructions() ?? '').length > 0, 'the server sends usage instructions');

  const capabilities = client.getServerCapabilities() ?? {};
  if (!capabilities.tools) {
    // An install that exposes only MCP prompts or resources: check those instead of the tools.
    if (capabilities.prompts) {
      const { prompts } = await client.listPrompts();
      check(prompts.length > 0 || values['allow-empty'], `lists ${prompts.length} MCP prompts`);
    }
    if (capabilities.resources) {
      const { resources } = await client.listResources();
      check(resources.length > 0 || values['allow-empty'], `lists ${resources.length} resources`);
    }
    check(Boolean(capabilities.prompts || capabilities.resources), 'exposes prompts or resources (no tools)');
    if (values.write) fail('--write needs the tools, which this install does not expose');
    await client.close();
    return;
  }

  const tools = (await client.listTools()).tools.map(tool => tool.name);
  const missingTools = READ_TOOLS.filter(name => !tools.includes(name));
  check(missingTools.length === 0, `offers ${READ_TOOLS.join(', ')}`, `missing ${missingTools.join(', ')}`);
  const writeTools = WRITE_TOOLS.filter(name => tools.includes(name));
  if (values['expect-read-only']) {
    check(writeTools.length === 0, 'is read-only: no add_prompt, update_prompt or delete_prompt', `offers ${writeTools.join(', ')}`);
  }

  const page = await call(client, 'list_prompts', { limit: 100 });
  if (page) {
    check(page.total > 0 || values['allow-empty'], `list_prompts finds ${page.total} prompts`, 'the library is empty (wrong PROMPTS_DIR or selection?)');
    if (maxPrompts !== undefined) {
      check(page.total <= maxPrompts, `serves no more than ${maxPrompts} prompts`, `it serves ${page.total}: is the profile or selection applied?`);
    }
    const listed = JSON.stringify(page).length;
    pass(`one list_prompts call returns about ${Math.round(listed / 100) / 10}k characters`);
    const first = page.prompts?.[0];
    if (first) {
      const prompt = await call(client, 'get_prompt', { id: first.id });
      check(prompt?.id === first.id && typeof prompt?.content === 'string', `get_prompt returns "${first.id}"`);
    }
    const template = page.prompts?.find(prompt => prompt.isTemplate);
    if (template) {
      const full = await call(client, 'get_prompt', { id: template.id });
      const names = (full?.variables ?? []).map(variable => (typeof variable === 'string' ? variable : variable.name));
      const rendered = await call(client, 'apply_template', { id: template.id, variables: Object.fromEntries(names.map(name => [name, 'x'])) });
      check(typeof rendered?.text === 'string' && Array.isArray(rendered?.missing), `apply_template fills "${template.id}"`);
    }
  }

  const stats = await call(client, 'get_stats');
  if (stats) {
    pass(`get_stats: ${stats.total} prompts, ${stats.templates} templates, storage "${stats.storage}"`);
    if (values['expect-persistent']) {
      check(stats.storage === 'file', 'changes are saved to a state directory', `storage is "${stats.storage}": set MCP_PROMPTS_STATE_DIR (--state-dir) and leave read-only off`);
    }
  }

  if (values.write) {
    if (writeTools.length < WRITE_TOOLS.length) {
      fail(`--write: the server is read-only (it offers ${writeTools.join(', ') || 'no write tools'})`);
    } else {
      const id = `smoke-test-${Math.random().toString(36).slice(2, 10)}`;
      const added = await call(client, 'add_prompt', { id, name: 'Smoke test', content: 'Hello {{who}}', isTemplate: true, variables: ['who'], tags: ['smoke-test'] });
      check(added?.id === id, `add_prompt stores "${id}" (${added?.persisted ? 'saved to disk' : 'in memory only'})`);
      if (added) {
        const rendered = await call(client, 'apply_template', { id, variables: { who: 'there' } });
        check(rendered?.text === 'Hello there', 'apply_template fills the new template');
        const updated = await call(client, 'update_prompt', { id, updates: { description: 'Written by the smoke test' } });
        check(updated?.version === 2, 'update_prompt raises the version');
        const deleted = await call(client, 'delete_prompt', { id });
        check(deleted?.id === id, 'delete_prompt removes it again');
        const gone = await client.callTool({ name: 'get_prompt', arguments: { id } });
        check(gone.isError === true, 'the deleted prompt is gone');
      }
    }
  }

  await client.close();
}

const timer = setTimeout(() => {
  process.stdout.write(`  FAIL  no answer within ${timeoutMs / 1000} seconds\n`);
  process.exit(1);
}, timeoutMs);

try {
  await run();
} catch (error) {
  fail(`unexpected error: ${error?.message ?? error}`);
}
clearTimeout(timer);
process.stdout.write(failures === 0 ? 'All checks passed.\n' : `${failures} check${failures === 1 ? '' : 's'} failed.\n`);
process.exit(failures === 0 ? 0 : 1);
