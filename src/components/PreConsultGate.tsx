"use client";

import { useState } from "react";
import { CONSULT_FEE_USD, CONSULT_DURATION_TEXT, verifyPolicy, simulatePaymentRef, type Billing } from "@/lib/billing";
import {
  Clock, ShieldCheck, CreditCard, Wallet, ArrowRight, ArrowLeft,
  Loader2, Check, BadgeCheck, Video, AlertCircle,
} from "lucide-react";

type Phase = "info" | "insurance" | "policy" | "payment";

const PRIMARY = "inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#28C8D8] px-4 py-2.5 text-sm font-semibold text-[#0D0E10] hover:bg-[#1FA9B8] disabled:opacity-50";
const BACK = "inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium text-white/65 hover:bg-white/10";
const INPUT = "w-full rounded-lg border border-white/15 px-3 py-2 text-sm focus:border-[#28C8D8] focus:outline-none";

// Kapının çevrilebilir TÜM statik metinleri — triyaj sayfası bunları useT'ye besler.
// t() bileşende zaten uygulanıyor; ancak metnin bu listede (yani çeviri fetch'inde) olması
// ŞART: useT, listede olmayan metin için Türkçe orijinali döndürür (map[s] ?? s).
export const PRECONSULT_TEXTS: string[] = [
  "Görüşme bilgisi", "Sigorta", "Doğrulama", "Ödeme",
  "Uzman görüşmesi — ön bilgilendirme", "Şikayetlerinizi paylaşmadan önce kısa bir bilgilendirme.",
  "Görüşme ücreti", "Tek seferlik · Tier 1 ön değerlendirme", "Ortalama süre", "15–25 dk",
  "Uzman doktorla birebir video", "Şikayet ve tıbbi geçmiş değerlendirmesi",
  "Branş yönlendirmesi ve ikinci görüş", "Tedavi/paket için ön plan", "Devam et",
  "Sigorta durumu", "Bu görüşmeyi kapsayan bir sağlık sigortanız var mı?",
  "Evet, sigortam var", "Poliçe numarası ile kapsamı doğrulayın",
  "Hayır / sigortasız devam", "ödeyerek devam edin", "Geri",
  "Sigorta poliçesi doğrulama", "Poliçe numaranızı girin; görüşme kapsamı kontrol edilsin.",
  "Poliçe no (ör. ALZ123456)", "Poliçe numarası geçersiz görünüyor (en az 6 karakter olmalı).",
  "Dilerseniz ödeme yaparak devam edebilirsiniz.", "Ödeme ile devam", "Doğrula",
  "Görüşme ücreti:", "Kart bilgileri", "(demo — gerçek ödeme alınmaz)", "Kart numarası",
  "AA/YY", "öde", "Lütfen geçerli bir kart numarası girin (demo).",
  "🔒 Ödeme simülasyondur. Gerçek sürümde Iyzico/Stripe + Escrow entegrasyonu kullanılır.",
];

