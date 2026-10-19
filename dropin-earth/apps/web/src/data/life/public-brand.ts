/** Public presentation only. Do not use this name for protocol IDs, billing tiers or legal identity. */
export const LIFEPP_PUBLIC_BRAND = 'Life++HERE';

export function lifeBrandHomeLabel(locale: 'zh' | 'en'): string {
  return locale === 'zh' ? `${LIFEPP_PUBLIC_BRAND} 首页` : `${LIFEPP_PUBLIC_BRAND} home`;
}
