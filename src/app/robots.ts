import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/aura-landing/seo";

// robots.txt (v5.9.1) — public landing/giriş/kayıt taranabilir; hassas paneller ve API
// dışlanır (indeks gürültüsü + yüzey daraltma). /kurumsal-giris personel kapısı (sayfa
// meta'sı da noindex). Auth-kapılı rotalar zaten login'e 307 döner; robots ek sinyal.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/admin",
        "/operasyon",
        // ⚠️ robots.txt prefix eşleşmesi segment-agnostiktir: "/doktor" satırı doktor dizinini
        // (/doktorlar · /doktorlar/[id] — 2026-08-17 rename'i; eski yollar "/hekimler"·"/hekim") DA
        // kapsar. İkisi de oturum-kapılı olduğundan istenen davranış; ayrı satır gerekmez.
        "/doktor",
        "/acente",
        "/partner",
        "/etik-kurul",
        "/denetim",
        "/kurumsal-giris", // personel kapısı + /e-posta formu (noindex)
        "/doctorium/giris", // Doctorium kapısı (noindex) — /doctorium LANDING indekslenir, prefix onu KAPSAMAZ
        "/doctorium-v1", // eski landing'in karşılaştırma yedeği (2026-08-23, noindex) — iki landing indekslenmesin
        "/doctorium-v2", // v2 landing'in karşılaştırma yedeği (2026-08-26, noindex) — v3 takası
        "/vaka",
        "/vakalarim",
        "/paket",
        "/teklif",
        "/rezervasyon",
        "/takip",
        "/paylasimlarim",
        "/sikayet",
        "/erisim-kaydi",
        "/gorusme",
        "/konsultasyon",
        "/triyaj",
        "/onam",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
