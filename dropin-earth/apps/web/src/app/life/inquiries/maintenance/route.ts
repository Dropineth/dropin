import { inquiryRuntime } from '@/lib/life/inquiry-runtime';
import { maintainInquiries } from '@/lib/life/inquiry-service';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export function POST(request: Request) { return maintainInquiries(request, inquiryRuntime()); }
