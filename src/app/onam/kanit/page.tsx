"use client";

// Onay Kanıtı (Consent Proof) — kullanıcının kendi onam kaydının bağımsız doğrulanabilir ispatı.
// Onaylanan metin sürümü + hash · cihaz · IP · zaman · hash-zinciri mührü · (test) RFC 3161 zaman damgası + doğrulama.
// Yazdır → PDF (print:hidden çubuk gizlenir → temiz belge).
import { useEffect, useState } from "react";
import { ShieldCheck, ShieldAlert, Printer, Loader2, Fingerprint, Clock, Link2, FileText } from "lucide-react";

// v6.211: kapsam sekmeleri — telesağlık (GENERAL_KVKK) · Doctorium aydınlatma · Doctorium sözleşme · diploma
// beyanı. Kaydı olmayan kapsam "kayıt yok" gösterir; "metin eşleşmesi" her kapsamın kendi kanonik metnine
// göre ölçülür (lib/doctorium-consent canonicalTextFor — ekran = hash kararının doğrulaması).
const SCOPES: { key: string; label: string }[] = [
  { key: "GENERAL_KVKK", label: "Telesağlık (KVKK)" },
  { key: "DOCTORIUM_KVKK", label: "Doctorium aydınlatma" },
  { key: "DOCTORIUM_TERMS", label: "Doctorium sözleşme" },
  { key: "DOCTORIUM_DIPLOMA_BEYAN", label: "Diploma beyanı" },
];

interface Proof {
  title?: string;
  userId: string; scope: string; version: number; currentVersion: number;
  grantedAt: string; ip: string | null; userAgent: string | null; channel: string;
  textHash: string | null; canonicalTextHash: string; prevHash: string | null; entryHash: string | null;
  tsAuthority: string | null; tsTime: string | null; tsToken: string | null;
  verification: { hasProofLayer: boolean; entryHashValid: boolean | null; timestampValid: boolean | null; textHashMatches: boolean | null };
}

