"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SCOPES, DURATIONS, durationLabel, scopeLabel, type ScopeKey } from "@/lib/share";
import {
  FileText, ScanLine, FlaskConical, Stethoscope,
  Share2, Copy, Check, Trash2, Lock, Download, Clock, Eye, Plus,
  MessageCircle, MessageSquare, Mail, ShieldCheck, Link2, AlertCircle,
} from "lucide-react";

const SCOPE_ICON = { EPIKRIZ: FileText, RADYOLOJI: ScanLine, LAB: FlaskConical, GORUSME_NOTU: Stethoscope } as const;

interface CaseOpt { id: string; patientName: string; branch: string; country: string }
interface LinkData {
  id: string; token: string; recipientName: string | null; scopes: string[];
  expiresAt: string | null; revokedAt: string | null; allowDownload: boolean;
  createdAt: string; caseName: string; caseBranch: string; accessCount: number; lastAccess: string | null;
}

type ShareState = "ACTIVE" | "EXPIRED" | "REVOKED";
function stateOf(l: LinkData): ShareState {
  if (l.revokedAt) return "REVOKED";
  if (l.expiresAt && new Date(l.expiresAt).getTime() < Date.now()) return "EXPIRED";
  return "ACTIVE";
}
const STATE_META: Record<ShareState, { label: string; badge: string }> = {
  ACTIVE: { label: "Aktif", badge: "bg-emerald-100 text-emerald-700 ring-emerald-200" },
  EXPIRED: { label: "Süresi doldu", badge: "bg-slate-100 text-slate-600 ring-slate-200" },
  REVOKED: { label: "İptal edildi", badge: "bg-red-100 text-red-700 ring-red-200" },
};

function fmt(d: string | null): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" }).format(new Date(d));
}

function buildMessage(url: string, recipient: string, duration: string, hasPassword: boolean): string {
  return (
    `Sağlık kayıtlarımı sizinle güvenli olarak paylaştım.${recipient ? ` (Alıcı: ${recipient})` : ""}\n` +
    `Görüntülemek için: ${url}\n` +
    `Erişim süresi: ${duration}.` +
    (hasPassword ? `\nErişim şifresini ayrıca ileteceğim.` : "")
  );
}

function ShareActions({ url, recipient, duration, hasPassword, compact }: {
  url: string; recipient: string; duration: string; hasPassword: boolean; compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const msg = buildMessage(url, recipient, duration, hasPassword);

  async function copy() {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch {}
  }
  async function nativeShare() {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try { await navigator.share({ title: "Air — Güvenli Sağlık Paylaşımı", text: msg, url }); } catch {}
    } else { copy(); }
  }

  const btn = "inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button onClick={nativeShare} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#0E9E97] px-3 py-2 text-sm font-semibold text-white hover:bg-[#0A7D77]">
        <Share2 size={15} /> Paylaş
      </button>
      {!compact && (
        <>
          <a href={`https://wa.me/?text=${encodeURIComponent(msg)}`} target="_blank" rel="noopener noreferrer" className={btn}><MessageCircle size={15} /> WhatsApp</a>
          <a href={`mailto:?subject=${encodeURIComponent("Güvenli Sağlık Paylaşımı")}&body=${encodeURIComponent(msg)}`} className={btn}><Mail size={15} /> E-posta</a>
          <a href={`sms:?body=${encodeURIComponent(msg)}`} className={btn}><MessageSquare size={15} /> SMS</a>
        </>
      )}
      <button onClick={copy} className={btn}>
        {copied ? <><Check size={15} className="text-emerald-600" /> Kopyalandı</> : <><Copy size={15} /> Kopyala</>}
      </button>
    </div>
  );
}

