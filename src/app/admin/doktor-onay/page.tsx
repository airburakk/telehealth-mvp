import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { hasProcedures, hasQualification } from "@/lib/doctor-activation";
import { VerifyButton } from "./VerifyButton";
import { DocReviewButtons } from "./DocReviewButtons";
import { ClinicPhoneVerify } from "./ClinicPhoneVerify";
import { ShieldCheck, Stethoscope, MapPin, Globe, Check, X, Clock, BadgeCheck, Flag, FileText } from "lucide-react";

export const dynamic = "force-dynamic";

const ADMIN_ROLES = ["ETHICS", "ADMIN"]; // proxy /admin ETHICS_ROLES ile korur (doktor doğrulama onayı)

// DoctorDocument.type → incelemeci yüzü Türkçe etiket (doctor-activation ALL_DOC_TYPES eşleniği).
const DOC_TYPE_LABELS: Record<string, string> = {
  DIPLOMA: "Diploma", MMSS: "MMSS poliçesi", CHAMBER: "Tabip odası yazısı",
  CERTIFICATE: "Sertifika", ACADEMIC: "Akademik çalışma",
};

// M5 — Doktor doğrulama onayı (ADMIN / Etik Kurul). Self-signup doktorlar verified:false başlar;
// burada onaylanınca public dizine + eşleştirmelere dahil olur. Proxy TOKEN roluyle korur; doğrulama
// onay yetkisi kritik olduğundan getCurrentUser (DB-rol otoriter) öz-savunması ŞART (2026-07-12).
export default async function DoctorApprovalPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/giris?next=/admin/doktor-onay");
  if (!ADMIN_ROLES.includes(user.role)) redirect("/");

  const pending = await db.doctor.findMany({
    where: { verified: false },
    orderBy: { name: "asc" },
    select: {
      id: true, title: true, name: true, branch: true, city: true, languages: true,
      activatedAt: true, licenseNo: true, specBoard: true, procedures: true,
      mmssInsurer: true, mmssCoverageLimit: true, mmssCoverageCurrency: true,
      mmssValidUntil: true, // poliçe bitişi (Faz 1b) — dolu+geçmişse kırmızı rozet; boşsa rozet YOK (mevcut doktorda boş normaldir)
      registryStatus: true, // HealthTürkiye dizin doğrulaması (FAZ 6) — NOT_FOUND ise uyarı bayrağı
      // v6.127 — Aşama 2 klinik telefonu teyidi (koordinatör geri-arama bloğu)
      clinicPhoneVerifiedAt: true, clinicPhoneEstablishment: true,
      // Belge META'sı — içerik listede taşınmaz; incelemeci tek belgeyi raw uçtan açar (audit'li).
      documents: { select: { id: true, type: true, label: true, mimeType: true, createdAt: true, status: true, reviewNote: true }, orderBy: { createdAt: "desc" } },
    },
  });

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--c-accent)] text-[var(--c-bg)]"><ShieldCheck size={22} /></span>
        <div>
          <h1 className="aura-display text-3xl font-medium tracking-tight text-[var(--c-ink)]">Doktor Doğrulama Onayı</h1>
          <p className="text-sm text-[var(--c-ink-2)]">Kaydolan doktorları inceleyip doğrulayın — onaylanmadan dizinde ve eşleştirmede görünmezler.</p>
        </div>
      </div>

      {/* İnceleme kontrol listesi (tasarım: vault output/doktor-belge-kontrol-tasarimi-2026-08-14.md §4.2).
          Onay = verified:true → dizin + eşleştirme; karar audit'e DOCTOR_VERIFY olarak düşer. */}
      <details className="mt-6 rounded-3xl border border-[var(--c-hairline)] bg-[var(--c-surface)] px-5 py-4 text-sm text-[var(--c-ink-2)]">
        <summary className="cursor-pointer font-semibold text-[var(--c-ink)]">İnceleme kontrol listesi (onay öncesi)</summary>
        <ol className="mt-3 list-decimal space-y-1 pl-5">
          <li>Belge açılıyor ve okunaklı mı? (bozuk/boş dosya → onay verme)</li>
          <li>Tip doğru mu — içerik gerçekten diploma / MMSS poliçesi mi? (Diploma için tercih:
            e-Devlet barkodlu Mezun Belgesi — barkodu okunabildiyse sistem zaten otomatik
            doğrulamıştır; elinize düşenler çoğunlukla barkodsuz fotoğraf/taramadır.)</li>
          <li>Diplomada barkod numarası varsa turkiye.gov.tr/belge-dogrulama&apos;dan elle teyit
            edebilirsiniz (barkod + belge sahibinin T.C. kimlik numarası istenir).</li>
          <li>Belgedeki ad-soyad ↔ profil adı ↔ (varsa) HealthTürkiye kaydı eşleşiyor mu?</li>
          <li>Diploma no ↔ beyan edilen tescil no · MMSS poliçe alanları ↔ beyan tutarlı mı?</li>
          <li>HealthTürkiye NOT_FOUND tek başına engel değil (dizin kapsamı sınırlı) — belgeler
            ikna ediciyse takdiren onay verilebilir.</li>
        </ol>
      </details>

      {pending.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-dashed border-[var(--c-hairline)] bg-[var(--c-surface)] p-10 text-center text-sm text-[var(--c-ink-2)]">
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
              <div key={d.id} className="rounded-3xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-base font-bold text-[var(--c-ink)]">
                      <Stethoscope size={16} className="text-[var(--c-accent-strong)]" /> {d.title} {d.name}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--c-ink-2)]">
                      <span className="font-medium text-[var(--c-accent-strong)]">{d.branch || "— branş belirtilmemiş"}</span>
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
                      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--c-accent)]/10 px-2.5 py-1 text-xs font-semibold text-[var(--c-accent)] ring-1 ring-[var(--c-accent)]/25" title="healthturkiye.gov.tr doktor dizininde ad-soyad eşleşmesi bulundu"><BadgeCheck size={13} /> HealthTürkiye kaydı ✓</span>
                    ) : d.registryStatus === "NOT_FOUND" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-bold text-red-300 ring-1 ring-red-400/25" title="healthturkiye.gov.tr resmi doktor dizininde bulunamadı — onay öncesi ek doğrulama önerilir"><Flag size={13} /> ⚠ HealthTürkiye kaydı YOK</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--c-ink)]/10 px-2.5 py-1 text-xs font-medium text-[var(--c-ink-2)]" title="Dizin henüz senkronlanmadığı için kontrol yapılamadı">HealthTürkiye: kontrol edilmedi</span>
                    )}
                    <VerifyButton doctorId={d.id} />
                  </div>
                </div>

                {/* Belge / FHIR uzmanlık durum rozetleri */}
                <div className="mt-3 flex flex-wrap gap-2 border-t border-[var(--c-hairline)] pt-3">
                  <Badge ok={diploma} label="Diploma" />
                  <Badge ok={mmssDoc} label="MMSS poliçesi" />
                  <Badge ok={mmssMeta} label={mmssMeta ? `MMSS ${d.mmssCoverageLimit?.toLocaleString("tr-TR")} ${d.mmssCoverageCurrency ?? ""}` : "MMSS teminat"} />
                  {/* Poliçe bitişi (Faz 1b — ROZET-ONLY kararı: süre dolsa da sistem engellemez, göz uyarılır) */}
                  {d.mmssValidUntil && (d.mmssValidUntil < new Date() ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-bold text-red-300 ring-1 ring-red-400/25"><Flag size={12} /> MMSS süresi dolmuş ({d.mmssValidUntil.toLocaleDateString("tr-TR")})</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300 ring-1 ring-emerald-400/25"><Check size={12} /> MMSS geçerli → {d.mmssValidUntil.toLocaleDateString("tr-TR")}</span>
                  ))}
                  <Badge ok={qual} label={qual ? `Diploma no + uzmanlık` : "FHIR uzmanlık"} />
                  <Badge ok={proc} label={proc ? `${procCount} işlem` : "İşlem seçimi"} />
                </div>

                {/* Yüklenen belgeler — içerik raw uçtan yeni sekmede açılır (DOCTOR_DOC_VIEW audit'li).
                    Rozetler "var/yok" der; onay kararı belge İÇERİĞİ görülerek verilir (Faz 1, 2026-08-14). */}
                {d.documents.length > 0 && (
                  <div className="mt-3 border-t border-[var(--c-hairline)] pt-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--c-ink-3)]">Yüklenen belgeler — açarak inceleyin</div>
                    <ul className="mt-2 space-y-1">
                      {d.documents.map((doc) => (
                        <li key={doc.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <a
                            href={`/api/admin/doctors/${d.id}/documents/${doc.id}/raw`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-[var(--c-accent)] hover:underline"
                          >
                            <FileText size={14} className="shrink-0" />
                            {DOC_TYPE_LABELS[doc.type] ?? doc.type} — {doc.label}
                            <span className="text-xs font-normal text-[var(--c-ink-3)]">({doc.mimeType} · {doc.createdAt.toLocaleDateString("tr-TR")})</span>
                          </a>
                          {/* İnceleme durumu (Faz 2): PENDING sessiz — karar verilmemiş belgeye rozet gürültüsü yapılmaz */}
                          {doc.status === "ACCEPTED" && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-300 ring-1 ring-emerald-400/25"><Check size={11} /> Uygun</span>
                          )}
                          {doc.status === "REJECTED" && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] font-semibold text-red-300 ring-1 ring-red-400/25" title={doc.reviewNote ?? undefined}><X size={11} /> Yetersiz{doc.reviewNote ? `: ${doc.reviewNote.slice(0, 60)}` : ""}</span>
                          )}
                          <DocReviewButtons doctorId={d.id} docId={doc.id} status={doc.status} />
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* v6.127 — Aşama 2 kurum bağı: klinik telefonu geri-arama teyidi (insan-işletimli).
                    Gate'ten BAĞIMSIZ hep görünür: damgalar AURA_LAYER_GATE açılmadan ÖNCE dolmalı. */}
                <ClinicPhoneVerify
                  doctorId={d.id}
                  initialVerified={!!d.clinicPhoneVerifiedAt}
                  initialEstablishment={d.clinicPhoneEstablishment}
                />
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
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${ok ? "bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-400/25" : "bg-[var(--c-ink)]/10 text-[var(--c-ink-3)]"}`}>
      {ok ? <Check size={12} /> : <X size={12} />} {label}
    </span>
  );
}
