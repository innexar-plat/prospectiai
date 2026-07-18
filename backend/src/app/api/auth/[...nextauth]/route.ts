import { handlers } from "@/auth"
import { NextRequest } from "next/server"
import { APP_ORIGINS } from "@/lib/app-origins"

const ALLOWED_HOSTS = new Set(APP_ORIGINS.map((origin) => new URL(origin).host))

/**
 * Multi-domain deploy behind Traefik+nginx: Next.js standalone reconstructs
 * request.url from the server bind address (0.0.0.0:4000), so Auth.js would
 * emit redirect/callback URLs on the wrong origin. Rewrite the request URL to
 * the public origin from the forwarded headers — restricted to known app hosts
 * so a forged Host header can't steer auth flows to an attacker domain.
 * Ref: https://authjs.dev/getting-started/deployment#docker
 */
function withPublicOrigin(req: NextRequest): NextRequest {
    const forwardedHost = req.headers.get("x-forwarded-host") ?? req.headers.get("host")
    const host = forwardedHost?.split(",")[0]?.trim().toLowerCase()
    if (!host || !ALLOWED_HOSTS.has(host)) return req

    const url = new URL(req.url)
    const publicUrl = new URL(`https://${host}${url.pathname}${url.search}`)
    return new NextRequest(publicUrl, req)
}

export const GET = (req: NextRequest) => handlers.GET(withPublicOrigin(req))
export const POST = (req: NextRequest) => handlers.POST(withPublicOrigin(req))
