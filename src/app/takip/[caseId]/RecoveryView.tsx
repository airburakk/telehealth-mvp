"use client";

// Post-Op Takip — çok dilli (8+ dil) + RTL. Veriyi server page.tsx getirir; burada sunum + çeviri.
// Hasta notu (ci.note) ÇEVRİLMEZ (kendi girdisi); arayüz + protokol + checklist + severity çevrilir.
import Link from "next/link";
import { useMemo } from "react";
import { useT } from "@/components/useT";
import { usePatientLang, PatientLangSelect } from "@/components/PatientLocale";
import { severityMeta, type Severity } from "@/lib/postop";
import { formatDateTime, langDir } from "@/lib/constants";
import { CheckInForm } from "@/components/CheckInForm";
import { ArrowLeft, ArrowRight, HeartPulse, CalendarCheck, Pill, Video, Thermometer, Activity, ShieldCheck } from "lucide-react";

export type RecoveryCheckIn = {
  id: string;
  createdAt: string; // ISO
  severity: string;
  pain: number;
  feverC: number;
  meds: boolean;
  note: string | null;
  photo: string | null;
};

export type RecoveryData = {
  caseId: string;
  patientName: string;
  branch: string;
  day: number;
  protocol: { day: string; title: string; desc: string }[];
  checkIns: RecoveryCheckIn[];
};

const UI = [
  "Vaka detayı", "Post-Op Takip", "Tedavi sonrası", "gün",
  "Kontrol geçmişi", "Henüz kontrol girilmedi.", "Ağrı", "İlaç",
  "İyileşme fotoğrafı", "Büyütmek için aç",
  "İyileşme Takvimi", "Tele-Kontrol",
  "Kritik dönüm noktalarında doktorunuzla kısa görüşme planlanır.", "Randevu iste",
  "İlaç Hatırlatıcı", "Günlük ilaç bildirimleri açık (demo).",
  "Güvenli Paylaşım",
  "Bu kayıtları kendi ülkenizdeki doktorunuzla süreli ve iptal edilebilir bir bağlantıyla paylaşın.",
  "Paylaşım Kontrol Merkezi",
  "Kırmızı bayrak", "İzlemde", "Normal", // severityMeta etiketleri (geçmiş rozetleri)
];

export function RecoveryView({ data }: { data: RecoveryData }) {
  const [lang, setLang] = usePatientLang();
  const texts = useMemo(
    () => [...UI, data.branch, ...data.protocol.flatMap((p) => [p.day, p.title, p.desc])],
    [data.branch, data.protocol],
  );
  const { t } = useT(lang, texts);

  return (
    <div dir={langDir(lang)} className="mx-auto max-w-4xl px-5 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={`/doktor/vaka/${data.caseId}`} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-[#0EA5B2]">
          <ArrowLeft size={16} /> {t("Vaka detayı")}
        </Link>
        <PatientLangSelect lang={lang} onChange={setLang} />
      </div>

      <div className="mt-4 flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#14C3D0] text-[#101010]"><HeartPulse size={22} /></span>
        <div>
          <h1 className="text-2xl font-bold text-[#101010]">{t("Post-Op Takip")}</h1>
          <p className="text-sm text-slate-500">{data.patientName} · {t(data.branch)} · {t("Tedavi sonrası")} <strong className="text-slate-700">{data.day}. {t("gün")}</strong></p>
        </div>
      </div>

      <div className="mt-7 grid gap-5 lg:grid-cols-[1fr_340px]">
        {/* Sol: kontrol + geçmiş */}
        <div className="space-y-5">
          <CheckInForm caseId={data.caseId} branch={data.branch} lang={lang} />

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="font-bold text-slate-800">{t("Kontrol geçmişi")}</h2>
            {data.checkIns.length === 0 ? (
              <p className="mt-2 text-sm text-slate-400">{t("Henüz kontrol girilmedi.")}</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {data.checkIns.map((ci) => {
                  const m = severityMeta(ci.severity as Severity);
                  return (
                    <li key={ci.id} className="flex items-start gap-3 rounded-lg border border-slate-200 p-3">
                      <span className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${m.dot}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium text-slate-700">{formatDateTime(ci.createdAt)}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${m.badge}`}>{t(m.label)}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500">
                          <span className="inline-flex items-center gap-1"><Activity size={12} /> {t("Ağrı")} {ci.pain}/10</span>
                          <span className="inline-flex items-center gap-1"><Thermometer size={12} /> {ci.feverC.toFixed(1)}°C</span>
                          <span className="inline-flex items-center gap-1"><Pill size={12} /> {t("İlaç")} {ci.meds ? "✓" : "✗"}</span>
                          {ci.photo && !ci.photo.startsWith("data:") && <span>📷 {ci.photo}</span>}
                        </div>
                        {ci.note && <p className="mt-1 text-sm text-slate-600">{ci.note}</p>}
                        {ci.photo?.startsWith("data:") && (
                          <a href={ci.photo} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block" title={t("Büyütmek için aç")}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={ci.photo} alt={t("İyileşme fotoğrafı")} className="h-20 w-20 rounded-lg object-cover ring-1 ring-slate-200 transition hover:ring-[#14C3D0]" />
                          </a>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Sağ: protokol + hatırlatıcı */}
        <aside className="space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500"><CalendarCheck size={15} /> {t("İyileşme Takvimi")}</div>
            <ol className="mt-3 space-y-0">
              {data.protocol.map((mst, i) => (
                <li key={i} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-teal-100 text-[11px] font-bold text-teal-700">{i + 1}</span>
                    {i < data.protocol.length - 1 && <span className="my-1 h-5 w-0.5 bg-slate-200" />}
                  </div>
                  <div className="pb-1.5">
                    <div className="text-sm font-medium text-slate-800">{t(mst.title)} <span className="text-xs font-normal text-teal-600">· {t(mst.day)}</span></div>
                    <div className="text-xs text-slate-400">{t(mst.desc)}</div>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-3xl border border-teal-200 bg-teal-50/60 p-5">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-teal-700"><Video size={15} /> {t("Tele-Kontrol")}</div>
            <p className="mt-1.5 text-sm text-slate-600">{t("Kritik dönüm noktalarında doktorunuzla kısa görüşme planlanır.")}</p>
            <button className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
              {t("Randevu iste")}
            </button>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500"><Pill size={15} /> {t("İlaç Hatırlatıcı")}</div>
            <p className="mt-1.5 text-sm text-slate-600">{t("Günlük ilaç bildirimleri açık (demo).")}</p>
          </div>

          <Link href="/paylasimlarim" className="block rounded-3xl border border-[#14C3D0]/20 bg-[#14C3D0]/[0.03] p-5 transition-colors hover:bg-[#14C3D0]/[0.06]">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#101010]"><ShieldCheck size={15} /> {t("Güvenli Paylaşım")}</div>
            <p className="mt-1.5 text-sm text-slate-600">{t("Bu kayıtları kendi ülkenizdeki doktorunuzla süreli ve iptal edilebilir bir bağlantıyla paylaşın.")}</p>
            <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[#101010]">{t("Paylaşım Kontrol Merkezi")} <ArrowRight size={14} /></span>
          </Link>
        </aside>
      </div>
    </div>
  );
}
