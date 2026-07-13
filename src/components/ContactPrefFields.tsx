"use client";

import { Phone, MessageSquare, Mail, Bell } from "lucide-react";

// Hasta Ön Bilgi — telefon + iletişim tercihi alanları (FAZ 8, 2026-07-10).
// 4 intake senaryosunda (Triyaj · İkinci Görüş · Sağlık Turizmi · Ücretsiz Sağlık) ortak kullanılır.
// Çeviri, HER formun kendi useT'siyle yapılır (t prop'u); metinler CONTACT_PREF_TEXTS ile formun
// texts listesine eklenir (sabit modül-düzeyi dizi — [[uset-unstable-texts-race]] uyumlu).

export const CONTACT_PREF_TEXTS = [
  "Telefon numarası (isteğe bağlı)",
  "Sizinle iletişime geçmemiz gerekirse hangi yoldan size ulaşmamızı istersiniz?",
  "Uygulama üzerinden mesaj",
  "Telefon üzerinden mesaj",
  "E-posta",
] as const;

export type ContactPref = "APP" | "SMS" | "EMAIL";

const OPTIONS: { key: ContactPref; label: (typeof CONTACT_PREF_TEXTS)[number]; icon: typeof Bell }[] = [
  { key: "APP", label: "Uygulama üzerinden mesaj", icon: Bell },
  { key: "SMS", label: "Telefon üzerinden mesaj", icon: MessageSquare },
  { key: "EMAIL", label: "E-posta", icon: Mail },
];

export function ContactPrefFields({
  phone, onPhone, pref, onPref, t,
}: {
  phone: string;
  onPhone: (v: string) => void;
  pref: ContactPref;
  onPref: (v: ContactPref) => void;
  t: (s: string) => string;
}) {
  return (
    <div className="space-y-4">
      <label className="block">
        <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-[var(--c-ink)]">
          <Phone size={14} className="text-[var(--c-ink-3)]" /> {t("Telefon numarası (isteğe bağlı)")}
        </span>
        <input
          type="tel"
          value={phone}
          onChange={(e) => onPhone(e.target.value)}
          placeholder="+90 5xx xxx xx xx"
          dir="ltr"
          className="w-full rounded-lg border border-[var(--c-hairline)] px-3 py-2 text-sm outline-none focus:border-[var(--c-accent)]"
        />
      </label>

      <div>
        <span className="mb-1.5 block text-sm font-medium text-[var(--c-ink)]">
          {t("Sizinle iletişime geçmemiz gerekirse hangi yoldan size ulaşmamızı istersiniz?")}
        </span>
        <div className="flex flex-wrap gap-1.5">
          {OPTIONS.map((o) => {
            const Icon = o.icon;
            const active = pref === o.key;
            return (
              <button
                type="button"
                key={o.key}
                onClick={() => onPref(o.key)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition ${
                  active ? "border-[var(--c-accent)] bg-[var(--c-accent)] text-[var(--c-bg)]" : "border-[var(--c-hairline)] bg-[var(--c-panel)] text-[var(--c-ink-2)] hover:border-[var(--c-accent)]/40"
                }`}
              >
                <Icon size={13} /> {t(o.label)}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
