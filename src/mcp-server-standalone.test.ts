import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import * as fs from 'fs';
import * as path from 'path';

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
