import { signIn } from "@/auth"
import { NextRequest, NextResponse } from "next/server"
import { resolveAuthRedirectUrl } from "@/lib/app-origins"
import { getSiteUrlFromRequest } from "@/lib/site-url"

const OAUTH_PROVIDERS = new Set(["google", "github"])

/**
 * GET /api/oauth/:provider?callbackUrl=/dashboard
 *
 * Server-side OAuth initiation via Auth.js signIn().
 * This avoids navigating the browser to /api/auth/signin/:provider (which
 * Chrome Enhanced Protection can flag as suspicious).  Instead the browser
 * simply follows a GET redirect chain: our origin → OAuth provider.
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ provider: string }> },
) {
    const { provider } = await params
    if (!OAUTH_PROVIDERS.has(provider)) {
        return NextResponse.json({ error: "Invalid provider" }, { status: 400 })
    }

    const rawCallback = request.nextUrl.searchParams.get("callbackUrl") || "/dashboard"
    const baseUrl = getSiteUrlFromRequest(request)
    const callbackUrl = resolveAuthRedirectUrl(rawCallback, baseUrl)

    // signIn() internally builds the OAuth URL, sets PKCE/state cookies,
    // and calls redirect() which throws NEXT_REDIRECT — Next.js converts
    // that into an actual HTTP 302 response with the proper Set-Cookie headers.
    await signIn(provider, { redirectTo: callbackUrl })
}
