import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { PromptListChangedNotificationSchema, ResourceListChangedNotificationSchema } from '@modelcontextprotocol/sdk/types.js';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { makeFixtureLibrary, type FixtureLibrary } from './testing/fixture-library';

// Drives the real stdio entry point the way an MCP client does, so a tool registered without
// an argument schema (whose arguments the SDK then never passes on) fails here.
describe('mcp-server-standalone over stdio', () => {
  const root = path.join(__dirname, '..');
  const client = new Client({ name: 'standalone-test', version: '1.0.0' });

  beforeAll(async () => {
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'), path.join(root, 'src', 'mcp-server-standalone.ts')],
      cwd: root,
      env: { ...process.env, LOG_LEVEL: 'silent' } as Record<string, string>,
      stderr: 'ignore',
    });
    await client.connect(transport);
  }, 30_000);

  afterAll(async () => {
    await client.close();
  });

  it('reports the package version', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    expect(client.getServerVersion()?.version).toBe(pkg.version);
  });

  it('sends usage instructions that name the template flow and the persistence limit', () => {
    const instructions = client.getInstructions() ?? '';
    for (const word of ['list_prompts', 'get_prompt', 'apply_template', 'variables', 'memory only']) {
      expect(instructions).toContain(word);
    }
  });

  it('advertises the arguments of every tool that takes them', async () => {
    const { tools } = await client.listTools();
    const props = (name: string) =>
      Object.keys((tools.find(t => t.name === name)?.inputSchema.properties as object) ?? {});
    expect(props('get_prompt')).toContain('id');
    expect(props('delete_prompt')).toContain('id');
    expect(props('update_prompt')).toEqual(expect.arrayContaining(['id', 'updates']));
    expect(props('apply_template')).toEqual(expect.arrayContaining(['id', 'variables']));
    expect(props('add_prompt')).toEqual(expect.arrayContaining(['name', 'content']));
    expect(props('list_prompts')).toEqual(expect.arrayContaining(['tags', 'search']));
    for (const tool of tools) expect(tool.description).toBeTruthy();
  });

  it('passes arguments through to the tools', async () => {
    const added = await client.callTool({
      name: 'add_prompt',
      arguments: { name: 'Greeting', content: 'Hello {{who}}', isTemplate: true, tags: ['test-only'] },
    });
    expect(added.isError).toBeFalsy();
    const id = /ID: (\S+)/.exec((added.content as Array<{ text: string }>)[0].text)?.[1];
    expect(id).toBeTruthy();

    const fetched = await client.callTool({ name: 'get_prompt', arguments: { id } });
    expect(fetched.isError).toBeFalsy();
    expect((fetched.content as Array<{ text: string }>)[0].text).toContain('Hello {{who}}');

    const listed = await client.callTool({ name: 'list_prompts', arguments: { tags: ['test-only'] } });
    expect((listed.content as Array<{ text: string }>)[0].text).toContain('Greeting');

    const applied = await client.callTool({ name: 'apply_template', arguments: { id, variables: { who: 'world' } } });
    expect((applied.content as Array<{ text: string }>)[0].text).toContain('Hello world');
  });
});

const root = path.join(__dirname, '..');
const tsx = path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const entry = path.join(root, 'src', 'mcp-server-standalone.ts');

async function connect(args: string[], env: Record<string, string> = {}): Promise<Client> {
  const client = new Client({ name: 'standalone-options-test', version: '1.0.0' });
  await client.connect(new StdioClientTransport({
    command: process.execPath,
    args: [tsx, entry, ...args],
    cwd: root,
    env: { ...process.env, LOG_LEVEL: 'silent', ...env } as Record<string, string>,
    stderr: 'ignore',
  }));
  return client;
}

