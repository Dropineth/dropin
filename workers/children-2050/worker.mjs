import { renderPage, pageCss } from './page.mjs';
export const ORIGIN = 'https://children.canopyproof.org';
export const RELEASE = 'children-2050-2026-11-15-v1';
export const securityHeaders = Object.freeze({
  'cache-control': 'private, no-store, max-age=0',
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'x-robots-tag': 'noindex, nofollow, noarchive',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'content-security-policy': "default-src 'none'; style-src 'self'; img-src 'self'; script-src 'none'; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
});
const pages = new Set(['/', '/learn', '/account', '/capture', '/network', '/family']);
function reply(body, status = 200, type = 'text/plain; charset=utf-8', method = 'GET', extra = {}) {
  return new Response(method === 'HEAD' ? null : body, {status, headers: {...securityHeaders, 'content-type': type, ...extra}});
}
export function authenticatedContext(env, ctx) {
  const aud = env?.CHILD_PREVIEW_ACCESS_AUD;
  // Native Access invocation context, NOT user-supplied headers/JWT payloads.
  // This authorizes editorial pages only; it never proves legal guardianship.
  return typeof aud === 'string' && /^[a-f0-9]{64}$/.test(aud) && ctx?.access?.aud === aud;
}
export default {
  fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.origin !== ORIGIN) return reply('Not found',404,undefined,request.method);
    if (!authenticatedContext(env,ctx)) return reply('Access required',403,undefined,request.method);
    const json = (value, status=200) => reply(JSON.stringify(value),status,'application/json; charset=utf-8',request.method);
    if (url.pathname === '/api/status' && ['GET','HEAD'].includes(request.method)) {
      return json({release:RELEASE,mode:'protected-learning',learningAvailable:true,accountOpening:'not_connected',accountId:null,captureRequests:'not_connected',liveScene:'not_connected',verifiedContributionCount:null});
    }
    // Do not read, log, persist, forward or echo child data while no verified
    // account/capture service is connected. No synthetic success or localStorage.
    if (['/api/children/accounts','/api/capture-requests'].includes(url.pathname)) {
      if (!['GET','HEAD','POST'].includes(request.method)) return reply('Method not allowed',405,undefined,request.method,{'allow':'GET, HEAD, POST'});
      return json({error:'SERVICE_NOT_CONNECTED',accepted:false,persisted:false,accountCreated:false},503);
    }
    if (!['GET','HEAD'].includes(request.method)) return reply('Method not allowed',405,undefined,request.method,{'allow':'GET, HEAD'});
    if (url.pathname === '/assets/children2050.css') return reply(pageCss,200,'text/css; charset=utf-8',request.method);
    let path=url.pathname; const zh=!(path==='/en'||path.startsWith('/en/'));
    if (!zh) path=path.slice(3)||'/';
    if (path==='/zh') path='/'; else if(path.startsWith('/zh/')) path=path.slice(3);
    if (['/children','/child-accounts'].includes(path)) path='/';
    if (path==='/stewardship') path='/learn';
    if(!pages.has(path)) return reply('Not found',404,undefined,request.method);
    return reply(renderPage(zh,path),200,'text/html; charset=utf-8',request.method);
  }
};
