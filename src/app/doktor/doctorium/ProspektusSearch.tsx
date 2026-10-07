"use client";

import { useState } from "react";
import { AlertTriangle, ChevronDown, Loader2, Pill, Search } from "lucide-react";

import { labelSourceUrl, type LabelResult as Result } from "@/lib/prospektus-label";

// Dijital prospektüs arama (v6.50). Kaynak openFDA = ABD ürün bilgisi; TİTCK'nın makine-okunur
// kaynağı YOK → "FDA (ABD)" uyarısı kaldırılamaz biçimde her sonuçta durur ve metin ÇEVRİLMEZ.
export function ProspektusSearch() {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<Result[] | null>(null);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (q.trim().length < 2) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/doctorium/prospektus?q=${encodeURIComponent(q.trim())}`);
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Arama başarısız.");
      setRows(j.results ?? []);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Arama başarısız.");
      setRows(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-5 rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-surface)] p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--c-ink)]">
        <Pill size={16} className="text-[var(--c-accent)]" /> Dijital prospektüs araması
      </h2>

      <form onSubmit={search} className="mt-3 flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Etken madde veya marka adı (ör. metformin)"
          aria-label="İlaç adı"
          className="min-w-0 flex-1 rounded-xl border border-[var(--c-hairline)] bg-[var(--c-surface-2)] px-3 py-2 text-sm text-[var(--c-ink)] outline-none focus:border-[var(--c-accent)]/50"
        />
        <button type="submit" disabled={busy || q.trim().length < 2}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[var(--c-accent)] px-3.5 py-2 text-sm font-semibold text-[var(--c-bg)] hover:bg-[var(--c-accent-strong)] disabled:opacity-60">
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />} Ara
        </button>
      </form>

      {/*
        UYARI AÇILIR KAPANIR (kullanıcı isteği 2026-08-19) — ama KRİTİK CÜMLE DAİMA GÖRÜNÜR.
        Bu bir güvenlik uyarısıdır: veri ABD ruhsatına ait, Türkiye KÜB/KT'si farklı olabilir.
        Tamamen gizlenirse doktor FDA etiketine bakıp Türkiye endikasyonu sanabilir.
        Çözüm: <summary> satırının KENDİSİ iddiayı taşır ("FDA (ABD) ürün bilgisidir"),
        ayrıntı açılır. 🔴 Bu satırı kapanabilir hâle getirme — yalnız altındaki detay katlanır.
        Uyarı ayrıca her SONUÇ kartında "FDA · ABD" rozetiyle tekrar eder.
      */}
      <details className="group mt-2 rounded-xl border border-amber-400/25 bg-amber-500/10">
        <summary className="flex cursor-pointer list-none items-start gap-2 px-3 py-2 text-[11px] leading-relaxed text-amber-200">
          <AlertTriangle size={14} className="mt-px shrink-0" />
          <span className="flex-1">
            Sonuçlar <strong>FDA (ABD) onaylı ürün bilgisidir</strong> — Türkiye ruhsatı farklı olabilir.
          </span>
          <ChevronDown size={14} className="mt-px shrink-0 transition-transform group-open:rotate-180" />
        </summary>
        <p className="px-3 pb-2.5 pl-[34px] text-[11px] leading-relaxed text-amber-200/90">
          Türkiye ruhsatındaki Kısa Ürün Bilgisi (KÜB) / Kullanma Talimatı (KT) endikasyon, doz ve
          uyarılar açısından FARKLI olabilir — reçeteleme kararında{" "}
          <strong>TİTCK onaylı KÜB&apos;ü esas alın</strong>. Metinler özgün dilinde (İngilizce)
          gösterilir; çeviri yapılmaz.
        </p>
      </details>

      {err && <p className="mt-2 text-xs text-rose-300">{err}</p>}
      {rows?.length === 0 && <p className="mt-3 text-xs text-[var(--c-ink-2)]">Bu ada ait FDA etiketi bulunamadı.</p>}

      {rows && rows.length > 0 && (
        <ul className="mt-3 grid gap-3">
          {rows.map((r, i) => (
            <li key={r.id ?? i} className="min-w-0 rounded-xl border border-[var(--c-hairline)] p-3.5">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-sm font-semibold text-[var(--c-ink)]">{r.brand ?? r.generic ?? "—"}</span>
                {r.generic && r.brand && <span className="text-[11px] text-[var(--c-ink-3)]">({r.generic})</span>}
                <span className="aura-mono ml-auto rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                  FDA · ABD
                </span>
              </div>
              {r.manufacturer && <p className="mt-0.5 text-[11px] text-[var(--c-ink-3)]">{r.manufacturer}</p>}
              {r.sourceUrl && r.sourceUrl === labelSourceUrl(r.id) ? (
                <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs text-[var(--c-accent)] underline">
                  Kaynak etiket verisi (openFDA, yeni sekme)
                </a>
              ) : <p className="mt-2 text-xs text-[var(--c-ink-3)]">Bu sonuç için kaynak bağlantısı doğrulanamadı.</p>}
              <p className="mt-2 text-[11px] text-[var(--c-ink-3)]">Aşağıda kaynağın döndürdüğü seçili bölümler gösterilir; etiketin diğer bölümleri kaynak bağlantısındadır.</p>
              <dl className="mt-2 grid gap-2">
                {([
                  ["Endikasyon (indications)", r.indications],
                  ["Doz (dosage)", r.dosage],
                  ["Kontrendikasyon", r.contraindications],
                  ["Kutu uyarısı (boxed warning)", r.boxedWarnings],
                  ["Uyarılar", r.warnings],
                  ["Uyarılar ve önlemler", r.cautions],
                  ["Yan etkiler", r.adverse],
                ] as [string, string | null][])
                  .filter(([, v]) => !!v)
                  .map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-[10px] font-semibold uppercase tracking-wide text-[var(--c-ink-3)]">{k}</dt>
                      <dd className="mt-0.5 min-w-0 text-xs leading-relaxed text-[var(--c-ink-2)]"><LabelSection name={k} text={v!} /></dd>
                    </div>
                  ))}
              </dl>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function LabelSection({ name, text }: { name: string; text: string }) {
  const cutoff = 600;
  const long = text.length > cutoff;
  const boundary = text.lastIndexOf(" ", cutoff);
  const preview = text.slice(0, boundary > 300 ? boundary : cutoff);
  const style = "whitespace-pre-wrap [overflow-wrap:anywhere]";
  if (!long) return <p className={style}>{text}</p>;
  return (
    <details className="group">
      <summary className="cursor-pointer rounded text-[var(--c-accent)] focus-visible:outline-2 focus-visible:outline-offset-2" aria-label={`${name}: tam bölüm metnini aç veya kapat`}>
        Önizleme — tam bölüm metnini aç / kapat
      </summary>
      <p className={`${style} mt-1 group-open:hidden`}>{preview}…</p>
      <div className="mt-1 hidden group-open:block">
        <p className="mb-1 text-[11px] text-[var(--c-ink-3)]">Kaynağın döndürdüğü bu bölümün tüm metni</p>
        <p className={style}>{text}</p>
      </div>
    </details>
  );
}