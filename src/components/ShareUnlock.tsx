"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, ShieldCheck, AlertCircle } from "lucide-react";

export function ShareUnlock({ id, recipient }: { id: string; recipient: string | null }) {
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/shares/${id}/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Şifre doğrulanamadı.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hata oluştu.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-3xl border border-white/10 bg-[#161719] p-6 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-amber-500/15 text-amber-300">
          <Lock size={22} />
        </span>
        <div>
          <h1 className="text-lg font-bold text-[#F4F5F3]">Şifre korumalı paylaşım</h1>
          <p className="text-sm text-white/50">
            {recipient ? `Sayın ${recipient}, ` : ""}bu sağlık kaydını görüntülemek için hastanın size ayrıca ilettiği erişim şifresini girin.
          </p>
        </div>
      </div>

      <label className="mt-5 block text-sm font-medium text-white/75">Erişim şifresi</label>
      <input
        autoFocus
        value={pw}
        onChange={(e) => setPw(e.target.value)}
        type="password"
        placeholder="••••••"
        className="mt-1.5 w-full rounded-lg border border-white/15 px-3 py-2 text-sm"
      />

      {error && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      <button
        type="submit"
        disabled={busy}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#28C8D8] px-4 py-2.5 text-sm font-semibold text-[#0D0E10] hover:bg-[#1FA9B8] disabled:opacity-50"
      >
        <ShieldCheck size={16} /> {busy ? "Doğrulanıyor…" : "Görüntüle"}
      </button>
    </form>
  );
}
