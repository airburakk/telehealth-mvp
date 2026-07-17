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

export function PatientQuestionsPanel({ storageKey, lang }: { storageKey: string; lang: string }) {
  const texts = useMemo(() => Object.values(TX), []);
  const { t } = useT(lang, texts);
  const dir = langDir(lang);
  const key = `air_preconsult_note_${storageKey}`;

  const [note, setNote] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- kalıcı not yalnız istemcide (SSR'de localStorage yok)
    try {
      const v = localStorage.getItem(key);
      if (v) { setNote(v); setOpen(true); } // not varsa panel açık başlar (görünürlük = talebin özü)
    } catch {}
  }, [key]);

  const onNote = (v: string) => {
    setNote(v);
    try { localStorage.setItem(key, v); } catch {}
  };

  return (
    <div dir={dir} className="rounded-3xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-4 shadow-sm">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2"
      >
        <span className="flex items-center gap-1.5 aura-mono text-[11px] uppercase tracking-[0.2em] text-[var(--c-ink-2)]">
          <NotebookPen size={14} className="text-[var(--c-accent-strong)]" /> {t(TX.title)}
        </span>
        {open ? <ChevronUp size={16} className="text-[var(--c-ink-3)]" /> : <ChevronDown size={16} className="text-[var(--c-ink-3)]" />}
      </button>

      {open && (
        <div className="mt-3">
          <p className="text-[11px] leading-relaxed text-[var(--c-ink-3)]">{t(TX.hint)}</p>
          <textarea
            value={note}
            onChange={(e) => onNote(e.target.value)}
            rows={4}
            placeholder={t(TX.placeholder)}
            className="mt-2 w-full resize-none rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-surface)] px-3 py-2.5 text-sm text-[var(--c-ink)] outline-none placeholder:text-[var(--c-ink-3)] focus:border-[var(--c-accent)] focus:bg-[var(--c-surface)]"
          />
          {note.trim() && <p className="mt-1 text-[11px] text-[var(--c-ink-3)]">{t(TX.saved)}</p>}
        </div>
      )}
    </div>
  );
}
