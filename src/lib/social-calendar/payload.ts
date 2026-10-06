// İçerik takvimi — YÜK (payload) sözleşmesi (v6.328, 2026-10-06): slaytlar + altyazı + kaynaklar. SAF; DB'ye dokunmaz.
//
// Üç iş: (1) API girdisini DOĞRULAYIP normalize eder (zod bağımlılığı YOK — projede elle doğrulama), (2) KANONİK JSON + sha256 üretir
// (onay mührü: `approvedHash` — yayın hattı "onaydan sonra değişmedi" diye bunu yeniden hesaplar), (3) "Doktor için çıkarım" editör
// metnini slayt maddelerine çevirir (TEK girdi: textarea → cikarim slaytı `bullets`).
// Hash'e giren: slayt rol/başlık/gövde/maddeler/alıntı bayrağı + altyazı + etiketler + kaynaklar. Girmeyen: `auto` (taslak bayrağı) ve `meta`
// (bilgi amaçlı: tema, daire…) — bunları düzenlemek yayınlanacak içeriği değiştirmez, onayı düşürmez.
import { sha256 } from "../timestamp";
import { LIMITS, noteLines } from "./limits";
import { SLIDE_ROLES, type SlideRole } from "./series";

// Sınırlar ve editör metni yardımcısı limits.ts'te (istemci de okuyabilsin: bu dosya Node `crypto`'ya bağlanır); mevcut içe aktarmalar için yeniden dışa aktarılır.
export { LIMITS, noteLines };

export interface Slide {
  role: SlideRole;
  title: string;
  body: string;
  /** Madde listesi (Doktor için çıkarım). */
  bullets?: string[];
  /** true → gövde kaynak metinden BİREBİR alıntıdır; onay kapısı kaynakta aynen geçtiğini doğrular. */
  quote?: boolean;
  /** true → otomatik üretildi, editör henüz dokunmadı (ekranda "otomatik taslak — kontrol edin"). Hash'e GİRMEZ. */
  auto?: boolean;
}

export interface PlanSource {
  label: string;
  ref: string;
}

export interface PlanMeta {
  court?: string;
  daire?: string;
  esas?: string;
  karar?: string;
  tarih?: string;
  theme?: string;
  themeLabel?: string;
  themes?: string[];
  sonuc?: string;
  /** Üreticinin çıkardığı alternatif gerekçe kesitleri (birincil dahil; birebir alıntı). Editör "Başka kesit" ile gövdeyi değiştirir; hash'e girmez. */
  gerekceAlts?: string[];
}

export interface PlanPayload {
  v: 1;
  slides: Slide[];
  /** Instagram altyazısı (≤ 2200). Hashtag'ler ayrı alanda. */
  caption: string;
  hashtags: string[];
  sources: PlanSource[];
  meta?: PlanMeta;
}

export function emptyPayload(): PlanPayload {
  return { v: 1, slides: [], caption: "", hashtags: [], sources: [] };
}

const str = (v: unknown): string => (typeof v === "string" ? v.replace(/\r\n?/g, "\n").trim() : "");

export type NormalizeResult = { ok: true; payload: PlanPayload } | { ok: false; error: string };

/** API girdisini (bilinmeyen biçim) doğrular ve temiz bir PlanPayload üretir; bilinmeyen alanlar atılır. */
export function normalizePayload(input: unknown): NormalizeResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false, error: "İçerik biçimi geçersiz." };
  const o = input as Record<string, unknown>;
  if (!Array.isArray(o.slides)) return { ok: false, error: "Slayt listesi eksik." };
  if (o.slides.length > LIMITS.maxSlides) return { ok: false, error: `En çok ${LIMITS.maxSlides} slayt olabilir.` };

  const slides: Slide[] = [];
  for (const [i, raw] of o.slides.entries()) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, error: `Slayt ${i + 1} biçimi geçersiz.` };
    const s = raw as Record<string, unknown>;
    const role = s.role;
    if (typeof role !== "string" || !(SLIDE_ROLES as readonly string[]).includes(role)) return { ok: false, error: `Slayt ${i + 1}: geçersiz rol.` };
    const title = str(s.title);
    const body = str(s.body);
    if (title.length > LIMITS.title) return { ok: false, error: `Slayt ${i + 1}: başlık en çok ${LIMITS.title} karakter.` };
    if (body.length > LIMITS.body) return { ok: false, error: `Slayt ${i + 1}: gövde en çok ${LIMITS.body} karakter.` };
    let bullets: string[] | undefined;
    if (s.bullets !== undefined && s.bullets !== null) {
      if (!Array.isArray(s.bullets) || s.bullets.some((b) => typeof b !== "string")) return { ok: false, error: `Slayt ${i + 1}: maddeler geçersiz.` };
      bullets = (s.bullets as string[]).map((b) => str(b)).filter(Boolean);
      if (bullets.length > LIMITS.bullets) return { ok: false, error: `Slayt ${i + 1}: en çok ${LIMITS.bullets} madde.` };
      if (bullets.some((b) => b.length > LIMITS.bullet)) return { ok: false, error: `Slayt ${i + 1}: madde en çok ${LIMITS.bullet} karakter.` };
    }
    const slide: Slide = { role: role as SlideRole, title, body };
    if (bullets && bullets.length) slide.bullets = bullets;
    if (s.quote === true) slide.quote = true;
    if (s.auto === true) slide.auto = true;
    slides.push(slide);
  }

  const caption = str(o.caption);
  if (caption.length > LIMITS.caption) return { ok: false, error: `Altyazı en çok ${LIMITS.caption} karakter.` };

  const hashtags: string[] = [];
  if (o.hashtags !== undefined && o.hashtags !== null) {
    if (!Array.isArray(o.hashtags) || o.hashtags.some((h) => typeof h !== "string")) return { ok: false, error: "Etiketler geçersiz." };
    for (const h of o.hashtags as string[]) {
      const t = str(h).replace(/\s+/g, "");
      if (!t) continue;
      if (t.length > LIMITS.hashtag) return { ok: false, error: `Etiket en çok ${LIMITS.hashtag} karakter.` };
      hashtags.push(t.startsWith("#") ? t : `#${t}`);
    }
    if (hashtags.length > LIMITS.hashtags) return { ok: false, error: `En çok ${LIMITS.hashtags} etiket olabilir.` };
  }

  const sources: PlanSource[] = [];
  if (o.sources !== undefined && o.sources !== null) {
    if (!Array.isArray(o.sources)) return { ok: false, error: "Kaynak listesi geçersiz." };
    for (const raw of o.sources) {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, error: "Kaynak biçimi geçersiz." };
      const r = raw as Record<string, unknown>;
      const label = str(r.label);
      const ref = str(r.ref);
      if (!label && !ref) continue;
      if (label.length > LIMITS.sourceLabel || ref.length > LIMITS.sourceRef) return { ok: false, error: "Kaynak metni çok uzun." };
      sources.push({ label, ref });
    }
    if (sources.length > LIMITS.sources) return { ok: false, error: `En çok ${LIMITS.sources} kaynak olabilir.` };
  }

  const payload: PlanPayload = { v: 1, slides, caption, hashtags, sources };
  const meta = normalizeMeta(o.meta);
  if (meta) payload.meta = meta;
  return { ok: true, payload };
}

