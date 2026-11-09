import { afterAll, describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ConfigError, loadConfig } from './config';

describe('loadConfig', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-prompts-config-'));
  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('listens on loopback, port 3003, with no token by default', () => {
    expect(loadConfig({})).toEqual({
      host: '127.0.0.1', port: 3003, corsOrigin: undefined, authToken: undefined,
      allowedHosts: undefined, allowedOrigins: [], allowInsecure: false,
    });
  });

  it('treats an empty variable as unset', () => {
    expect(loadConfig({ HOST: '', PORT: '', MCP_PROMPTS_AUTH_TOKEN: '' })).toMatchObject({ host: '127.0.0.1', port: 3003, authToken: undefined });
  });

  it('reads false as false', () => {
    expect(loadConfig({ MCP_PROMPTS_ALLOW_INSECURE: 'false' }).allowInsecure).toBe(false);
    expect(loadConfig({ MCP_PROMPTS_ALLOW_INSECURE: '0' }).allowInsecure).toBe(false);
    expect(loadConfig({ MCP_PROMPTS_ALLOW_INSECURE: 'TRUE' }).allowInsecure).toBe(true);
    expect(() => loadConfig({ MCP_PROMPTS_ALLOW_INSECURE: 'maybe' })).toThrow(/MCP_PROMPTS_ALLOW_INSECURE/);
  });

  it('rejects ports that cannot be listened on, naming the variable', () => {
    for (const PORT of ['70000', '-1', 'abc', '80.5']) {
      expect(() => loadConfig({ PORT }), PORT).toThrow(/PORT/);
    }
    expect(loadConfig({ PORT: '0' }).port).toBe(0);
  });

  it('splits host and origin lists', () => {
    expect(loadConfig({ MCP_PROMPTS_ALLOWED_HOSTS: 'a.test, b.test,', MCP_PROMPTS_ALLOWED_ORIGINS: 'https://a.test' })).toMatchObject({
      allowedHosts: ['a.test', 'b.test'], allowedOrigins: ['https://a.test'],
    });
  });

  it('reads the token from a file, and refuses a short, empty or doubly-given one', () => {
    const file = path.join(dir, 'token');
    fs.writeFileSync(file, 'a-long-enough-secret-token\n');
    expect(loadConfig({ MCP_PROMPTS_AUTH_TOKEN_FILE: file }).authToken).toBe('a-long-enough-secret-token');
    expect(() => loadConfig({ MCP_PROMPTS_AUTH_TOKEN_FILE: file, MCP_PROMPTS_AUTH_TOKEN: 'another-long-secret-token' })).toThrow(/not both/);
    expect(() => loadConfig({ MCP_PROMPTS_AUTH_TOKEN: 'short' })).toThrow(ConfigError);
    fs.writeFileSync(file, '\n');
    expect(() => loadConfig({ MCP_PROMPTS_AUTH_TOKEN_FILE: file })).toThrow(/empty/);
    expect(() => loadConfig({ MCP_PROMPTS_AUTH_TOKEN_FILE: path.join(dir, 'missing') })).toThrow(/cannot read/);
  });

  it('no longer fails on settings of removed backends', () => {
    // Dockerfile.production set STORAGE_TYPE=aws, which the old schema rejected at start.
    expect(() => loadConfig({ STORAGE_TYPE: 'aws', ENABLE_SSE: 'false', POSTGRES_SSL: '0' })).not.toThrow();
  });
});
