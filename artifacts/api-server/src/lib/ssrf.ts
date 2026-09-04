/**
 * SSRF protection utilities for outbound HTTP requests.
 *
 * Two-layer defence:
 *   1. Pre-flight: resolve hostname → block any private/reserved IP address.
 *   2. Redirect: follow redirects manually with the same check on every Location header.
 *
 * Known limitation: DNS rebinding (TTL=0 racing the lookup against the connection)
 * cannot be fully eliminated without a custom HTTP agent that dials the pre-validated
 * IP directly. That approach requires bypassing TLS hostname verification and is out of
 * scope here; this implementation defends against the common case while staying
 * maintainable.
 */

import { promises as dns } from 'node:dns';

// ── IP classification ──────────────────────────────────────────────────────────

/**
 * Returns true if `addr` falls in any IANA-reserved / non-public range.
 * Covers IPv4 and a broad set of IPv6 special-purpose prefixes.
 */
export function isPrivateIP(addr: string): boolean {
  // ── IPv4 ──────────────────────────────────────────────────────────────────
  const v4 = addr.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [, a, b, c] = v4.map(Number);
    return (
      a === 0 ||                                    // 0.0.0.0/8  — "This" network
      a === 10 ||                                   // 10.0.0.0/8 — Private
      (a === 100 && b >= 64 && b <= 127) ||         // 100.64.0.0/10 — CGNAT (RFC 6598)
      a === 127 ||                                  // 127.0.0.0/8 — Loopback
      (a === 169 && b === 254) ||                   // 169.254.0.0/16 — Link-local
      (a === 172 && b >= 16 && b <= 31) ||          // 172.16.0.0/12 — Private
      (a === 192 && b === 0 && c === 0) ||           // 192.0.0.0/24 — IETF Protocol
      (a === 192 && b === 0 && c === 2) ||           // 192.0.2.0/24 — TEST-NET-1
      (a === 192 && b === 88 && c === 99) ||         // 192.88.99.0/24 — 6to4 anycast
      (a === 192 && b === 168) ||                   // 192.168.0.0/16 — Private
      (a === 198 && (b === 18 || b === 19)) ||      // 198.18.0.0/15 — Benchmarking
      (a === 198 && b === 51 && c === 100) ||        // 198.51.100.0/24 — TEST-NET-2
      (a === 203 && b === 0 && c === 113) ||         // 203.0.113.0/24 — TEST-NET-3
      a >= 224                                       // 224–255 — Multicast + Reserved
    );
  }

  // ── IPv6 ──────────────────────────────────────────────────────────────────
  const lower = addr.toLowerCase().replace(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/, (_m, v4addr) => {
    // IPv4-mapped IPv6 — recheck as IPv4.
    return `mapped:${v4addr}`;
  });

  if (lower.startsWith('mapped:')) {
    return isPrivateIP(lower.slice('mapped:'.length));
  }

  return (
    lower === '::1' ||                             // Loopback
    lower === '::' ||                              // Unspecified
    lower.startsWith('fe8') ||                    // fe80::/10 — Link-local
    lower.startsWith('fe9') ||
    lower.startsWith('fea') ||
    lower.startsWith('feb') ||
    lower.startsWith('fc') ||                     // fc00::/7  — ULA
    lower.startsWith('fd') ||
    lower.startsWith('::ffff:') ||               // IPv4-mapped (text form)
    lower.startsWith('64:ff9b:') ||              // NAT64 (RFC 6052)
    lower.startsWith('2001:db8:') ||             // Documentation (RFC 3849)
    lower.startsWith('2001:10:') ||              // ORCHID (RFC 4843)
    lower.startsWith('2001::') ||               // Teredo
    lower.startsWith('100::') ||                // Discard (RFC 6666)
    lower === 'ff00::' ||                        // Multicast (broad match)
    lower.startsWith('ff')                       // All ff::/8 multicast
  );
}

// ── URL validation ─────────────────────────────────────────────────────────────

/**
 * Returns an error message if `rawUrl` should be blocked for SSRF reasons,
 * or `null` if it is safe to fetch.
 *
 * Checks:
 *  - Must be http: or https:
 *  - Hostname must not be a private/reserved literal
 *  - All DNS-resolved addresses must be public
 */
export async function assertPublicUrl(rawUrl: string): Promise<string | null> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return 'Invalid URL';
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return 'Only HTTP/HTTPS URLs are allowed';
  }

  const { hostname } = parsed;

  // Block bare numeric literals immediately (no DNS needed).
  if (isPrivateIP(hostname)) {
    return 'Requests to private/reserved addresses are not allowed';
  }

  // Resolve and validate every returned address.
  let addresses: string[];
  try {
    addresses = await dns.resolve(hostname).catch(() =>
      dns.resolve4(hostname).catch(() => dns.resolve6(hostname)),
    );
  } catch {
    return 'Could not resolve hostname';
  }

  for (const addr of addresses) {
    if (isPrivateIP(addr)) {
      return 'Requests to private/reserved addresses are not allowed';
    }
  }

  return null; // safe
}

// ── SSRF-safe fetch ────────────────────────────────────────────────────────────

const MAX_REDIRECTS = 5;

/**
 * Drop-in replacement for `fetch` that:
 *  1. Validates the target URL before connecting.
 *  2. Disables automatic redirect following (`redirect: 'manual'`).
 *  3. Manually follows each redirect, validating the Location header before
 *     issuing the next request.
 *
 * Throws an Error (rather than returning a response) if SSRF checks fail or
 * the redirect limit is reached.
 */
export async function fetchWithSsrfGuard(
  url: string,
  options: RequestInit = {},
  maxRedirects = MAX_REDIRECTS,
): Promise<Response> {
  let currentUrl = url;
  let hops = 0;

  while (hops <= maxRedirects) {
    const ssrfError = await assertPublicUrl(currentUrl);
    if (ssrfError) throw new Error(`SSRF blocked: ${ssrfError}`);

    const resp = await fetch(currentUrl, { ...options, redirect: 'manual' });

    // Not a redirect — return directly.
    if (resp.status < 300 || resp.status >= 400) {
      return resp;
    }

    // Redirect: validate the next location before following.
    const location = resp.headers.get('location');
    if (!location) {
      // Malformed redirect — return the redirect response as-is.
      return resp;
    }

    // Resolve relative redirects against the current URL.
    let nextUrl: string;
    try {
      nextUrl = new URL(location, currentUrl).toString();
    } catch {
      throw new Error(`SSRF blocked: redirect to invalid URL: ${location}`);
    }

    currentUrl = nextUrl;
    hops++;
  }

  throw new Error('SSRF blocked: too many redirects');
}
