// [S1+S2+S3] Üç modül AURA'nın BAĞIMSIZ vitrin siteleridir: kendi alan adlarında, ayrı Vercel projelerinde yaşarlar
// (21.09.2026'dan beri canlı; kaynak/yeniden yayın: vault output/aura-modul-uygulama/domain-sites/README.md).
// AURA ana sitesinde yalnız BAĞLANTI olarak geçerler: footer "Aura World" + hizmet kartlarındaki "Özel Sitesi" kutuları
// (components/aura/care-site-links.tsx) + v2/entry-paths kart hedefleri.
//
// 👤 karar 2026-10-02: AURA'da /care sayfası YOKTUR (v6.304'te eklenmişti, v6.305'te kaldırıldı — aynı içerik iki
// adreste yayınlanmaz). Bu dosyaya rota, görsel yolu ya da landing metni GERİ EKLENMEZ; yalnız alan adı tutulur.
export const MODULES = {
  "second-opinion": { domain: "aurasecondopinion.com" },
  "medical-tourism": { domain: "auramedicaltourism.com" },
  "medical-aesthetics": { domain: "auramedicalaesthetics.com" },
} as const;

export type ModuleKey = keyof typeof MODULES;
