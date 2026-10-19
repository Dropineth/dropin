/** Existing public read/presentation routes only. This registry grants no operational capability. */
export const BUSINESS_ROUTES = Object.freeze({
  overview: "/",
  earth: "/earth",
  evidence: "/evidence",
  ecology: "/ecology",
  life: "/life",
  spaces: "/life/spaces",
  company: "/company",
} as const);
export type BusinessArea = keyof typeof BUSINESS_ROUTES;

export function businessHref(area: BusinessArea, locale: "zh" | "en" = "zh"): string {
  if (!Object.hasOwn(BUSINESS_ROUTES, area)) throw new Error("Unknown business area");
  const path = BUSINESS_ROUTES[area];
  // Only Life/company bilingual routes are verified by the Life route manifest.
  // Do not invent /en/ecology or assume every CanopyProof route has a translation.
  const localizable = area === "life" || area === "spaces" || area === "company";
  return locale === "en" && localizable ? `/en${path}` : path;
}