export default function ConsentProofPage() {
  const [proof, setProof] = useState<Proof | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "none" | "auth">("loading");
  const [scope, setScope] = useState<string>(SCOPES[0].key);

  // "loading" durumu sekme tıklamasında (olay içinde) set edilir — effect gövdesinde senkron setState
  // React Compiler kuralına takılır (v6.183 lint rejimi); effect yalnız fetch'i başlatır.
  useEffect(() => {
    fetch(`/api/consent/proof?scope=${encodeURIComponent(scope)}`)
      .then(async (r) => {
        if (r.status === 401) { setState("auth"); return; }
        if (r.status === 404) { setState("none"); return; }
        if (!r.ok) { setState("none"); return; }
        setProof(await r.json());
        setState("ok");
      })
      .catch(() => setState("none"));
  }, [scope]);

  const tabs = (
    <div className="print:hidden mb-5 flex flex-wrap gap-2" role="tablist" aria-label="Onam kapsamı">
      {SCOPES.map((s) => (
        <button
          key={s.key}
          role="tab"
          aria-selected={scope === s.key}
          onClick={() => { if (s.key !== scope) { setState("loading"); setScope(s.key); } }}
          className={`rounded-full border px-3 py-1 text-[12px] transition-colors ${
            scope === s.key
              ? "border-[var(--c-accent)] bg-[var(--c-accent)] text-[var(--c-bg)]"
              : "border-[var(--c-hairline)] text-[var(--c-ink-2)] hover:border-[var(--c-accent)]"
          }`}
        >
          {s.label}
        </button>
      ))}
    </div>
  );

  if (state === "auth") {
    return <div className="mx-auto max-w-2xl px-5 py-16 text-center text-[var(--c-ink-2)]">Onay kanıtınızı görmek için giriş yapın.</div>;
  }
  if (state === "loading") {
    return <div className="mx-auto max-w-2xl px-5 py-10">{tabs}<div className="py-6 text-center text-[var(--c-ink-3)]"><Loader2 className="mx-auto animate-spin" /> Onay kanıtı yükleniyor…</div></div>;
  }
  if (state === "none" || !proof) {
    return <div className="mx-auto max-w-2xl px-5 py-10">{tabs}<div className="py-6 text-center text-[var(--c-ink-2)]">Bu kapsamda henüz bir onay kaydınız yok.</div></div>;
  }

  const v = proof.verification;
  const sealed = v.hasProofLayer;
  // entryHashValid null = mühürsüz eski kayıt VEYA başka ortamın anahtarı (unknown-key) — bozukluk
  // kanıtı değil → amber uyarıya düşürme; yalnız KESİN false'lar uyarı üretir.
  const allValid = sealed && v.entryHashValid !== false && v.timestampValid !== false && v.textHashMatches !== false;

  return (
    <div className="print-doc mx-auto max-w-2xl px-5 py-10">
      {tabs}
      <div className={`rounded-3xl border p-5 flex items-start gap-3 ${allValid ? "border-emerald-400/25 bg-emerald-500/10" : "border-amber-400/25 bg-amber-500/10"}`}>
        {allValid ? <ShieldCheck className="mt-0.5 shrink-0 text-emerald-300" /> : <ShieldAlert className="mt-0.5 shrink-0 text-amber-300" />}
        <div>
          <h1 className={`font-bold ${allValid ? "text-emerald-200" : "text-amber-200"}`}>Onay Kanıtı (Consent Proof)</h1>
          <p className={`mt-0.5 text-sm ${allValid ? "text-emerald-200/90" : "text-amber-200/90"}`}>
            {sealed
              ? (allValid ? "Bu onam kaydı mühürlü ve bütünlüğü doğrulandı — kayıt verildiği tarihten beri değiştirilmemiştir." : "Bu kayıt mühürlü ancak doğrulama tam geçmedi (aşağıya bakın).")
              : "Bu kayıt eski sürümde alınmış olup ispat katmanı (hash-zinciri + zaman damgası) içermiyor. Güncel sürümde yeniden onam verildiğinde mühürlenir."}
          </p>
        </div>
      </div>

      {/* Doğrulama rozetleri */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Badge ok={sealed} label="Mühürlü kayıt" />
        <Badge ok={v.entryHashValid} label="Bütünlük (hash)" />
        <Badge ok={v.timestampValid} label="Zaman damgası" />
        <Badge ok={v.textHashMatches} label="Metin eşleşmesi" />
      </div>

      <div className="mt-6 rounded-3xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-6 shadow-sm space-y-4">
        <Row
          icon={<FileText size={14} />}
          k="Onaylanan metin"
          v={`${proof.title ?? "KVKK Aydınlatma & Açık Rıza"} · ${proof.currentVersion === 0 ? `Kayıt #${proof.version}` : `Sürüm ${proof.version}${proof.version !== proof.currentVersion ? ` (güncel: ${proof.currentVersion})` : ""}`}`}
        />
        <Row icon={<Fingerprint size={14} />} k="Metin hash (SHA-256)" v={proof.textHash ?? "—"} mono />
        <Row icon={<Clock size={14} />} k="Onay zamanı" v={fmt(proof.grantedAt)} />
        <Row icon={<Clock size={14} />} k="Zaman damgası (TSA)" v={proof.tsTime ? `${fmt(proof.tsTime)} · ${proof.tsAuthority ?? ""}` : "—"} />
        <Row icon={<Link2 size={14} />} k="Kayıt mührü (entryHash)" v={proof.entryHash ?? "—"} mono />
        <Row icon={<Link2 size={14} />} k="Önceki mühür (zincir)" v={proof.prevHash ?? "—"} mono />
        <Row icon={<Fingerprint size={14} />} k="Zaman damgası token" v={proof.tsToken ?? "—"} mono />
        <Row icon={<FileText size={14} />} k="Kanal · Cihaz" v={`${proof.channel} · ${proof.userAgent ?? "—"}`} />
        <Row icon={<FileText size={14} />} k="IP" v={proof.ip ?? "—"} />
      </div>

      <div className="mt-4 rounded-2xl bg-[var(--c-surface)] px-4 py-3 text-xs text-[var(--c-ink-2)]">
        ⚖️ Bu belge KVKK/GDPR ispat yükümlülüğü için onam kaydının bütünlük kanıtıdır. Zaman damgası otoritesi şu an
        <b> test/yerel (SIMULATED-LOCAL)</b>; üretimde yasal geçerli bir RFC 3161 TSA (ör. TÜBİTAK BİLGEM) bağlanacaktır.
      </div>

      <div className="print:hidden mt-6">
        <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg bg-[var(--c-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--c-bg)] hover:bg-[var(--c-accent-strong)]">
          <Printer size={16} /> Yazdır / PDF olarak kaydet
        </button>
      </div>
    </div>
  );
}

function Badge({ ok, label }: { ok: boolean | null; label: string }) {
  const tone = ok === true ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-300" : ok === false ? "border-red-400/25 bg-red-500/10 text-red-300" : "border-[var(--c-hairline)] bg-[var(--c-surface)] text-[var(--c-ink-3)]";
  return (
    <div className={`rounded-2xl border px-3 py-2.5 text-center ${tone}`}>
      <div className="text-base font-bold">{ok === true ? "✓" : ok === false ? "✗" : "—"}</div>
      <div className="mt-0.5 text-[11px] font-medium leading-tight">{label}</div>
    </div>
  );
}

function Row({ icon, k, v, mono }: { icon: React.ReactNode; k: string; v: string; mono?: boolean }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 aura-mono text-[11px] uppercase tracking-[0.2em] text-[var(--c-ink-3)]">{icon} {k}</div>
      <div className={`mt-0.5 break-all text-sm ${mono ? "font-mono text-xs text-[var(--c-ink-2)]" : "text-[var(--c-ink)]"}`}>{v}</div>
    </div>
  );
}

function fmt(iso: string): string {
  try {
    return new Intl.DateTimeFormat("tr-TR", { dateStyle: "long", timeStyle: "medium", timeZone: "Europe/Istanbul" }).format(new Date(iso));
  } catch { return iso; }
}
