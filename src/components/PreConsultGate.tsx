"use client";

import { useState } from "react";
import { CONSULT_FEE_USD, CONSULT_DURATION_TEXT, verifyPolicy, simulatePaymentRef, type Billing } from "@/lib/billing";
import {
  Clock, ShieldCheck, CreditCard, Wallet, Loader2, Check, BadgeCheck, Video, AlertCircle,
} from "lucide-react";

// Ön-konsültasyon kapısı — TEK EKRAN (basitleştirme Faz 2, 2026-07-12; önceki 3-fazlı sihirbaz
// [bilgi → sigorta → poliçe/ödeme] tek yüzeye indirildi): ücret/süre bilgisi + yöntem seçimi
// (sigorta ↔ kart) + seçilen yöntemin alanları aynı ekranda. Billing sözleşmesi DEĞİŞMEDİ.
const PRIMARY = "inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--c-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--c-bg)] hover:bg-[var(--c-accent-strong)] disabled:opacity-50";
const INPUT = "w-full rounded-lg border border-[var(--c-hairline)] px-3 py-2 text-sm focus:border-[var(--c-accent)] focus:outline-none";

type Method = "card" | "insurance";

// Kapının çevrilebilir TÜM statik metinleri — triyaj sayfası bunları useT'ye besler.
// t() bileşende zaten uygulanıyor; ancak metnin bu listede (yani çeviri fetch'inde) olması
// ŞART: useT, listede olmayan metin için Türkçe orijinali döndürür (map[s] ?? s).
export const PRECONSULT_TEXTS: string[] = [
  "Uzman görüşmesi — ön bilgilendirme", "Şikayetlerinizi paylaşmadan önce kısa bir bilgilendirme.",
  "Görüşme ücreti", "Tek seferlik · Tier 1 ön değerlendirme", "Ortalama süre", "15–25 dk",
  "Uzman doktorla birebir video", "Şikayet ve tıbbi geçmiş değerlendirmesi",
  "Branş yönlendirmesi ve ikinci görüş", "Tedavi/paket için ön plan",
  "Ödeme yöntemi",
  "Kartla öde", "ödeyerek devam edin",
  "Sigortam var", "Poliçe numarası ile kapsamı doğrulayın",
  "Poliçe numaranızı girin; görüşme kapsamı kontrol edilsin.",
  "Poliçe no (ör. ALZ123456)", "Poliçe numarası geçersiz görünüyor (en az 6 karakter olmalı).",
  "Dilerseniz ödeme yaparak devam edebilirsiniz.", "Doğrula",
  "Kart bilgileri", "(demo — gerçek ödeme alınmaz)", "Kart numarası",
  "AA/YY", "öde", "Lütfen geçerli bir kart numarası girin (demo).",
  "🔒 Ödeme simülasyondur. Gerçek sürümde Iyzico/Stripe + Escrow entegrasyonu kullanılır.",
];

