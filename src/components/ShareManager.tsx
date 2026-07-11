"use client";

// Güvenli paylaşım yöneticisi (hasta-yüzü) — çok dilli (8+ dil) + RTL. Dil `lang` prop'undan gelir
// (tek kaynak: SharesView). Sabit TR metinler `ST`'de toplanır + lib/share label'ları useT ile çevrilir.
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SCOPES, DURATIONS, durationLabel, scopeLabel, type ScopeKey } from "@/lib/share";
import { useT } from "@/components/useT";
import { langDir, LANG_BCP47 } from "@/lib/constants";
import {
  FileText, ScanLine, FlaskConical, Stethoscope,
  Share2, Copy, Check, Trash2, Lock, Download, Clock, Eye, Plus,
  MessageCircle, MessageSquare, Mail, ShieldCheck, Link2, AlertCircle,
  ArrowRight, ArrowLeft,
} from "lucide-react";

const SCOPE_ICON = { EPIKRIZ: FileText, RADYOLOJI: ScanLine, LAB: FlaskConical, GORUSME_NOTU: Stethoscope } as const;

export interface CaseOpt { id: string; patientName: string; branch: string; country: string }
export interface LinkData {
  id: string; token: string; recipientName: string | null; scopes: string[];
  expiresAt: string | null; revokedAt: string | null; allowDownload: boolean;
  createdAt: string; caseName: string; caseBranch: string; accessCount: number; lastAccess: string | null;
}

type T = (s: string) => string;

// Tüm TR sabit metinler — useT bunları hedef dile çevirir (lang="Türkçe" ise no-op).
const ST = {
  // Durum rozetleri
  stActive: "Aktif",
  stExpired: "Süresi doldu",
  stRevoked: "İptal edildi",
  // Paylaşım mesajı (WhatsApp/e-posta/SMS gövdesi — hasta kendi dilinde okur)
  msgShared: "Sağlık kayıtlarımı sizinle güvenli olarak paylaştım.",
  msgRecipient: "Alıcı",
  msgView: "Görüntülemek için",
  msgDuration: "Erişim süresi",
  msgPassword: "Erişim şifresini ayrıca ileteceğim.",
  // Paylaş aksiyonları
  shareTitle: "AURA — Güvenli Sağlık Paylaşımı",
  mailSubject: "Güvenli Sağlık Paylaşımı",
  share: "Paylaş",
  email: "E-posta",
  copied: "Kopyalandı",
  copy: "Kopyala",
  // Adım rayı
  stepsAria: "Paylaşım adımları",
  stepSelect: "Seç",
  stepProtect: "Koru",
  stepShare: "Paylaş",
  // Yeni paylaşım — Adım 1
  newShare: "Yeni güvenli paylaşım",
  newShareDesc: "Hangi verinin, kim tarafından, ne kadar süre görülebileceğine adım adım siz karar verirsiniz.",
  record: "Sağlık kaydı",
  noRecord: "Kayıt bulunamadı",
  recipientDoctor: "Alıcı doktor",
  optional: "(opsiyonel)",
  recipientPlaceholder: "ör. Dr. Lefèvre",
  dataToShare: "Paylaşılacak veriler",
  next: "Devam",
  // Adım 2
  accessDuration: "Erişim süresi",
  allowDownload: "İndirmeye izin ver",
  viewOnlyDefault: "(varsayılan: yalnız görüntüleme)",
  addPassword: "Erişim şifresi ekle",
  passwordPlaceholder: "Doktora ayrı kanaldan ileteceğiniz şifre",
  recipientSees: "Alıcının göreceği",
  noDataYet: "Henüz veri seçilmedi.",
  downloadable: "indirilebilir",
  viewOnly: "yalnız görüntüleme",
  encrypted: "şifreli",
  back: "Geri",
  // Adım 3
  linkReady: "Bağlantı hazır — şimdi paylaşın",
  newShareLink: "Yeni paylaşım",
  finalCheck: "Son kontrol",
  recipient: "Alıcı",
  notSpecified: "Belirtilmedi",
  recordCol: "Kayıt",
  dataCol: "Veriler",
  durationCol: "Süre",
  protectionCol: "Koruma",
  creating: "Oluşturuluyor…",
  createSecureLink: "Güvenli link oluştur",
  // Sağ panel — liste
  myShares: "Paylaşımlarım",
  emptyTitle: "İlk güvenli paylaşımınızı oluşturun",
  emptyDesc: "Soldaki formdan bir sağlık kaydı seçin; hangi verinin, kim tarafından, ne kadar süre görülebileceğine siz karar verin.",
  sharedPerson: "Paylaşılan kişi",
  ends: "Bitiş",
  noExpiry: "Süresiz",
  accessN: "erişim",
  lastAccess: "son",
  revokeQ: "Bağlantı iptal edilsin mi?",
  revokeBody: "İptal, bu bağlantıyla yeni erişimi anında durdurur. Daha önce görüntülenen veya indirilen veriler geri alınamaz.",
  revoking: "İptal ediliyor…",
  revokeYes: "Evet, iptal et",
  revokeCancel: "Vazgeç",
  revoke: "İptal",
  // Hatalar
  errNoRecord: "Lütfen bir sağlık kaydı seçin.",
  errNoScope: "En az bir veri kategorisi seçin.",
  errPassword: "Erişim şifresi en az 3 karakter olmalı.",
  errCreate: "Bağlantı oluşturulamadı.",
  errGeneric: "Hata oluştu.",
} as const;

