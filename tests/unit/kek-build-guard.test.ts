// Build-time KEK korkuluğu (2026-09-20, tatbikat #1 A6/B4) — saf değerlendirme sözleşmesi:
//  · VERCEL_ENV=production + KEK yok/boş/32 byte değil → ok=false (build DURUR)
//  · production + geçerli 32 byte base64 → ok=true, skipped=false
//  · preview / VERCEL_ENV yok (yerel, CI) → ok=true, skipped=true (kontrol yapılmaz — dev passthrough bilinçli)
import { describe, it, expect } from "vitest";
import { evaluateKekGuard, KEK_BYTES } from "@/lib/kek-build-guard";

const KEK32 = Buffer.alloc(32, 7).toString("base64");
const KEK16 = Buffer.alloc(16, 7).toString("base64");

describe("evaluateKekGuard — üretim build korkuluğu", () => {
  it("production + KEK tanımsız → FAIL (build başlamaz)", () => {
    const r = evaluateKekGuard({ VERCEL_ENV: "production" });
    expect(r).toMatchObject({ ok: false, skipped: false });
    expect(r.reason).toContain("tanımsız");
  });

  it("production + KEK boş/boşluk → FAIL", () => {
    expect(evaluateKekGuard({ VERCEL_ENV: "production", DATA_ENCRYPTION_KEK: "" }).ok).toBe(false);
    expect(evaluateKekGuard({ VERCEL_ENV: "production", DATA_ENCRYPTION_KEK: "   " }).ok).toBe(false);
  });

  it("production + 16 byte anahtar → FAIL (crypto.ts kekFromBase64 ile aynı ölçüt: tam 32 byte)", () => {
    const r = evaluateKekGuard({ VERCEL_ENV: "production", DATA_ENCRYPTION_KEK: KEK16 });
    expect(r.ok).toBe(false);
    expect(r.reason).toContain(`${KEK_BYTES} byte değil`);
    expect(KEK_BYTES).toBe(32);
  });

  it("production + geçerli 32 byte → ok, kontrol YAPILDI (skipped=false); baştaki/sondaki boşluk tolere edilir", () => {
    expect(evaluateKekGuard({ VERCEL_ENV: "production", DATA_ENCRYPTION_KEK: KEK32 })).toMatchObject({ ok: true, skipped: false });
    expect(evaluateKekGuard({ VERCEL_ENV: "production", DATA_ENCRYPTION_KEK: `  ${KEK32}\n` }).ok).toBe(true);
  });

  it("preview ya da VERCEL_ENV yok (yerel/CI build) → atlanır, KEK'siz de ok (dev passthrough bilinçli)", () => {
    expect(evaluateKekGuard({ VERCEL_ENV: "preview" })).toMatchObject({ ok: true, skipped: true });
    expect(evaluateKekGuard({})).toMatchObject({ ok: true, skipped: true });
    expect(evaluateKekGuard({ VERCEL_ENV: "development", DATA_ENCRYPTION_KEK: KEK16 }).ok).toBe(true);
  });
});
