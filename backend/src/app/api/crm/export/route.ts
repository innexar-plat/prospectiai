import { NextRequest, NextResponse } from 'next/server';
import { crmContext, crmFail } from '@/lib/crm-api';
import { exportDealsCsv } from '@/lib/crm';

/** GET /api/crm/export — all deals as CSV (Excel-friendly UTF-8 BOM). */
export async function GET() {
    const ctx = await crmContext();
    if (ctx instanceof NextResponse) return ctx;
    try {
        return new NextResponse(await exportDealsCsv(ctx.workspaceId), {
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="negociacoes-${new Date().toISOString().slice(0, 10)}.csv"`,
            },
        });
    } catch (error) {
        return crmFail(error);
    }
}
