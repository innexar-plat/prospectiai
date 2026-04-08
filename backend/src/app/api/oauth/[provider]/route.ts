import { signIn } from "@/auth"
import { NextRequest } from "next/server"

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
    const callbackUrl = request.nextUrl.searchParams.get("callbackUrl") || "/dashboard"

    // signIn() internally builds the OAuth URL, sets PKCE/state cookies,
    // and calls redirect() which throws NEXT_REDIRECT — Next.js converts
    // that into an actual HTTP 302 response with the proper Set-Cookie headers.
    await signIn(provider, { redirectTo: callbackUrl })
}
