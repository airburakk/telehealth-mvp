import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifyToken } from "@/lib/session";
import { CONSENT_VERSION } from "@/lib/consent-config";

const DOCTOR_ROLES = ["DOCTOR", "COORDINATOR", "ADMIN"];
const ETHICS_ROLES = ["ETHICS", "ADMIN"];
const OPS_ROLES = ["COORDINATOR", "ADMIN"]; // S2 operasyon paneli
const PARTNER_ROLES = ["PARTNER", "ADMIN"]; // M5 Faz 3 — Partner Doktor alanı (hasta DB'sine erişimi yok)
const CONSENT_PATH = "/onam";

export async function proxy(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const user = token ? await verifyToken(token) : null;
  const { pathname } = req.nextUrl;

  if (!user) {
    const url = new URL("/giris", req.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Onam sayfası: giriş yeterli (onam kontrolünü atla → döngü olmasın).
  if (pathname === CONSENT_PATH) return NextResponse.next();

  // KVKK açık onam kapısı: güncel sürümde onam yoksa /onam'a yönlendir (her şeyin ön koşulu).
  // cv JWT'de taşınır (login/onam'da set edilir) → proxy DB'siz çalışır (Node runtime; edge desteklenmez).
  // Bilinçli takas: JWT iptali (sv claim) burada KONTROL EDİLMEZ — iptal edilen token sayfa
  // kabuğuna kadar gelebilir; gerçek yaptırım veri katmanında (getCurrentUser sv≠DB → null).
  // Proxy'ye DB koymak her gezintiye sorgu ekler, kazanç marjinal.
  if ((user.cv ?? 0) < CONSENT_VERSION) {
    const url = new URL(CONSENT_PATH, req.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/etik-kurul") && !ETHICS_ROLES.includes(user.role)) {
    return NextResponse.redirect(new URL("/", req.url));
  }
  if (pathname.startsWith("/denetim") && !ETHICS_ROLES.includes(user.role)) {
    return NextResponse.redirect(new URL("/", req.url)); // denetim izi bütünlüğü = denetçi (ADMIN/Etik Kurul)
  }
  if (pathname.startsWith("/admin") && !ETHICS_ROLES.includes(user.role)) {
    return NextResponse.redirect(new URL("/", req.url)); // doktor doğrulama onayı = ADMIN/Etik Kurul
  }
  if (pathname.startsWith("/doktor") && !DOCTOR_ROLES.includes(user.role)) {
    return NextResponse.redirect(new URL("/", req.url));
  }
  if (pathname.startsWith("/operasyon") && !OPS_ROLES.includes(user.role)) {
    return NextResponse.redirect(new URL("/", req.url));
  }
  if (pathname.startsWith("/partner") && !PARTNER_ROLES.includes(user.role)) {
    return NextResponse.redirect(new URL("/", req.url)); // yalnız Partner Doktor (+ADMIN); doktor/hasta giremez
  }
  // /gorusme: giriş yeterli (hasta + doktor görüşmeye katılabilir)

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/onam",
    "/basla",
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
    "/denetim",
    "/admin", "/admin/:path*",
    "/operasyon", "/operasyon/:path*",
    "/partner", "/partner/:path*",
    "/vakalarim",
    "/erisim-kaydi",
    "/second-opinion/basvur", "/second-opinion/basvur/:path*",
    "/second-opinion/vaka/:path*",
    "/second-opinion/vakalarim",
    "/second-opinion/gorusme/:path*",
    "/ucretsiz-saglik/basvur", "/ucretsiz-saglik/bekleme",
  ],
};
