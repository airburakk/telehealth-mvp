"use client";

import { useEffect, useRef, useState } from "react";
import { leaveConsentGate } from "./leave-gate";
import { Loader2 } from "lucide-react";

// Onam seti tam ama JWT `cv` eski (proxy /onam'a attı) → kayıt yazmadan oturumu yeniden imzala ve geç.
// (v6.211) Aksi hâlde proxy ↔ /onam sonsuz döngüye girerdi: sayfa redirect edemez, çünkü çerezi
// yalnız bir route handler yazabilir. Çıkış TAM SAYFA gezintisidir (2026-09-15): router.replace üretimde Header
// ön-yüklemelerinin bayat-çerezli 307'sini önbellekten kullanıp buraya geri dönüyor, spinner asılı kalıyordu (leave-gate.ts).
export function ConsentResign({ dest }: { dest: string }) {
  const [err, setErr] = useState("");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    fetch("/api/consent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "resign" }) })
      .then((r) => { if (!r.ok) throw new Error(); leaveConsentGate(dest, "replace"); })
      .catch(() => setErr("Oturum yenilenemedi. Sayfayı yenileyin veya yeniden giriş yapın."));
  }, [dest]);

  return (
    <div className="mx-auto max-w-2xl px-5 py-16 text-center text-sm text-[var(--c-ink-2)]">
      {err ? <p className="text-red-300">{err}</p> : <p className="inline-flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Onay durumunuz doğrulanıyor…</p>}
    </div>
  );
}
