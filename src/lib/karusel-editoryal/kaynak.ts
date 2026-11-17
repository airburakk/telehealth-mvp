// Karusel editoryal — kaynak metni toplayıcı (Vercel'e taşıma, 2026-11-17). Editoryal metnin TEK dayanağı.
// KAYNAK: infra/kart/karusel/editoryal/kaynak.py — BİREBİR çeviri (Europe PMC · ClinicalTrials.gov · Resmî Gazete fihristi ·
// diğer sayfalarda <p>/<h1>/<h2>/<li> metni). Okuma fail-open: kaynak okunamazsa yalnız edisyon metni kalır ve QA'ya yazılır.
//
// Yalnız herkese açık sayfa/API; kimlik bilgisi YOK. Disk önbelleği yerine çalışma başına bellek önbelleği (aynı URL bir
// koşuda bir kez çekilir). URL'ler Bearer korumalı uca gelen edisyondan gelir; yine de yalnız http(s) çekilir.
import { decodeHtmlEntities } from "@/lib/document-text";

const UA = "Mozilla/5.0 (compatible; DoctoriumKaynakOkuyucu/1.0)";
export const MAX_CHARS = 6000;
const TIMEOUT_MS = 30_000;
const YENIDEN_MS = 2_000;
const AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

export type EdisyonOgesi = {
  url: string;
  title: string;
  sourceName: string;
  streamLabel: string;
  publishedAt?: string | null;
  summaryLong?: string | null;
  summaryLongFallback?: boolean | null;
};
export type KaynakPaketi = { edition: string; fetched: string; fetchedOk: boolean; error: string | null };
/** URL → ham bayt. Testte sahtesi verilir. */
export type Getir = (url: string, accept?: string) => Promise<Uint8Array>;

