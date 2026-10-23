/** Defense in depth before legacy authentication and route handlers.
 * A dedicated synthetic-demo server cannot expose any legacy data or execution surface.
 */
export function childBoundaryDenies(path: string, authorization: string, serverMode: string | undefined): boolean {
  if (path === "/canopyproof/child-stewardship/v1" || path.startsWith("/canopyproof/child-stewardship/v1/")) return false;
  if (/^Bearer\s+cp-demo\./i.test(authorization)) return true;
  return serverMode === "synthetic-demo" && !["/health", "/ready", "/metrics"].includes(path);
}
