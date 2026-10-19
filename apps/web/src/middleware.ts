import { NextRequest, NextResponse } from "next/server";

/** /w/<workspace>/<page> shows /<page>. The workspace ID stays in the address bar; the app checks it against the signed-in company. */
export function middleware(req: NextRequest) {
  const m = req.nextUrl.pathname.match(/^\/w\/[a-z0-9-]{2,40}(\/.*)?$/i);
  if (!m) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = m[1] && m[1] !== "/" ? m[1] : "/dashboard";
  return NextResponse.rewrite(url);
}

export const config = { matcher: ["/w/:path*"] };
