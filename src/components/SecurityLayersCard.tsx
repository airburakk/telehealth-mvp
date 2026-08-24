"use client";

import { useState } from "react";
import { ShieldCheck, Smartphone, Mail, PhoneCall, Check, Loader2, Info } from "lucide-react";

// AŞAMA 2 — Güvenlik Doğrulamaları bölümü (v6.127; metinler kullanıcı onaylı 2026-08-19).
// GÖRÜNÜRLÜK bu bileşende DEĞİL sunucudadır: page yalnız `verifyUiVisible()` doğruysa render eder
// (kanal aktif değilken kod gönderemeyen kart doktoru boşuna uğraştırır — kullanıcı kararı).
// Kapı SUNUCUDA (canActivate + AURA_LAYER_GATE); buradaki her şey GÖSTERİM + OTP akışı istemcisi.
// 🔒 Kod/telefon/e-posta bu bileşenden loglanmaz; sunucu yanıtındaki `simulated` bayrağı
// "kanal henüz aktif değil" uyarısına çevrilir (dürüstlük — kod gitmediyse gitti denmez).

export interface SecurityInitial {
  smsVerified: boolean;
  workEmailVerified: boolean;
  clinicPhoneVerified: boolean;
  clinicPhoneEstablishment: string | null;
  /** AURA_LAYER_GATE=1 mi — kapalıyken "yakında zorunlu olacak" dili kullanılmaz, nötr anlatım. */
  gateOn: boolean;
}

