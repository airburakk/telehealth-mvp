// Build-time KEK korkuluğu — SAF değerlendirme (tatbikat #1 aksiyon A6 / bulgu B4, 2026-09-20). Koşturucu: scripts/check-kek.ts
// (package.json "build" ön adımı → iki Vercel projesinde de `npm run build` koşar).
//
// Neden: lib/crypto encryptField üretimde KEK'siz yazımı fail-closed durdurur ve alarm atar (P0 #3) — ama DEPLOYMENT yine de
// canlıya çıkar: hasta yüzeyi 500'lerle yaşar, şifreli veri okunamaz (SEV-1, geç fark edilir). Tatbikat #1 Inject 1 tam buydu.
// Kapı build'e çekilince KEK'siz/bozuk anahtarlı üretim deployment'ı HİÇ oluşmaz (önceki Ready deployment canlı kalır).
//
// Kapsam: yalnız VERCEL_ENV=production. Preview/yerel/CI build'leri (KEK'siz olabilir) ATLANIR — dev'de düz-metin passthrough
// zaten bilinçli (crypto.ts). ENV proje-başına AYRI girildiği için (CLAUDE.md 2026-09-02 dersi: EDEVLET bayrağı doctorium'a
// taşınmamıştı) korkuluk doctorium projesinde unutulan KEK'i de yakalar. Bilinçli istisna/bypass YOK: KEK'siz üretim deploy'u
// istenen bir durum değildir; anahtar kaybı senaryosunda yol = escrow (DEPLOY.md "Yedekleme / Felaket Kurtarma") ya da break-glass.
//
// Değerlendirme crypto.ts `kekFromBase64` ile aynı ölçüte bakar: base64 çözülünce tam 32 byte.
export const KEK_BYTES = 32;

export interface KekGuardResult {
  ok: boolean;
  /** true = üretim hedefi değil, kontrol yapılmadı (ok=true ile birlikte) */
  skipped: boolean;
  reason: string;
}

export function evaluateKekGuard(env: Record<string, string | undefined>): KekGuardResult {
  const target = (env.VERCEL_ENV ?? "").trim();
  if (target !== "production") {
    return { ok: true, skipped: true, reason: `VERCEL_ENV=${target || "(yok)"} — üretim build'i değil, korkuluk atlandı` };
  }
  const raw = (env.DATA_ENCRYPTION_KEK ?? "").trim();
  if (!raw) return { ok: false, skipped: false, reason: "DATA_ENCRYPTION_KEK tanımsız ya da boş" };
  const len = Buffer.from(raw, "base64").length;
  if (len !== KEK_BYTES) {
    return { ok: false, skipped: false, reason: `DATA_ENCRYPTION_KEK ${KEK_BYTES} byte değil (base64 çözümü ${len} byte) — openssl rand -base64 32` };
  }
  return { ok: true, skipped: false, reason: `DATA_ENCRYPTION_KEK mevcut ve ${KEK_BYTES} byte` };
}
