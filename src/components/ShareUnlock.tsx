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
    <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-amber-100 text-amber-700">
          <Lock size={22} />
        </span>
        <div>
          <h1 className="text-lg font-bold text-[#0f2a4a]">Şifre korumalı paylaşım</h1>
          <p className="text-sm text-slate-500">
            {recipient ? `Sayın ${recipient}, ` : ""}bu sağlık kaydını görüntülemek için hastanın size ayrıca ilettiği erişim şifresini girin.
          </p>
        </div>
      </div>

      <label className="mt-5 block text-sm font-medium text-slate-700">Erişim şifresi</label>
      <input
        autoFocus
        value={pw}
        onChange={(e) => setPw(e.target.value)}
        type="password"
        placeholder="••••••"
        className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />

      {error && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      <button
        type="submit"
        disabled={busy}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#0f2a4a] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#143a63] disabled:opacity-50"
      >
        <ShieldCheck size={16} /> {busy ? "Doğrulanıyor…" : "Görüntüle"}
      </button>
    </form>
  );
}
