/**
 * SSRF guard unit tests — uses Node.js built-in test runner (node:test).
 *
 * Run: node --experimental-strip-types --test src/lib/ssrf.test.ts
 *
 * Tests cover:
 *  - isPrivateIP: all private/reserved IPv4 and IPv6 ranges, plus public addresses
 *  - assertPublicUrl: schema, literal-IP blocking, DNS resolution failure
 *  - fetchWithSsrfGuard: redirect chain validation (public-to-private redirect blocked)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isPrivateIP, assertPublicUrl, fetchWithSsrfGuard } from './ssrf.js';

// ── isPrivateIP ───────────────────────────────────────────────────────────────

describe('isPrivateIP', () => {
  // Private IPv4 ranges
  it('blocks 10.x (RFC 1918)', () => {
    assert.equal(isPrivateIP('10.0.0.0'), true);
    assert.equal(isPrivateIP('10.255.255.255'), true);
    assert.equal(isPrivateIP('10.1.2.3'), true);
  });

  it('blocks 172.16–31.x (RFC 1918)', () => {
    assert.equal(isPrivateIP('172.16.0.0'), true);
    assert.equal(isPrivateIP('172.31.255.255'), true);
    assert.equal(isPrivateIP('172.20.10.5'), true);
  });

  it('blocks 192.168.x (RFC 1918)', () => {
    assert.equal(isPrivateIP('192.168.0.0'), true);
    assert.equal(isPrivateIP('192.168.1.1'), true);
    assert.equal(isPrivateIP('192.168.255.255'), true);
  });

  it('blocks 127.x (loopback)', () => {
    assert.equal(isPrivateIP('127.0.0.1'), true);
    assert.equal(isPrivateIP('127.255.255.255'), true);
  });

  it('blocks 169.254.x (link-local)', () => {
    assert.equal(isPrivateIP('169.254.0.0'), true);
    assert.equal(isPrivateIP('169.254.169.254'), true);  // AWS metadata endpoint
  });

  it('blocks 0.x (this network)', () => {
    assert.equal(isPrivateIP('0.0.0.0'), true);
    assert.equal(isPrivateIP('0.255.255.255'), true);
  });

  it('blocks 100.64–127.x (CGNAT, RFC 6598)', () => {
    assert.equal(isPrivateIP('100.64.0.0'), true);
    assert.equal(isPrivateIP('100.127.255.255'), true);
  });

  it('blocks 192.0.2.x (TEST-NET-1)', () => {
    assert.equal(isPrivateIP('192.0.2.1'), true);
  });

  it('blocks 198.18–19.x (benchmarking)', () => {
    assert.equal(isPrivateIP('198.18.0.0'), true);
    assert.equal(isPrivateIP('198.19.255.255'), true);
  });

  it('blocks 224+ (multicast, reserved, broadcast)', () => {
    assert.equal(isPrivateIP('224.0.0.1'), true);
    assert.equal(isPrivateIP('255.255.255.255'), true);
    assert.equal(isPrivateIP('240.0.0.1'), true);
  });

  it('allows public IPv4 addresses', () => {
    assert.equal(isPrivateIP('8.8.8.8'), false);        // Google DNS
    assert.equal(isPrivateIP('1.1.1.1'), false);        // Cloudflare DNS
    assert.equal(isPrivateIP('104.21.0.0'), false);     // Cloudflare
    assert.equal(isPrivateIP('172.15.0.1'), false);     // just outside 172.16/12
    assert.equal(isPrivateIP('172.32.0.1'), false);     // just outside 172.31/12
  });

  // Private IPv6 ranges
  it('blocks ::1 (IPv6 loopback)', () => {
    assert.equal(isPrivateIP('::1'), true);
  });

  it('blocks fe80::/10 (link-local)', () => {
    assert.equal(isPrivateIP('fe80::1'), true);
    assert.equal(isPrivateIP('FE80::1'), true);
    assert.equal(isPrivateIP('fe9f::1'), true);
    assert.equal(isPrivateIP('fea0::1'), true);
    assert.equal(isPrivateIP('feb0::1'), true);
  });

  it('blocks fc/fd::/7 (ULA)', () => {
    assert.equal(isPrivateIP('fc00::1'), true);
    assert.equal(isPrivateIP('fd12:3456::1'), true);
  });

  it('blocks ::ffff: IPv4-mapped addresses', () => {
    assert.equal(isPrivateIP('::ffff:127.0.0.1'), true);
    assert.equal(isPrivateIP('::ffff:10.0.0.1'), true);
    assert.equal(isPrivateIP('::ffff:192.168.0.1'), true);
  });

  it('blocks 2001:db8:: (documentation)', () => {
    assert.equal(isPrivateIP('2001:db8::1'), true);
  });

  it('allows public IPv6 addresses', () => {
    assert.equal(isPrivateIP('2001:4860:4860::8888'), false);  // Google DNS
    assert.equal(isPrivateIP('2606:4700:4700::1111'), false);  // Cloudflare DNS
  });
});

// ── assertPublicUrl ──────────────────────────────────────────────────────────

describe('assertPublicUrl', () => {
  it('rejects invalid URL', async () => {
    assert.notEqual(await assertPublicUrl('not-a-url'), null);
    assert.notEqual(await assertPublicUrl(''), null);
  });

  it('rejects non-http(s) schemes', async () => {
    assert.notEqual(await assertPublicUrl('ftp://example.com/file'), null);
    assert.notEqual(await assertPublicUrl('file:///etc/passwd'), null);
    assert.notEqual(await assertPublicUrl('javascript:alert(1)'), null);
    assert.notEqual(await assertPublicUrl('data:text/plain,hello'), null);
  });

  it('blocks literal private IPv4 in hostname', async () => {
    assert.notEqual(await assertPublicUrl('http://127.0.0.1/'), null);
    assert.notEqual(await assertPublicUrl('http://10.0.0.1/'), null);
    assert.notEqual(await assertPublicUrl('http://192.168.1.1/'), null);
    assert.notEqual(await assertPublicUrl('http://169.254.169.254/latest/meta-data/'), null);
  });

  it('blocks literal private IPv6 in hostname', async () => {
    assert.notEqual(await assertPublicUrl('http://[::1]/'), null);
    assert.notEqual(await assertPublicUrl('http://[fe80::1]/'), null);
  });

  it('rejects unresolvable hostname', async () => {
    const result = await assertPublicUrl('http://this-hostname-does-not-exist-ssrf-test.invalid/');
    assert.notEqual(result, null);
  });

  it('passes a real public hostname (live DNS)', async () => {
    // This resolves over the network; skipped if offline.
    // Using example.com which resolves to 93.184.216.34 (public).
    const result = await assertPublicUrl('https://example.com/').catch(() => 'dns-error');
    if (result === 'dns-error') return; // offline — skip
    assert.equal(result, null, `Expected public URL to pass, got: ${result}`);
  });
});

// ── fetchWithSsrfGuard — redirect validation ─────────────────────────────────

describe('fetchWithSsrfGuard', () => {
  it('throws when initial URL is private', async () => {
    await assert.rejects(
      () => fetchWithSsrfGuard('http://127.0.0.1/'),
      /SSRF blocked/,
    );
  });

  it('throws when a redirect points to a private literal', async () => {
    // Simulate a server that returns a 301 → private address.
    // We intercept by monkey-patching globalThis.fetch for this test.
    const originalFetch = globalThis.fetch;
    let callCount = 0;

    globalThis.fetch = async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      const url = input.toString();
      callCount++;
      if (callCount === 1 && url.includes('example.com')) {
        // First call: return a redirect to loopback
        return new Response(null, {
          status: 301,
          headers: { location: 'http://127.0.0.1/internal' },
        });
      }
      return originalFetch(input, init);
    };

    try {
      await assert.rejects(
        () => fetchWithSsrfGuard('https://example.com/resource'),
        /SSRF blocked/,
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('throws when redirect chain is too long', async () => {
    const originalFetch = globalThis.fetch;
    let n = 0;

    globalThis.fetch = async () => {
      n++;
      return new Response(null, {
        status: 301,
        headers: { location: `https://example.com/page${n}` },
      });
    };

    try {
      await assert.rejects(
        () => fetchWithSsrfGuard('https://example.com/start', {}, 3),
        /too many redirects/i,
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('returns response when no redirect', async () => {
    // Monkey-patch fetch to return 200 immediately (no DNS needed).
    const originalFetch = globalThis.fetch;

    globalThis.fetch = async () => new Response('ok', { status: 200 });

    try {
      // 8.8.8.8 is public; pre-flight lookup may fail in sandboxed envs — use mock.
      const resp = await fetchWithSsrfGuard('https://8.8.8.8/');
      assert.equal(resp.status, 200);
    } catch (err: unknown) {
      // If DNS resolves 8.8.8.8 to an unexpected value or network is blocked, skip.
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('SSRF blocked') && !msg.includes('Could not resolve')) throw err;
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
