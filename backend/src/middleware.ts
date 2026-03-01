import { NextRequest, NextResponse } from 'next/server';

export default function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;
    // Log only method + path in development; never log cookie or other sensitive headers (security).
    if (process.env.NODE_ENV === 'development') {
        console.log(`[REQ] ${req.method} ${pathname}`);
    }

    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new NextResponse(null, {
            status: 200,
            headers: {
                'Access-Control-Allow-Credentials': 'true',
                'Access-Control-Allow-Origin': process.env.FRONTEND_URL || 'https://prospectorai.innexar.com.br',
                'Access-Control-Allow-Methods': 'GET,OPTIONS,PATCH,DELETE,POST,PUT',
                'Access-Control-Allow-Headers': 'X-CSRF-Token, X-Requested-With, Accept, Content-Type, Authorization',
            },
        });
    }

    // Only API routes are served by this backend
    if (!pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Not Found' }, { status: 404 });
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
