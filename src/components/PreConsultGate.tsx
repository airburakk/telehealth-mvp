"use client";

import { useEffect, useRef, useState } from "react";
import { CONSULT_FEE_USD, CONSULT_DURATION_TEXT, simulatePaymentRef, type Billing } from "@/lib/billing";
import { Clock, Wallet, Loader2, Check, Video, Sparkles } from "lucide-react";

// Ön-konsültasyon kapısı — TEK EKRAN (basitleştirme Faz 2, 2026-07-12): ücret/süre bilgisi + demo onayı aynı yüzeyde.
// "Sigortam var" yöntemi 2026-08-05'te kaldırıldı (anlaşmalı sigorta şirketi yok). Billing sözleşmesi: status=PAID, method=PAYMENT.
// Kontrol raporu 2026-09-17 H06/H07 (v6.283): SAHTE kart alanları (numara/AA-YY/CVC) KALKTI — yalnız kart metni uzunluğu
// simülasyonu ilerletiyordu, alanlar erişilebilir ad taşımıyordu ve autoFocus sayfayı aşağı kaydırıp bağlamı gizliyordu.
// Gerçek ödeme gelince sağlayıcının güvenli formu (Iyzico/Stripe) + sunucu doğrulaması bu yüzeye bağlanır.
const PRIMARY = "inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--c-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--c-bg)] hover:bg-[var(--c-accent-strong)] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--c-accent)]";

// Kapının çevrilebilir TÜM statik metinleri — triyaj sayfası bunları useT'ye besler.
// t() bileşende zaten uygulanıyor; ancak metnin bu listede (yani çeviri fetch'inde) olması
// ŞART: useT, listede olmayan metin için Türkçe orijinali döndürür (map[s] ?? s).
export const PRECONSULT_TEXTS: string[] = [
  "Uzman görüşmesi — ön bilgilendirme", "Şikayetlerinizi paylaşmadan önce kısa bir bilgilendirme.",
  "Görüşme ücreti", "Tek seferlik · Tier 1 ön değerlendirme", "demo: tahsil edilmez", "Ortalama süre", "15–25 dk",
  "Uzman doktorla birebir video", "Şikayet ve tıbbi geçmiş değerlendirmesi",
  "Branş yönlendirmesi ve ikinci görüş", "Tedavi/paket için ön plan",
  "Demo ile devam et — ücret alınmaz",
  "Demo ortamında kart bilgisi istenmez; gerçek sürümde ödeme sağlayıcısının güvenli formu açılır.",
  "🔒 Ödeme simülasyondur. Gerçek sürümde Iyzico/Stripe + Escrow entegrasyonu kullanılır.",
];

// t: arayüz çeviri fonksiyonu (hasta arayüzü çok dilli — varsayılan kimlik/Türkçe)
export function PreConsultGate({ onCleared, t = (s) => s }: { onCleared: (b: Billing) => void; t?: (s: string) => string }) {
  const [proceeding, setProceeding] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // H07: odak aşama BAŞLIĞINA, kaydırmadan (eski autoFocus kart alanına gidip sayfayı aşağı çekiyordu).
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  function proceed() {
    setProceeding(true);
    setTimeout(() => {
      setProceeding(false);
      onCleared({ status: "PAID", method: "PAYMENT", fee: CONSULT_FEE_USD, payRef: simulatePaymentRef() });
    }, 600);
  }

  return (
    <div className="rounded-3xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-6 shadow-sm">
      {/* Bilgi başlığı + ücret/süre kartları — eski "bilgi" ekranı, artık aynı yüzeyde */}
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--c-accent)] text-[var(--c-bg)]"><Video size={22} /></span>
        <div>
          <h2 ref={headingRef} tabIndex={-1} className="aura-display text-lg font-medium tracking-tight text-[var(--c-ink)] outline-none">{t("Uzman görüşmesi — ön bilgilendirme")}</h2>
          <p className="text-sm text-[var(--c-ink-2)]">{t("Şikayetlerinizi paylaşmadan önce kısa bir bilgilendirme.")}</p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-[var(--c-hairline)] p-4">
          <div className="flex items-center gap-1.5 aura-mono text-[11px] uppercase tracking-[0.2em] text-[var(--c-ink-2)]"><Wallet size={14} /> {t("Görüşme ücreti")}</div>
          <div className="mt-1 text-2xl font-bold text-[var(--c-ink)]">${CONSULT_FEE_USD} <span className="text-sm font-medium text-amber-300">· {t("demo: tahsil edilmez")}</span></div>
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

      {/* Demo onayı — kart alanı YOK (H06) */}
      <div className="mt-5">
        <button type="button" onClick={proceed} disabled={proceeding} aria-describedby="preconsult-demo-note" className={`${PRIMARY} w-full`}>
          {proceeding ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} {t("Demo ile devam et — ücret alınmaz")}
        </button>
        <p id="preconsult-demo-note" className="mt-2 text-[11px] text-[var(--c-ink-3)]">
          {t("Demo ortamında kart bilgisi istenmez; gerçek sürümde ödeme sağlayıcısının güvenli formu açılır.")}{" "}
          {t("🔒 Ödeme simülasyondur. Gerçek sürümde Iyzico/Stripe + Escrow entegrasyonu kullanılır.")}
        </p>
      </div>
    </div>
  );
}
