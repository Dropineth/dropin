import { getCloudflareContext } from '@opennextjs/cloudflare';
import { parseInquiryConfig, type InquiryDatabase, type InquiryRuntime } from './inquiry-service';

function database(value: unknown): value is InquiryDatabase {
  return typeof value === 'object' && value !== null && 'prepare' in value && typeof value.prepare === 'function' && 'batch' in value && typeof value.batch === 'function';
}
/** Request-scoped, server-only binding discovery; never falls back to memory or public env. */
export function inquiryRuntime(): InquiryRuntime | null {
  try {
    const env: Record<string, unknown> = { ...getCloudflareContext().env };
    const config = parseInquiryConfig(env);
    return config && database(env.LIFEPP_INQUIRY_DB) ? { config, db: env.LIFEPP_INQUIRY_DB } : null;
  } catch { return null; }
}
