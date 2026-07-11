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
    <div dir={dir} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2"
      >
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <NotebookPen size={14} className="text-[#1FA9B8]" /> {t(TX.title)}
        </span>
        {open ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
      </button>

      {open && (
        <div className="mt-3">
          <p className="text-[11px] leading-relaxed text-slate-400">{t(TX.hint)}</p>
          <textarea
            value={note}
            onChange={(e) => onNote(e.target.value)}
            rows={4}
            placeholder={t(TX.placeholder)}
            className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-[#0D0E10] outline-none placeholder:text-slate-400 focus:border-[#28C8D8] focus:bg-white"
          />
          {note.trim() && <p className="mt-1 text-[11px] text-slate-400">{t(TX.saved)}</p>}
        </div>
      )}
    </div>
  );
}
