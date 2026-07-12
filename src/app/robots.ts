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
        "/doktor",
        "/hekim",
        "/acente",
        "/partner",
        "/etik-kurul",
        "/denetim",
        "/kurumsal-giris", // personel kapısı + /e-posta formu (noindex)
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
