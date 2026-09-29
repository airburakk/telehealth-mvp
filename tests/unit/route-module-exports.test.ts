// Rota modülü export nöbeti (v6.305, 2026-09-30) — Next.js `app/**/route.ts` dosyaları YALNIZ HTTP handler'ları
// (GET/HEAD/POST/PUT/DELETE/PATCH/OPTIONS) ve segment yapılandırmasını dışa aktarabilir. Fazladan bir `export const`
// (olay: api/realtime/token/route.ts → LIVE_TRANSLATE_MODEL) webpack NextTypesPlugin'in ürettiği
// `checkFields<Diff<{ GET?…, runtime?… }, TEntry>>` tip denetimini kırar (`next build --webpack`, 2026-09-22:
// "Property 'LIVE_TRANSLATE_MODEL' is incompatible with index signature"); Turbopack build'i ve CI geçtiği için hata
// GİZLİYDİ. Bu test aynı denetimi kaynak taramasıyla (AST değil, düzenli ifade; satır başı `export`) birim katmanına
// indirir → fazladan export CI'da anında görünür.
// İzinli liste node_modules/next/dist/build/webpack/plugins/next-types-plugin/index.js (createTypeGuardFile) ile
// SÖZLEŞMELİDİR — Next sürümü yükselince oradan yeniden okunur.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";
import { LIVE_TRANSLATE_MODEL } from "@/lib/live-translate-model";

const ROOT = process.cwd();
const APP = join(ROOT, "src", "app");
const HTTP_METHODS = ["GET", "HEAD", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"];
const SEGMENT_CONFIG = [
  "config", "generateStaticParams", "unstable_instant", "unstable_dynamicStaleTime", "revalidate",
  "dynamic", "dynamicParams", "fetchCache", "preferredRegion", "runtime", "maxDuration",
];
const ALLOWED = new Set([...HTTP_METHODS, ...SEGMENT_CONFIG]);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/^route\.(ts|tsx|js|mjs)$/.test(name)) out.push(p);
  }
  return out;
}

/** Çalışma-zamanı export adları. `export type`/`interface` erir (typeof import()'ta görünmez) → sayılmaz.
 *  Adı çıkarılamayan biçim (default / `{ … }` / `* from`) rota dosyasında beklenmez → "?" ile işaretlenir. */
function runtimeExports(src: string): string[] {
  const names: string[] = [];
  for (const line of src.split("\n")) {
    const m = /^\s*export\s+(.*)$/.exec(line);
    if (!m) continue;
    const rest = m[1];
    if (/^(type|interface)\s/.test(rest)) continue;
    const named = /^(?:async\s+)?(?:function\*?|const|let|var|class|enum)\s+([A-Za-z_$][\w$]*)/.exec(rest);
    names.push(named ? named[1] : `? ${rest.trim().slice(0, 40)}`);
  }
  return names;
}

const files = walk(APP);
const rel = (p: string) => relative(ROOT, p).replace(/\\/g, "/");

describe("rota modülü export sözleşmesi (webpack NextTypesPlugin ile aynı izinli liste)", () => {
  it("kaynak ağacı taranabiliyor (nöbetin kendisi çalışıyor mu)", () => {
    expect(files.length).toBeGreaterThan(100); // 2026-09-30: 178
  });

  it("hiçbir route.ts HTTP handler + segment config DIŞINA export vermez", () => {
    const violations: string[] = [];
    for (const f of files) {
      for (const name of runtimeExports(readFileSync(f, "utf8"))) {
        if (!ALLOWED.has(name)) violations.push(`${rel(f)} → ${name}`);
      }
    }
    expect(violations, "fazladan export → src/lib/ modülüne taşı (next build --webpack kırılır)").toEqual([]);
  });

  it("ayrıştırıcı: olayı yakalar (LIVE_TRANSLATE_MODEL), handler/segment config'i tanır, tip export'unu saymaz", () => {
    const src = [
      'export const LIVE_TRANSLATE_MODEL = "gemini-3.5-live-translate-preview";',
      "export async function GET() {}",
      "export function POST(req: Request) {}",
      'export const dynamic = "force-dynamic";',
      "export const maxDuration = 60; // yorum",
      "export type Foo = { a: 1 };",
      "export interface Bar { b: 2 }",
      "  // export const yorumSatiri = 1;",
      "export default handler;",
    ].join("\n");
    expect(runtimeExports(src)).toEqual(["LIVE_TRANSLATE_MODEL", "GET", "POST", "dynamic", "maxDuration", "? default handler;"]);
    expect(runtimeExports(src).filter((n) => !ALLOWED.has(n))).toEqual(["LIVE_TRANSLATE_MODEL", "? default handler;"]);
  });
});

describe("LIVE_TRANSLATE_MODEL tek kaynak — lib/live-translate-model", () => {
  const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
  const IMPORT = 'import { LIVE_TRANSLATE_MODEL } from "@/lib/live-translate-model";';

  it("değer sabit (token ile istemci aynı modele kilitli; değişiklik bilinçli olmalı)", () => {
    expect(LIVE_TRANSLATE_MODEL).toBe("gemini-3.5-live-translate-preview");
  });

  it("token rotası sabiti lib'den okur, kendisi export etmez", () => {
    const src = read("src/app/api/realtime/token/route.ts");
    expect(src).toContain(IMPORT);
    expect(src).not.toMatch(/^\s*export\s+const\s+LIVE_TRANSLATE_MODEL/m); // satır başı: yorumdaki anma sayılmaz
    expect(src).toContain("model: LIVE_TRANSLATE_MODEL");
  });

  it("LiveInterpreter (istemci) yedek model adını aynı sabitten alır — kodda düz literal yok", () => {
    const src = read("src/components/LiveInterpreter.tsx");
    expect(src).toContain(IMPORT);
    expect(src).toContain("td.model || LIVE_TRANSLATE_MODEL");
    const code = src.split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n"); // yorum satırları hariç
    expect(code).not.toContain('"gemini-3.5-live-translate-preview"');
  });
});
