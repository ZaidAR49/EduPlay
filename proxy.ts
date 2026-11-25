import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

/**
 * Request proxy that propagates explicit `?lang=ar|en` query overrides to Server Components
 * so bilingual pages render matching SSR HTML, `<html lang/dir>`, and metadata for crawlers.
 */
export function proxy(request: NextRequest) {
  const lang = request.nextUrl.searchParams.get("lang")
  if (lang === "en" || lang === "ar") {
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set("x-eduplay-locale", lang)
    requestHeaders.set("x-eduplay-has-lang", "1")
    return NextResponse.next({
      request: { headers: requestHeaders },
    })
  }
  return NextResponse.next()
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|icon.png|opengraph-image|twitter-image|robots.txt|sitemap.xml|manifest.webmanifest|llms.txt|llms-full.txt).*)",
  ],
}
