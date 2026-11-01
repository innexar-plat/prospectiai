import { NextRequest, NextResponse } from 'next/server';
import { crmContext, crmFail } from '@/lib/crm-api';
import { listMembers } from '@/lib/crm';

/** GET /api/crm/members — workspace members (deal owners). */
export async function GET() {
    const ctx = await crmContext();
    if (ctx instanceof NextResponse) return ctx;
    try {
        const members = await listMembers(ctx.workspaceId);
        return NextResponse.json({ members: members.map((m) => ({ userId: m.userId, role: m.role, name: m.user.name, email: m.user.email })) });
    } catch (error) {
        return crmFail(error);
    }
}