function normalizeMeta(raw: unknown): PlanMeta | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const m = raw as Record<string, unknown>;
  const out: PlanMeta = {};
  for (const k of ["court", "daire", "esas", "karar", "tarih", "theme", "themeLabel", "sonuc"] as const) {
    const v = str(m[k]);
    if (v) out[k] = v.slice(0, 200);
  }
  if (Array.isArray(m.themes)) {
    const t = m.themes.filter((x): x is string => typeof x === "string").map((x) => x.slice(0, 80)).slice(0, 10);
    if (t.length) out.themes = t;
  }
  if (Array.isArray(m.gerekceAlts)) {
    // alıntı kesitleri KESİLMEZ (kesilirse birebir olmaz): sınırı aşan eleman atılır
    const a = m.gerekceAlts.filter((x): x is string => typeof x === "string" && x.length > 0 && x.length <= LIMITS.body).slice(0, 4);
    if (a.length) out.gerekceAlts = a;
  }
  return Object.keys(out).length ? out : undefined;
}

/** Kayıtlı JSON'dan güvenli okuma: bozuksa null (sayfa çökmez, "taslak yok" gösterir). */
export function parsePayload(json: string | null | undefined): PlanPayload | null {
  if (!json) return null;
  try {
    const r = normalizePayload(JSON.parse(json));
    return r.ok ? r.payload : null;
  } catch {
    return null;
  }
}

// ── Kanonik biçim + mühür ────────────────────────────────────────────────────────────────────────────

/** Sabit anahtar sırası; `auto` ve `meta` HARİÇ (bkz. dosya başlığı). */
export function canonicalJson(p: PlanPayload): string {
  return JSON.stringify({
    v: 1,
    slides: p.slides.map((s) => ({ role: s.role, title: s.title, body: s.body, bullets: s.bullets ?? [], quote: s.quote === true })),
    caption: p.caption,
    hashtags: p.hashtags,
    sources: p.sources.map((x) => ({ label: x.label, ref: x.ref })),
  });
}

export function payloadHash(p: PlanPayload): string {
  return sha256(canonicalJson(p));
}

// ── "Doktor için çıkarım" (tek girdi: textarea; satır ayrıştırma `noteLines` limits.ts'te) ─────────────────

/** Editör metnini `cikarim` slaytının maddelerine yansıtır (slayt yoksa payload'a dokunmaz). Girdiyi DEĞİŞTİRMEZ. */
export function applyEditorNote(p: PlanPayload, note: string | null | undefined): PlanPayload {
  const lines = noteLines(note).slice(0, LIMITS.bullets);
  return {
    ...p,
    slides: p.slides.map((s) => {
      if (s.role !== "cikarim") return s;
      // editör dokundu → `auto` bayrağı düşer (yeni nesne; girdi değişmez)
      const next: Slide = { role: s.role, title: s.title, body: s.body, bullets: lines };
      if (s.quote) next.quote = true;
      return next;
    }),
  };
}

/** `cikarim` slaytının maddeleri → textarea metni (sayfa ilk yüklenirken). */
export function noteFromPayload(p: PlanPayload | null): string {
  const s = p?.slides.find((x) => x.role === "cikarim");
  return (s?.bullets ?? []).map((b, i) => `${i + 1}) ${b}`).join("\n");
}
