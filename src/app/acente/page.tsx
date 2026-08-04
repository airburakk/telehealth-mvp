import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { decryptField } from "@/lib/crypto";
import { Luggage } from "lucide-react";
import { AgencyList, type AgencyFileRow } from "./AgencyList";

export const dynamic = "force-dynamic";

// S3 — Sağlık Turizmi Acentesi kuyruğu (FAZ 4, 2026-07-10).
// Doktorun tedavi kararını kaydettiği (agencySentAt damgalı) dosyalar burada listelenir; acente
// teklif hazırlayıp hastaya gönderir. VERİ MİNİMİZASYONU: liste ve dosyada yalnız kimlik/iletişim +
// doktorun kararı (işlem/ücret/süre/hastane) vardır — semptom, belge, görüntüleme, lab ASLA seçilmez
// (SELECT kısıtlı; klinik kolonlar sorguya girmez → decrypt bile edilmez).
// 2026-08-04: liste + stat'lar client bileşene çıktı (AgencyList) — sayılar tıklanır filtre oldu
// (post-op RecoveryList deseni). Bu dosyada SUNUCU işleri kalır: auth, sorgu, decryptField.
export default async function AgencyQueue() {
  const user = await getCurrentUser();
  if (!user || !["AGENCY", "ADMIN"].includes(user.role)) notFound();

  const cases = await db.case.findMany({
    where: { agencySentAt: { not: null } },
    select: {
      id: true, patientName: true, country: true, language: true, branch: true,
      contactPreference: true, recommendedProcedures: true,
      treatmentDaysMin: true, treatmentDaysMax: true, hospitalName: true, agencySentAt: true,
      doctor: { select: { title: true, name: true } },
      bookings: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true, status: true, total: true, currency: true } },
    },
    orderBy: { agencySentAt: "desc" },
    take: 100,
  });

  const rows: AgencyFileRow[] = cases.map((c) => {
    let procs: { code: string; name: string; priceTRY: number }[] = [];
    try { procs = c.recommendedProcedures ? JSON.parse(c.recommendedProcedures) : []; } catch { procs = []; }
    const bk = c.bookings[0];
    return {
      id: c.id,
      patientName: decryptField(c.patientName), // kimlik at-rest şifreli → SUNUCUDA çöz
      country: c.country,
      language: c.language,
      branch: c.branch,
      procCount: procs.length,
      totalTRY: procs.reduce((a, p) => a + (p.priceTRY || 0), 0),
      daysMin: c.treatmentDaysMin,
      daysMax: c.treatmentDaysMax,
      hospitalName: c.hospitalName,
      doctorName: c.doctor ? `${c.doctor.title} ${c.doctor.name}` : null,
      sentAt: c.agencySentAt ? c.agencySentAt.toISOString() : null,
      bookingStatus: bk?.status ?? null,
    };
  });

  return (
    <div className="mx-auto max-w-4xl px-5 py-10">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--c-accent)] text-[var(--c-bg)]"><Luggage size={22} /></span>
        <div>
          <h1 className="aura-display text-3xl font-medium tracking-tight text-[var(--c-ink)]">Tedavi Dosyaları</h1>
          <p className="text-sm text-[var(--c-ink-2)]">Doktorların ilettiği tedavi kararları — teklif hazırlayıp hastaya gönderin.</p>
        </div>
      </div>

      <AgencyList rows={rows} />

      <p className="mt-6 text-[11px] leading-relaxed text-[var(--c-ink-3)]">
        Veri minimizasyonu: acente panelinde yalnız hasta kimliği/iletişimi ve doktorun tedavi kararı
        (işlem · ücret · süre · hastane) görüntülenir. Tıbbi belge, görüntüleme, test sonucu ve şikâyet
        metni acenteyle paylaşılmaz.
      </p>
    </div>
  );
}
