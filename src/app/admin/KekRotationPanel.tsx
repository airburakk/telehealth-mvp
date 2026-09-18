"use client";

import { useState } from "react";
import { Eye, EyeOff, Loader2, RefreshCw, ShieldAlert, Wand2 } from "lucide-react";
import { AuraButton } from "@/components/ui/AuraButton";
import { CONFIRM_PHRASE, KEK_ROTATION_SECRET_ENV } from "@/lib/kek-rotation-constants";

// Break-glass KEK rotasyonu paneli (2026-09-18, tatbikat #1 A1) — /admin "Şifreleme anahtarı" bloğu.
// Sunucu üç şeyi prop'la geçirir (client env GÖREMEZ): bu dağıtımın KEK parmak izi öneki (escrow paritesi —
// sır değil), ucun kurulu olup olmadığı (KEK_ROTATION_SECRET var mı) ve bu dağıtımın AURA olup olmadığı
// (rotasyon DB ortak olduğu için yalnız AURA projesinden koşar). Yeni KEK yalnız bu formda yaşar: tarayıcıda
// üretilir ya da yapıştırılır, HTTPS ile kendi sunucumuza gider, sunucu hiçbir yerde loglamaz.
type Props = { available: boolean; armed: boolean; fingerprint: string | null };

interface ColumnReport { table: string; column: string; rewrap: number; already: number; foreign: number; blob: number; blobRotated: number }
interface ApiResult {
  ok?: boolean;
  error?: string;
  mode?: "dry-run" | "apply";
  complete?: boolean;
  durationMs?: number;
  scanned?: { tables: number; columns: number };
  totals?: { rewrap: number; already: number; foreign: number; blob: number; blobRotated: number };
  columns?: ColumnReport[];
  foreignSamples?: string[];
  unrotatable?: string[];
  oldFingerprint?: string;
  newFingerprint?: string;
  nextSteps?: string[];
}

/** 32 rastgele bayt → base64 (openssl rand -base64 32 ile aynı biçim). */
function generateKek(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

/** Sunucuyla aynı reçete: sha256(base64 dizesi, kırpılmış) → ilk 12 hex. Escrow'a yazmadan önce karşılaştırma. */
async function fingerprintOf(rawBase64: string): Promise<string> {
  const data = new TextEncoder().encode(rawBase64.trim());
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 12);
}

const INPUT = "w-full rounded-lg border border-[var(--c-hairline)] bg-[var(--c-surface-2)] px-3 py-2 font-mono text-xs text-[var(--c-ink)] outline-none focus:border-[var(--c-ink-3)]";

