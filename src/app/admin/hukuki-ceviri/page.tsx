import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AURA_LEGAL_VERSION } from "@/lib/aura-legal";
import { LANG_NATIVE_NAME } from "@/lib/aura-legal/display";
import { LEGAL_QUEUE_STATE_LABEL, listLegalTranslationQueue, type LegalQueueState } from "@/lib/legal-approval";
import { PageHeader } from "@/components/ui/PageHeader";
import { AuraPanel } from "@/components/ui/AuraPanel";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Hukuki Çeviriler" };

// Hukuki çeviri onay kuyruğu (7-C, v6.286 · 2026-09-20) — admin/kvkk-basvurulari deseni: proxy /admin'i TOKEN roluyle korur;
// onay yetkisi kritik → getCurrentUser (DB-rol otoriter) ŞART, yalnız ADMIN. Liste ÖNBELLEKTEN okur (Claude'a istek atmaz);
// üretim/onay detay sayfasında. /admin ağacı Doctorium kromundadır → yalnız --c-* token'ları, AURA'ya götüren bağlantı YOK.
const STATE_TONE: Record<LegalQueueState, string> = {
  reviewed: "border-[var(--c-success)]/40 text-[var(--c-success)]",
  automatic: "border-[var(--c-hairline)] text-[var(--c-ink-2)]",
  incomplete: "border-[var(--c-danger)]/40 text-[var(--c-danger)]",
  missing: "border-[var(--c-hairline)] text-[var(--c-ink-3)]",
  stale: "border-[var(--c-danger)]/40 text-[var(--c-danger)]",
  revoked: "border-[var(--c-hairline)] text-[var(--c-ink-3)]",
};

export default async function LegalTranslationQueuePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/giris?next=/admin/hukuki-ceviri");
  if (user.role !== "ADMIN") redirect("/");

  const items = await listLegalTranslationQueue();
  const count = (...states: LegalQueueState[]) => items.filter((i) => states.includes(i.state)).length;
  const docs = [...new Map(items.map((i) => [i.slug, i.title])).entries()];
  const kpis: { label: string; value: number }[] = [
    { label: "İncelenmiş", value: count("reviewed") },
    { label: "Otomatik (incelenmedi)", value: count("automatic") },
    { label: "Eksik / üretilmedi", value: count("incomplete", "missing") },
    { label: "Eskidi / geri alındı", value: count("stale", "revoked") },
  ];

  return (
    <div className="mx-auto max-w-4xl px-5 py-10">
      <PageHeader
        eyebrow="Yönetim"
        title="Hukuki Çeviriler"
        sub="Hasta yüzü hukuki belgelerinin Türkçe/İngilizce dışı 9 dildeki çevirileri. Otomatik çeviri hastaya 'henüz hukuki incelemeden geçmedi' rozetiyle gösterilir; incelediğiniz belgeyi onaylayınca metin dondurulur ve 'İncelenmiş çeviri' rozetini taşır. Kaynak metin ya da belge sürümü değişince onay kendiliğinden eskir."
      />

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-surface)] px-4 py-3">
            <div className="text-2xl font-bold text-[var(--c-ink)]">{k.value}</div>
            <div className="mt-0.5 text-[11px] text-[var(--c-ink-3)]">{k.label}</div>
          </div>
        ))}
      </div>

      {docs.map(([slug, title]) => (
        <AuraPanel key={slug} title={title} meta={`Sürüm ${AURA_LEGAL_VERSION} · /${slug}`} className="mt-6" level="h2">
          <ul className="divide-y divide-[var(--c-hairline)]">
            {items
              .filter((i) => i.slug === slug)
              .map((i) => (
                <li key={i.lang} className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <span className="text-[var(--c-ink)]">{LANG_NATIVE_NAME[i.lang] ?? i.lang}</span>
                    <span className="ml-2 text-xs text-[var(--c-ink-3)]">{i.lang} · {i.code}</span>
                    <div className="mt-0.5 text-xs text-[var(--c-ink-3)]">
                      {i.state === "reviewed" && i.approvedAt
                        ? `Onay: ${i.approvedAt.toLocaleDateString("tr-TR")} · ${i.approvedBy ?? ""}`
                        : i.units
                          ? `${i.translated}/${i.units} birim çevrildi`
                          : "Önbellekte çeviri yok"}
                      {i.note && i.state !== "reviewed" ? ` · not: ${i.note}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${STATE_TONE[i.state]}`}>{LEGAL_QUEUE_STATE_LABEL[i.state]}</span>
                    <Link href={`/admin/hukuki-ceviri/${i.slug}/${i.code}`} className="text-xs font-semibold text-[var(--c-accent)] hover:underline">
                      İncele
                    </Link>
                  </div>
                </li>
              ))}
          </ul>
        </AuraPanel>
      ))}

      <p className="mt-6 text-xs leading-relaxed text-[var(--c-ink-3)]">
        Toplu üretim (tüm diller): <code>node scripts/translate-legal-prod.mjs</code> (üretim) · <code>npx tsx scripts/translate-legal.ts</code> (geliştirme).{" "}
        {"Tek belge/dil: detay sayfasındaki \"Çeviriyi üret\". Hukuken bağlayıcı metin daima Türkçe kanoniktir; çeviri bilgilendirme amaçlıdır."}
      </p>
    </div>
  );
}
