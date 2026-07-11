"use client";

// Onay Kanıtı (Consent Proof) — kullanıcının kendi onam kaydının bağımsız doğrulanabilir ispatı.
// Onaylanan metin sürümü + hash · cihaz · IP · zaman · hash-zinciri mührü · (test) RFC 3161 zaman damgası + doğrulama.
// Yazdır → PDF (print:hidden çubuk gizlenir → temiz belge).
import { useEffect, useState } from "react";
import { ShieldCheck, ShieldAlert, Printer, Loader2, Fingerprint, Clock, Link2, FileText } from "lucide-react";

interface Proof {
  userId: string; scope: string; version: number; currentVersion: number;
  grantedAt: string; ip: string | null; userAgent: string | null; channel: string;
  textHash: string | null; canonicalTextHash: string; prevHash: string | null; entryHash: string | null;
  tsAuthority: string | null; tsTime: string | null; tsToken: string | null;
  verification: { hasProofLayer: boolean; entryHashValid: boolean | null; timestampValid: boolean | null; textHashMatches: boolean | null };
}

export default function ConsentProofPage() {
  const [proof, setProof] = useState<Proof | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "none" | "auth">("loading");

  useEffect(() => {
    fetch("/api/consent/proof")
      .then(async (r) => {
        if (r.status === 401) { setState("auth"); return; }
        if (r.status === 404) { setState("none"); return; }
        if (!r.ok) { setState("none"); return; }
        setProof(await r.json());
        setState("ok");
      })
      .catch(() => setState("none"));
  }, []);

  if (state === "loading") {
    return <div className="mx-auto max-w-2xl px-5 py-16 text-center text-white/40"><Loader2 className="mx-auto animate-spin" /> Onay kanıtı yükleniyor…</div>;
  }
  if (state === "auth") {
    return <div className="mx-auto max-w-2xl px-5 py-16 text-center text-white/50">Onay kanıtınızı görmek için giriş yapın.</div>;
  }
  if (state === "none" || !proof) {
    return <div className="mx-auto max-w-2xl px-5 py-16 text-center text-white/50">Henüz bir onay kaydınız yok.</div>;
  }

  const v = proof.verification;
  const sealed = v.hasProofLayer;
  // entryHashValid null = mühürsüz eski kayıt VEYA başka ortamın anahtarı (unknown-key) — bozukluk
  // kanıtı değil → amber uyarıya düşürme; yalnız KESİN false'lar uyarı üretir.
  const allValid = sealed && v.entryHashValid !== false && v.timestampValid !== false && v.textHashMatches !== false;

  return (
    <div className="print-doc mx-auto max-w-2xl px-5 py-10">
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

      <div className="mt-6 rounded-3xl border border-white/10 bg-[#161719] p-6 shadow-sm space-y-4">
        <Row icon={<FileText size={14} />} k="Onaylanan metin" v={`KVKK Aydınlatma & Açık Rıza · Sürüm ${proof.version}${proof.version !== proof.currentVersion ? ` (güncel: ${proof.currentVersion})` : ""}`} />
        <Row icon={<Fingerprint size={14} />} k="Metin hash (SHA-256)" v={proof.textHash ?? "—"} mono />
        <Row icon={<Clock size={14} />} k="Onay zamanı" v={fmt(proof.grantedAt)} />
        <Row icon={<Clock size={14} />} k="Zaman damgası (TSA)" v={proof.tsTime ? `${fmt(proof.tsTime)} · ${proof.tsAuthority ?? ""}` : "—"} />
        <Row icon={<Link2 size={14} />} k="Kayıt mührü (entryHash)" v={proof.entryHash ?? "—"} mono />
        <Row icon={<Link2 size={14} />} k="Önceki mühür (zincir)" v={proof.prevHash ?? "—"} mono />
        <Row icon={<Fingerprint size={14} />} k="Zaman damgası token" v={proof.tsToken ?? "—"} mono />
        <Row icon={<FileText size={14} />} k="Kanal · Cihaz" v={`${proof.channel} · ${proof.userAgent ?? "—"}`} />
        <Row icon={<FileText size={14} />} k="IP" v={proof.ip ?? "—"} />
      </div>

      <div className="mt-4 rounded-2xl bg-[#1E1F22] px-4 py-3 text-xs text-white/50">
        ⚖️ Bu belge KVKK/GDPR ispat yükümlülüğü için onam kaydının bütünlük kanıtıdır. Zaman damgası otoritesi şu an
        <b> test/yerel (SIMULATED-LOCAL)</b>; üretimde yasal geçerli bir RFC 3161 TSA (ör. TÜBİTAK BİLGEM) bağlanacaktır.
      </div>

      <div className="print:hidden mt-6">
        <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg bg-[#28C8D8] px-4 py-2.5 text-sm font-semibold text-[#0D0E10] hover:bg-[#1FA9B8]">
          <Printer size={16} /> Yazdır / PDF olarak kaydet
        </button>
      </div>
    </div>
  );
}

function Badge({ ok, label }: { ok: boolean | null; label: string }) {
  const tone = ok === true ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-300" : ok === false ? "border-red-400/25 bg-red-500/10 text-red-300" : "border-white/10 bg-[#1E1F22] text-white/40";
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
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-white/40">{icon} {k}</div>
      <div className={`mt-0.5 break-all text-sm ${mono ? "font-mono text-xs text-white/65" : "text-[#F4F5F3]"}`}>{v}</div>
    </div>
  );
}

function fmt(iso: string): string {
  try {
    return new Intl.DateTimeFormat("tr-TR", { dateStyle: "long", timeStyle: "medium", timeZone: "Europe/Istanbul" }).format(new Date(iso));
  } catch { return iso; }
}
