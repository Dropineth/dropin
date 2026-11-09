import {childPublicPage, childPublicHeaders} from '../../../components/child-public/public-page.mjs';
export function GET() {return new Response(childPublicPage('canopy', true), {headers:childPublicHeaders});}
export function HEAD() {return new Response(null, {headers:childPublicHeaders});}
