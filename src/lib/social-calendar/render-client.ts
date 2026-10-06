// İçerik takvimi — PNG önizleme istemcisi (v6.328, 2026-10-06). Vercel → n8n webhook → kart servisi (`POST /rubrik/render`, infra/kart).
//
// 👤 Karar (2026-10-06): önizleme YAKLAŞIK HTML değil, yayınlanacak PNG'nin kendisidir (kart servisi aynı Chromium'la çizer) — editör
// onayladığı şeyin pikseline bakar. Kart servisi internete AÇIK DEĞİL (docker ağı içi); köprü n8n'dir. `Authorization: Bearer
// SOCIAL_DIGEST_TOKEN` başlığı n8n'den geçip kart servisine ulaşır, doğrulamayı KART yapar (n8n akışında saklı sır yok).
// Env: RUBRIK_RENDER_URL (n8n webhook adresi — sır DEĞİL ama yalnız sunucuda tutulur) · SOCIAL_DIGEST_TOKEN (social-digest ile ortak).
// Servis yoksa/kapalıysa önizleme 503 döner; takvimin geri kalanı (aday, taslak, kapılar, onay) çalışmaya devam eder.
import type { PlanPayload } from "./payload";
import type { SeriesDef, SlideRole } from "./series";

export interface RenderedSlide {
  index: number;
  role: SlideRole;
  /** base64 PNG (1080×1350). */
  png: string;
  /** true → metin asgari puntoda bile sığmadı (kart servisi işaretler); ekranda "kısaltın" uyarısı. */
  tasma: boolean;
}

export type RenderResult = { ok: true; slides: RenderedSlide[] } | { ok: false; status: number; error: string };

export const RENDER_TIMEOUT_MS = 90_000;
const MAX_RESPONSE_BYTES = 24 * 1024 * 1024;

export interface RenderRequestBody {
  templateKey: string;
  seriesName: string;
  slotDay: string;
  slides: { role: SlideRole; title: string; body: string; bullets: string[]; quote: boolean }[];
}

/** Kart servisine giden gövde: yalnız görsele yarayan alanlar (hash'e giren/girmeyen ayrımı burada yok; `auto`/`meta` gönderilmez). */
export function renderRequestBody(series: SeriesDef, payload: PlanPayload, slotDay: string): RenderRequestBody {
  return {
    templateKey: series.templateKey,
    seriesName: series.name,
    slotDay,
    slides: payload.slides.map((s) => ({ role: s.role, title: s.title, body: s.body, bullets: s.bullets ?? [], quote: s.quote === true })),
  };
}

export async function renderRubrik(
  input: { series: SeriesDef; payload: PlanPayload; slotDay: string },
  opts: { fetchImpl?: typeof fetch; url?: string; token?: string; timeoutMs?: number } = {},
): Promise<RenderResult> {
  const url = opts.url ?? process.env.RUBRIK_RENDER_URL;
  const token = opts.token ?? process.env.SOCIAL_DIGEST_TOKEN;
  if (!url || !token) return { ok: false, status: 503, error: "Önizleme servisi yapılandırılmamış (RUBRIK_RENDER_URL / SOCIAL_DIGEST_TOKEN)." };
  if (input.payload.slides.length === 0) return { ok: false, status: 400, error: "Önizlenecek slayt yok." };

  const f = opts.fetchImpl ?? fetch;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? RENDER_TIMEOUT_MS);
  try {
    const res = await f(url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify(renderRequestBody(input.series, input.payload, input.slotDay)),
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (res.status === 401 || res.status === 403) return { ok: false, status: 502, error: "Önizleme servisi kimliği reddetti (SOCIAL_DIGEST_TOKEN uyuşmuyor)." };
    if (res.status === 503 || res.status === 429) return { ok: false, status: 503, error: "Önizleme servisi şu an meşgul (sabah yayın işi çalışıyor olabilir) — birkaç dakika sonra deneyin." };
    if (!res.ok) return { ok: false, status: 502, error: `Önizleme servisi hata verdi (${res.status}).` };
    const text = await res.text();
    if (text.length > MAX_RESPONSE_BYTES) return { ok: false, status: 502, error: "Önizleme yanıtı beklenenden büyük." };
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      return { ok: false, status: 502, error: "Önizleme yanıtı çözümlenemedi." };
    }
    const slides = parseRenderResponse(json);
    if (!slides) return { ok: false, status: 502, error: "Önizleme yanıtı geçersiz biçimde." };
    return { ok: true, slides };
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return { ok: false, status: aborted ? 504 : 502, error: aborted ? "Önizleme zaman aşımına uğradı." : "Önizleme servisine ulaşılamadı." };
  } finally {
    clearTimeout(timer);
  }
}

/** Yanıt doğrulaması: `{ slides: [{ index, role, png }] }`; png = base64 PNG (imza kontrolü). Geçersizse null. */
export function parseRenderResponse(json: unknown): RenderedSlide[] | null {
  if (!json || typeof json !== "object") return null;
  const arr = (json as { slides?: unknown }).slides;
  if (!Array.isArray(arr) || arr.length === 0 || arr.length > 12) return null;
  const out: RenderedSlide[] = [];
  for (const raw of arr) {
    if (!raw || typeof raw !== "object") return null;
    const r = raw as Record<string, unknown>;
    if (typeof r.png !== "string" || !r.png.startsWith("iVBORw0KGgo")) return null; // PNG imzasının base64'ü
    if (typeof r.index !== "number" || typeof r.role !== "string") return null;
    out.push({ index: r.index, role: r.role as SlideRole, png: r.png, tasma: r.tasma === true });
  }
  return out;
}
