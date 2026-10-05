// Fixed local error response for malformed internal prefetch flags. This is not
// a page, proxy or external redirect. No submitted values are echoed or stored.
export function GET() {
  return Response.json({ error: "invalid_prefetch_request" }, {
    status: 400,
    headers: { "cache-control": "private, no-store", "x-robots-tag": "noindex, nofollow", "x-content-type-options": "nosniff" },
  });
}