/** Gerçek okuyucu: çalışma başına bellek önbellekli, 30 sn zaman aşımlı; 2xx dışı = hata (Python urlopen gibi). */
export function webGetir(): Getir {
  const onbellek = new Map<string, Promise<Uint8Array>>();
  return (url, accept = "*/*") => {
    const anahtar = `${accept} ${url}`;
    let p = onbellek.get(anahtar);
    if (!p) {
      p = (async () => {
        const u = new URL(url);
        if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error(`desteklenmeyen şema ${u.protocol}`);
        // Python'dan bilinçli fark: 5xx / ağ hatasında BİR kez yeniden dene (17.11 provası: Europe PMC'nin anlık 503'ü
        // tek öğeyi düşürüyordu → bütün karusel tek karta iner). 4xx yeniden denenmez.
        for (let deneme = 1; ; deneme++) {
          try {
            const r = await fetch(u, { headers: { "User-Agent": UA, Accept: accept }, signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
            if (r.status >= 500 && deneme < 2) throw Object.assign(new Error(`HTTP ${r.status}`), { yeniden: true });
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return new Uint8Array(await r.arrayBuffer());
          } catch (e) {
            const yeniden = (e as { yeniden?: boolean }).yeniden || !(e instanceof Error && /^HTTP \d/.test(e.message));
            if (deneme >= 2 || !yeniden) throw e;
            await new Promise((ok) => setTimeout(ok, YENIDEN_MS));
          }
        }
      })();
      onbellek.set(anahtar, p);
      p.catch(() => onbellek.delete(anahtar));
    }
    return p;
  };
}

/** UTF-8; değilse windows-1254 (Resmî Gazete fihristi). */
export function decode(raw: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(raw);
  } catch {
    return new TextDecoder("windows-1254").decode(raw);
  }
}

const strip = (s: string) => s.replace(/<[^>]+>/g, " ");
const cut = (s: string, n: number) => [...s].slice(0, n).join("");

export function htmlText(raw: Uint8Array): string {
  let s = decode(raw);
  s = s.replace(/<(script|style|noscript|nav|footer|header|form)[^>]*>[\s\S]*?<\/\1>/gi, " ");
  const paras = [...s.matchAll(/<(?:p|h1|h2|li)[^>]*>([\s\S]*?)<\/(?:p|h1|h2|li)>/gi)].map((m) => m[1]);
  const text = paras.map((p) => decodeHtmlEntities(strip(p))).join("\n").replace(/[ \t ]+/g, " ");
  return text.split(/\r\n|\r|\n/).map((l) => l.trim()).filter((l) => [...l].length > 30).join("\n");
}

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string => (typeof v === "string" ? v : v == null ? "" : String(v));

async function europepmc(doi: string, getir: Getir): Promise<string> {
  const q = encodeURIComponent(`DOI:"${doi}"`);
  const data = obj(JSON.parse(decode(await getir(`https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${q}&resultType=core&format=json`))));
  const res = arr(obj(data.resultList).result);
  if (!res.length) return "";
  const r = obj(res[0]);
  const abstract = str(r.abstractText).replace(/<[^>]+>/g, " ");
  return `Başlık: ${str(r.title)}\nDergi: ${str(obj(obj(r.journalInfo).journal).title)}\nÖzet: ${abstract}`;
}

async function ctgov(nct: string, getir: Getir): Promise<string> {
  const d = obj(JSON.parse(decode(await getir(`https://clinicaltrials.gov/api/v2/studies/${nct}`, "application/json"))));
  const p = obj(d.protocolSection);
  const ident = obj(p.identificationModule), status = obj(p.statusModule), design = obj(p.designModule);
  const arms = arr(obj(p.armsInterventionsModule).armGroups).map(obj);
  const outs = arr(obj(p.outcomesModule).primaryOutcomes).map(obj);
  const lines = [
    `Resmî başlık: ${str(ident.officialTitle)}`, `Kısa ad: ${str(ident.acronym)}`,
    `Faz: ${arr(design.phases).map(str).join(", ")}`, `Durum: ${str(status.overallStatus)}`,
    `Özet: ${str(obj(p.descriptionModule).briefSummary)}`,
    ...arms.map((a) => `Kol: ${str(a.label)} — ${arr(a.interventionNames).map(str).join(", ")}`),
    ...outs.map((o) => `Birincil sonlanım: ${str(o.measure)}`),
  ];
  return lines.join("\n");
}

async function resmigazete(pdfUrl: string, title: string, getir: Getir): Promise<string> {
  // PDF taranmış görüntü olabilir → aynı günün fihrist sayfası (sayı + karar adı) okunur.
  const m = /\/eskiler\/(\d{4})\/(\d{2})\/(\d{8})/.exec(pdfUrl);
  if (!m) return "";
  const raw = await getir(`https://www.resmigazete.gov.tr/eskiler/${m[1]}/${m[2]}/${m[3]}.htm`);
  const flat = decodeHtmlEntities(strip(decode(raw))).replace(/\s+/g, " ");
  const head = /(\d{1,2} [\p{L}\p{N}_]+ \d{4}) Tarihli ve (\d+) Sayılı Resm/u.exec(flat);
  const key = /Karar Sayısı:\s*(\d+)/.exec(title);
  const hit = key ? new RegExp(`[^.]{0,160}Karar Sayısı:\\s*${key[1]}\\)?`).exec(flat) : null;
  const parts: string[] = [];
  if (head) parts.push(`Fihrist: ${head[1]} tarihli ve ${head[2]} sayılı Resmî Gazete`);
  if (hit) parts.push("Fihrist kaydı: " + hit[0].trim());
  return parts.join("\n");
}

/** Bir öğe için kaynak paketi. Okuma hatası fail-open: yalnız edisyon metni kalır, hata QA'ya yazılır. */
export async function collect(item: EdisyonOgesi, getir: Getir): Promise<KaynakPaketi> {
  const day = (item.publishedAt ?? "").slice(0, 10);
  let meta = `Kaynak: ${item.sourceName} · Akış: ${item.streamLabel ?? ""}`;
  if (day) {
    const [y, mo, d] = day.split("-");
    meta += ` · Yayım tarihi: ${Number(d)} ${AYLAR[Number(mo) - 1]} ${y}`;
  }
  // Yedek cümle (summaryLongFallback) kaynak bilgisi değildir → yalnız başlık.
  const edition = item.summaryLongFallback
    ? `${meta}\nBaşlık: ${item.title}`
    : `${meta}\nBaşlık: ${item.title}\nÖzet: ${item.summaryLong ?? ""}`;
  const url = item.url;
  let fetched = "";
  let error: string | null = null;
  try {
    if (item.sourceName === "Europe PMC" && url.startsWith("https://doi.org/")) fetched = await europepmc(url.slice("https://doi.org/".length), getir);
    else if (url.includes("clinicaltrials.gov/study/")) fetched = await ctgov(url.slice(url.lastIndexOf("/") + 1), getir);
    else if (url.includes("resmigazete.gov.tr")) fetched = await resmigazete(url, item.title, getir);
    else fetched = htmlText(await getir(url));
  } catch (e) {
    error = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  }
  fetched = cut(fetched, MAX_CHARS);
  return { edition, fetched, fetchedOk: fetched.trim().length > 0, error };
}

export function sourceText(p: KaynakPaketi): string {
  return p.edition + (p.fetchedOk ? "\n\n--- KAYNAKTAN OKUNAN METİN ---\n" + p.fetched : "");
}
