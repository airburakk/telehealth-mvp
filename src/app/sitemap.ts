import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/aura-landing/seo";

// XML sitemap (v5.9.1) — yalnız HALKA AÇIK, indekslenebilir rotalar. Auth-kapılı paneller
// (proxy matcher: /triyaj, /vaka, /doktor, /operasyon, /admin, /acente, /partner, /etik-kurul,
// /denetim, /hekimler, /second-opinion/*, /ucretsiz-saglik/basvur… ) DAHİL DEĞİL; /kurumsal-giris
// bilinçli noindex (personel kapısı) → dışarıda. Landing 8 dil tek URL (dil client-side) → dil
// başına ayrı giriş yok; hreflang yerine og:locale:alternate kullanılır ([[seo]]).
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const entry = (
    path: string,
    priority: number,
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]
  ) => ({ url: `${SITE_URL}${path}`, lastModified: now, changeFrequency, priority });

  return [
    entry("/", 1.0, "weekly"),
    entry("/how-it-works", 0.9, "monthly"),
    entry("/guven-ve-gizlilik", 0.8, "monthly"), // Güven ve Gizlilik (kanonik; /trust → 301)
    entry("/giris", 0.7, "monthly"), // hasta giriş kapısı (public)
    entry("/kayit/hasta", 0.7, "monthly"), // hasta üyeliği
    entry("/kayit", 0.6, "monthly"), // doktor kaydı
    entry("/second-opinion", 0.6, "monthly"), // İkinci Görüş vitrin (kök public; /basvur gated)
    entry("/ucretsiz-saglik", 0.6, "monthly"), // Ücretsiz Sağlık vitrin (kök public; /basvur gated)
  ];
}
