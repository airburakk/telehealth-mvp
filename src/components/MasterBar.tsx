"use client";

// Master üst bandı — iki mod:
//  • impersonating: bürünme oturumu aktif → "X olarak geziyorsun · Master'a dön" (kırmızı, dikkat çeker).
//  • master: bürünmemiş master → küçük "Master modu · Panel" kısayolu.
// Header'dan bağımsız (paylaşılan Header'a dokunmamak için) layout üstünde render edilir.

import Link from "next/link";
import { useState } from "react";
import { ShieldCheck, LogOut, Loader2 } from "lucide-react";

export function MasterBar({ mode, userName }: { mode: "master" | "impersonating"; userName?: string }) {
  const [busy, setBusy] = useState(false);

  async function stop() {
    setBusy(true);
    try {
      const res = await fetch("/api/master/stop", { method: "POST" });
      const j = await res.json().catch(() => ({}));
      window.location.assign(j.redirect || "/master");
    } catch {
      setBusy(false);
    }
  }

  if (mode === "impersonating") {
    return (
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-rose-600 px-4 py-2 text-center text-xs font-medium text-white sm:text-sm">
        <ShieldCheck size={15} className="shrink-0" />
        <span>
          <b>{userName}</b> olarak geziyorsun · master bürünme
        </span>
        <button
          onClick={stop}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-md bg-white/20 px-2.5 py-1 font-semibold hover:bg-white/30 disabled:opacity-60"
        >
          {busy ? <Loader2 size={13} className="animate-spin" /> : <LogOut size={13} />} Master&apos;a dön
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-2 bg-rose-500/15 px-4 py-1.5 text-center text-xs text-rose-200 ring-1 ring-inset ring-rose-400/20">
      <ShieldCheck size={13} /> Master modu
      <Link href="/master" className="font-semibold underline underline-offset-2 hover:text-rose-100">
        Panel
      </Link>
    </div>
  );
}
