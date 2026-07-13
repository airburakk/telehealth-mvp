"use client";

// Post-Op Takip — çok dilli (8+ dil) + RTL. Veriyi server page.tsx getirir; burada sunum + çeviri.
// Hasta notu (ci.note) ÇEVRİLMEZ (kendi girdisi); arayüz + protokol + checklist + severity çevrilir.
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/useT";
import { usePatientLang, PatientLangSelect } from "@/components/PatientLocale";
import { severityMeta, type Severity } from "@/lib/postop";
import { formatDateTime, langDir } from "@/lib/constants";
import { CheckInForm } from "@/components/CheckInForm";
import { DischargeReport, type Structured } from "@/components/DischargeReport";
import { TranslateButton } from "@/components/TranslateButton";
import { ArrowLeft, ArrowRight, HeartPulse, CalendarCheck, Pill, Video, Thermometer, Activity, ShieldCheck, CheckCircle2, RotateCcw, FileText, Loader2, Check, AlertTriangle } from "lucide-react";

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
  closed?: boolean; // E2EE Faz 2A — takip tamamlandı → yeni kontrol girişi kapalı (geçmiş salt-okunur)
  // FAZ 3 (2026-07-10): AI Epikriz post-op ekranında yaşar — personel üretir, hasta ister + salt-okunur görür
  isStaff?: boolean;
  dischargeRequestedAt?: string | null; // hastanın epikriz talebi (ISO)
  discharge?: { report: string; structured: Structured | null; savedAt: string | null } | null;
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
  // AI Epikriz (FAZ 3) — hasta yüzü
  "AI Epikriz / Taburcu Raporu",
  "Tedavi sürecinizin tıbbi özet raporu. Doktorunuz oluşturduğunda burada görüntülenir.",
  "AI Epikriz / Taburcu Raporu iste",
  "İstek gönderiliyor…",
  "Talebiniz doktorunuza iletildi",
  "Raporu doktorunuz oluşturur; hazır olduğunda bildirim alırsınız.",
  "Takip kapandığı için yeni talep, doktora erişimi yeniden vermenizle mümkündür.",
  "oluşturuldu",
  "Rapor kaynak dilinde (Türkçe) hazırlanır; aşağıdan kendi dilinize çevirebilirsiniz.",
  "Post-op takip tamamlandı",
  "Bu sürecin takibi tamamlandı; yeni kontrol girişi kapalıdır. Geçmiş kayıtlarınız aşağıda görüntülenmeye devam eder.",
  "Doktora erişimi yeniden ver",
  "Klinik ekibiniz kayıtlarınıza yeniden erişebilecek. Erişimi yeniden vermek istiyor musunuz?",
  "Evet, erişimi yeniden ver",
  "Erişim yeniden açılıyor…",
  "Vazgeç",
];

