// RSS kimlik geçişi (v6.307, 2026-10-02) — SAF modül: db/ağ YOK. İçe aktarma (doctorium-sources ingestRss), tek seferlik
// temizlik betiği (scripts/dedupe-rss-guid.ts) ve birim testi AYNI kimlik kuralını buradan okur.
//
// ARKA PLAN: 1438e05 (2026-09-29) ingestRss `externalId`'sini `link` → `guid || link` yaptı (KLİMİK gibi WordPress
// kaynaklarında yazının tarihi değişince permalink de değişiyor, aynı duyuru "yeni kayıt" sanılıyordu). Değişiklik doğruydu
// ama o güne dek yazılmış satırlar link-anahtarlı KALDI. `upsertArticle` yalnız (source, externalId) çiftine baktığı için
// guid ≠ link olan beslemelerde pencere içindeki ESKİ kalemler ilk gece (30 Eylül) yeni kimlikle YENİDEN yaratıldı:
// üretimde KLİMİK'te 7 başlık ikişer kez (ölçüm 2026-10-02; tjod / tatd / tgd-gastro / tgcd aynı sınıf).
// 🔑 DERS: kimlik anahtarının ÜRETİM KURALINI değiştirmek bir veri göçüdür — eski anahtar ya taşınır ya da okuma
// yolunda tanınır; ikisi de yapılmazsa pencere içindeki her kalem bir kez çiftlenir.

/** `NewsArticle.externalId` için RSS toplayıcısının kestiği uzunluk (sondan). */
export const RSS_EXTERNAL_ID_MAX = 180;

/** ESKİ kimlik: 1438e05 öncesi tek kural (guid'siz beslemelerde bugün de geçerli kimlik budur). */
export function legacyRssKey(link: string): string {
  return link.slice(-RSS_EXTERNAL_ID_MAX);
}

/** GÜNCEL kimlik: varsa `<guid>` (yazı düzenlense de değişmez), yoksa `<link>`. */
export function rssExternalId(guid: string, link: string): string {
  return (guid || link).slice(-RSS_EXTERNAL_ID_MAX);
}

export interface TwinRow {
  id: string;
  source: string;
  externalId: string;
  url: string | null;
  createdAt: Date;
}

export interface TwinPair<R extends TwinRow = TwinRow> {
  source: string;
  url: string;
  /** Link-anahtarlı ESKİ satır — kalır (gerçek ilk görülme tarihi + kaydetmeler onda). */
  keep: R;
  /** Guid-anahtarlı YENİ ikiz — silinir; anahtarı `keep`'e taşınır. */
  drop: R;
}

export interface TwinScan<R extends TwinRow = TwinRow> {
  pairs: TwinPair<R>[];
  /** Aynı kaynak + aynı URL ama beklenen biçimde olmayan gruplar — DOKUNULMAZ, yalnız raporlanır. */
  odd: { source: string; url: string; ids: string[]; reason: string }[];
}

/**
 * Aynı kaynak + aynı URL'li satır gruplarından kimlik-geçişi ikizlerini ayırır. Onarılabilir çift = TAM iki satır;
 * biri link-anahtarlı (externalId === legacyRssKey(url)), diğeri değil; link-anahtarlı olan daha eski. Bu kalıba uymayan
 * her grup (üç satır, iki link-anahtarlı, sıra ters…) `odd`'a düşer — tahminle silme YOK.
 */
export function scanRssTwins<R extends TwinRow>(rows: R[]): TwinScan<R> {
  const groups = new Map<string, R[]>();
  for (const r of rows) {
    if (!r.url) continue;
    const k = `${r.source}\n${r.url}`;
    const g = groups.get(k);
    if (g) g.push(r);
    else groups.set(k, [r]);
  }
  const out: TwinScan<R> = { pairs: [], odd: [] };
  for (const g of groups.values()) {
    if (g.length < 2) continue;
    const { source } = g[0];
    const url = g[0].url as string;
    const legacy = g.filter((r) => r.externalId === legacyRssKey(url));
    const rest = g.filter((r) => r.externalId !== legacyRssKey(url));
    const odd = (reason: string) => out.odd.push({ source, url, ids: g.map((r) => r.id), reason });
    if (g.length !== 2) odd(`${g.length} satır (beklenen 2)`);
    else if (legacy.length !== 1 || rest.length !== 1) odd(legacy.length === 0 ? "link-anahtarlı satır yok" : "iki satır da link-anahtarlı");
    else if (legacy[0].createdAt.getTime() > rest[0].createdAt.getTime()) odd("link-anahtarlı satır daha YENİ (beklenen: daha eski)");
    else out.pairs.push({ source, url, keep: legacy[0], drop: rest[0] });
  }
  return out;
}