export function KekRotationPanel({ available, armed, fingerprint }: Props) {
  const [newKek, setNewKek] = useState("");
  const [newFp, setNewFp] = useState<string | null>(null);
  const [showKek, setShowKek] = useState(false);
  const [secret, setSecret] = useState("");
  const [blobs, setBlobs] = useState(true);
  const [applyOpen, setApplyOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState<null | "dry-run" | "apply">(null);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function updateKek(value: string) {
    setNewKek(value);
    setNewFp(value.trim() ? await fingerprintOf(value) : null);
  }

  async function run(mode: "dry-run" | "apply") {
    setBusy(mode);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/kek-rotate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ secret, newKek: newKek.trim(), mode, blobs, confirm: mode === "apply" ? confirm : undefined }),
      });
      const body = (await res.json().catch(() => ({}))) as ApiResult;
      if (!res.ok) setError(body.error ?? `İstek başarısız (${res.status}).`);
      else setResult(body);
    } catch {
      setError("Ağ hatası — istek gönderilemedi (uzun koşumlarda bağlantı düşmüş olabilir; sonuç için denetim zincirine bakın).");
    } finally {
      setBusy(null);
    }
  }

  const ready = newKek.trim().length > 0 && secret.length > 0 && busy === null;

  return (
    <div className="mt-3 flex flex-col gap-4">
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        <dt className="text-[var(--c-ink-3)]">Bu dağıtımın KEK parmak izi</dt>
        <dd className="font-mono text-[var(--c-ink)]">
          {fingerprint ? `${fingerprint}…` : "— (DATA_ENCRYPTION_KEK tanımsız)"}
          <span className="ml-2 font-sans text-[var(--c-ink-3)]">sha256 öneki — escrow kaydıyla karşılaştırın</span>
        </dd>
        <dt className="text-[var(--c-ink-3)]">Break-glass ucu</dt>
        <dd className="text-[var(--c-ink)]">
          {!available
            ? "bu dağıtımda yok (yalnız AURA projesi)"
            : armed
              ? `KURULU — ${KEK_ROTATION_SECRET_ENV} tanımlı; iş bitince kaldırıp yeniden dağıtın`
              : `uykuda — ${KEK_ROTATION_SECRET_ENV} tanımsız (404)`}
        </dd>
      </dl>

      {!available && (
        <p className="text-xs leading-relaxed text-[var(--c-ink-2)]">
          Veritabanı iki markada ortaktır; rotasyon AURA (telehealth-mvp) dağıtımından koşulur. Bu dağıtımda yalnız parmak izi
          gösterilir: rotasyondan sonra buradaki değer de yeni anahtara geçmeli (env iki projeye ayrı girilir).
        </p>
      )}

      {available && !armed && (
        <ol className="list-decimal space-y-1 pl-5 text-xs leading-relaxed text-[var(--c-ink-2)]">
          <li>
            Vercel → telehealth-mvp → Settings → Environment Variables: <code className="font-mono">{KEK_ROTATION_SECRET_ENV}</code> (Production,
            uzun rastgele değer, Sensitive) ekleyin ve yeniden dağıtın. Yazma yetkisi ikinci faktördür: yönetici oturumu tek başına yetmez.
          </li>
          <li>Bu sayfayı yenileyin — form açılır. Yeni anahtarı ÖNCE escrow&apos;a yazın, dry-run ile sayın, sonra uygulayın.</li>
          <li>İş bitince env&apos;i kaldırıp yeniden dağıtın; uç 404&apos;e döner.</li>
        </ol>
      )}

      {available && armed && (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => { e.preventDefault(); if (ready) void run("dry-run"); }}
          autoComplete="off"
        >
          <label className="flex flex-col gap-1 text-xs text-[var(--c-ink-2)]">
            <span>Yeni KEK (base64, 32 byte)</span>
            <div className="flex gap-2">
              <input
                type={showKek ? "text" : "password"}
                value={newKek}
                onChange={(e) => void updateKek(e.target.value)}
                className={INPUT}
                spellCheck={false}
                autoComplete="off"
                name="kek-new"
              />
              <AuraButton type="button" variant="secondary" size="sm" onClick={() => setShowKek((s) => !s)} aria-label={showKek ? "Gizle" : "Göster"}>
                {showKek ? <EyeOff size={14} /> : <Eye size={14} />}
              </AuraButton>
              <AuraButton type="button" variant="secondary" size="sm" onClick={() => void updateKek(generateKek())}>
                <Wand2 size={14} /> Üret
              </AuraButton>
            </div>
            <span className="font-mono text-[var(--c-ink-3)]">
              parmak izi öneki: {newFp ? `${newFp}…` : "—"}
              <span className="ml-2 font-sans">Uygulamadan ÖNCE anahtarı escrow&apos;a yazın (parola kasası + kanonik .env); bu anahtar olmadan veri okunamaz.</span>
            </span>
          </label>

          <label className="flex flex-col gap-1 text-xs text-[var(--c-ink-2)]">
            <span>İkinci faktör — {KEK_ROTATION_SECRET_ENV} değeri</span>
            <input type="password" value={secret} onChange={(e) => setSecret(e.target.value)} className={INPUT} autoComplete="off" name="kek-secret" />
          </label>

          <label className="flex items-center gap-2 text-xs text-[var(--c-ink-2)]">
            <input type="checkbox" checked={blobs} onChange={(e) => setBlobs(e.target.checked)} />
            Blob belgeleri de döndür (blob:v1: — üretimde ŞART; kapatmak yarım rotasyon bırakır)
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <AuraButton type="submit" variant="secondary" size="sm" disabled={!ready}>
              {busy === "dry-run" ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              Dry-run (yazmaz, sayar)
            </AuraButton>
            {!applyOpen ? (
              <AuraButton type="button" variant="secondary" size="sm" disabled={!ready} onClick={() => setApplyOpen(true)} className="text-[var(--c-danger)]">
                <ShieldAlert size={14} /> Uygula…
              </AuraButton>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder={`Onay için ${CONFIRM_PHRASE} yazın`}
                  className={`${INPUT} w-56`}
                  autoComplete="off"
                  name="kek-confirm"
                />
                <AuraButton
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={!ready || confirm !== CONFIRM_PHRASE}
                  onClick={() => void run("apply")}
                  className="text-[var(--c-danger)]"
                >
                  {busy === "apply" ? <Loader2 size={14} className="animate-spin" /> : <ShieldAlert size={14} />}
                  Rotasyonu uygula (geri dönüşü yok)
                </AuraButton>
              </div>
            )}
          </div>
          <p className="text-xs leading-relaxed text-[var(--c-ink-3)]">
            Uzun koşumlar 700 saniyede sayfa sınırında durur ve &quot;tekrar çalıştırın&quot; der; tekrar güvenlidir (bitenler &quot;already&quot; sayılır).
            Uygulama, anahtarı yalnız bellekte tutar; günlük, denetim zinciri ve alarm satırlarında yalnız sha256 önekleri geçer.
          </p>
        </form>
      )}

      {error && (
        <p role="alert" className="text-xs leading-relaxed text-[var(--c-danger)]">{error}</p>
      )}

      {result && result.totals && (
        <div role="status" className="rounded-xl border border-[var(--c-hairline)] bg-[var(--c-surface-2)] px-3 py-3 text-xs">
          <p className="font-semibold text-[var(--c-ink)]">
            {result.mode === "apply" ? "UYGULANDI" : "Dry-run"} · {result.complete ? "tamamlandı" : "SÜRE BÜTÇESİNDE KESİLDİ"} ·{" "}
            {result.scanned?.tables} tablo / {result.scanned?.columns} metin kolonu · {((result.durationMs ?? 0) / 1000).toFixed(1)} sn ·{" "}
            <span className="font-mono">{result.oldFingerprint}… → {result.newFingerprint}…</span>
          </p>
          <p className="mt-1 font-mono text-[var(--c-ink)]">
            rewrap {result.totals.rewrap} · already {result.totals.already} · blob {result.totals.blob}
            {result.mode === "apply" ? ` (döndü ${result.totals.blobRotated})` : ""} · foreign {result.totals.foreign}
            {result.unrotatable && result.unrotatable.length > 0 ? ` · döndürülemeyen ${result.unrotatable.length}` : ""}
          </p>
          {result.columns && result.columns.length > 0 && (
            <ul className="mt-2 grid gap-0.5 font-mono text-[var(--c-ink-2)] sm:grid-cols-2">
              {result.columns.map((c) => (
                <li key={`${c.table}.${c.column}`}>
                  {c.table}.{c.column}: {c.rewrap}/{c.already}/{c.blob}/{c.foreign}
                </li>
              ))}
            </ul>
          )}
          {result.columns && result.columns.length > 0 && (
            <p className="mt-1 text-[var(--c-ink-3)]">(kolon başına rewrap/already/blob/foreign)</p>
          )}
          {result.foreignSamples && result.foreignSamples.length > 0 && (
            <p className="mt-2 text-[var(--c-danger)]">Açılamayan örnekler: {result.foreignSamples.join(" · ")}</p>
          )}
          {result.unrotatable && result.unrotatable.length > 0 && (
            <p className="mt-1 text-[var(--c-danger)]">Tekil id&apos;si olmayan tabloda envelope: {result.unrotatable.join(" · ")}</p>
          )}
          {result.nextSteps && result.nextSteps.length > 0 && (
            <ol className="mt-2 list-decimal space-y-1 pl-5 leading-relaxed text-[var(--c-ink)]">
              {result.nextSteps.map((s) => <li key={s}>{s}</li>)}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