export function ShareManager({ cases, links }: { cases: CaseOpt[]; links: LinkData[] }) {
  const router = useRouter();
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  const [caseId, setCaseId] = useState(cases[0]?.id ?? "");
  const [recipient, setRecipient] = useState("");
  const [scopes, setScopes] = useState<ScopeKey[]>(["EPIKRIZ"]);
  const [durationKey, setDurationKey] = useState("7d");
  const [allowDownload, setAllowDownload] = useState(false);
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{ url: string; recipient: string; duration: string; hasPassword: boolean } | null>(null);

  function toggleScope(k: ScopeKey) {
    setScopes((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));
  }

  async function create() {
    setError("");
    if (!caseId) { setError("Lütfen bir sağlık kaydı seçin."); return; }
    if (scopes.length === 0) { setError("En az bir veri kategorisi seçin."); return; }
    if (usePassword && password.trim().length < 3) { setError("Erişim şifresi en az 3 karakter olmalı."); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId, scopes, durationKey, allowDownload,
          recipientName: recipient.trim() || undefined,
          password: usePassword ? password.trim() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Bağlantı oluşturulamadı.");
      setCreated({
        url: `${window.location.origin}/paylasim/${data.token}`,
        recipient: recipient.trim(),
        duration: durationLabel(durationKey),
        hasPassword: usePassword,
      });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Hata oluştu.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    await fetch(`/api/shares/${id}`, { method: "PATCH" });
    router.refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_minmax(320px,380px)]">
      {/* Sol: yeni paylaşım oluştur */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 font-bold text-slate-800"><Plus size={18} /> Yeni güvenli paylaşım</h2>
        <p className="mt-1 text-sm text-slate-500">Hangi verinin, kim tarafından, ne kadar süre görülebileceğine siz karar verirsiniz.</p>

        <label className="mt-5 block text-sm font-medium text-slate-700">Sağlık kaydı</label>
        <select value={caseId} onChange={(e) => setCaseId(e.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
          {cases.length === 0 && <option value="">Kayıt bulunamadı</option>}
          {cases.map((c) => <option key={c.id} value={c.id}>{c.patientName} · {c.branch}</option>)}
        </select>

        <label className="mt-4 block text-sm font-medium text-slate-700">Alıcı doktor <span className="font-normal text-slate-400">(opsiyonel)</span></label>
        <input value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="ör. Dr. Smith" className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />

        <div className="mt-4 text-sm font-medium text-slate-700">Paylaşılacak veriler</div>
        <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
          {SCOPES.map((s) => {
            const Icon = SCOPE_ICON[s.key];
            const on = scopes.includes(s.key);
            return (
              <button type="button" key={s.key} onClick={() => toggleScope(s.key)}
                className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition-colors ${on ? "border-[#0E9E97] bg-[#0E9E97]/5 ring-1 ring-[#0E9E97]/20" : "border-slate-200 hover:bg-slate-50"}`}>
                <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg ${on ? "bg-[#0E9E97] text-white" : "bg-slate-100 text-slate-500"}`}><Icon size={16} /></span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-sm font-medium text-slate-800">{s.label} {on && <Check size={14} className="text-[#0A3F39]" />}</span>
                  <span className="block text-xs text-slate-500">{s.desc}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-4 text-sm font-medium text-slate-700">Erişim süresi</div>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {DURATIONS.map((d) => (
            <button type="button" key={d.key} onClick={() => setDurationKey(d.key)}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${durationKey === d.key ? "border-[#0E9E97] bg-[#0E9E97] text-white" : "border-slate-300 text-slate-600 hover:bg-slate-50"}`}>
              {d.label}
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-2.5">
          <label className="flex items-center gap-2.5 text-sm text-slate-700">
            <input type="checkbox" checked={allowDownload} onChange={(e) => setAllowDownload(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
            <Download size={15} className="text-slate-400" /> İndirmeye izin ver <span className="text-slate-400">(varsayılan: yalnız görüntüleme)</span>
          </label>
          <label className="flex items-center gap-2.5 text-sm text-slate-700">
            <input type="checkbox" checked={usePassword} onChange={(e) => setUsePassword(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
            <Lock size={15} className="text-slate-400" /> Erişim şifresi ekle
          </label>
          {usePassword && (
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="text" placeholder="Doktora ayrı kanaldan ileteceğiniz şifre" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          )}
        </div>

        {error && <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"><AlertCircle size={15} /> {error}</div>}

        <button onClick={create} disabled={busy} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#0E9E97] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0A7D77] disabled:opacity-50">
          <ShieldCheck size={16} /> {busy ? "Oluşturuluyor…" : "Güvenli link oluştur"}
        </button>

        {created && (
          <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-emerald-800"><Check size={16} /> Bağlantı hazır — şimdi paylaşın</div>
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs text-slate-600">
              <Link2 size={14} className="shrink-0 text-slate-400" /> <span className="truncate">{created.url}</span>
            </div>
            <div className="mt-3"><ShareActions url={created.url} recipient={created.recipient} duration={created.duration} hasPassword={created.hasPassword} /></div>
          </div>
        )}
      </div>

      {/* Sağ: aktif paylaşımlar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 font-bold text-slate-800">
          <Link2 size={18} /> Paylaşımlarım <span className="text-sm font-normal text-slate-400">({links.length})</span>
        </h2>
        {links.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">Henüz paylaşım oluşturmadınız.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {links.map((l) => {
              const st = stateOf(l);
              const meta = STATE_META[st];
              const url = `${origin}/paylasim/${l.token}`;
              return (
                <li key={l.id} className="rounded-xl border border-slate-200 p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-800">{l.recipientName || "Paylaşılan kişi"}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${meta.badge}`}>{meta.label}</span>
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">{l.caseName} · {l.caseBranch}</div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {l.scopes.map((s) => <span key={s} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">{scopeLabel(s)}</span>)}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                    <span className="inline-flex items-center gap-1"><Clock size={12} /> {l.expiresAt ? `Bitiş ${fmt(l.expiresAt)}` : "Süresiz"}</span>
                    <span className="inline-flex items-center gap-1"><Eye size={12} /> {l.accessCount} erişim{l.lastAccess ? ` · son ${fmt(l.lastAccess)}` : ""}</span>
                    {l.allowDownload && <span className="inline-flex items-center gap-1"><Download size={12} /> indirilebilir</span>}
                  </div>
                  {st === "ACTIVE" && (
                    <div className="mt-2.5 flex items-center gap-2">
                      <ShareActions url={url} recipient={l.recipientName || ""} duration={l.expiresAt ? `bitiş ${fmt(l.expiresAt)}` : "süresiz"} hasPassword={false} compact />
                      <button onClick={() => revoke(l.id)} className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-2.5 py-2 text-sm font-medium text-red-600 hover:bg-red-50">
                        <Trash2 size={14} /> İptal
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
