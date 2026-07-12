import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { hasProcedures, hasQualification } from "@/lib/doctor-activation";
import { VerifyButton } from "./VerifyButton";
import { ShieldCheck, Stethoscope, MapPin, Globe, Check, X, Clock, BadgeCheck, Flag } from "lucide-react";

export const dynamic = "force-dynamic";

const ADMIN_ROLES = ["ETHICS", "ADMIN"]; // proxy /admin ETHICS_ROLES ile korur (doktor doğrulama onayı)

// M5 — Doktor doğrulama onayı (ADMIN / Etik Kurul). Self-signup doktorlar verified:false başlar;
// burada onaylanınca public dizine + eşleştirmelere dahil olur. Proxy TOKEN roluyle korur; doğrulama
// onay yetkisi kritik olduğundan getCurrentUser (DB-rol otoriter) öz-savunması ŞART (2026-07-12).
export default async function DoctorApprovalPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/giris?next=/admin/hekim-onay");
  if (!ADMIN_ROLES.includes(user.role)) redirect("/");

  const pending = await db.doctor.findMany({
    where: { verified: false },
    orderBy: { name: "asc" },
    select: {
      id: true, title: true, name: true, branch: true, city: true, languages: true,
      activatedAt: true, licenseNo: true, specBoard: true, procedures: true,
      mmssInsurer: true, mmssCoverageLimit: true, mmssCoverageCurrency: true,
      registryStatus: true, // HealthTürkiye dizin doğrulaması (FAZ 6) — NOT_FOUND ise uyarı bayrağı
      documents: { select: { type: true } },
    },
  });

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#28C8D8] text-[#0D0E10]"><ShieldCheck size={22} /></span>
        <div>
          <h1 className="text-2xl font-bold text-[#F4F5F3]">Doktor Doğrulama Onayı</h1>
          <p className="text-sm text-white/50">Kaydolan doktorları inceleyip doğrulayın — onaylanmadan dizinde ve eşleştirmede görünmezler.</p>
        </div>
      </div>

      {pending.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-dashed border-white/15 bg-[#1E1F22] p-10 text-center text-sm text-white/50">
          Onay bekleyen doktor yok.
        </div>
      ) : (
        <div className="mt-7 space-y-4">
          {pending.map((d) => {
            const types = new Set(d.documents.map((x) => x.type));
            const diploma = types.has("DIPLOMA");
            const mmssDoc = types.has("MMSS");
            const mmssMeta = !!d.mmssInsurer && typeof d.mmssCoverageLimit === "number" && d.mmssCoverageLimit > 0;
            const proc = hasProcedures(d.procedures);
            const qual = hasQualification({ licenseNo: d.licenseNo, specBoard: d.specBoard });
            const ready = !!d.activatedAt; // onboarding (belge + işlem + qualification) tamamlandı mı
            let procCount = 0;
            try { if (d.procedures) procCount = Object.keys(JSON.parse(d.procedures) as object).length; } catch { procCount = 0; }

            return (
              <div key={d.id} className="rounded-3xl border border-white/10 bg-[#161719] p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-base font-bold text-[#F4F5F3]">
                      <Stethoscope size={16} className="text-[#1FA9B8]" /> {d.title} {d.name}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/50">
                      <span className="font-medium text-[#1FA9B8]">{d.branch || "— branş belirtilmemiş"}</span>
                      <span className="inline-flex items-center gap-1"><MapPin size={12} /> {d.city || "—"}</span>
                      <span className="inline-flex items-center gap-1"><Globe size={12} /> {d.languages}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {ready ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-400/25"><BadgeCheck size={13} /> Onboarding tamam</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-300 ring-1 ring-amber-400/25"><Clock size={13} /> Onboarding eksik</span>
                    )}
                    {/* HealthTürkiye dizin doğrulaması (FAZ 6) — kayıtta ad-soyad eşleşmesi arandı */}
                    {d.registryStatus === "FOUND" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#28C8D8]/10 px-2.5 py-1 text-xs font-semibold text-[#28C8D8] ring-1 ring-[#28C8D8]/25" title="healthturkiye.gov.tr doktor dizininde ad-soyad eşleşmesi bulundu"><BadgeCheck size={13} /> HealthTürkiye kaydı ✓</span>
                    ) : d.registryStatus === "NOT_FOUND" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-bold text-red-300 ring-1 ring-red-400/25" title="healthturkiye.gov.tr resmi doktor dizininde bulunamadı — onay öncesi ek doğrulama önerilir"><Flag size={13} /> ⚠ HealthTürkiye kaydı YOK</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-white/50" title="Dizin henüz senkronlanmadığı için kontrol yapılamadı">HealthTürkiye: kontrol edilmedi</span>
                    )}
                    <VerifyButton doctorId={d.id} />
                  </div>
                </div>

                {/* Belge / FHIR uzmanlık durum rozetleri */}
                <div className="mt-3 flex flex-wrap gap-2 border-t border-white/10 pt-3">
                  <Badge ok={diploma} label="Diploma" />
                  <Badge ok={mmssDoc} label="MMSS poliçesi" />
                  <Badge ok={mmssMeta} label={mmssMeta ? `MMSS ${d.mmssCoverageLimit?.toLocaleString("tr-TR")} ${d.mmssCoverageCurrency ?? ""}` : "MMSS teminat"} />
                  <Badge ok={qual} label={qual ? `Diploma no + uzmanlık` : "FHIR uzmanlık"} />
                  <Badge ok={proc} label={proc ? `${procCount} işlem` : "İşlem seçimi"} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Badge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${ok ? "bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-400/25" : "bg-white/10 text-white/40"}`}>
      {ok ? <Check size={12} /> : <X size={12} />} {label}
    </span>
  );
}