// ── Tarihi değişen yazı: aynı başlık, FARKLI URL (v6.309, 2026-10-02) ───────────────────────────────────────────────
//
// WordPress kaynaklarında (KLİMİK) yazının tarihi sonradan değişince permalink de değişir. 1438e05 ÖNCESİ kimlik link
// olduğundan aynı yazı yeni adresiyle ikinci kez yazılmıştı (üretimde 8 küme; "Dünya Kuduz Günü" 21 ve 28 Eylül tarihli iki
// kayıt). Bu ikizler scanRssTwins'e GİRMEZ (URL'leri farklı). 🔑 Başlık KİMLİK DEĞİLDİR — "Duyuru" gibi yinelenen başlıklar
// meşrudur — bu yüzden birleştirme kararı yalnız KANITLA verilir: bir satırın adresi bugün diğerine yönleniyorsa (WordPress
// eski tarihli permalink'i yenisine 301'ler) iki satır aynı yazıdır; bayat adresli satır düşer, canlı adresli kalır.

/** Adres karşılaştırması için yalın biçim: şema ve `www.` yok sayılır, yol yüzde-kodundan çözülür, sondaki bölü atılır. */
export function normalizeArticleUrl(u: string): string {
  try {
    const x = new URL(u.trim());
    let path = x.pathname;
    try {
      path = decodeURIComponent(path);
    } catch {
      /* bozuk yüzde-kodu — ham yol karşılaştırılır */
    }
    return `${x.host.toLowerCase().replace(/^www\./, "")}${path.replace(/\/+$/, "")}${x.search}`;
  } catch {
    return u.trim();
  }
}

export interface TitleCluster<R extends TwinRow = TwinRow> {
  source: string;
  title: string;
  /** createdAt'e göre eski → yeni. */
  rows: R[];
}

/** Aynı kaynak + aynı başlık + en az iki FARKLI adres taşıyan kümeler (yalnız aday listesi — karar decideRedated'de). */
export function scanSameTitle<R extends TwinRow & { title: string }>(rows: R[]): TitleCluster<R>[] {
  const groups = new Map<string, R[]>();
  for (const r of rows) {
    if (!r.url) continue;
    const k = `${r.source}\n${r.title}`;
    const g = groups.get(k);
    if (g) g.push(r);
    else groups.set(k, [r]);
  }
  const out: TitleCluster<R>[] = [];
  for (const g of groups.values()) {
    if (new Set(g.map((r) => normalizeArticleUrl(r.url as string))).size < 2) continue;
    out.push({ source: g[0].source, title: g[0].title, rows: [...g].sort((x, y) => x.createdAt.getTime() - y.createdAt.getTime()) });
  }
  return out;
}

/** Bir adresin BUGÜNKÜ durumu (betik canlı ister; saf karar kuralı yalnız bu özetle çalışır). */
export type UrlResolution =
  | { kind: "live"; final: string } // 2xx — `final`: yönlendirmeler izlendikten sonra varılan adres
  | { kind: "dead" } // 404 / 410 — yazı kaynakta artık YOK
  | { kind: "unknown"; note: string }; // ağ hatası · 5xx · 403 … — KANIT DEĞİL

/**
 * Kanıt sınıfları (👤 karar 2026-10-02 — üretim ölçümünde üçü de görüldü):
 *   redirect    — bayat adres canlı adrese yönleniyor, canlı adres kendine çözülüyor (WordPress eski tarihli permalink'i 301'ler).
 *   same-target — iki adres de AYNI üçüncü adrese varıyor: tek yazı defalarca yeniden tarihlenmiş (KLİMİK haftalık bülteni);
 *                 başlık da aynı olduğundan aynı SAYI'nın çiftidir → ilk görülen satır kalır.
 *   dead-link   — bir adres ölü (404/410), diğeri canlı ve kendine çözülüyor: kırık bağlantılı kayıt düşer.
 */
