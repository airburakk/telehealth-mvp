import React from "react";

export const CAREER_PLANNING_GUIDES = [
  { slug: "uk-gmc", title: "GMC kaydı", audience: "Mezun hekimler; öğrenciler için mezuniyet sonrası planlama" },
  { slug: "tr-iyi-hal-belgesi", title: "Good Standing belgesi", audience: "Diploma tescilli sağlık meslek mensupları; öğrenciler için ileri kariyer planlama" },
  { slug: "tr-docentlik", title: "Doçentlik", audience: "Akademik yükselme; uygunluk güncel resmî başvuru şartlarına bağlı" },
] as const;

export function CareerEvidenceNote({ slug, confidence }: { slug: string; confidence: string }) {
  const guide = CAREER_PLANNING_GUIDES.find((g) => g.slug === slug);
  return <p className="mt-2 text-xs leading-relaxed text-[var(--c-ink-2)]">
    {guide && <span>{guide.audience}. </span>}
    {confidence === "kismi" && <span>Teyit bekliyor: rehberin bazı bilgileri kısmen doğrulanmıştır; güncel şartların tamamı için resmî kaynağı kontrol edin. </span>}
    Son doğrulama tarihi, kaydın son kontrol tarihidir; başvuru tarihinde şartların aynı kalacağını garanti etmez.
  </p>;
}

export function StudentPlanningGuides() {
  return <section aria-label="Mezuniyet sonrası kariyer planlama" className="rounded-xl border border-[var(--c-hairline)] p-4">
    <h2 className="text-sm font-semibold">Mezuniyet sonrası kariyer planlama</h2>
    <p className="mt-2 text-xs">Bu rehberleri gelecekteki adımları planlamak için inceleyebilirsiniz. Öğrenci olmak, ilgili başvuruya bugün uygun olduğunuz anlamına gelmez.</p>
    <ul className="mt-3 space-y-2">
      {CAREER_PLANNING_GUIDES.map((g) => <li key={g.slug}>
        <a className="text-sm underline" href={`/doktor/doctorium/kariyer/${g.slug}`}>{g.title} rehberi</a>
        <p className="text-xs">{g.audience}.</p>
      </li>)}
    </ul>
  </section>;
}
