"use client";

import { useState } from "react";
import { Bookmark } from "lucide-react";

/**
 * Kart sağ-üst "Kaydet" düğmesi (Faz 2, 2026-08-14) — optimistic toggle; hata olursa geri alır.
 * Yalnız kaydedebilen kullanıcıda render edilir (server karar verir: saved prop'u null değilse
 * çizilir — koşullu-href ilkesinin buton hâli). Kaydetme puan ÜRETMEZ.
 */
export function SaveButton({ articleId, initialSaved }: { articleId: string; initialSaved: boolean }) {
  const [saved, setSaved] = useState(initialSaved);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    const next = !saved;
    setSaved(next); // optimistic
    try {
      const res = await fetch("/api/doctorium/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId }),
      });
      if (!res.ok) throw new Error();
      const j = (await res.json()) as { saved?: boolean };
      setSaved(!!j.saved);
    } catch {
      setSaved(!next); // geri al — sessiz başarısızlık yerine görsel geri dönüş
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={saved}
      title={saved ? "Kaydedildi — kaldırmak için tıklayın" : "Kaydet"}
      className={`-mr-1 -mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg transition ${
        saved
          ? "text-emerald-300 hover:bg-emerald-500/10"
          : "text-[var(--c-ink-3)] hover:bg-[var(--c-surface-2)] hover:text-[var(--c-ink)]"
      }`}
    >
      <Bookmark size={16} fill={saved ? "currentColor" : "none"} />
    </button>
  );
}