export type RedatedEvidence = "redirect" | "same-target" | "dead-link";

export type RedatedDecision<R extends TwinRow = TwinRow> = { keep: R; drop: R; evidence: RedatedEvidence } | { reason: string };

/**
 * Aynı başlıklı iki satırdan hangisi düşer? Karar yalnız yukarıdaki üç kanıt sınıfından biri varsa verilir; diğer her
 * durum — ikisi de canlı ve AYRI yazı · erişilemedi (kanıt değil) · iki adres de ölü · adresler farklı yerlere varıyor —
 * gerekçesiyle geri döner ve satırlara DOKUNULMAZ. Başlık kimlik değildir: tahminle silme YOK.
 */
export function decideRedated<R extends TwinRow>(a: R, b: R, resolve: (url: string) => UrlResolution): RedatedDecision<R> {
  if (!a.url || !b.url) return { reason: "URL'siz satır" };
  const na = normalizeArticleUrl(a.url);
  const nb = normalizeArticleUrl(b.url);
  if (na === nb) return { reason: "adresler aynı — kimlik geçişi ikizi (scanRssTwins'in işi)" };
  const ra = resolve(a.url);
  const rb = resolve(b.url);
  if (ra.kind === "unknown" || rb.kind === "unknown") {
    const hangi = [ra.kind === "unknown" ? `${a.url} (${ra.note})` : null, rb.kind === "unknown" ? `${b.url} (${rb.note})` : null].filter(Boolean);
    return { reason: `erişilemedi — kanıt sayılmaz: ${hangi.join(" · ")}` };
  }
  if (ra.kind === "dead" && rb.kind === "dead") return { reason: "iki adres de ölü" };
  if (ra.kind === "dead" || rb.kind === "dead") {
    const [live, liveNorm, liveRes, dead] = ra.kind === "dead" ? ([b, nb, rb, a] as const) : ([a, na, ra, b] as const);
    if (liveRes.kind !== "live" || normalizeArticleUrl(liveRes.final) !== liveNorm) return { reason: "bir adres ölü, diğeri başka bir adrese varıyor" };
    return { keep: live, drop: dead, evidence: "dead-link" };
  }
  const ea = normalizeArticleUrl(ra.final);
  const eb = normalizeArticleUrl(rb.final);
  if (ea === nb && eb === nb) return { keep: b, drop: a, evidence: "redirect" };
  if (eb === na && ea === na) return { keep: a, drop: b, evidence: "redirect" };
  if (ea === na && eb === nb) return { reason: "iki adres de canlı ve ayrı (yönlendirme yok) — ayrı yazı" };
  if (ea === eb) {
    const [older, newer] = a.createdAt.getTime() <= b.createdAt.getTime() ? [a, b] : [b, a];
    return { keep: older, drop: newer, evidence: "same-target" };
  }
  return { reason: "adresler farklı yerlere varıyor" };
}

// ── Yeni sayı arşiv anahtarı (v6.309) ───────────────────────────────────────────────────────────────────────────────
//
// Guid kimliğinin açtığı boşluk: KLİMİK haftalık bülteni TEK yazı olarak tutuyor (guid sabit, 2022'den beri) ve her hafta
// başlığını + tarihini değiştiriyor → guid-anahtarlı satır "var" bulunduğu için yeni sayı akışa hiç düşmüyordu. Çözüm
// (lib/doctorium-sources syncRssEdition): başlık VE adres birlikte değişince eski sayı bu anahtara taşınır, guid boşalır,
// yeni sayı yeni kayıt olarak doğar. Anahtar satırın kendi id'sini taşır → çakışması imkânsız; `#` içerdiği için ne guid
// ne link anahtarıyla karışır.

/** Arşivlenen (eski) sayının externalId'si: `<guid>#<satır id>`. */
export function archivedRssKey(externalId: string, rowId: string): string {
  return `${externalId}#${rowId}`;
}
