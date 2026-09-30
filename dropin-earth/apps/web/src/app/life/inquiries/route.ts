import { inquiryRuntime } from '@/lib/life/inquiry-runtime';
import { inquiryStatus, submitInquiry, withdrawInquiry } from '@/lib/life/inquiry-service';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export function GET() { return inquiryStatus(inquiryRuntime()); }
export function POST(request: Request) { return submitInquiry(request, inquiryRuntime(), request.headers.get('cf-connecting-ip')); }
export function DELETE(request: Request) { return withdrawInquiry(request, inquiryRuntime()); }