// t: arayüz çeviri fonksiyonu (hasta arayüzü çok dilli — varsayılan kimlik/Türkçe)
export function PreConsultGate({ onCleared, t = (s) => s }: { onCleared: (b: Billing) => void; t?: (s: string) => string }) {
  const [method, setMethod] = useState<Method>("card");
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

  return (
    <div className="rounded-3xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-6 shadow-sm">
      {/* Bilgi başlığı + ücret/süre kartları — eski "bilgi" ekranı, artık aynı yüzeyde */}
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--c-accent)] text-[var(--c-bg)]"><Video size={22} /></span>
        <div>
          <h2 className="text-lg font-bold text-[var(--c-ink)]">{t("Uzman görüşmesi — ön bilgilendirme")}</h2>
          <p className="text-sm text-[var(--c-ink-2)]">{t("Şikayetlerinizi paylaşmadan önce kısa bir bilgilendirme.")}</p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-[var(--c-hairline)] p-4">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--c-ink-2)]"><Wallet size={14} /> {t("Görüşme ücreti")}</div>
          <div className="mt-1 text-2xl font-bold text-[var(--c-ink)]">${CONSULT_FEE_USD}</div>
          <div className="text-xs text-[var(--c-ink-3)]">{t("Tek seferlik · Tier 1 ön değerlendirme")}</div>
        </div>
        <div className="rounded-2xl border border-[var(--c-hairline)] p-4">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--c-ink-2)]"><Clock size={14} /> {t("Ortalama süre")}</div>
          <div className="mt-1 text-2xl font-bold text-[var(--c-ink)]">{t(CONSULT_DURATION_TEXT)}</div>
          <div className="text-xs text-[var(--c-ink-3)]">{t("Uzman doktorla birebir video")}</div>
        </div>
      </div>
      <ul className="mt-4 space-y-1.5 text-sm text-[var(--c-ink-2)]">
        <li className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-emerald-500" /> {t("Şikayet ve tıbbi geçmiş değerlendirmesi")}</li>
        <li className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-emerald-500" /> {t("Branş yönlendirmesi ve ikinci görüş")}</li>
        <li className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-emerald-500" /> {t("Tedavi/paket için ön plan")}</li>
      </ul>

      {/* Yöntem seçimi — sigorta ↔ kart aynı ekranda geçişli */}
      <div className="mt-5">
        <div className="text-xs font-semibold uppercase tracking-wide text-[var(--c-ink-2)]">{t("Ödeme yöntemi")}</div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => { setError(""); setMethod("card"); }}
            className={`rounded-2xl border-2 p-3.5 text-start transition-colors ${method === "card" ? "border-[var(--c-accent)] bg-[var(--c-accent)]/5" : "border-[var(--c-hairline)] hover:border-[var(--c-hairline)]"}`}
          >
            <CreditCard size={20} className="text-[var(--c-ink)]" />
            <div className="mt-1.5 text-sm font-semibold text-[var(--c-ink)]">{t("Kartla öde")}</div>
            <div className="text-xs text-[var(--c-ink-2)]">${CONSULT_FEE_USD} {t("ödeyerek devam edin")}</div>
          </button>
          <button
            type="button"
            onClick={() => { setPolicyMsg(""); setMethod("insurance"); }}
            className={`rounded-2xl border-2 p-3.5 text-start transition-colors ${method === "insurance" ? "border-[var(--c-accent)] bg-[var(--c-accent)]/5" : "border-[var(--c-hairline)] hover:border-[var(--c-hairline)]"}`}
          >
            <ShieldCheck size={20} className="text-[var(--c-ink)]" />
            <div className="mt-1.5 text-sm font-semibold text-[var(--c-ink)]">{t("Sigortam var")}</div>
            <div className="text-xs text-[var(--c-ink-2)]">{t("Poliçe numarası ile kapsamı doğrulayın")}</div>
          </button>
        </div>
      </div>

      {method === "insurance" ? (
        <div className="mt-4">
          <p className="text-sm text-[var(--c-ink-2)]">{t("Poliçe numaranızı girin; görüşme kapsamı kontrol edilsin.")}</p>
          <div className="mt-2 flex items-center gap-2">
            <input value={policyNo} onChange={(e) => setPolicyNo(e.target.value)} placeholder={t("Poliçe no (ör. ALZ123456)")} className={INPUT} autoFocus />
            <button onClick={verify} disabled={verifying || policyNo.trim().length < 3} className={`${PRIMARY} shrink-0`}>
              {verifying ? <Loader2 size={16} className="animate-spin" /> : <BadgeCheck size={16} />} {t("Doğrula")}
            </button>
          </div>
          {policyMsg && (
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
              <AlertCircle size={15} className="mt-0.5 shrink-0" /> <span>{t(policyMsg)} {t("Dilerseniz ödeme yaparak devam edebilirsiniz.")}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4">
          <div className="space-y-3 rounded-2xl border border-[var(--c-hairline)] p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--c-ink-2)]">{t("Kart bilgileri")} <span className="font-normal text-[var(--c-ink-3)]">{t("(demo — gerçek ödeme alınmaz)")}</span></div>
            <input value={card} onChange={(e) => setCard(e.target.value)} inputMode="numeric" placeholder={t("Kart numarası")} className={INPUT} autoFocus />
            <div className="grid grid-cols-2 gap-3">
              <input placeholder={t("AA/YY")} className={INPUT} />
              <input placeholder="CVC" className={INPUT} />
            </div>
          </div>
          {error && <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300"><AlertCircle size={15} /> {t(error)}</div>}
          <button onClick={pay} disabled={paying} className={`${PRIMARY} mt-4 w-full`}>
            {paying ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />} ${CONSULT_FEE_USD} {t("öde")}
          </button>
          <p className="mt-2 text-[11px] text-[var(--c-ink-3)]">{t("🔒 Ödeme simülasyondur. Gerçek sürümde Iyzico/Stripe + Escrow entegrasyonu kullanılır.")}</p>
        </div>
      )}
    </div>
  );
}
