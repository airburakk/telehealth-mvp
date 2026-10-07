// İçerik takvimi — YAYIN KAYDI sözleşmesi (v6.332, 2026-10-06). SAF; DB/Node `crypto`'ya dokunmaz → istemci bileşeni de içe aktarabilir.
//
// `ContentPlanItem.publishedRefs` düz String'tir (JSON, projede enum/JSON kolonu kullanılmaz). Tek biçim:
//   { v: 1, manual: boolean, channels: [{ channel, url? }], by?: string, at: ISO, error?: string }
// PUBLISHED'da kanallar + bağlantılar (elle yayın: manual=true, `by` = işaretleyen yönetici; otomasyon: manual=false); FAILED'da `error`.
// Bu alan YALNIZCA durum kaydıdır — içerik/PHI değil. Bağlantılar yalnız https:// kabul edilir (javascript:/data: gibi şemalar asla saklanmaz).

export const PUBLISH_CHANNELS = ["instagram", "linkedin", "facebook", "x", "diger"] as const;
export type PublishChannel = (typeof PUBLISH_CHANNELS)[number];

export const CHANNEL_LABEL: Record<PublishChannel, string> = {
  instagram: "Instagram",
  linkedin: "LinkedIn",
  facebook: "Facebook",
  x: "X",
  diger: "Diğer",
};

export const MAX_URL_LEN = 300;
export const MAX_ERROR_LEN = 300;

export interface PublishedChannel {
  channel: PublishChannel;
  url?: string;
}

export interface Publication {
  v: 1;
  /** true → editör içeriği elle paylaşıp işaretledi; false → otomasyon yayınladı/denedi. */
  manual: boolean;
  channels: PublishedChannel[];
  /** İşaretleyen (ad ya da e-posta). */
  by?: string;
  /** İşaretleme/hata anı (ISO). */
  at: string;
  /** FAILED'da son hata notu (≤ 300). */
  error?: string;
}

const isChannel = (v: unknown): v is PublishChannel => typeof v === "string" && (PUBLISH_CHANNELS as readonly string[]).includes(v);

/** Yalnız https, boşluksuz, kimlik bilgisiz, makul uzunlukta bağlantı; normalleştirilmiş href döner (geçersizse null). */
function safeHttpsUrl(s: string): string | null {
  if (!s || s.length > MAX_URL_LEN || /\s/.test(s)) return null;
  try {
    const u = new URL(s);
    if (u.protocol !== "https:" || !u.hostname || u.username || u.password) return null;
    return u.href.length <= MAX_URL_LEN ? u.href : null;
  } catch {
    return null;
  }
}

export type ChannelsResult = { ok: true; channels: PublishedChannel[] } | { ok: false; error: string };

/** API girdisini doğrular: en az bir kanal; bilinmeyen/tekrarlı kanal ve https dışı/bozuk/uzun bağlantı reddedilir. Bağlantı isteğe bağlıdır. */
export function normalizeChannels(input: unknown): ChannelsResult {
  if (!Array.isArray(input) || input.length === 0) return { ok: false, error: "En az bir kanal seçin." };
  if (input.length > PUBLISH_CHANNELS.length) return { ok: false, error: "Kanal listesi geçersiz." };
  const out: PublishedChannel[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, error: "Kanal biçimi geçersiz." };
    const r = raw as Record<string, unknown>;
    if (!isChannel(r.channel)) return { ok: false, error: "Bilinmeyen kanal." };
    const label = CHANNEL_LABEL[r.channel];
    if (seen.has(r.channel)) return { ok: false, error: `${label} iki kez seçilmiş.` };
    seen.add(r.channel);
    const item: PublishedChannel = { channel: r.channel };
    if (r.url !== undefined && r.url !== null) {
      if (typeof r.url !== "string") return { ok: false, error: `${label}: bağlantı geçersiz.` };
      const t = r.url.trim();
      if (t) {
        const safe = safeHttpsUrl(t);
        if (!safe) return { ok: false, error: `${label}: bağlantı https:// ile başlayan geçerli bir adres olmalı (en çok ${MAX_URL_LEN} karakter).` };
        item.url = safe;
      }
    }
    out.push(item);
  }
  return { ok: true, channels: out };
}

/** Kayıtlı JSON'dan güvenli okuma (bozuk/eski biçim → null; sayfa çökmez). Kanal/bağlantı yeniden doğrulanır: geçersiz bağlantı SESSİZCE düşer. */
export function parsePublication(json: string | null | undefined): Publication | null {
  if (!json) return null;
  try {
    const o: unknown = JSON.parse(json);
    if (!o || typeof o !== "object" || Array.isArray(o)) return null;
    const r = o as Record<string, unknown>;
    if (r.v !== 1 || typeof r.at !== "string" || Number.isNaN(Date.parse(r.at))) return null;
    const channels: PublishedChannel[] = [];
    for (const raw of Array.isArray(r.channels) ? r.channels : []) {
      if (!raw || typeof raw !== "object") continue;
      const c = raw as Record<string, unknown>;
      if (!isChannel(c.channel)) continue;
      const item: PublishedChannel = { channel: c.channel };
      if (typeof c.url === "string") {
        const safe = safeHttpsUrl(c.url.trim());
        if (safe) item.url = safe;
      }
      channels.push(item);
    }
    const pub: Publication = { v: 1, manual: r.manual === true, channels, at: r.at };
    if (typeof r.by === "string" && r.by) pub.by = r.by.slice(0, 120);
    if (typeof r.error === "string" && r.error) pub.error = r.error.slice(0, MAX_ERROR_LEN);
    return pub;
  } catch {
    return null;
  }
}

// ── Elle yayın yardımcıları (indirme paketi + altyazı) ───────────────────────────────────────────────

/** Panoya kopyalanan / ZIP içindeki `altyazi.txt` metni: altyazı + boş satır + etiketler (kaynak künyesi 7. slayttadır). */
export function buildCaptionText(p: { caption: string; hashtags: string[] }): string {
  return [p.caption.trim(), p.hashtags.join(" ").trim()].filter(Boolean).join("\n\n");
}

/** ZIP içindeki slayt dosyası: "01-kapak.png" (sıra + rol; rol ASCII'ye indirgenir). */
export function slideFileName(index: number, role: string): string {
  const slug = role.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "slayt";
  return `${String(index + 1).padStart(2, "0")}-${slug}.png`;
}

/** İndirilen paketin adı: "karar-masasi-2026-10-07.zip". */
export function zipFileName(seriesKey: string, slotDay: string): string {
  return `${seriesKey}-${slotDay}.zip`;
}
