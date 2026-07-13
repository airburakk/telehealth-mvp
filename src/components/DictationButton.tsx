"use client";

// Sesle dikte butonu — hasta intake formlarındaki semptom/şikayet kutucuklarına eklenir.
// Tarayıcı yerleşik Web Speech API (SpeechRecognition) kullanır: harici kütüphane/servis YOK,
// ses tanıma tamamen istemcide (tarayıcı motoru) → PHI sunucuya EK olarak gönderilmez (metin zaten
// textarea'ya yazılır, oradan normal intake akışıyla gider). Firefox gibi desteği olmayan
// tarayıcılarda buton hiç render edilmez (zarif geri düşüş — form davranışı değişmez).

import { useEffect, useRef, useState } from "react";
import { Mic } from "lucide-react";
import { langCodeFor } from "@/lib/constants";

// air_lang dil ADI ("Türkçe") → langCodeFor → ISO kod → Web Speech BCP-47 locale.
// SpeechRecognition.lang BCP-47 ister (tr-TR); ISO kod tek başına yetmez.
const SPEECH_LOCALE: Record<string, string> = {
  tr: "tr-TR", ar: "ar-SA", ru: "ru-RU", az: "az-AZ", fa: "fa-IR",
  fr: "fr-FR", en: "en-US", de: "de-DE", kk: "kk-KZ", ky: "ky-KG",
};

function speechLocale(langName?: string | null): string {
  const code = langCodeFor(langName);
  return (code && SPEECH_LOCALE[code]) || "tr-TR";
}

// Web Speech API — TS lib.dom bu tipleri garanti etmez, webkit öneki gerekebilir. Minimal tip.
interface SRResult { readonly isFinal: boolean; readonly length: number; [i: number]: { transcript: string } }
interface SREvent { resultIndex: number; results: { length: number; [i: number]: SRResult } }
interface SRErrorEvent { error: string }
interface SpeechRec {
  lang: string; continuous: boolean; interimResults: boolean;
  start: () => void; stop: () => void; abort: () => void;
  onresult: ((e: SREvent) => void) | null;
  onerror: ((e: SRErrorEvent) => void) | null;
  onend: (() => void) | null;
}

function getRecognition(): SpeechRec | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

// Bu bileşenin çevrilecek statik metinleri — çağıran sayfa useT tTexts'ine spread etmeli.
export const DICTATION_TEXTS = [
  "Sesle yaz", "Dinleniyor…", "Dinleniyor — durdurmak için dokunun",
  "Mikrofon izni gerekli", "Ses algılanamadı, tekrar deneyin",
];

export function DictationButton({
  lang,
  onAppend,
  t = (s) => s,
  className = "",
}: {
  lang?: string | null;
  /** Tanınan (final) metin — çağıran mevcut değere ekler. */
  onAppend: (text: string) => void;
  t?: (s: string) => string;
  className?: string;
}) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [err, setErr] = useState("");
  const recRef = useRef<SpeechRec | null>(null);

  useEffect(() => { setSupported(!!getRecognition()); }, []);
  // Unmount olurken dinlemeyi kes — mikrofon/oturum sızıntısı olmasın.
  useEffect(() => () => { try { recRef.current?.abort(); } catch {} }, []);

  function stop() {
    try { recRef.current?.stop(); } catch {}
    setListening(false);
    setInterim("");
  }

  function start() {
    setErr("");
    const rec = getRecognition();
    if (!rec) { setSupported(false); return; }
    rec.lang = speechLocale(lang);
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let finalText = "";
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interimText += r[0].transcript;
      }
      const clean = finalText.trim();
      if (clean) onAppend(clean);
      setInterim(interimText);
    };
    rec.onerror = (e) => {
      if (e?.error === "not-allowed" || e?.error === "service-not-allowed") setErr(t("Mikrofon izni gerekli"));
      else if (e?.error === "no-speech") setErr(t("Ses algılanamadı, tekrar deneyin"));
      stop();
    };
    rec.onend = () => { setListening(false); setInterim(""); };
    recRef.current = rec;
    try { rec.start(); setListening(true); } catch { setListening(false); }
  }

  if (!supported) return null; // Firefox vb. → buton gizli, form davranışı değişmez

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={() => (listening ? stop() : start())}
        aria-label={listening ? t("Dinleniyor — durdurmak için dokunun") : t("Sesle yaz")}
        title={listening ? t("Dinleniyor — durdurmak için dokunun") : t("Sesle yaz")}
        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium ring-1 transition ${
          listening
            ? "bg-red-500/15 text-red-300 ring-red-400/30"
            : "bg-white/5 text-white/70 ring-white/15 hover:bg-[#28C8D8]/10 hover:text-[#28C8D8] hover:ring-[#28C8D8]/30"
        }`}
      >
        {listening ? (
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
          </span>
        ) : (
          <Mic size={14} />
        )}
        {listening ? t("Dinleniyor…") : t("Sesle yaz")}
      </button>
      {interim && <span className="text-xs italic text-white/40">{interim}</span>}
      {err && <span className="text-xs text-red-300">{err}</span>}
    </div>
  );
}
