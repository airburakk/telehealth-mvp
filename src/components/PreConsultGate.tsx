"use client";

import { useState } from "react";
import { CONSULT_FEE_USD, CONSULT_DURATION_TEXT, simulatePaymentRef, type Billing } from "@/lib/billing";
import {
  Clock, CreditCard, Wallet, Loader2, Check, Video, AlertCircle,
} from "lucide-react";

// Ön-konsültasyon kapısı — TEK EKRAN (basitleştirme Faz 2, 2026-07-12): ücret/süre bilgisi +
// kart ödeme aynı yüzeyde. "Sigortam var" yöntemi 2026-08-05'te kaldırıldı (anlaşmalı sigorta
// şirketi yok); kartla demo ödeme tek yoldur. Billing sözleşmesi: status=PAID, method=PAYMENT.
const PRIMARY = "inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--c-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--c-bg)] hover:bg-[var(--c-accent-strong)] disabled:opacity-50";
const INPUT = "w-full rounded-lg border border-[var(--c-hairline)] px-3 py-2 text-sm focus:border-[var(--c-accent)] focus:outline-none";

// Kapının çevrilebilir TÜM statik metinleri — triyaj sayfası bunları useT'ye besler.
// t() bileşende zaten uygulanıyor; ancak metnin bu listede (yani çeviri fetch'inde) olması
// ŞART: useT, listede olmayan metin için Türkçe orijinali döndürür (map[s] ?? s).
export const PRECONSULT_TEXTS: string[] = [
  "Uzman görüşmesi — ön bilgilendirme", "Şikayetlerinizi paylaşmadan önce kısa bir bilgilendirme.",
  "Görüşme ücreti", "Tek seferlik · Tier 1 ön değerlendirme", "Ortalama süre", "15–25 dk",
  "Uzman doktorla birebir video", "Şikayet ve tıbbi geçmiş değerlendirmesi",
  "Branş yönlendirmesi ve ikinci görüş", "Tedavi/paket için ön plan",
  "Kart bilgileri", "(demo — gerçek ödeme alınmaz)", "Kart numarası",
  "AA/YY", "öde", "Lütfen geçerli bir kart numarası girin (demo).",
  "🔒 Ödeme simülasyondur. Gerçek sürümde Iyzico/Stripe + Escrow entegrasyonu kullanılır.",
];

// t: arayüz çeviri fonksiyonu (hasta arayüzü çok dilli — varsayılan kimlik/Türkçe)
export function PreConsultGate({ onCleared, t = (s) => s }: { onCleared: (b: Billing) => void; t?: (s: string) => string }) {
  const [card, setCard] = useState("");
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");

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
          <h2 className="aura-display text-lg font-medium tracking-tight text-[var(--c-ink)]">{t("Uzman görüşmesi — ön bilgilendirme")}</h2>
          <p className="text-sm text-[var(--c-ink-2)]">{t("Şikayetlerinizi paylaşmadan önce kısa bir bilgilendirme.")}</p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-[var(--c-hairline)] p-4">
          <div className="flex items-center gap-1.5 aura-mono text-[11px] uppercase tracking-[0.2em] text-[var(--c-ink-2)]"><Wallet size={14} /> {t("Görüşme ücreti")}</div>
          <div className="mt-1 text-2xl font-bold text-[var(--c-ink)]">${CONSULT_FEE_USD}</div>
          <div className="text-xs text-[var(--c-ink-3)]">{t("Tek seferlik · Tier 1 ön değerlendirme")}</div>
        </div>
        <div className="rounded-2xl border border-[var(--c-hairline)] p-4">
          <div className="flex items-center gap-1.5 aura-mono text-[11px] uppercase tracking-[0.2em] text-[var(--c-ink-2)]"><Clock size={14} /> {t("Ortalama süre")}</div>
          <div className="mt-1 text-2xl font-bold text-[var(--c-ink)]">{t(CONSULT_DURATION_TEXT)}</div>
          <div className="text-xs text-[var(--c-ink-3)]">{t("Uzman doktorla birebir video")}</div>
        </div>
      </div>
      <ul className="mt-4 space-y-1.5 text-sm text-[var(--c-ink-2)]">
        <li className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-emerald-500" /> {t("Şikayet ve tıbbi geçmiş değerlendirmesi")}</li>
        <li className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-emerald-500" /> {t("Branş yönlendirmesi ve ikinci görüş")}</li>
        <li className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-emerald-500" /> {t("Tedavi/paket için ön plan")}</li>
      </ul>

      {/* Kart ödeme — tek yöntem */}
      <div className="mt-5">
        <div className="space-y-3 rounded-2xl border border-[var(--c-hairline)] p-4">
          <div className="aura-mono text-[11px] uppercase tracking-[0.2em] text-[var(--c-ink-2)]">{t("Kart bilgileri")} <span className="font-normal text-[var(--c-ink-3)]">{t("(demo — gerçek ödeme alınmaz)")}</span></div>
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
    </div>
  );
}
