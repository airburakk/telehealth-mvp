import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifyToken } from "@/lib/session";
import { CONSENT_VERSION } from "@/lib/consent-config";
import { IS_DOCTORIUM_DEPLOY } from "@/lib/brand";
import { usesDoctoriumBrand } from "@/lib/chrome-routes";

const DOCTOR_ROLES = ["DOCTOR", "COORDINATOR", "ADMIN"];
const ETHICS_ROLES = ["ETHICS", "ADMIN"];
const OPS_ROLES = ["COORDINATOR", "ADMIN"]; // S2 operasyon paneli
const PARTNER_ROLES = ["PARTNER", "ADMIN"]; // M5 Faz 3 — Partner Doktor alanı (hasta DB'sine erişimi yok)
const AGENCY_ROLES = ["AGENCY", "ADMIN"]; // S3 Sağlık Turizmi Acentesi — yalnız kısıtlı tedavi dosyaları (FAZ 4)
const HEALTH_PRO_ROLES = ["HEALTH_PRO", "ADMIN"]; // Sağlık Uzmanı başlangıç paneli (klinik yetki yok — 2026-08-12)
const CONSENT_PATH = "/onam";

export async function proxy(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const user = token ? await verifyToken(token) : null;
  const { pathname } = req.nextUrl;

  if (!user) {
    // Giriş kapısı MARKA-DUYARLI (2026-08-29, canlı doğrulamada ölçüldü). Burası koşulsuz
    // "/giris"e yönlendiriyordu — AURA'nın HASTA kapısı. /giris AURA_ONLY_PREFIXES'te olduğu
    // için Doctorium deploy'unda zincir şuydu:
    //   doctorium.tr/admin → doctorium.tr/giris → telehealth-mvp-roan.vercel.app/giris
    // yani oturumu düşen Doctorium kullanıcısı hem BAŞKA MARKAYA hem YANLIŞ KAPIYA (hasta
    // girişi) savruluyordu. Doctorium doktor/öğrenci ürünüdür; kapısı /doctorium/giris'tir.
    const doctoriumSurface =
      IS_DOCTORIUM_DEPLOY || usesDoctoriumBrand(pathname) || pathname.startsWith("/doktor/doctorium");
    const url = new URL(doctoriumSurface ? "/doctorium/giris" : "/giris", req.url);
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
  // ⚠️ SEGMENT SINIRI ŞART (2026-08-17): çıplak startsWith("/doktor") komşu rotaları da yutar —
  // doktor dizini eski "/hekimler" yolundan /doktorlar'a taşınınca (terim kuralı) bu kontrol
  // hasta rolünü dizinden ana sayfaya atardı. /doktorlar klinik panel DEĞİL: giriş + onam ister
  // (aşağıdaki matcher), rol kapısı istemez. Yeni "/doktor…" rotası eklerken bu ayrımı koru.
  if ((pathname === "/doktor" || pathname.startsWith("/doktor/")) && !DOCTOR_ROLES.includes(user.role)) {
    return NextResponse.redirect(new URL("/", req.url));
  }
  if (pathname.startsWith("/operasyon") && !OPS_ROLES.includes(user.role)) {
    return NextResponse.redirect(new URL("/", req.url));
  }
  if (pathname.startsWith("/partner") && !PARTNER_ROLES.includes(user.role)) {
    return NextResponse.redirect(new URL("/", req.url)); // yalnız Partner Doktor (+ADMIN); doktor/hasta giremez
  }
  if (pathname.startsWith("/acente") && !AGENCY_ROLES.includes(user.role)) {
    return NextResponse.redirect(new URL("/", req.url)); // yalnız acente (+ADMIN); sayfalar ayrıca kendi savunmasını yapar
  }
  if (pathname.startsWith("/uzman") && !HEALTH_PRO_ROLES.includes(user.role)) {
    return NextResponse.redirect(new URL("/", req.url)); // yalnız Sağlık Uzmanı (+ADMIN); sayfa kendi staffVerifiedAt kapısını da yapar
  }
  // /kayit/durum: oturum + onam yeterli (rol kapısı yok — sayfa kendi rol/doğrulama yönlendirmesini yapar)
  // MASTER paneli: env-gated + e-posta allowlist (rol DEĞİL). Bürünme oturumu (imp) master sayılmaz.
  // Kontrol inline (middleware'i auth.ts/db'ye bağlamamak için); sayfa da isMaster ile kendi savunmasını yapar.
  if (pathname.startsWith("/master")) {
    const enabled = process.env.MASTER_ACCOUNT_ENABLED === "true";
    const allow = (process.env.MASTER_ACCOUNT_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
    const email = (user.email ?? "").toLowerCase();
    if (!enabled || user.imp || !allow.includes(email)) {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }
  // /gorusme: giriş yeterli (hasta + doktor görüşmeye katılabilir)

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/onam",
    "/triyaj", "/triyaj/:path*",
    "/vaka/:path*",
    "/doktorlar", "/doktorlar/:path*",
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
    "/acente", "/acente/:path*",
    "/uzman", "/uzman/:path*",
    "/kayit/durum", // kurumsal başvuru durumu — oturum + onam kapısı (kayıt formları public kalır)
    "/master", "/master/:path*",
    "/vakalarim",
    "/hesap", // hesap ayarları / veri silme (v6.11) — sayfa ayrıca kendi PATIENT kapısını yapar
    "/erisim-kaydi",
    "/second-opinion/basvur", "/second-opinion/basvur/:path*",
    "/second-opinion/vaka/:path*",
    "/second-opinion/vakalarim",
    "/second-opinion/gorusme/:path*",
    "/ucretsiz-saglik/basvur", "/ucretsiz-saglik/bekleme",
    "/saglik-turizmi", "/saglik-turizmi/:path*",
  ],
};
