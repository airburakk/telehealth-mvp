import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifyToken } from "@/lib/session";

const DOCTOR_ROLES = ["DOCTOR", "COORDINATOR", "ADMIN"];
const ETHICS_ROLES = ["ETHICS", "ADMIN"];
const OPS_ROLES = ["COORDINATOR", "ADMIN"]; // S2 operasyon paneli

export async function middleware(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const user = token ? await verifyToken(token) : null;
  const { pathname } = req.nextUrl;

  if (!user) {
    const url = new URL("/giris", req.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/etik-kurul") && !ETHICS_ROLES.includes(user.role)) {
    return NextResponse.redirect(new URL("/", req.url));
  }
  if (pathname.startsWith("/doktor") && !DOCTOR_ROLES.includes(user.role)) {
    return NextResponse.redirect(new URL("/", req.url));
  }
  if (pathname.startsWith("/operasyon") && !OPS_ROLES.includes(user.role)) {
    return NextResponse.redirect(new URL("/", req.url));
  }
  // /gorusme: giriş yeterli (hasta + doktor görüşmeye katılabilir)

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/triyaj", "/triyaj/:path*",
    "/hekimler", "/hekim/:path*",
    "/doktor", "/doktor/:path*",
    "/gorusme/:path*",
    "/paket/:path*",
    "/teklif/:path*",
    "/rezervasyon/:path*",
    "/takip/:path*",
    "/paylasimlarim", "/paylasimlarim/:path*",
    "/sikayet/:path*",
    "/etik-kurul", "/etik-kurul/:path*",
    "/operasyon", "/operasyon/:path*",
    "/vakalarim",
    "/second-opinion/basvur", "/second-opinion/basvur/:path*",
    "/second-opinion/vaka/:path*",
    "/second-opinion/vakalarim",
    "/second-opinion/gorusme/:path*",
    "/pro-bono/basvur", "/pro-bono/bekleme",
  ],
};
