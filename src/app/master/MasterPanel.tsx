"use client";

import { useMemo, useState } from "react";
import { ROLE_LABELS, ROLES, type Role } from "@/lib/session";
import { ShieldCheck, Search, LogIn, Loader2, AlertTriangle, KeyRound } from "lucide-react";

// Bürünme hedefi: doğrudan User, ya da (giriş hesabı olmayan) Doctor/PartnerDoctor profili
// (sunucu gölge hesap açar). Tam biçim: api/master/impersonate.
export type Target = { userId: string } | { doctorId: string } | { partnerId: string };

export type Entry = {
  key: string;
  target: Target;
  name: string;
  subtitle: string;
  role: string;
  hasLogin: boolean; // false → giriş hesabı yok (Doctor/PartnerDoctor profili; bürününce gölge hesap açılır)
  isSelf: boolean;
  createdAt: string;
};

const ROLE_CHIP: Record<string, string> = {
  PATIENT: "text-emerald-300 ring-emerald-400/30 bg-emerald-500/10",
  DOCTOR: "text-[var(--c-accent)] ring-[var(--c-accent)]/30 bg-[var(--c-accent)]/10",
  COORDINATOR: "text-amber-300 ring-amber-400/30 bg-amber-500/10",
  ETHICS: "text-violet-300 ring-violet-400/30 bg-violet-500/10",
  ADMIN: "text-rose-300 ring-rose-400/30 bg-rose-500/10",
  PARTNER: "text-sky-300 ring-sky-400/30 bg-sky-500/10",
  AGENCY: "text-orange-300 ring-orange-400/30 bg-orange-500/10",
};

export function MasterPanel({ entries, masterEmail }: { entries: Entry[]; masterEmail: string }) {
  const [q, setQ] = useState("");
  const [role, setRole] = useState<string>("ALL");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const e of entries) c[e.role] = (c[e.role] ?? 0) + 1;
    return c;
  }, [entries]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return entries.filter(
      (e) =>
        (role === "ALL" || e.role === role) &&
        (!needle || `${e.name} ${e.subtitle}`.toLowerCase().includes(needle)),
    );
  }, [entries, q, role]);

  async function impersonate(entry: Entry) {
    setBusy(entry.key);
    setErr("");
    try {
      const res = await fetch("/api/master/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry.target),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Bürünme başarısız.");
      // Tam reload — yeni oturum kimliği (layout getCurrentUser cache'i tazelensin).
      window.location.assign(j.redirect || "/");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Bürünme başarısız.");
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-5 py-10">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-rose-500/15 text-rose-300 ring-1 ring-rose-400/30">
          <ShieldCheck size={22} />
        </span>
        <div>
          <h1 className="text-xl font-bold text-[var(--c-ink)]">Master Paneli</h1>
          <p className="text-sm text-[var(--c-ink-2)]">
            Herhangi bir hesaba ya da doktor profiline bürünebilirsin. Giriş hesabı olmayan
            doktorlara bürününce arka planda gölge hesap açılır. Her bürünme audit&apos;e yazılır.
          </p>
        </div>
        <span className="ml-auto hidden rounded-full bg-[var(--c-ink)]/5 px-3 py-1 text-xs text-[var(--c-ink-2)] ring-1 ring-[var(--c-hairline)] sm:inline">
          {masterEmail}
        </span>
      </div>

      {/* Arama */}
      <div className="mt-6 flex items-center gap-2 rounded-xl border border-[var(--c-hairline)] bg-[var(--c-surface)] px-3">
        <Search size={16} className="text-[var(--c-ink-3)]" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ad, branş veya e-posta ara…"
          className="w-full bg-transparent py-2.5 text-sm text-[var(--c-ink)] outline-none placeholder:text-[var(--c-ink-3)]"
        />
      </div>

      {/* Rol filtreleri */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Chip active={role === "ALL"} onClick={() => setRole("ALL")}>
          Tümü <span className="text-[var(--c-ink-3)]">{entries.length}</span>
        </Chip>
        {ROLES.filter((r) => counts[r]).map((r) => (
          <Chip key={r} active={role === r} onClick={() => setRole(r)}>
            {ROLE_LABELS[r as Role]} <span className="text-[var(--c-ink-3)]">{counts[r]}</span>
          </Chip>
        ))}
      </div>

      {err && (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300 ring-1 ring-red-400/25">
          <AlertTriangle size={15} /> {err}
        </div>
      )}

      {/* Liste */}
      <div className="mt-4 space-y-2">
        {filtered.length === 0 && <div className="rounded-xl bg-[var(--c-surface)] px-4 py-8 text-center text-sm text-[var(--c-ink-3)]">Eşleşen kayıt yok.</div>}
        {filtered.map((e) => (
          <div key={e.key} className="flex items-center gap-3 rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-panel)] px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate font-semibold text-[var(--c-ink)]">{e.name}</span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${ROLE_CHIP[e.role] ?? "text-[var(--c-ink-2)] ring-[var(--c-hairline)] bg-[var(--c-ink)]/5"}`}>
                  {ROLE_LABELS[e.role as Role] ?? e.role}
                </span>
                {!e.hasLogin && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--c-ink)]/5 px-2 py-0.5 text-[10px] font-medium text-[var(--c-ink-3)] ring-1 ring-[var(--c-hairline)]" title="Giriş hesabı yok — bürününce gölge hesap açılır">
                    <KeyRound size={10} /> giriş yok
                  </span>
                )}
              </div>
              {e.subtitle && <div className="truncate text-xs text-[var(--c-ink-3)]">{e.subtitle}</div>}
            </div>
            <button
              onClick={() => impersonate(e)}
              disabled={e.isSelf || busy !== null}
              title={e.isSelf ? "Kendi hesabınız" : "Bu kimliğe bürün"}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-rose-500/15 px-3 py-1.5 text-xs font-semibold text-rose-200 ring-1 ring-rose-400/30 hover:bg-rose-500/25 disabled:opacity-40"
            >
              {busy === e.key ? <Loader2 size={14} className="animate-spin" /> : <LogIn size={14} />}
              {e.isSelf ? "Siz" : "Bürün"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 transition ${
        active ? "bg-[var(--c-accent)] text-[var(--c-bg)] ring-[var(--c-accent)]" : "bg-[var(--c-ink)]/5 text-[var(--c-ink-2)] ring-[var(--c-hairline)] hover:bg-[var(--c-ink)]/10"
      }`}
    >
      {children}
    </button>
  );
}
