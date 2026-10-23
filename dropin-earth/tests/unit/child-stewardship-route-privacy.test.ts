import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server.js";
import { middleware } from "../../apps/web/src/middleware.ts";

function headers(path: string) { return middleware(new NextRequest(`https://canopyproof.org${path}`)).headers; }
function directive(csp: string, name: string) { return csp.split(";").map(part => part.trim()).find(part => part.startsWith(`${name} `))!; }

test("child route restricts egress, referrer, caching and device surfaces independently of other app routes", () => {
  const original = process.env.NEXT_PUBLIC_DROPIN_API_URL;
  try {
    process.env.NEXT_PUBLIC_DROPIN_API_URL = "https://api.example.invalid/synthetic";
    for (const path of ["/stewardship", "/stewardship/", "/stewardship/future"]) {
      const result = headers(path); const csp = result.get("content-security-policy")!;
      assert.equal(directive(csp, "connect-src"), "connect-src 'self' https://api.example.invalid");
      assert.equal(directive(csp, "img-src"), "img-src 'self' data: blob:");
      assert.equal(directive(csp, "form-action"), "form-action 'none'");
      assert.equal(directive(csp, "worker-src"), "worker-src 'none'");
      assert.equal(result.get("referrer-policy"), "no-referrer");
      assert.equal(result.get("cache-control"), "private, no-store, max-age=0");
      assert.equal(result.get("x-robots-tag"), "noindex, nofollow");
      assert.match(result.get("permissions-policy")!, /camera=\(\), microphone=\(\), geolocation=\(\)/);
      assert.doesNotMatch(directive(csp, "script-src"), /https:|strict-dynamic/);
    }
    assert.equal(directive(headers("/draw").get("content-security-policy")!, "connect-src"), "connect-src 'self' https:");
    assert.equal(headers("/stewardship-other").get("referrer-policy"), "strict-origin-when-cross-origin");
  } finally { if (original === undefined) delete process.env.NEXT_PUBLIC_DROPIN_API_URL; else process.env.NEXT_PUBLIC_DROPIN_API_URL = original; }
});

test("malformed or insecure remote API configuration cannot broaden child CSP connectivity", () => {
  const original = process.env.NEXT_PUBLIC_DROPIN_API_URL;
  try {
    for (const value of ["", "http://untrusted.example/api", "javascript:alert(1)", "https://example.invalid/\n; connect-src *"]) {
      process.env.NEXT_PUBLIC_DROPIN_API_URL = value;
      const connect = directive(headers("/stewardship").get("content-security-policy")!, "connect-src");
      assert.doesNotMatch(connect, /\*|javascript:|http:\/\/untrusted/);
      assert.ok(["connect-src 'self'", "connect-src 'self' https://example.invalid"].includes(connect));
    }
    process.env.NEXT_PUBLIC_DROPIN_API_URL = "http://127.0.0.1:8787/api";
    assert.equal(directive(headers("/stewardship").get("content-security-policy")!, "connect-src"), "connect-src 'self' http://127.0.0.1:8787");
  } finally { if (original === undefined) delete process.env.NEXT_PUBLIC_DROPIN_API_URL; else process.env.NEXT_PUBLIC_DROPIN_API_URL = original; }
});
