import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { COPY } from "@/lib/aura-landing/copy";

// V02 (v6.297, kontrol raporu): sayfa içi çapa hedefleri ↔ ana sayfa (v2 landing) id'leri.
// - Kök-göreli "/#x" hedefleri (footer, nav — HER sayfadan ana sayfaya iner) src genelinde taranır.
// - Landing ağacındaki (home.tsx'ten import zinciri) "#x" hedefleri de aynı ağaçtaki bir id'ye denk gelmeli.
// - Giriş kartlarının id'si dinamik (`care-<key>`, EntryCard) → COPY.en.v2.entry.cards anahtarlarından türetilir.
// Eski /#ch-* çapaları (v5 landing kalıntısı) karşılıksızdı; bu test geri gelmelerini engeller.
const SRC = resolve(__dirname, "..", "..", "src");
const AURA = join(SRC, "components", "aura");
const HOME = join(AURA, "v2", "home.tsx");

function walk(d: string, out: string[] = []): string[] {
  for (const ad of readdirSync(d)) {
    const p = join(d, ad);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(ad)) out.push(p);
  }
  return out;
}
function resolveImport(from: string, spec: string): string | null {
  if (!spec.startsWith(".")) return null;
  const base = resolve(dirname(from), spec);
  for (const c of [base, base + ".tsx", base + ".ts", join(base, "index.tsx")]) if (existsSync(c) && statSync(c).isFile()) return c;
  return null;
}
/** home.tsx'ten göreli import zinciri (components/aura içinde kalan dosyalar). */
function landingTree(): string[] {
  const seen = new Set<string>(); const stack = [HOME];
  while (stack.length) {
    const f = stack.pop()!;
    if (seen.has(f) || !f.startsWith(AURA)) continue;
    seen.add(f);
    for (const m of readFileSync(f, "utf8").matchAll(/from "(\.[^"]+)"/g)) {
      const r = resolveImport(f, m[1]); if (r) stack.push(r);
    }
  }
  return [...seen];
}
const tree = landingTree();
const read = (f: string) => readFileSync(f, "utf8");
const staticIds = new Set(tree.flatMap((f) => [...read(f).matchAll(/\bid="([a-z][a-z0-9-]*)"/g)].map((m) => m[1])));
const cardIds = (COPY.en.v2.entry.cards as { key: string }[]).map((c) => `care-${c.key}`);
const ids = new Set([...staticIds, ...cardIds]);

describe("landing çapaları (V02)", () => {
  it("landing ağacı home.tsx'ten çözülür ve kart id'leri dinamik olarak EntryCard'da üretilir", () => {
    expect(tree.length).toBeGreaterThan(5);
    const entry = tree.find((f) => f.endsWith("entry-paths.tsx"));
    expect(entry, "entry-paths landing ağacında olmalı").toBeTruthy();
    expect(read(entry!)).toContain("id={`care-${card.key}`}");
    expect(cardIds).toEqual(["care-consult", "care-so", "care-tourism", "care-freecare"]);
  });
  it('kök-göreli href="/#x" hedeflerinin hepsi (src geneli) ana sayfada bir id\'ye denk gelir', () => {
    const missing: string[] = [];
    for (const f of walk(SRC)) {
      for (const m of read(f).matchAll(/href="\/#([a-z][a-z0-9-]*)"/g)) if (!ids.has(m[1])) missing.push(`${f.slice(SRC.length + 1)} → /#${m[1]}`);
    }
    expect(missing).toEqual([]);
  });
  it('landing ağacındaki href="#x" hedefleri de aynı ağaçtaki bir id\'ye denk gelir', () => {
    const missing: string[] = [];
    for (const f of tree) {
      for (const m of read(f).matchAll(/href="#([a-z][a-z0-9-]*)"/g)) if (!ids.has(m[1])) missing.push(`${f.slice(SRC.length + 1)} → #${m[1]}`);
    }
    expect(missing).toEqual([]);
  });
  it("eski /#ch-* çapaları geri gelmez", () => {
    for (const f of walk(SRC)) expect(read(f), f).not.toMatch(/href="\/#ch-/);
  });
});
