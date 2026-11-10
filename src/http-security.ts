import * as crypto from 'crypto';
import type { IncomingMessage } from 'http';

// Who may talk to the HTTP server. Prompts are instructions that agents act on, so a server that
// accepts writes from anyone who can reach its port hands that reach to every device on the
// network and, through the browser, to every web page the user opens.
//
// Three checks, in this order:
//   Host    a request whose Host header names another site reached us through DNS rebinding
//   Origin  a browser page from another site is calling us (a plain form post needs no CORS preflight)
//   Token   when one is configured, the request must carry it
//
// The health probes (/health, /ready, /version) skip all three: load balancers and container
// runtimes call them by IP address and without credentials. They reveal the version and the mode
// (read-only or not, token required or not, saving to disk or not), and no prompt.

export interface AccessPolicy {
  /** Bearer token; when set, every route that is not public requires it. */
  token?: string;
  /** Host header names (without port) to accept; undefined accepts any. */
  allowedHosts?: string[];
  /** Browser origins to accept, as scheme://host[:port]. */
  allowedOrigins: string[];
  /** Accept any origin (CORS_ORIGIN=*). */
  allowAnyOrigin: boolean;
  /** Accept origins on this machine (http://localhost:<port> and the like), e.g. the MCP Inspector. */
  allowLoopbackOrigins: boolean;
}

export interface AccessDenied {
  status: 401 | 403;
  message: string;
}

const LOOPBACK_NAMES = ['localhost', '[::1]'];

/** True for names and addresses that only this machine can reach. */
export function isLoopbackHost(host: string): boolean {
  const name = host.trim().toLowerCase();
  if (name === '::1' || LOOPBACK_NAMES.includes(name) || name.endsWith('.localhost')) return true;
  const octets = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(name);
  return octets !== null && octets[1] === '127' && octets.slice(1).every(part => Number(part) <= 255);
}

/** The host name of a Host header without its port, lower-cased; IPv6 keeps its brackets. */
export function hostnameOf(hostHeader: string): string {
  const value = hostHeader.trim().toLowerCase();
  if (value.startsWith('[')) {
    const end = value.indexOf(']');
    return end === -1 ? value : value.slice(0, end + 1);
  }
  const colon = value.lastIndexOf(':');
  return colon === -1 ? value : value.slice(0, colon);
}

/**
 * The policy for a server listening on host. On loopback only loopback Host names and origins are
 * accepted unless more are listed; beyond loopback the public name is unknown, so Host is checked
 * only when allowedHosts says what it should be.
 */
export function buildAccessPolicy(
  host: string,
  options: { token?: string; allowedHosts?: string[]; allowedOrigins?: string[]; corsOrigin?: string } = {}
): AccessPolicy {
  const loopback = isLoopbackHost(host);
  const allowedOrigins = [...(options.allowedOrigins ?? [])];
  if (options.corsOrigin && options.corsOrigin !== '*') allowedOrigins.push(options.corsOrigin);
  const hosts = options.allowedHosts?.map(name => hostnameOf(name));
  return {
    token: options.token,
    allowedHosts: hosts ?? (loopback ? ['localhost', '127.0.0.1', '[::1]'] : undefined),
    allowedOrigins: allowedOrigins.map(origin => origin.trim().toLowerCase().replace(/\/+$/, '')),
    allowAnyOrigin: options.corsOrigin === '*',
    allowLoopbackOrigins: loopback,
  };
}

/**
 * Why a server with these settings must not start, or undefined when it may. A server reachable
 * from other machines that accepts unauthenticated writes lets any of them plant instructions.
 */
export function startupRefusal(settings: { host: string; readOnly: boolean; token?: string; allowInsecure?: boolean }): string | undefined {
  if (isLoopbackHost(settings.host) || settings.readOnly || settings.token || settings.allowInsecure) return undefined;
  return (
    `refusing to listen on ${settings.host} with writes enabled and no auth token: anyone who can reach the port could change the prompts agents act on. ` +
    'Set MCP_PROMPTS_AUTH_TOKEN (or MCP_PROMPTS_AUTH_TOKEN_FILE), or serve read-only (--read-only / MCP_PROMPTS_READ_ONLY=true), ' +
    'or listen on 127.0.0.1. If another layer already authenticates every request, set MCP_PROMPTS_ALLOW_INSECURE=true.'
  );
}

function sameSecret(given: string, expected: string): boolean {
  // Hash both so the comparison takes the same time whatever the lengths.
  const a = crypto.createHash('sha256').update(given).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

function originAllowed(policy: AccessPolicy, origin: string): boolean {
  if (policy.allowAnyOrigin) return true;
  const normalized = origin.trim().toLowerCase().replace(/\/+$/, '');
  if (policy.allowedOrigins.includes(normalized)) return true;
  if (!policy.allowLoopbackOrigins) return false;
  try {
    const { hostname } = new URL(normalized);
    return isLoopbackHost(hostname);
  } catch {
    return false;
  }
}

/** The Host and Origin checks: is this request coming from where the server expects callers? */
export function checkSource(policy: AccessPolicy, req: Pick<IncomingMessage, 'headers'>): AccessDenied | undefined {
  const host = req.headers.host;
  if (policy.allowedHosts) {
    if (!host || !policy.allowedHosts.includes(hostnameOf(host))) {
      return { status: 403, message: `Host ${host ?? '(none)'} is not allowed; add it to MCP_PROMPTS_ALLOWED_HOSTS if this server is meant to answer to that name` };
    }
  }
  const origin = req.headers.origin;
  if (typeof origin === 'string' && origin !== '' && !originAllowed(policy, origin)) {
    return { status: 403, message: `Origin ${origin} is not allowed; add it to MCP_PROMPTS_ALLOWED_ORIGINS to let pages from it call this server` };
  }
  return undefined;
}

/** The token check: does this request carry the configured bearer token? */
export function checkToken(policy: AccessPolicy, req: Pick<IncomingMessage, 'headers'>): AccessDenied | undefined {
  if (!policy.token) return undefined;
  const header = req.headers.authorization;
  const match = typeof header === 'string' ? /^Bearer\s+(.+)$/i.exec(header.trim()) : null;
  if (!match || !sameSecret(match[1], policy.token)) {
    return { status: 401, message: 'Missing or wrong bearer token; send the header "Authorization: Bearer <token>"' };
  }
  return undefined;
}

/** All checks for a route that is not a health probe. */
export function checkAccess(policy: AccessPolicy, req: Pick<IncomingMessage, 'headers'>): AccessDenied | undefined {
  return checkSource(policy, req) ?? checkToken(policy, req);
}