type ShareState = "ACTIVE" | "EXPIRED" | "REVOKED";
function stateOf(l: LinkData): ShareState {
  if (l.revokedAt) return "REVOKED";
  if (l.expiresAt && new Date(l.expiresAt).getTime() < Date.now()) return "EXPIRED";
  return "ACTIVE";
}
const STATE_BADGE: Record<ShareState, string> = {
  ACTIVE: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/25",
  EXPIRED: "bg-white/10 text-white/65 ring-white/10",
  REVOKED: "bg-red-500/15 text-red-300 ring-red-400/25",
};
const STATE_LABEL: Record<ShareState, string> = {
  ACTIVE: ST.stActive, EXPIRED: ST.stExpired, REVOKED: ST.stRevoked,
};

// Tarih — alıcının/hastanın dil yereline göre; timeZone sabit (Istanbul) → SSR↔CSR hydration güvenli.
function fmt(d: string | null, locale: string): string {
  if (!d) return "—";
  return new Date(d).toLocaleString(locale, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" });
}

function buildMessage(url: string, recipient: string, duration: string, hasPassword: boolean, t: T): string {
  return (
    `${t(ST.msgShared)}${recipient ? ` (${t(ST.msgRecipient)}: ${recipient})` : ""}\n` +
    `${t(ST.msgView)}: ${url}\n` +
    `${t(ST.msgDuration)}: ${duration}.` +
    (hasPassword ? `\n${t(ST.msgPassword)}` : "")
  );
}

function ShareActions({ url, recipient, duration, hasPassword, compact, t }: {
  url: string; recipient: string; duration: string; hasPassword: boolean; compact?: boolean; t: T;
}) {
  const [copied, setCopied] = useState(false);
  const msg = buildMessage(url, recipient, duration, hasPassword, t);

  async function copy() {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch {}
  }
  async function nativeShare() {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try { await navigator.share({ title: t(ST.shareTitle), text: msg, url }); } catch {}
    } else { copy(); }
  }

  const btn = "inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-[#161719] px-3 py-2 text-sm font-medium text-white/75 hover:bg-[#1E1F22]";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button onClick={nativeShare} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#28C8D8] px-3 py-2 text-sm font-semibold text-[#0D0E10] hover:bg-[#1FA9B8]">
        <Share2 size={15} /> {t(ST.share)}
      </button>
      {!compact && (
        <>
          <a href={`https://wa.me/?text=${encodeURIComponent(msg)}`} target="_blank" rel="noopener noreferrer" className={btn}><MessageCircle size={15} /> WhatsApp</a>
          <a href={`mailto:?subject=${encodeURIComponent(t(ST.mailSubject))}&body=${encodeURIComponent(msg)}`} className={btn}><Mail size={15} /> {t(ST.email)}</a>
          <a href={`sms:?body=${encodeURIComponent(msg)}`} className={btn}><MessageSquare size={15} /> SMS</a>
        </>
      )}
      <button onClick={copy} className={btn}>
        {copied ? <><Check size={15} className="text-emerald-300" /> {t(ST.copied)}</> : <><Copy size={15} /> {t(ST.copy)}</>}
      </button>
    </div>
  );
}