export function SecurityLayersCard({ initial }: { initial: SecurityInitial }) {
  const [sms, setSms] = useState(initial.smsVerified);
  const [email, setEmail] = useState(initial.workEmailVerified);

  return (
    <div className="mt-8">
      <div className="flex items-center gap-2 text-sm font-bold text-[var(--c-ink)]">
        <ShieldCheck size={16} className="text-[var(--c-accent-strong)]" /> Güvenlik Doğrulamaları
      </div>
      <p className="mt-1 text-xs text-[var(--c-ink-2)]">
        Klinik havuzlara katılmadan önce kimliğinizi iki kanaldan teyit ediyoruz:{" "}
        <strong>cep telefonunuz</strong> (zorunlu) ve <strong>kurum bağınız</strong> (iş e-postası{" "}
        <em>veya</em> klinik telefonu — biri yeterli).
        {!initial.gateOn && " Bu doğrulamaları şimdiden tamamlayabilirsiniz."}
      </p>

      <div className="mt-3 space-y-3">
        <OtpCard
          channel="sms"
          icon={<Smartphone size={18} />}
          title="Cep telefonu"
          zorunlu
          done={sms}
          doneText="Telefon numaranız doğrulandı."
          targetLabel="Cep telefonu numaranız"
          targetPlaceholder="05xx xxx xx xx"
          startHint="Numaranıza tek kullanımlık kod göndereceğiz."
          onVerified={() => setSms(true)}
        />
        <OtpCard
          channel="work-email"
          icon={<Mail size={18} />}
          title="İş e-postası"
          done={email}
          doneText="İş e-postanız doğrulandı."
          targetLabel="Kurumsal e-posta adresiniz"
          targetPlaceholder="ad.soyad@kurum.edu.tr"
          startHint="Hastane/üniversite e-posta adresinize kod göndereceğiz. Serbest e-posta adresleri (gmail, hotmail…) kabul edilmez."
          onVerified={() => setEmail(true)}
        />

        {/* Klinik telefonu — doktor tarafında AKIŞ YOK (insan-işletimli): yalnız durum anlatılır. */}
        <div className={`rounded-3xl border p-4 ${initial.clinicPhoneVerified ? "border-emerald-400/25 bg-emerald-500/10" : "border-[var(--c-hairline)] bg-[var(--c-panel)]"}`}>
          <div className="flex items-start gap-3">
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${initial.clinicPhoneVerified ? "bg-emerald-500 text-white" : "bg-[var(--c-ink)]/10 text-[var(--c-ink-3)]"}`}>
              {initial.clinicPhoneVerified ? <Check size={18} /> : <PhoneCall size={18} />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-[var(--c-ink)]">Klinik telefonu teyidi</div>
              {initial.clinicPhoneVerified ? (
                <p className="mt-0.5 text-xs text-[var(--c-ink-2)]">
                  Kurumunuz{initial.clinicPhoneEstablishment ? ` (${initial.clinicPhoneEstablishment})` : ""} resmî
                  telefonundan aranarak teyit edildi.
                </p>
              ) : (
                <p className="mt-0.5 text-xs text-[var(--c-ink-2)]">
                  İş e-postanız yoksa alternatif: koordinatörümüz, çalıştığınız kurumun{" "}
                  <strong>resmî numarasından</strong> sizi arayarak teyit eder. Bu teyit ekibimizce
                  yürütülür — sizin bir işlem yapmanız gerekmez.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Tek OTP kartı: hedef gir → kod iste → kodu doğrula. Sunucu `simulated` derse dürüst uyarı.
function OtpCard({
  channel, icon, title, zorunlu, done, doneText, targetLabel, targetPlaceholder, startHint, onVerified,
}: {
  channel: "sms" | "work-email";
  icon: React.ReactNode;
  title: string;
  zorunlu?: boolean;
  done: boolean;
  doneText: string;
  targetLabel: string;
  targetPlaceholder: string;
  startHint: string;
  onVerified: () => void;
}) {
  const [target, setTarget] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"idle" | "sent">("idle");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [simulated, setSimulated] = useState(false);

  async function start() {
    setErr(""); setBusy(true);
    try {
      const r = await fetch(`/api/doctor/verify/${channel}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Kod gönderilemedi.");
      setSimulated(!!d.simulated);
      setStage("sent");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Hata oluştu.");
    } finally { setBusy(false); }
  }

  async function confirm() {
    setErr(""); setBusy(true);
    try {
      const r = await fetch(`/api/doctor/verify/${channel}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Doğrulanamadı.");
      onVerified();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Hata oluştu.");
    } finally { setBusy(false); }
  }

  const inputCls = "w-full rounded-xl border border-[var(--c-hairline)] bg-[var(--c-panel)] px-3 py-2 text-sm text-[var(--c-ink)] placeholder:text-[var(--c-ink-3)] focus:border-[var(--c-accent)] focus:outline-none";

  return (
    <div className={`rounded-3xl border p-4 ${done ? "border-emerald-400/25 bg-emerald-500/10" : zorunlu ? "border-amber-400/25 bg-amber-500/10" : "border-[var(--c-hairline)] bg-[var(--c-panel)]"}`}>
      <div className="flex items-start gap-3">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${done ? "bg-emerald-500 text-white" : zorunlu ? "bg-amber-400 text-white" : "bg-[var(--c-ink)]/10 text-[var(--c-ink-3)]"}`}>
          {done ? <Check size={18} /> : icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--c-ink)]">
            {title}
            {zorunlu ? (
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-300">Zorunlu</span>
            ) : (
              <span className="rounded-full bg-[var(--c-ink)]/10 px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--c-ink-2)]">Kurum bağı</span>
            )}
          </div>

          {done ? (
            <p className="mt-1 text-xs text-emerald-300">{doneText}</p>
          ) : (
            <>
              <p className="mt-0.5 text-xs text-[var(--c-ink-2)]">{startHint}</p>
              {stage === "idle" ? (
                <div className="mt-2 flex gap-2">
                  <label className="sr-only">{targetLabel}</label>
                  <input value={target} onChange={(e) => setTarget(e.target.value)} placeholder={targetPlaceholder}
                    className={inputCls} inputMode={channel === "sms" ? "tel" : "email"} />
                  <button type="button" onClick={start} disabled={busy || !target.trim()}
                    className="shrink-0 rounded-xl bg-[var(--c-accent)] px-3.5 py-2 text-xs font-semibold text-[var(--c-bg)] transition hover:bg-[var(--c-accent-strong)] disabled:opacity-50">
                    {busy ? <Loader2 size={14} className="animate-spin" /> : "Kod gönder"}
                  </button>
                </div>
              ) : (
                <div className="mt-2">
                  {simulated && (
                    <p className="mb-2 flex items-center gap-1.5 rounded-xl bg-amber-500/10 px-3 py-2 text-[11px] text-amber-300 ring-1 ring-amber-400/20">
                      <Info size={13} className="shrink-0" /> Gönderim kanalı henüz aktif değil — kod iletilemedi. Bu adımı daha sonra tamamlayabilirsiniz.
                    </p>
                  )}
                  <div className="flex gap-2">
                    <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="6 haneli kod" className={inputCls} inputMode="numeric" />
                    <button type="button" onClick={confirm} disabled={busy || code.length !== 6}
                      className="shrink-0 rounded-xl bg-[var(--c-accent)] px-3.5 py-2 text-xs font-semibold text-[var(--c-bg)] transition hover:bg-[var(--c-accent-strong)] disabled:opacity-50">
                      {busy ? <Loader2 size={14} className="animate-spin" /> : "Doğrula"}
                    </button>
                  </div>
                  <button type="button" onClick={() => { setStage("idle"); setCode(""); }} className="mt-1.5 text-[11px] font-medium text-[var(--c-ink-3)] hover:text-[var(--c-ink-2)]">
                    Farklı {channel === "sms" ? "numara" : "adres"} kullan / yeni kod iste
                  </button>
                </div>
              )}
            </>
          )}
          {err && <p className="mt-1.5 text-xs text-red-300">{err}</p>}
        </div>
      </div>
    </div>
  );
}