function run(args: string[], env: Record<string, string> = {}) {
  const result = spawnSync(process.execPath, [tsx, entry, ...args], {
    cwd: root,
    env: { ...process.env, LOG_LEVEL: 'silent', ...env },
    encoding: 'utf8',
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

const textOf = (message: { content: unknown }) => (message.content as { text: string }).text;

describe('mcp-server-standalone with install options on the command line', () => {
  let fixture: FixtureLibrary;
  let client: Client;

  beforeAll(async () => {
    fixture = makeFixtureLibrary();
    client = await connect([
      '--prompts-dir', fixture.library, '--prompts', 'none', '--templates', 'alpha',
      '--expose', 'tools,prompts,resources', '--read-only',
    ]);
  }, 30_000);

  afterAll(async () => {
    await client.close();
    fixture.cleanup();
  });

  it('leaves out the tools that change prompts', async () => {
    const names = (await client.listTools()).tools.map(t => t.name).sort();
    expect(names).toEqual(['apply_template', 'get_prompt', 'get_stats', 'list_prompts']);
  });

  it('serves the chosen templates as MCP prompts, with their variables as arguments', async () => {
    const { prompts } = await client.listPrompts();
    expect(prompts.map(p => p.name).sort()).toEqual(['a-deep', 'a-greet']);
    expect(prompts.find(p => p.name === 'a-greet')).toMatchObject({
      title: 'Greeting',
      description: 'Greets someone',
      arguments: [{ name: 'who', required: false }, { name: 'place', description: 'Where from', required: false }],
    });
    const filled = await client.getPrompt({ name: 'a-greet', arguments: { who: 'you' } });
    expect(textOf(filled.messages[0])).toBe('Hello you from {{place}}');
    // Invalid params, said once: the message used to arrive as "MCP error -32602: MCP error -32602: ...".
    await expect(client.getPrompt({ name: 'a-plain' })).rejects.toMatchObject({
      code: -32602,
      message: 'MCP error -32602: Prompt with ID a-plain not found',
    });
  });

  it('serves the chosen templates as prompts:// resources', async () => {
    const { resources } = await client.listResources();
    expect(resources.map(r => r.uri).sort()).toEqual(['prompts://a-deep', 'prompts://a-greet']);
    const read = await client.readResource({ uri: 'prompts://a-greet' });
    expect(read.contents[0]).toMatchObject({ mimeType: 'text/plain', text: 'Hello {{who}} from {{place}}' });
    const { resourceTemplates } = await client.listResourceTemplates();
    expect(resourceTemplates[0].uriTemplate).toBe('prompts://{id}');
    // The specification's code for a resource that does not exist.
    await expect(client.readResource({ uri: 'prompts://b-tmpl' })).rejects.toMatchObject({
      code: -32002,
      message: 'MCP error -32002: Prompt with ID b-tmpl not found',
    });
    // Broken percent-encoding is the caller's mistake, not an internal error.
    await expect(client.readResource({ uri: 'prompts://%E0%A4%A' })).rejects.toMatchObject({ code: -32602 });
    await expect(client.readResource({ uri: 'file:///etc/passwd' })).rejects.toMatchObject({ code: -32602 });
  });

  it('tells the model what this install exposes and serves', () => {
    const instructions = client.getInstructions() ?? '';
    expect(instructions).toContain('exposes MCP tools, prompts, resources');
    expect(instructions).toContain('2 of the 6 library prompts');
    expect(instructions).toContain('Read-only');
    expect(instructions).not.toContain('memory only');
  });

  it('keeps the tools within the selection', async () => {
    const listed = await client.callTool({ name: 'list_prompts', arguments: {} });
    const text = (listed.content as Array<{ text: string }>)[0].text;
    expect(text).toContain('Found 2 prompts');
    const outside = await client.callTool({ name: 'get_prompt', arguments: { id: 'b-tmpl' } });
    expect(outside.isError).toBe(true);
  });
});

describe('mcp-server-standalone exposing tools and prompts together', () => {
  let fixture: FixtureLibrary;
  let client: Client;

  beforeAll(async () => {
    fixture = makeFixtureLibrary();
    client = await connect(['--prompts-dir', fixture.library, '--prompts', 'none', '--templates', 'none', '--expose', 'tools,prompts,resources']);
  }, 30_000);

  afterAll(async () => {
    await client.close();
    fixture.cleanup();
  });

  it('announces prompts added with add_prompt and serves them as MCP prompts', async () => {
    const promptsChanged = new Promise<void>(resolve => client.setNotificationHandler(PromptListChangedNotificationSchema, () => resolve()));
    const resourcesChanged = new Promise<void>(resolve => client.setNotificationHandler(ResourceListChangedNotificationSchema, () => resolve()));
    expect((await client.listPrompts()).prompts).toEqual([]);
    const added = await client.callTool({
      name: 'add_prompt',
      arguments: { name: 'Mine', content: 'Hi {{who}}', isTemplate: true, variables: ['who'] },
    });
    const id = /ID: (\S+)/.exec((added.content as Array<{ text: string }>)[0].text)?.[1];
    await Promise.all([promptsChanged, resourcesChanged]);
    expect((await client.listPrompts()).prompts.map(p => p.name)).toEqual([id]);
    const got = await client.getPrompt({ name: id!, arguments: { who: 'there' } });
    expect((got.messages[0].content as { text: string }).text).toBe('Hi there');
  });
});

describe('mcp-server-standalone with options from the environment and a config file', () => {
  let fixture: FixtureLibrary;
  let client: Client;

  beforeAll(async () => {
    fixture = makeFixtureLibrary();
    const config = path.join(fixture.root, 'mcp-prompts.json');
    // Paths in the file resolve against the file's directory.
    fs.writeFileSync(config, JSON.stringify({ promptsDir: 'library', prompts: 'none', templates: ['beta'], expose: ['prompts'] }));
    client = await connect([], { MCP_PROMPTS_CONFIG: config, MCP_PROMPTS_DIRS: fixture.own });
  }, 30_000);

  afterAll(async () => {
    await client.close();
    fixture.cleanup();
  });

  it('exposes only MCP prompts: the chosen templates plus the user\'s own directory', async () => {
    expect(client.getServerCapabilities()?.tools).toBeUndefined();
    expect(client.getServerCapabilities()?.prompts).toBeDefined();
    const { prompts } = await client.listPrompts();
    expect(prompts.map(p => p.name).sort()).toEqual(['b-plain', 'b-tmpl', 'o-tmpl']);
    expect(prompts.find(p => p.name === 'b-plain')?.title).toBe('My b-plain');
  });
});

describe('mcp-prompts commands', () => {
  let fixture: FixtureLibrary;
  beforeAll(() => { fixture = makeFixtureLibrary(); });
  afterAll(() => fixture.cleanup());

  it('catalog --json lists the groups and what the options select', () => {
    const { status, stdout, stderr } = run(['catalog', '--json', '--prompts-dir', fixture.library, '--prompts', 'none', '--templates', 'beta,nope']);
    expect(status).toBe(0);
    expect(stderr).toContain('warning: templates: "nope" matches no group, id or tag in the library');
    const catalog = JSON.parse(stdout);
    expect(catalog.groups.map((row: { group: string }) => row.group)).toEqual(['', 'alpha', 'alpha/deep', 'beta']);
    expect(catalog.served).toEqual([{ id: 'b-tmpl', name: 'b-tmpl name', template: true, source: 'library', group: 'beta' }]);
  }, 30_000);

  it('catalog prints a table by default', () => {
    const { status, stdout } = run(['catalog', '--prompts-dir', fixture.library]);
    expect(status).toBe(0);
    expect(stdout).toMatch(/alpha\s+1\/1\s+1\/1/);
    expect(stdout).toContain('Served (6):');
  }, 30_000);

  it('config prints the same choice as a command, client config, URL and config file', () => {
    const { status, stdout } = run(['config', '--prompts', 'none', '--templates', 'mia-car,tag:voice', '--expose', 'tools,prompts', '--read-only', '--name', 'my-prompts']);
    expect(status).toBe(0);
    expect(stdout).toContain('claude mcp add -s user my-prompts -- mcp-prompts --prompts none --templates mia-car,tag:voice --expose tools,prompts --read-only');
    expect(stdout).toContain('"args": [');
    expect(stdout).toContain("claude mcp add -s user --transport http my-prompts 'http://localhost:3003/mcp?prompts=none&templates=mia-car,tag:voice&expose=tools,prompts&readOnly=true'");
    expect(stdout).toContain('"type": "http"');
    expect(stdout).toMatch(/"templates": \[\s+"mia-car",\s+"tag:voice"\s+\]/);
  }, 30_000);

  it('rejects bad options with exit code 2 and a pointer to --help', () => {
    const bad = run(['--expose', 'sampling']);
    expect(bad.status).toBe(2);
    expect(bad.stderr).toContain('mcp-prompts: expose: unknown capability sampling');
    expect(bad.stderr).toContain('mcp-prompts --help');
    expect(bad.stdout).toBe('');
    expect(run(['catalogue']).stderr).toContain('unknown command "catalogue"');
    expect(run(['--json']).stderr).toContain('--json goes with the catalog and profiles commands');
  }, 30_000);

  it('profiles lists the library\'s profiles, what each serves and what none serves', () => {
    const { status, stdout } = run(['profiles', '--prompts-dir', fixture.library]);
    expect(status).toBe(0);
    expect(stdout).toMatch(/greetings\s+0\s+2\s+Greeting templates/);
    expect(stdout).toMatch(/notes\s+2\s+0\s+Plain notes/);
    expect(stdout).toMatch(/\(no profile\)\s+3\s+3/);
    expect(stdout).toContain('In no profile (2), served only without one: a-plain, b-tmpl');

    const listing = JSON.parse(run(['profiles', '--json', '--prompts-dir', fixture.library]).stdout);
    expect(listing.profiles.map((profile: { name: string }) => profile.name)).toEqual(['greetings', 'notes']);
    expect(listing.total).toEqual({ prompts: 3, templates: 3 });
  }, 30_000);

  it('serves only a profile\'s prompts and says so in the instructions', async () => {
    const client = await connect(['--prompts-dir', fixture.library, '--profile', 'greetings']);
    const listed = await client.callTool({ name: 'list_prompts', arguments: {} });
    expect((listed.structuredContent as { prompts: Array<{ id: string }> }).prompts.map(p => p.id)).toEqual(['a-greet', 'a-deep']);
    expect(client.getInstructions()).toContain('2 of the 6 library prompts (profile greetings)');
    const outside = await client.callTool({ name: 'get_prompt', arguments: { id: 'root-note' } });
    expect(outside.isError).toBe(true);
    await client.close();

    // The environment variable does the same, and --exclude narrows the profile.
    const narrowed = await connect(['--prompts-dir', fixture.library, '--exclude', 'a-greet'], { MCP_PROMPTS_PROFILE: 'greetings,notes' });
    const all = await narrowed.callTool({ name: 'list_prompts', arguments: {} });
    expect((all.structuredContent as { prompts: Array<{ id: string }> }).prompts.map(p => p.id)).toEqual(['a-deep', 'b-plain', 'root-note']);
    await narrowed.close();
  }, 30_000);

  it('refuses a profile the library does not have, naming the ones it has', () => {
    const { status, stderr, stdout } = run(['--prompts-dir', fixture.library, '--profile', 'greeting']);
    expect(status).toBe(2);
    expect(stderr).toContain('unknown profile "greeting": this library has greetings, notes');
    expect(stdout).toBe('');
  }, 30_000);

  it('config carries the profile into the command, the client config, the URL and the config file', () => {
    const { stdout } = run(['config', '--prompts-dir', fixture.library, '--profile', 'greetings', '--read-only']);
    expect(stdout).toContain('--profile greetings --read-only');
    expect(stdout).toContain('/mcp?profile=greetings&readOnly=true');
    expect(stdout).toContain('"profile": [');
  }, 30_000);

  it('still serves when started the 3.x way, as "mcp-prompts start"', async () => {
    // Client configs written for 3.x say `npx -y @sparesparrow/mcp-prompts start`.
    const client = await connect(['start', '--mode', 'mcp', '--prompts-dir', fixture.library]);
    expect((await client.listTools()).tools).toHaveLength(7);
    await client.close();
    const http = run(['start', '--mode', 'http']);
    expect(http.status).toBe(2);
    expect(http.stderr).toContain('mcp-prompts-http');
  }, 30_000);

  it('--help lists the options', () => {
    const { status, stdout } = run(['--help']);
    expect(status).toBe(0);
    for (const flag of ['--prompts', '--templates', '--exclude', '--expose', '--read-only', '--dir', '--state-dir', '--config', 'MCP_PROMPTS_TEMPLATES', 'MCP_PROMPTS_AUTH_TOKEN']) {
      expect(stdout).toContain(flag);
    }
  }, 30_000);

  it('config carries the state directory into the command and the config file', () => {
    const { stdout } = run(['config', '--state-dir', '/var/lib/mcp-prompts']);
    expect(stdout).toContain('-- mcp-prompts --state-dir /var/lib/mcp-prompts');
    expect(stdout).toContain('"stateDir": "/var/lib/mcp-prompts"');
  }, 30_000);

  it('exits with one line, not a stack trace, when the state directory cannot be written', () => {
    const blocked = path.join(fixture.root, 'a-file');
    fs.writeFileSync(blocked, '');
    const { status, stderr, stdout } = run(['--state-dir', path.join(blocked, 'state')]);
    expect(status).toBe(1);
    expect(stderr).toMatch(/^mcp-prompts: State directory .* is not writable/);
    expect(stderr).not.toContain('    at ');
    expect(stdout).toBe('');
  }, 30_000);
});

describe('mcp-server-standalone with a state directory', () => {
  let fixture: FixtureLibrary;
  beforeAll(() => { fixture = makeFixtureLibrary(); });
  afterAll(() => fixture.cleanup());

  it('keeps what one run of the binary added for the next run', async () => {
    const args = ['--prompts-dir', fixture.library, '--state-dir', path.join(fixture.root, 'state')];
    const first = await connect(args);
    const added = await first.callTool({ name: 'add_prompt', arguments: { id: 'across-runs', name: 'Across runs', content: 'kept' } });
    expect(added.structuredContent).toMatchObject({ id: 'across-runs', persisted: true });
    await first.close();

    const second = await connect(args);
    const fetched = await second.callTool({ name: 'get_prompt', arguments: { id: 'across-runs' } });
    expect(fetched.structuredContent).toMatchObject({ name: 'Across runs', content: 'kept' });
    await second.close();
  }, 30_000);
});
