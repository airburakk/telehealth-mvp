import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { decryptField } from "@/lib/crypto";
import { getCurrentUser } from "@/lib/auth";
import { BRANCHES } from "@/lib/triage";
import { isOfferExpired } from "@/lib/second-opinion";
import { scrubText } from "@/lib/deidentify";
import { COUNTRIES, formatDateTime } from "@/lib/constants";
import { SO_DOC_TYPE_LABELS, type SoDocType } from "@/data/second-opinion-docs";
import { ArrowLeft, EyeOff, FileText, Stethoscope } from "lucide-react";
import { SoAcceptButton } from "../SoAcceptButton";
import { SoOpinionPanel } from "./SoOpinionPanel";

export const dynamic = "force-dynamic";

// İkinci Görüş — doktor inceleme + görüş sayfası.
export default async function DoctorSoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/giris?next=/doktor/ikinci-gorus/${id}`);
  if (!["DOCTOR", "ADMIN"].includes(user.role)) redirect("/");

  const c = await db.secondOpinionCase.findUnique({
    where: { id },
    include: {
      documents: { select: { id: true, type: true, deliveryMethod: true, externalRef: true, label: true }, orderBy: { uploadedAt: "asc" } },
      requests: { orderBy: { createdAt: "desc" } },
      opinion: { select: { content: true, structured: true, submittedAt: true } },
      appointment: { select: { id: true, scheduledAt: true, status: true } },
    },
  });
  if (!c) notFound();

  const branchLabel = BRANCHES.find((b) => b.key === c.branch)?.label ?? c.branch;

  // §8 + BOLA daraltması (2026-07-02): doktor claim-ÖNCESİ (OFFERED) yalnız DE-ID önizleme görür —
  // hasta kimliği ve belge içerikleri kabul (claim) ile açılır. Kabul sonrası yalnız atanan doktor girer.
  if (user.role === "DOCTOR") {
    const me = await db.user.findUnique({ where: { id: user.id }, select: { doctorId: true } });
    const myDoctorId = me?.doctorId ?? null;
    const assignedToMe = !!myDoctorId && myDoctorId === c.assignedDoctorId;

    if (c.status === "OFFERED") {
      // Önizleme hakkı = kabul hakkı (accept route ile aynı kural): doğrulanmış + branş uyumlu +
      // (bana teklif edildi VEYA kabul süresi doldu → açık fan-out).
      const myDoctor = myDoctorId
        ? await db.doctor.findUnique({ where: { id: myDoctorId }, select: { branch: true, verified: true } })
        : null;
      const claimable =
        !!myDoctor?.verified && myDoctor.branch === c.branch && (assignedToMe || isOfferExpired(c.assignedAt));
      if (!claimable) redirect("/doktor/ikinci-gorus");

      // De-id özet: ad/kimlik yok; serbest metin scrub'lanır; belge yalnız TÜR olarak listelenir
      // (label serbest metin → kimlik taşıyabilir, gönderilmez).
      const patient = await db.user.findUnique({ where: { id: c.patientId }, select: { name: true } });
      const summary = scrubText(c.diagnosisSummary, [decryptField(patient?.name ?? "") || ""]);
      const region = c.country ? (COUNTRIES.find((x) => x.code === c.country)?.name ?? c.country) : null;

      return (
        <div className="mx-auto max-w-2xl px-5 py-8">
          <Link href="/doktor/ikinci-gorus" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
            <ArrowLeft size={15} /> Atanan vakalar
          </Link>
          <div className="mt-4 rounded-3xl border border-[#14C3D0]/50 bg-[#14C3D0]/[0.05] p-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-white">
                <EyeOff size={11} /> Anonim önizleme
              </span>
              <span className="inline-flex items-center gap-1 text-xs text-[#0EA5B2]"><Stethoscope size={12} /> {branchLabel}</span>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${assignedToMe ? "bg-[#14C3D0]/20 text-[#0E8A95]" : "bg-amber-100 text-amber-700"}`}>
                {assignedToMe ? "Size atandı" : "Açık — süre doldu"}
              </span>
            </div>
            <h1 className="mt-3 text-lg font-bold text-[#101010]">İkinci görüş dosyası — kabul öncesi önizleme</h1>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{summary}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              {region && <span>Bölge: {region}</span>}
              {c.language && <span>· Dil: {c.language}</span>}
              {c.assignedAt && <span>· Teklif: {formatDateTime(c.assignedAt)}</span>}
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {c.documents.map((d) => (
                <span key={d.id} className="rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200">
                  <FileText size={10} className="mr-1 inline" />
                  {SO_DOC_TYPE_LABELS[d.type as SoDocType] ?? d.type}
                </span>
              ))}
              {c.documents.length === 0 && <span className="text-xs text-slate-400">Belge yok</span>}
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
              <p className="max-w-[320px] text-xs text-slate-500">
                Hasta kimliği ve belge içerikleri, dosyayı <strong>kabul ettikten sonra</strong> açılır.
              </p>
              <SoAcceptButton caseId={c.id} open={!assignedToMe} />
            </div>
          </div>
        </div>
      );
    }

    if (!assignedToMe) redirect("/doktor/ikinci-gorus");
    // v4.19: canSoCaseBeAccessedBy ile hizalama — atanmış olsa bile doğrulanmamış doktor PHI göremez
    // (belge uçları zaten 403 veriyordu; sayfa+görüş yolu açık kalmıştı — tutarsız erişim kapatıldı).
    const myVerified = myDoctorId
      ? (await db.doctor.findUnique({ where: { id: myDoctorId }, select: { verified: true } }))?.verified
      : false;
    if (!myVerified) redirect("/doktor/ikinci-gorus");
  }
  const patient = await db.user.findUnique({ where: { id: c.patientId }, select: { name: true } });

  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <Link href="/doktor/ikinci-gorus" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft size={15} /> Atanan vakalar
      </Link>
      <SoOpinionPanel
        data={{
          id: c.id,
          status: c.status,
          branch: c.branch,
          branchLabel,
          diagnosisSummary: c.diagnosisSummary,
          patientName: patient?.name ?? "Hasta",
          documents: c.documents,
          requests: c.requests.map((r) => ({ id: r.id, type: r.type, description: r.description, status: r.status })),
          opinion: c.opinion
            ? { content: decryptField(c.opinion.content), structured: decryptField(c.opinion.structured), submittedAt: c.opinion.submittedAt.toISOString() }
            : null,
          appointment: c.appointment ? { id: c.appointment.id, scheduledAt: c.appointment.scheduledAt.toISOString(), status: c.appointment.status } : null,
        }}
      />
    </div>
  );
}
