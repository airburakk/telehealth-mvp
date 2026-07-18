import { NextResponse } from "next/server";
import { rateLimit, clientIp } from "@/lib/rate-limit";

// CSP ihlal raporu toplayıcı (Report-Only fazı — 2026-07-18 denetimi P2 "Tam CSP" kalemi).
// Tarayıcı, Content-Security-Policy-Report-Only başlığındaki report-uri/report-to hedefine
// ihlal raporu POST'lar. Bu uç enforce ÖNCESİ allowlist'i gerçek trafikle doğrulamanın veri kaynağıdır.
//
// ⚠️ ASLA-LOGLAMA: rapor gövdesindeki document-uri TAM YOL içerir (ör. /paylasim/<token> — paylaşım
// token'ı!). Bu yüzden TAM URL HİÇBİR ZAMAN loglanmaz: yalnız direktif + engellenen kaynağın ORIGIN'i
// + belgenin İLK yol segmenti yazılır. Kimlik/PHI taşıyan hiçbir alan log'a girmez.
//
// Kimlik doğrulama YOK (bilinçli): tarayıcı raporları oturumsuz gönderir; uç salt-yazar telemetridir.
// Kötüye kullanım freni: IP başına rate-limit + gövde boyutu sınırı + instance-içi tekilleştirme.

const MAX_BODY = 32_768; // 32 KB — normal rapor ~1 KB; şişirilmiş gövdeler işlenmeden düşer
const seen = new Set<string>(); // warm instance başına tekilleştirme (aynı ihlal spam'i tek satır)

// Engellenen kaynak: URL ise yalnız origin'i; 'inline'/'eval'/'wasm-eval'/'data'/'blob' gibi
// anahtar kelimeler olduğu gibi kalır (bunlar zaten host taşımaz).
function blockedOrigin(v: unknown): string {
  const s = String(v ?? "").slice(0, 200);
  if (!s.includes("://")) return s || "(boş)";
  try {
    return new URL(s).origin;
  } catch {
    return "(çözümlenemedi)";
  }
}

// Belge yolu: yalnız İLK segment (/paylasim/<token> → /paylasim) — token/id log'a sızmaz.
function docFirstSegment(v: unknown): string {
  try {
    const p = new URL(String(v ?? "")).pathname;
    const first = p.split("/").filter(Boolean)[0];
    return first ? `/${first}` : "/";
  } catch {
    return "(?)";
  }
}

type Violation = { directive: string; blocked: string; doc: string };

// İki format tek listeye: legacy report-uri {"csp-report":{...}} + Reporting API [{type,body},...].
function parseViolations(raw: unknown): Violation[] {
  const out: Violation[] = [];
  const push = (directive: unknown, blocked: unknown, doc: unknown) =>
    out.push({
      directive: String(directive ?? "?").slice(0, 60),
      blocked: blockedOrigin(blocked),
      doc: docFirstSegment(doc),
    });

  if (Array.isArray(raw)) {
    for (const r of raw.slice(0, 20)) {
      const b = (r as { type?: string; body?: Record<string, unknown> } | null)?.body;
      if (b && (r as { type?: string }).type === "csp-violation") {
        push(b.effectiveDirective, b.blockedURL, b.documentURL);
      }
    }
  } else if (raw && typeof raw === "object" && "csp-report" in raw) {
    const b = (raw as Record<string, Record<string, unknown>>)["csp-report"];
    push(b["effective-directive"] ?? b["violated-directive"], b["blocked-uri"], b["document-uri"]);
  }
  return out;
}

export async function POST(req: Request) {
  // Fren: 30 rapor/dk/IP — aşımda sessiz düş (telemetri; tarayıcıya geri bildirim anlamsız).
  const rl = await rateLimit(`csp-report:${clientIp(req)}`, 30, 60_000);
  if (rl.ok) {
    try {
      const text = await req.text();
      if (text.length <= MAX_BODY) {
        for (const v of parseViolations(JSON.parse(text))) {
          const key = `${v.directive}|${v.blocked}|${v.doc}`;
          if (seen.has(key)) continue;
          if (seen.size < 300) seen.add(key);
          console.warn(`[csp-report] ${v.directive} ← ${v.blocked} @ ${v.doc}`);
        }
      }
    } catch {
      // bozuk gövde — telemetri ucu asla hata sızdırmaz
    }
  }
  return new NextResponse(null, { status: 204 });
}
