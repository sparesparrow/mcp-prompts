import { describe, expect, it } from 'vitest';
import { buildAccessPolicy, checkAccess, checkSource, checkToken, hostnameOf, isLoopbackHost, startupRefusal } from './http-security';

const request = (headers: Record<string, string>) => ({ headers });

describe('isLoopbackHost and hostnameOf', () => {
  it('recognises loopback names and addresses only', () => {
    for (const host of ['localhost', 'LOCALHOST', '127.0.0.1', '127.8.9.1', '::1', '[::1]', 'dev.localhost']) {
      expect(isLoopbackHost(host), host).toBe(true);
    }
    for (const host of ['0.0.0.0', '192.168.1.5', '::', 'localhost.evil.example', '127.0.0.1.evil.example', '1270.0.0.1']) {
      expect(isLoopbackHost(host), host).toBe(false);
    }
  });

  it('strips the port from a Host header, keeping IPv6 brackets', () => {
    expect(hostnameOf('Example.test:3003')).toBe('example.test');
    expect(hostnameOf('127.0.0.1')).toBe('127.0.0.1');
    expect(hostnameOf('[::1]:3003')).toBe('[::1]');
  });
});

describe('startupRefusal', () => {
  it('refuses unauthenticated writes beyond loopback, and says how to fix it', () => {
    const refusal = startupRefusal({ host: '0.0.0.0', readOnly: false });
    expect(refusal).toMatch(/MCP_PROMPTS_AUTH_TOKEN/);
    expect(refusal).toMatch(/read-only/);
  });

  it('allows loopback, read-only, a token, or an explicit override', () => {
    expect(startupRefusal({ host: '127.0.0.1', readOnly: false })).toBeUndefined();
    expect(startupRefusal({ host: '0.0.0.0', readOnly: true })).toBeUndefined();
    expect(startupRefusal({ host: '0.0.0.0', readOnly: false, token: 'x'.repeat(32) })).toBeUndefined();
    expect(startupRefusal({ host: '0.0.0.0', readOnly: false, allowInsecure: true })).toBeUndefined();
  });
});

describe('checkAccess', () => {
  const loopback = buildAccessPolicy('127.0.0.1');

  it('accepts loopback Host names and rejects a rebound one', () => {
    expect(checkAccess(loopback, request({ host: 'localhost:3003' }))).toBeUndefined();
    expect(checkAccess(loopback, request({ host: '127.0.0.1:3003' }))).toBeUndefined();
    expect(checkAccess(loopback, request({ host: '[::1]:3003' }))).toBeUndefined();
    expect(checkAccess(loopback, request({ host: 'evil.example:3003' }))).toMatchObject({ status: 403 });
    expect(checkAccess(loopback, request({}))).toMatchObject({ status: 403 });
  });

  it('accepts pages on this machine and rejects pages from elsewhere', () => {
    expect(checkAccess(loopback, request({ host: 'localhost', origin: 'http://localhost:6274' }))).toBeUndefined();
    expect(checkAccess(loopback, request({ host: 'localhost', origin: 'https://evil.example' }))).toMatchObject({ status: 403 });
    expect(checkAccess(loopback, request({ host: 'localhost', origin: 'null' }))).toMatchObject({ status: 403 });
  });

  it('does not check Host beyond loopback unless told the names, and trusts no origin by default', () => {
    const open = buildAccessPolicy('0.0.0.0');
    expect(checkAccess(open, request({ host: 'prompts.internal' }))).toBeUndefined();
    expect(checkAccess(open, request({ host: 'prompts.internal', origin: 'http://localhost:6274' }))).toMatchObject({ status: 403 });

    const named = buildAccessPolicy('0.0.0.0', { allowedHosts: ['Prompts.Internal:443'], allowedOrigins: ['https://ui.internal/'] });
    expect(checkAccess(named, request({ host: 'prompts.internal' }))).toBeUndefined();
    expect(checkAccess(named, request({ host: '10.0.0.7:3003' }))).toMatchObject({ status: 403 });
    expect(checkAccess(named, request({ host: 'prompts.internal', origin: 'https://ui.internal' }))).toBeUndefined();
  });

  it('treats CORS_ORIGIN as an allowed origin, and * as any', () => {
    const one = buildAccessPolicy('0.0.0.0', { corsOrigin: 'https://app.example' });
    expect(checkAccess(one, request({ host: 'h', origin: 'https://app.example' }))).toBeUndefined();
    expect(checkAccess(one, request({ host: 'h', origin: 'https://other.example' }))).toMatchObject({ status: 403 });
    const any = buildAccessPolicy('0.0.0.0', { corsOrigin: '*' });
    expect(checkAccess(any, request({ host: 'h', origin: 'https://other.example' }))).toBeUndefined();
  });

  it('requires the bearer token on everything but public routes', () => {
    const token = 'correct-horse-battery-staple';
    const policy = buildAccessPolicy('0.0.0.0', { token });
    expect(checkAccess(policy, request({ host: 'h' }))).toMatchObject({ status: 401 });
    expect(checkAccess(policy, request({ host: 'h', authorization: 'Bearer wrong' }))).toMatchObject({ status: 401 });
    expect(checkAccess(policy, request({ host: 'h', authorization: `Basic ${token}` }))).toMatchObject({ status: 401 });
    expect(checkAccess(policy, request({ host: 'h', authorization: `Bearer ${token}` }))).toBeUndefined();
    expect(checkAccess(policy, request({ host: 'h', authorization: `bearer ${token}` }))).toBeUndefined();
  });

  it('checks where a request comes from separately from its token', () => {
    const policy = buildAccessPolicy('127.0.0.1', { token: 'correct-horse-battery-staple' });
    expect(checkSource(policy, request({ host: 'localhost' }))).toBeUndefined();
    expect(checkToken(policy, request({ host: 'localhost' }))).toMatchObject({ status: 401 });
    // A rebound request is refused as such even when it carries the right token.
    expect(checkAccess(policy, request({ host: 'evil.example', authorization: 'Bearer correct-horse-battery-staple' }))).toMatchObject({ status: 403 });
  });
});