// Adım rayı — Seç → Koru → Paylaş (DESIGN.md: ekran başına tek karar; kaygı azaltma).
function StepRail({ step, t }: { step: number; t: T }) {
  const labels = [t(ST.stepSelect), t(ST.stepProtect), t(ST.stepShare)];
  return (
    <div className="mt-5 flex items-center gap-2 text-xs font-medium" aria-label={t(ST.stepsAria)}>
      {labels.map((label, i) => {
        const n = i + 1;
        const done = step > n;
        const active = step === n;
        return (
          <div key={n} className="flex flex-1 items-center gap-2 last:flex-none">
            <span aria-current={active ? "step" : undefined}
              className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold ${done || active ? "bg-[#28C8D8] text-[#06262a]" : "bg-white/10 text-white/40"}`}>
              {done ? <Check size={13} /> : n}
            </span>
            <span className={active ? "text-[#F4F5F3]" : done ? "text-[#0b5563]" : "text-white/40"}>{label}</span>
            {n < 3 && <span className={`h-px flex-1 ${done ? "bg-[#28C8D8]" : "bg-white/15"}`} />}
          </div>
        );
      })}
    </div>
  );
}

export function ShareManager({ cases, links, lang }: { cases: CaseOpt[]; links: LinkData[]; lang: string }) {
  const router = useRouter();
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  // texts: ST + lib/share label'ları (SCOPES label/desc + DURATIONS label). MEMOIZE — yoksa her render
  // useT effect'ini yeniden kurar, uçuştaki çeviri fetch'i iptal olur (v2.68 dersi).
  const texts = useMemo(
    () => [...Object.values(ST), ...SCOPES.flatMap((s) => [s.label, s.desc]), ...DURATIONS.map((d) => d.label)],
    [],
  );
  const { t } = useT(lang, texts);
  const locale = LANG_BCP47[lang] ?? "tr-TR";
  const rtl = langDir(lang) === "rtl";
  const FwdArrow = rtl ? ArrowLeft : ArrowRight;
  const BackArrow = rtl ? ArrowRight : ArrowLeft;

  const [step, setStep] = useState(1);
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
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null); // iptal onayı — "ileriye-dönük" netleştirme (geçmiş erişim geri alınamaz)
  const [revoking, setRevoking] = useState(false);

  const selectedCase = cases.find((c) => c.id === caseId);

  function toggleScope(k: ScopeKey) {
    setScopes((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));
  }

  // Adım ilerletme — her adımın kendi doğrulaması (mevcut create() doğrulamasıyla aynı kurallar).
  function next() {
    setError("");
    if (step === 1) {
      if (!caseId) { setError(t(ST.errNoRecord)); return; }
      if (scopes.length === 0) { setError(t(ST.errNoScope)); return; }
      setStep(2);
    } else if (step === 2) {
      if (usePassword && password.trim().length < 3) { setError(t(ST.errPassword)); return; }
      setStep(3);
    }
  }
  function back() { setError(""); setStep((s) => Math.max(1, s - 1)); }
  function reset() { setCreated(null); setError(""); setStep(1); }

  async function create() {
    setError("");
    if (!caseId) { setError(t(ST.errNoRecord)); return; }
    if (scopes.length === 0) { setError(t(ST.errNoScope)); return; }
    if (usePassword && password.trim().length < 3) { setError(t(ST.errPassword)); return; }
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
      if (!res.ok) throw new Error(data.error || t(ST.errCreate));
      setCreated({
        url: `${window.location.origin}/paylasim/${data.token}`,
        recipient: recipient.trim(),
        duration: durationLabel(durationKey), // raw TR; render'da t() ile çevrilir
        hasPassword: usePassword,
      });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t(ST.errGeneric));
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    setRevoking(true);
    await fetch(`/api/shares/${id}`, { method: "PATCH" });
    setRevoking(false);
    setConfirmRevoke(null);
    router.refresh();
  }

  const navPrimary = "inline-flex items-center justify-center gap-2 rounded-lg bg-[#28C8D8] px-4 py-2.5 text-sm font-semibold text-[#0D0E10] hover:bg-[#1FA9B8] disabled:opacity-50";
  const navGhost = "inline-flex items-center justify-center gap-2 rounded-lg border border-white/15 px-4 py-2.5 text-sm font-medium text-white/65 hover:bg-[#1E1F22]";

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_minmax(320px,380px)]">
      {/* Sol: yeni paylaşım — 3 adımlı akış (Seç → Koru → Paylaş) */}
      <div className="rounded-3xl border border-white/10 bg-[#161719] p-6 shadow-sm">
        <h2 className="flex items-center gap-2 font-bold text-[#F4F5F3]"><Plus size={18} /> {t(ST.newShare)}</h2>
        <p className="mt-1 text-sm text-white/50">{t(ST.newShareDesc)}</p>

        <StepRail step={step} t={t} />

        {/* Adım 1 — Seç: kayıt + alıcı + veriler */}
        {step === 1 && (
          <div className="mt-5">
            <label className="block text-sm font-medium text-white/75">{t(ST.record)}</label>
            <select value={caseId} onChange={(e) => setCaseId(e.target.value)} className="mt-1.5 w-full rounded-lg border border-white/15 px-3 py-2 text-sm">
              {cases.length === 0 && <option value="">{t(ST.noRecord)}</option>}
              {cases.map((c) => <option key={c.id} value={c.id}>{c.patientName} · {c.branch}</option>)}
            </select>

            <label className="mt-4 block text-sm font-medium text-white/75">{t(ST.recipientDoctor)} <span className="font-normal text-white/40">{t(ST.optional)}</span></label>
            <input value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder={t(ST.recipientPlaceholder)} className="mt-1.5 w-full rounded-lg border border-white/15 px-3 py-2 text-sm" />

            <div className="mt-4 text-sm font-medium text-white/75">{t(ST.dataToShare)}</div>
            <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
              {SCOPES.map((s) => {
                const Icon = SCOPE_ICON[s.key];
                const on = scopes.includes(s.key);
                return (
                  <button type="button" key={s.key} onClick={() => toggleScope(s.key)}
                    className={`flex items-start gap-2.5 rounded-2xl border p-3 text-start transition-colors ${on ? "border-[#28C8D8] bg-[#28C8D8]/5 ring-1 ring-[#28C8D8]/20" : "border-white/10 hover:bg-[#1E1F22]"}`}>
                    <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg ${on ? "bg-[#28C8D8] text-[#0D0E10]" : "bg-white/10 text-white/50"}`}><Icon size={16} /></span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 text-sm font-medium text-[#F4F5F3]">{t(s.label)} {on && <Check size={14} className="text-[#F4F5F3]" />}</span>
                      <span className="block text-xs text-white/50">{t(s.desc)}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            <button onClick={next} className={`${navPrimary} mt-5 w-full`}>{t(ST.next)} <FwdArrow size={16} /></button>
          </div>
        )}

        {/* Adım 2 — Koru: süre + koruma + "alıcının göreceği" canlı önizleme */}
        {step === 2 && (
          <div className="mt-5">
            <div className="text-sm font-medium text-white/75">{t(ST.accessDuration)}</div>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {DURATIONS.map((d) => (
                <button type="button" key={d.key} onClick={() => setDurationKey(d.key)}
                  className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${durationKey === d.key ? "border-[#28C8D8] bg-[#28C8D8] text-[#0D0E10]" : "border-white/15 text-white/65 hover:bg-[#1E1F22]"}`}>
                  {t(d.label)}
                </button>
              ))}
            </div>

            <div className="mt-4 space-y-2.5">
              <label className="flex items-center gap-2.5 text-sm text-white/75">
                <input type="checkbox" checked={allowDownload} onChange={(e) => setAllowDownload(e.target.checked)} className="h-4 w-4 rounded border-white/15" />
                <Download size={15} className="text-white/40" /> {t(ST.allowDownload)} <span className="text-white/40">{t(ST.viewOnlyDefault)}</span>
              </label>
              <label className="flex items-center gap-2.5 text-sm text-white/75">
                <input type="checkbox" checked={usePassword} onChange={(e) => setUsePassword(e.target.checked)} className="h-4 w-4 rounded border-white/15" />
                <Lock size={15} className="text-white/40" /> {t(ST.addPassword)}
              </label>
              {usePassword && (
                <input value={password} onChange={(e) => setPassword(e.target.value)} type="text" placeholder={t(ST.passwordPlaceholder)} className="w-full rounded-lg border border-white/15 px-3 py-2 text-sm" />
              )}
            </div>

            {/* Canlı önizleme — alıcının tam olarak ne göreceği (somut güven; DESIGN.md: açık/klinik) */}
            <div className="mt-4 rounded-2xl border border-[#28C8D8]/30 bg-[#28C8D8]/5 p-4">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#0b5563]">
                <Eye size={13} /> {t(ST.recipientSees)}
              </div>
              <div className="mt-2.5 space-y-1.5">
                {scopes.length === 0 ? (
                  <p className="text-xs text-white/50">{t(ST.noDataYet)}</p>
                ) : (
                  SCOPES.filter((s) => scopes.includes(s.key)).map((s) => {
                    const Icon = SCOPE_ICON[s.key];
                    return <div key={s.key} className="flex items-center gap-2 text-sm text-white/75"><Icon size={15} className="text-[#1FA9B8]" /> {t(s.label)}</div>;
                  })
                )}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[#28C8D8]/20 pt-2.5 text-[11px] text-white/50">
                <span className="inline-flex items-center gap-1"><Clock size={12} /> {t(durationLabel(durationKey))}</span>
                <span className="inline-flex items-center gap-1">
                  {allowDownload ? <><Download size={12} /> {t(ST.downloadable)}</> : <><Eye size={12} /> {t(ST.viewOnly)}</>}
                </span>
                {usePassword && <span className="inline-flex items-center gap-1"><Lock size={12} /> {t(ST.encrypted)}</span>}
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <button onClick={back} className={navGhost}><BackArrow size={16} /> {t(ST.back)}</button>
              <button onClick={next} className={`${navPrimary} flex-1`}>{t(ST.next)} <FwdArrow size={16} /></button>
            </div>
          </div>
        )}

        {/* Adım 3 — Paylaş: son kontrol + oluştur → hazır bağlantı */}
        {step === 3 && (created ? (
          <div className="mt-5 rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-4">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-emerald-200"><Check size={16} /> {t(ST.linkReady)}</div>
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-emerald-400/25 bg-[#161719] px-3 py-2 text-xs text-white/65">
              <Link2 size={14} className="shrink-0 text-white/40" /> <span className="truncate">{created.url}</span>
            </div>
            <div className="mt-3"><ShareActions url={created.url} recipient={created.recipient} duration={t(created.duration)} hasPassword={created.hasPassword} t={t} /></div>
            <button onClick={reset} className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-[#1FA9B8] hover:underline"><Plus size={14} /> {t(ST.newShareLink)}</button>
          </div>
        ) : (
          <div className="mt-5">
            <div className="rounded-2xl border border-white/10 p-4">
              <div className="text-sm font-medium text-[#F4F5F3]">{t(ST.finalCheck)}</div>
              <dl className="mt-2.5 space-y-1.5 text-sm">
                <div className="flex justify-between gap-3"><dt className="text-white/50">{t(ST.recipient)}</dt><dd className="text-end text-[#F4F5F3]">{recipient.trim() || t(ST.notSpecified)}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-white/50">{t(ST.recordCol)}</dt><dd className="text-end text-[#F4F5F3]">{selectedCase ? `${selectedCase.patientName} · ${selectedCase.branch}` : "—"}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-white/50">{t(ST.dataCol)}</dt><dd className="text-end text-[#F4F5F3]">{scopes.map((k) => t(scopeLabel(k))).join(", ")}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-white/50">{t(ST.durationCol)}</dt><dd className="text-[#F4F5F3]">{t(durationLabel(durationKey))}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-white/50">{t(ST.protectionCol)}</dt><dd className="text-[#F4F5F3]">{allowDownload ? t(ST.downloadable) : t(ST.viewOnly)}{usePassword ? ` · ${t(ST.encrypted)}` : ""}</dd></div>
              </dl>
            </div>
            <div className="mt-5 flex gap-2">
              <button onClick={back} className={navGhost}><BackArrow size={16} /> {t(ST.back)}</button>
              <button onClick={create} disabled={busy} className={`${navPrimary} flex-1`}><ShieldCheck size={16} /> {busy ? t(ST.creating) : t(ST.createSecureLink)}</button>
            </div>
          </div>
        ))}

        {error && <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300"><AlertCircle size={15} /> {error}</div>}
      </div>

      {/* Sağ: aktif paylaşımlar */}
      <div className="rounded-3xl border border-white/10 bg-[#161719] p-6 shadow-sm">
        <h2 className="flex items-center gap-2 font-bold text-[#F4F5F3]">
          <Link2 size={18} /> {t(ST.myShares)} <span className="text-sm font-normal text-white/40">({links.length})</span>
        </h2>
        {links.length === 0 ? (
          <div className="mt-4 flex flex-col items-center rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-[#28C8D8]/10 text-[#1FA9B8]"><ShieldCheck size={20} /></span>
            <p className="mt-3 text-sm font-medium text-white/75">{t(ST.emptyTitle)}</p>
            <p className="mt-1 text-xs text-white/50">{t(ST.emptyDesc)}</p>
          </div>
        ) : (
          <ul className="mt-3 space-y-3">
            {links.map((l) => {
              const st = stateOf(l);
              const url = `${origin}/paylasim/${l.token}`;
              return (
                <li key={l.id} className="rounded-2xl border border-white/10 p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-[#F4F5F3]">{l.recipientName || t(ST.sharedPerson)}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${STATE_BADGE[st]}`}>{t(STATE_LABEL[st])}</span>
                  </div>
                  <div className="mt-0.5 text-xs text-white/50">{l.caseName} · {l.caseBranch}</div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {l.scopes.map((s) => <span key={s} className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white/65">{t(scopeLabel(s))}</span>)}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/50">
                    <span className="inline-flex items-center gap-1"><Clock size={12} /> {l.expiresAt ? `${t(ST.ends)} ${fmt(l.expiresAt, locale)}` : t(ST.noExpiry)}</span>
                    <span className="inline-flex items-center gap-1"><Eye size={12} /> {l.accessCount} {t(ST.accessN)}{l.lastAccess ? ` · ${t(ST.lastAccess)} ${fmt(l.lastAccess, locale)}` : ""}</span>
                    {l.allowDownload && <span className="inline-flex items-center gap-1"><Download size={12} /> {t(ST.downloadable)}</span>}
                  </div>
                  {st === "ACTIVE" && (confirmRevoke === l.id ? (
                    <div className="mt-2.5 rounded-xl border border-amber-400/25 bg-amber-500/10 p-3">
                      <p className="text-xs text-amber-200">
                        <strong>{t(ST.revokeQ)}</strong> {t(ST.revokeBody)}
                      </p>
                      <div className="mt-2.5 flex gap-2">
                        <button onClick={() => revoke(l.id)} disabled={revoking} className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
                          <Trash2 size={14} /> {revoking ? t(ST.revoking) : t(ST.revokeYes)}
                        </button>
                        <button onClick={() => setConfirmRevoke(null)} disabled={revoking} className="rounded-lg border border-white/15 px-3 py-1.5 text-sm font-medium text-white/65 hover:bg-[#1E1F22]">
                          {t(ST.revokeCancel)}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2.5 flex items-center gap-2">
                      <ShareActions url={url} recipient={l.recipientName || ""} duration={l.expiresAt ? `${t(ST.ends)} ${fmt(l.expiresAt, locale)}` : t(ST.noExpiry)} hasPassword={false} compact t={t} />
                      <button onClick={() => setConfirmRevoke(l.id)} className="ms-auto inline-flex items-center gap-1.5 rounded-lg border border-red-400/25 bg-[#161719] px-2.5 py-2 text-sm font-medium text-red-300 hover:bg-red-500/10">
                        <Trash2 size={14} /> {t(ST.revoke)}
                      </button>
                    </div>
                  ))}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
