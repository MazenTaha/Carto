import { NextRequest } from 'next/server';

export const runtime = "nodejs";
import { guardAdminApi } from '@/lib/admin-auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { getAdminOverviewData } from '@/lib/services/admin-dashboard.service';

export async function GET(req: NextRequest) {
  const guard = await guardAdminApi(req);
  if (guard) return guard;

  try {
    return successResponse(await getAdminOverviewData());
  } catch (error: any) {
    console.error('[admin/stats]', error);
    return errorResponse('Failed to fetch admin stats.', 500, 'INTERNAL_SERVER_ERROR');
  }
}