// t: arayüz çeviri fonksiyonu (hasta arayüzü çok dilli — varsayılan kimlik/Türkçe)
export function PreConsultGate({ onCleared, t = (s) => s }: { onCleared: (b: Billing) => void; t?: (s: string) => string }) {
  const [phase, setPhase] = useState<Phase>("info");
  const [policyNo, setPolicyNo] = useState("");
  const [policyMsg, setPolicyMsg] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [card, setCard] = useState("");
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");

  function verify() {
    setPolicyMsg("");
    setVerifying(true);
    setTimeout(() => {
      const res = verifyPolicy(policyNo);
      setVerifying(false);
      if (res.covered) {
        onCleared({ status: "INSURED", method: "INSURANCE", fee: CONSULT_FEE_USD, policyNo: policyNo.trim(), insurer: res.insurer });
      } else {
        setPolicyMsg(res.message);
      }
    }, 900);
  }

  function pay() {
    setError("");
    if (card.replace(/\s/g, "").length < 12) { setError("Lütfen geçerli bir kart numarası girin (demo)."); return; }
    setPaying(true);
    setTimeout(() => {
      setPaying(false);
      onCleared({ status: "PAID", method: "PAYMENT", fee: CONSULT_FEE_USD, payRef: simulatePaymentRef() });
    }, 1300);
  }

  const stepIndex = phase === "info" ? 0 : phase === "insurance" ? 1 : 2;
  const thirdLabel = phase === "policy" ? t("Doğrulama") : t("Ödeme");
  const steps = [t("Görüşme bilgisi"), t("Sigorta"), thirdLabel];

  return (
    <div className="rounded-3xl border border-white/10 bg-[#161719] p-6 shadow-sm">
      {/* mini ilerleme */}
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs">
        {steps.map((label, i) => (
          <span key={i} className={`inline-flex items-center gap-1.5 ${i <= stepIndex ? "font-semibold text-[#F4F5F3]" : "text-white/40"}`}>
            <span className={`grid h-5 w-5 place-items-center rounded-full text-[10px] ${i < stepIndex ? "bg-emerald-500 text-white" : i === stepIndex ? "bg-[#28C8D8] text-[#0D0E10]" : "bg-white/15 text-white/50"}`}>
              {i < stepIndex ? <Check size={11} /> : i + 1}
            </span>
            {label}
            {i < steps.length - 1 && <span className="mx-0.5 text-white/25">›</span>}
          </span>
        ))}
      </div>

      <div className="mt-5">
        {phase === "info" && (
          <div>
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#28C8D8] text-[#0D0E10]"><Video size={22} /></span>
              <div>
                <h2 className="text-lg font-bold text-[#F4F5F3]">{t("Uzman görüşmesi — ön bilgilendirme")}</h2>
                <p className="text-sm text-white/50">{t("Şikayetlerinizi paylaşmadan önce kısa bir bilgilendirme.")}</p>
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 p-4">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-white/50"><Wallet size={14} /> {t("Görüşme ücreti")}</div>
                <div className="mt-1 text-2xl font-bold text-[#F4F5F3]">${CONSULT_FEE_USD}</div>
                <div className="text-xs text-white/40">{t("Tek seferlik · Tier 1 ön değerlendirme")}</div>
              </div>
              <div className="rounded-2xl border border-white/10 p-4">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-white/50"><Clock size={14} /> {t("Ortalama süre")}</div>
                <div className="mt-1 text-2xl font-bold text-[#F4F5F3]">{t(CONSULT_DURATION_TEXT)}</div>
                <div className="text-xs text-white/40">{t("Uzman doktorla birebir video")}</div>
              </div>
            </div>
            <ul className="mt-4 space-y-1.5 text-sm text-white/65">
              <li className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-emerald-500" /> {t("Şikayet ve tıbbi geçmiş değerlendirmesi")}</li>
              <li className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-emerald-500" /> {t("Branş yönlendirmesi ve ikinci görüş")}</li>
              <li className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-emerald-500" /> {t("Tedavi/paket için ön plan")}</li>
            </ul>
            <button onClick={() => setPhase("insurance")} className={`${PRIMARY} mt-5 w-full`}>{t("Devam et")} <ArrowRight size={16} /></button>
          </div>
        )}

        {phase === "insurance" && (
          <div>
            <h2 className="text-lg font-bold text-[#F4F5F3]">{t("Sigorta durumu")}</h2>
            <p className="mt-1 text-sm text-white/50">{t("Bu görüşmeyi kapsayan bir sağlık sigortanız var mı?")}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button onClick={() => { setPhase("policy"); setPolicyMsg(""); }} className="rounded-2xl border-2 border-white/10 p-4 text-start transition-colors hover:border-[#28C8D8] hover:bg-[#28C8D8]/5">
                <ShieldCheck size={22} className="text-[#F4F5F3]" />
                <div className="mt-2 font-semibold text-[#F4F5F3]">{t("Evet, sigortam var")}</div>
                <div className="text-xs text-white/50">{t("Poliçe numarası ile kapsamı doğrulayın")}</div>
              </button>
              <button onClick={() => { setError(""); setPhase("payment"); }} className="rounded-2xl border-2 border-white/10 p-4 text-start transition-colors hover:border-[#28C8D8] hover:bg-[#28C8D8]/5">
                <CreditCard size={22} className="text-[#F4F5F3]" />
                <div className="mt-2 font-semibold text-[#F4F5F3]">{t("Hayır / sigortasız devam")}</div>
                <div className="text-xs text-white/50">${CONSULT_FEE_USD} {t("ödeyerek devam edin")}</div>
              </button>
            </div>
            <button onClick={() => setPhase("info")} className={`${BACK} mt-4`}><ArrowLeft size={16} /> {t("Geri")}</button>
          </div>
        )}

        {phase === "policy" && (
          <div>
            <h2 className="text-lg font-bold text-[#F4F5F3]">{t("Sigorta poliçesi doğrulama")}</h2>
            <p className="mt-1 text-sm text-white/50">{t("Poliçe numaranızı girin; görüşme kapsamı kontrol edilsin.")}</p>
            <input value={policyNo} onChange={(e) => setPolicyNo(e.target.value)} placeholder={t("Poliçe no (ör. ALZ123456)")} className={`${INPUT} mt-4`} autoFocus />
            {policyMsg && (
              <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                <AlertCircle size={15} className="mt-0.5 shrink-0" /> <span>{t(policyMsg)} {t("Dilerseniz ödeme yaparak devam edebilirsiniz.")}</span>
              </div>
            )}
            <div className="mt-4 flex items-center gap-2">
              <button onClick={() => setPhase("insurance")} className={BACK}><ArrowLeft size={16} /> {t("Geri")}</button>
              {policyMsg && <button onClick={() => setPhase("payment")} className="rounded-lg border border-white/15 px-3.5 py-2 text-sm font-medium text-white/75 hover:bg-[#1E1F22]">{t("Ödeme ile devam")}</button>}
              <button onClick={verify} disabled={verifying || policyNo.trim().length < 3} className={`${PRIMARY} ms-auto`}>
                {verifying ? <Loader2 size={16} className="animate-spin" /> : <BadgeCheck size={16} />} {t("Doğrula")}
              </button>
            </div>
          </div>
        )}

        {phase === "payment" && (
          <div>
            <h2 className="text-lg font-bold text-[#F4F5F3]">{t("Ödeme")}</h2>
            <p className="mt-1 text-sm text-white/50">{t("Görüşme ücreti:")} <strong className="text-white/75">${CONSULT_FEE_USD}</strong></p>
            <div className="mt-3 space-y-3 rounded-2xl border border-white/10 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-white/50">{t("Kart bilgileri")} <span className="font-normal text-white/40">{t("(demo — gerçek ödeme alınmaz)")}</span></div>
              <input value={card} onChange={(e) => setCard(e.target.value)} inputMode="numeric" placeholder={t("Kart numarası")} className={INPUT} autoFocus />
              <div className="grid grid-cols-2 gap-3">
                <input placeholder={t("AA/YY")} className={INPUT} />
                <input placeholder="CVC" className={INPUT} />
              </div>
            </div>
            {error && <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300"><AlertCircle size={15} /> {t(error)}</div>}
            <div className="mt-4 flex items-center gap-2">
              <button onClick={() => setPhase("insurance")} className={BACK}><ArrowLeft size={16} /> {t("Geri")}</button>
              <button onClick={pay} disabled={paying} className={`${PRIMARY} ms-auto`}>
                {paying ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />} ${CONSULT_FEE_USD} {t("öde")}
              </button>
            </div>
            <p className="mt-2 text-[11px] text-white/40">{t("🔒 Ödeme simülasyondur. Gerçek sürümde Iyzico/Stripe + Escrow entegrasyonu kullanılır.")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
