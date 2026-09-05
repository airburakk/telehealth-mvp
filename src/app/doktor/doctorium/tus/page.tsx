import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { TUS_EXAM_PERIODS, TUS_OFFICIAL_LINKS } from "@/lib/tus";
import { DoctoriumShell } from "../DoctoriumSidebar";
import { PageHeader } from "@/components/ui/PageHeader";
import { AuraPanel } from "@/components/ui/AuraPanel";
import { EmptyState } from "@/components/ui/EmptyState";

export const dynamic = "force-dynamic";
export const metadata = { title: "TUS" };

/**
 * TUS — Tıpta Uzmanlık Sınavı (üç katman Faz B1, kullanıcı kararı 2026-09-05; rapor §3). Rafın 09 durağı: öğrencide
 * varsayılan açık, doktorda Özelleştir'den açılır ("kapalı, gizli değil" — doğrudan URL herkese serbest; kapı segment
 * layout'unun Doctorium kapısıdır).
 *
 * DÜRÜST İSKELET: veri hattı (ÖSYM açık verisi → doğrulama → dönem-bazlı snapshot → grafikler, simülatör) AYRI plandadır.
 * Bugün yalnız resmî kaynaklar + insan girişli dönem tablosu (lib/tus TUS_EXAM_PERIODS — boş başlar) gösterilir; grafik /
 * temsilî sayı / uydurma tarih YOK (vitrin iddia kuralının iç yüzey karşılığı). Kit: PageHeader · AuraPanel · EmptyState.
 */
export default async function TusPage() {
  const user = await getCurrentUser();
  if (!user || !["DOCTOR", "COORDINATOR", "ADMIN"].includes(user.role)) redirect("/");

  return (
    <DoctoriumShell active="tus">
      <div className="mx-auto max-w-3xl px-5 py-8">
        <Link href="/doktor/doctorium" className="inline-flex items-center gap-1.5 text-sm text-[var(--c-ink-2)] hover:text-[var(--c-ink)]">
          <ArrowLeft size={15} /> Akışıma dön
        </Link>

        <PageHeader
          className="mt-5"
          eyebrow="TUS"
          title="Tıpta Uzmanlık Sınavı"
          sub="Kamuya açık ÖSYM verisinin (sınav takvimi, kontenjanlar, taban puanlar, boş kalan kontenjanlar) tek yerden okunabilir hâli. Veri yayına alınmadan önce kaynak ve tarihle doğrulanır."
        />

        <AuraPanel title="Resmî kaynaklar" meta="ÖSYM" className="mt-6">
          <ul className="grid gap-3 sm:grid-cols-2">
            {TUS_OFFICIAL_LINKS.map((l) => (
              <li key={l.href} className="rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-surface)] p-4">
                <a
                  href={l.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-[var(--c-ink)] hover:text-[var(--c-accent)]"
                >
                  {l.label} <ExternalLink size={14} aria-hidden />
                </a>
                <p className="mt-1 text-[13px] leading-relaxed text-[var(--c-ink-2)]">{l.note}</p>
              </li>
            ))}
          </ul>
        </AuraPanel>

        {TUS_EXAM_PERIODS.length > 0 ? (
          <AuraPanel title="Sınav dönemleri" meta="KAYNAKLI" className="mt-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-[var(--c-ink-3)]">
                  <th className="py-2">Dönem</th><th className="py-2">Sınav</th><th className="py-2">Sonuç</th><th className="py-2">Kaynak</th>
                </tr>
              </thead>
              <tbody>
                {TUS_EXAM_PERIODS.map((p) => (
                  <tr key={`${p.year}-${p.term}`} className="border-t border-[var(--c-hairline)] text-[var(--c-ink-2)]">
                    <td className="py-2 font-medium text-[var(--c-ink)]">{p.year} · {p.term}. dönem</td>
                    <td className="py-2">{p.examDate ?? "—"}</td>
                    <td className="py-2">{p.resultDate ?? "—"}</td>
                    <td className="py-2"><a href={p.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">ÖSYM</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </AuraPanel>
        ) : (
          <EmptyState
            className="mt-6"
            title="Taban puan ve kontenjan verisi hazırlanıyor"
            sub="ÖSYM'nin açık verisi (kılavuzlar, kontenjanlar, yerleştirme sonuçları) doğrulanıp yüklendiğinde branş bazlı eğilimler ve tercih simülasyonu burada görünecek. Şimdilik resmî kaynaklara doğrudan ulaşabilirsiniz."
          />
        )}
      </div>
    </DoctoriumShell>
  );
}