export function RecoveryView({ data }: { data: RecoveryData }) {
  const [lang, setLang] = usePatientLang();
  const router = useRouter();
  const [reopenStep, setReopenStep] = useState<"idle" | "confirm">("idle");
  const [reopening, setReopening] = useState(false);
  const [reopenErr, setReopenErr] = useState("");

  // AI Epikriz talebi (FAZ 3) — hasta düğmeye basınca doktora bildirim düşer (video talebi deseni)
  const [reqBusy, setReqBusy] = useState(false);
  const [reqErr, setReqErr] = useState("");
  const [requestedAt, setRequestedAt] = useState<string | null>(data.dischargeRequestedAt ?? null);

  async function requestDischarge() {
    setReqBusy(true);
    setReqErr("");
    try {
      const res = await fetch(`/api/cases/${data.caseId}/discharge-request`, { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Talep gönderilemedi.");
      setRequestedAt(d.requestedAt ?? new Date().toISOString());
    } catch (e) {
      setReqErr(e instanceof Error ? e.message : "Hata oluştu.");
    } finally {
      setReqBusy(false);
    }
  }

  // Personel bandı: rapor talep sonrası henüz (yeniden) üretilmediyse talep "bekliyor" sayılır
  const pendingRequest = !!data.dischargeRequestedAt &&
    (!data.discharge?.savedAt || new Date(data.dischargeRequestedAt) > new Date(data.discharge.savedAt));

  // Geri-alma (E2EE Faz 2A) — hasta post-op erişimini klinik ekibe yeniden açar; başarıda sayfa yenilenir → form geri gelir.
  async function reopen() {
    setReopening(true);
    setReopenErr("");
    try {
      const res = await fetch(`/api/cases/${data.caseId}/recovery/reopen`, { method: "POST" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "İşlem başarısız.");
      }
      router.refresh();
    } catch (e) {
      setReopenErr(e instanceof Error ? e.message : "Hata oluştu.");
      setReopening(false);
    }
  }

  const texts = useMemo(
    () => [...UI, data.branch, ...data.protocol.flatMap((p) => [p.day, p.title, p.desc])],
    [data.branch, data.protocol],
  );
  const { t } = useT(lang, texts);

  return (
    <div dir={langDir(lang)} className="print-doc mx-auto max-w-4xl px-5 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={`/doktor/vaka/${data.caseId}`} className="inline-flex items-center gap-1.5 text-sm text-[var(--c-ink-2)] hover:text-[var(--c-accent-strong)]">
          <ArrowLeft size={16} /> {t("Vaka detayı")}
        </Link>
        <PatientLangSelect lang={lang} onChange={setLang} />
      </div>

      <div className="mt-4 flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--c-accent)] text-[var(--c-bg)]"><HeartPulse size={22} /></span>
        <div>
          <h1 className="text-2xl font-bold text-[var(--c-ink)]">{t("Post-Op Takip")}</h1>
          <p className="text-sm text-[var(--c-ink-2)]">{data.patientName} · {t(data.branch)} · {t("Tedavi sonrası")} <strong className="text-[var(--c-ink)]">{data.day}. {t("gün")}</strong></p>
        </div>
      </div>

      <div className="mt-7 grid gap-5 lg:grid-cols-[1fr_340px]">
        {/* Sol: kontrol + geçmiş */}
        <div className="space-y-5">
          {data.closed ? (
            <div className="rounded-3xl border border-[var(--c-hairline)] bg-[var(--c-surface)] p-6 text-center">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-300"><CheckCircle2 size={24} /></span>
              <h2 className="mt-3 font-bold text-[var(--c-ink)]">{t("Post-op takip tamamlandı")}</h2>
              <p className="mx-auto mt-1 max-w-md text-sm text-[var(--c-ink-2)]">{t("Bu sürecin takibi tamamlandı; yeni kontrol girişi kapalıdır. Geçmiş kayıtlarınız aşağıda görüntülenmeye devam eder.")}</p>
              {/* Geri-alma (E2EE Faz 2A) — veri post-op bitince hastaya döner; hasta isterse klinik ekibe erişimi YENİDEN verir (açma hasta kararı). */}
              <div className="mt-4">
                {reopenStep === "idle" ? (
                  <button onClick={() => setReopenStep("confirm")} className="inline-flex items-center gap-2 rounded-lg border border-[var(--c-hairline)] bg-[var(--c-panel)] px-4 py-2 text-sm font-medium text-[var(--c-ink)] hover:bg-[var(--c-surface)]">
                    <RotateCcw size={15} /> {t("Doktora erişimi yeniden ver")}
                  </button>
                ) : (
                  <div className="mx-auto max-w-md rounded-2xl border border-amber-400/25 bg-amber-500/10 p-4 text-start">
                    <p className="text-sm text-amber-200">{t("Klinik ekibiniz kayıtlarınıza yeniden erişebilecek. Erişimi yeniden vermek istiyor musunuz?")}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button onClick={reopen} disabled={reopening} className="inline-flex items-center gap-2 rounded-lg bg-[var(--c-accent)] px-4 py-2 text-sm font-semibold text-[var(--c-bg)] hover:bg-[var(--c-accent-strong)] disabled:opacity-50">
                        <RotateCcw size={15} /> {reopening ? t("Erişim yeniden açılıyor…") : t("Evet, erişimi yeniden ver")}
                      </button>
                      <button onClick={() => { setReopenStep("idle"); setReopenErr(""); }} disabled={reopening} className="rounded-lg border border-[var(--c-hairline)] px-4 py-2 text-sm font-medium text-[var(--c-ink-2)] hover:bg-[var(--c-surface)]">
                        {t("Vazgeç")}
                      </button>
                    </div>
                    {reopenErr && <p className="mt-2 text-sm text-red-300">{reopenErr}</p>}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <CheckInForm caseId={data.caseId} branch={data.branch} lang={lang} />
          )}

          <div className="rounded-3xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-6 shadow-sm">
            <h2 className="font-bold text-[var(--c-ink)]">{t("Kontrol geçmişi")}</h2>
            {data.checkIns.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--c-ink-3)]">{t("Henüz kontrol girilmedi.")}</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {data.checkIns.map((ci) => {
                  const m = severityMeta(ci.severity as Severity);
                  return (
                    <li key={ci.id} className="flex items-start gap-3 rounded-lg border border-[var(--c-hairline)] p-3">
                      <span className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${m.dot}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium text-[var(--c-ink)]">{formatDateTime(ci.createdAt)}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${m.badge}`}>{t(m.label)}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-[var(--c-ink-2)]">
                          <span className="inline-flex items-center gap-1"><Activity size={12} /> {t("Ağrı")} {ci.pain}/10</span>
                          <span className="inline-flex items-center gap-1"><Thermometer size={12} /> {ci.feverC.toFixed(1)}°C</span>
                          <span className="inline-flex items-center gap-1"><Pill size={12} /> {t("İlaç")} {ci.meds ? "✓" : "✗"}</span>
                          {ci.photo && !ci.photo.startsWith("data:") && <span>📷 {ci.photo}</span>}
                        </div>
                        {ci.note && <p className="mt-1 text-sm text-[var(--c-ink-2)]">{ci.note}</p>}
                        {ci.photo?.startsWith("data:") && (
                          <a href={ci.photo} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block" title={t("Büyütmek için aç")}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={ci.photo} alt={t("İyileşme fotoğrafı")} className="h-20 w-20 rounded-lg object-cover ring-1 ring-white/10 transition hover:ring-[var(--c-accent)]" />
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

        {/* Sağ: epikriz + protokol + hatırlatıcı */}
        <aside className="space-y-4">
          {/* AI Epikriz / Taburcu Raporu — FAZ 3 (2026-07-10): görüşme ekranından buraya taşındı.
              Personel: üretim paneli (+ hasta talebi bandı) · Hasta: salt-okunur rapor + "iste" düğmesi. */}
          {data.isStaff ? (
            <div className="space-y-3">
              {pendingRequest && (
                <div className="flex items-start gap-2 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-200">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  <span>
                    <strong>Hasta epikriz / taburcu raporu istedi</strong>
                    {requestedAt ? ` (${formatDateTime(requestedAt)})` : ""} — aşağıdaki panelden oluşturduğunuzda hastaya bildirim gider.
                  </span>
                </div>
              )}
              <DischargeReport
                caseId={data.caseId}
                initialReport={data.discharge?.report ?? null}
                initialStructured={data.discharge?.structured ?? null}
                initialSavedAt={data.discharge?.savedAt ?? null}
              />
            </div>
          ) : (
            <div className="rounded-3xl border border-violet-400/25 bg-[var(--c-panel)] p-5 shadow-sm">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-violet-300">
                <FileText size={15} /> {t("AI Epikriz / Taburcu Raporu")}
              </div>
              {data.discharge ? (
                <>
                  {data.discharge.savedAt && (
                    <div className="mt-1 text-[11px] text-[var(--c-ink-3)]">{t("oluşturuldu")}: {formatDateTime(data.discharge.savedAt)}</div>
                  )}
                  <p className="mt-1.5 text-[11px] text-[var(--c-ink-3)]">{t("Rapor kaynak dilinde (Türkçe) hazırlanır; aşağıdan kendi dilinize çevirebilirsiniz.")}</p>
                  <div className="mt-2 max-h-72 overflow-y-auto whitespace-pre-line rounded-xl border border-[var(--c-hairline)] bg-[var(--c-surface)]/60 p-3 text-sm leading-relaxed text-[var(--c-ink)]">
                    {data.discharge.report}
                  </div>
                  <TranslateButton text={data.discharge.report} defaultTarget={lang !== "Türkçe" ? lang : "İngilizce"} compact />
                </>
              ) : (
                <>
                  <p className="mt-1.5 text-sm leading-relaxed text-[var(--c-ink-2)]">
                    {t("Tedavi sürecinizin tıbbi özet raporu. Doktorunuz oluşturduğunda burada görüntülenir.")}
                  </p>
                  {requestedAt ? (
                    <div className="mt-3 flex items-start gap-2 rounded-xl bg-[var(--c-accent)]/10 p-2.5 text-[12px] leading-relaxed text-[var(--c-accent)] ring-1 ring-[var(--c-accent)]/20">
                      <Check size={14} className="mt-0.5 shrink-0" />
                      <span>
                        {t("Talebiniz doktorunuza iletildi")} ({formatDateTime(requestedAt)}). {t("Raporu doktorunuz oluşturur; hazır olduğunda bildirim alırsınız.")}
                      </span>
                    </div>
                  ) : data.closed ? (
                    <p className="mt-3 rounded-xl bg-amber-500/10 p-2.5 text-[12px] text-amber-300 ring-1 ring-amber-400/20">
                      {t("Takip kapandığı için yeni talep, doktora erişimi yeniden vermenizle mümkündür.")}
                    </p>
                  ) : (
                    <button
                      onClick={requestDischarge}
                      disabled={reqBusy}
                      className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-violet-400/30 bg-violet-500/10 px-3 py-2 text-sm font-semibold text-violet-300 hover:bg-violet-500/15 disabled:opacity-50"
                    >
                      {reqBusy ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}
                      {reqBusy ? t("İstek gönderiliyor…") : t("AI Epikriz / Taburcu Raporu iste")}
                    </button>
                  )}
                  {reqErr && <p className="mt-2 text-xs text-red-300">{reqErr}</p>}
                </>
              )}
            </div>
          )}

          <div className="rounded-3xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-5 shadow-sm">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--c-ink-2)]"><CalendarCheck size={15} /> {t("İyileşme Takvimi")}</div>
            <ol className="mt-3 space-y-0">
              {data.protocol.map((mst, i) => (
                <li key={i} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--c-accent)]/15 text-[11px] font-bold text-[var(--c-accent)]">{i + 1}</span>
                    {i < data.protocol.length - 1 && <span className="my-1 h-5 w-0.5 bg-[var(--c-ink)]/15" />}
                  </div>
                  <div className="pb-1.5">
                    <div className="text-sm font-medium text-[var(--c-ink)]">{t(mst.title)} <span className="text-xs font-normal text-[var(--c-accent)]">· {t(mst.day)}</span></div>
                    <div className="text-xs text-[var(--c-ink-3)]">{t(mst.desc)}</div>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-3xl border border-[var(--c-accent)]/25 bg-[var(--c-accent)]/10 p-5">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--c-accent)]"><Video size={15} /> {t("Tele-Kontrol")}</div>
            <p className="mt-1.5 text-sm text-[var(--c-ink-2)]">{t("Kritik dönüm noktalarında doktorunuzla kısa görüşme planlanır.")}</p>
            <button className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--c-hairline)] bg-[var(--c-panel)] px-4 py-2 text-sm font-medium text-[var(--c-ink-2)] hover:bg-[var(--c-surface)]">
              {t("Randevu iste")}
            </button>
          </div>

          <div className="rounded-3xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-5 shadow-sm">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--c-ink-2)]"><Pill size={15} /> {t("İlaç Hatırlatıcı")}</div>
            <p className="mt-1.5 text-sm text-[var(--c-ink-2)]">{t("Günlük ilaç bildirimleri açık (demo).")}</p>
          </div>

          <Link href="/paylasimlarim" className="block rounded-3xl border border-[var(--c-accent)]/20 bg-[var(--c-accent)]/[0.03] p-5 transition-colors hover:bg-[var(--c-accent)]/[0.06]">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--c-ink)]"><ShieldCheck size={15} /> {t("Güvenli Paylaşım")}</div>
            <p className="mt-1.5 text-sm text-[var(--c-ink-2)]">{t("Bu kayıtları kendi ülkenizdeki doktorunuzla süreli ve iptal edilebilir bir bağlantıyla paylaşın.")}</p>
            <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--c-ink)]">{t("Paylaşım Kontrol Merkezi")} <ArrowRight size={14} /></span>
          </Link>
        </aside>
      </div>
    </div>
  );
}
