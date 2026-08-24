"use client";

// Hasta "doktora sorular" notu — görüşme odasında görünür + düzenlenebilir panel.
// Bekleme odasında (PreConsultLobby B3) yazılan not AYNI localStorage anahtarından okunur
// (air_preconsult_note_${storageKey}) → otomatik senkron; cihaz-yerel (doktora gösterilmez).
// Görüşme sırasında hasta sorularını görür, işaretler, yeni soru ekler.

import { useEffect, useMemo, useState } from "react";
import { NotebookPen, ChevronDown, ChevronUp } from "lucide-react";
import { useT } from "@/components/useT";
import { langDir } from "@/lib/constants";

const TX = {
  title: "Doktora sorularım",
  hint: "Bekleme odasında not aldıysanız burada görünür; görüşme sırasında düzenleyebilirsiniz.",
  placeholder: "Doktora sormak istediğiniz soruları buraya not edin…",
  saved: "Notlarınız bu cihaza kaydedildi.",
} as const;

export function PatientQuestionsPanel({
  storageKey,
  lang,
  variant = "card",
}: {
  storageKey: string;
  lang: string;
  /**
   * "card"  → kendi kartını çizer (lobi/scroll alanı içi kullanım).
   * "sheet" → VideoCallShell'in ALT SABİT RAYI içinde alt-tabaka (v6.134): kendi zeminini/
   *   kenarlığını çizmez, ray zaten yüzeydir. Kapalıyken tek satır + soru sayısı rozeti,
   *   açılınca yukarı doğru büyür (ray shrink-0 → orta scroll alanı kısalır).
   */
  variant?: "card" | "sheet";
}) {
  const texts = useMemo(() => Object.values(TX), []);
  const { t } = useT(lang, texts);
  const dir = langDir(lang);
  const key = `air_preconsult_note_${storageKey}`;

  const [note, setNote] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem(key);
      // Not varsa KART modunda panel açık başlar (görünürlük = talebin özü). TABAKA modunda
      // açık başlamaz: rozet zaten "kaç sorum var"ı gösteriyor ve açık tabaka orta scroll
      // alanından yer çalardı — görünürlük yerden ödün almadan sağlanır.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- kalıcı not yalnız istemcide (SSR'de localStorage yok)
      if (v) { setNote(v); if (variant === "card") setOpen(true); }
    } catch {}
  }, [key, variant]);

  const onNote = (v: string) => {
    setNote(v);
    try { localStorage.setItem(key, v); } catch {}
  };

  const sheet = variant === "sheet";
  // Rozet sayısı = boş olmayan satır sayısı (hasta sorularını satır satır yazıyor). Kapalı
  // tabakada "kaç sorum var" bilgisini yer kaplamadan taşır.
  const count = note.split("\n").filter((l) => l.trim()).length;

  return (
    <div
      dir={dir}
      className={sheet ? "" : "rounded-3xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-4 shadow-sm"}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`flex w-full items-center justify-between gap-2 ${sheet ? "min-h-11" : ""}`}
      >
        <span className="aura-mono flex items-center gap-1.5 text-[11px] uppercase tracking-[0.2em] text-[var(--c-ink-2)]">
          <NotebookPen size={14} className="text-[var(--c-accent-strong)]" /> {t(TX.title)}
          {sheet && count > 0 && (
            <span className="ms-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--c-accent)]/15 px-1.5 text-[11px] font-semibold tabular-nums text-[var(--c-accent)] ring-1 ring-[var(--c-accent)]/25">
              {count}
            </span>
          )}
        </span>
        {open ? <ChevronUp size={16} className="text-[var(--c-ink-3)]" /> : <ChevronDown size={16} className="text-[var(--c-ink-3)]" />}
      </button>

      {open && (
        <div className={sheet ? "mt-2 pb-1" : "mt-3"}>
          <p className="text-[11px] leading-relaxed text-[var(--c-ink-3)]">{t(TX.hint)}</p>
          <textarea
            value={note}
            onChange={(e) => onNote(e.target.value)}
            rows={sheet ? 3 : 4}
            placeholder={t(TX.placeholder)}
            className="mt-2 w-full resize-none rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-surface)] px-3 py-2.5 text-sm text-[var(--c-ink)] outline-none placeholder:text-[var(--c-ink-3)] focus:border-[var(--c-accent)] focus:bg-[var(--c-surface)]"
          />
          {note.trim() && <p className="mt-1 text-[11px] text-[var(--c-ink-3)]">{t(TX.saved)}</p>}
        </div>
      )}
    </div>
  );
}
