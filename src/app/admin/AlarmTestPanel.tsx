"use client";

import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { AuraButton } from "@/components/ui/AuraButton";

// Alarm kanalı tatbikat düğmesi (2026-09-12) — /admin "Alarm kanalı" bloğu.
// Sunucu, env durumunu (alıcı MASKELİ + sağlayıcı var/yok) prop'la geçirir: client env GÖREMEZ ve bu
// sayede daha tıklamadan "bu dağıtımda ALERT_EMAIL var mı?" okunur — iki Vercel projesine env AYRI
// girildiği için bu satır bir parite kontrolüdür. Tıklama: POST /api/admin/alarm-test →
// lib/alerts sendAlert("alarm-test") → gerçek log satırı + gerçek e-posta (aynı 30 dk cooldown).
type Props = { recipient: string | null; providerConfigured: boolean };

type Outcome = { tone: "ok" | "warn" | "err"; text: string };

interface ApiResult {
  ok?: boolean;
  result?: { logged: boolean; emailed: boolean; suppressed: "cooldown" | "test" | null };
  recipient?: string | null;
  providerConfigured?: boolean;
  error?: string;
}

const TONE: Record<Outcome["tone"], string> = {
  ok: "text-[var(--c-success)]",
  warn: "text-amber-400",
  err: "text-[var(--c-danger)]",
};

// sendAlert sonucunu insan-okur cümleye çevirir — her dal gerçek bir durum, "başarılı" sanısı yok.
function outcomeOf(r: ApiResult): Outcome {
  const res = r.result;
  if (!res) return { tone: "err", text: r.error ?? "Beklenmeyen yanıt." };
  if (res.suppressed === "cooldown") {
    return { tone: "warn", text: "Aynı test son 30 dakika içinde gönderilmiş — bekleme penceresi (cooldown) tekrarı bastırdı; günlük satırı da yazılmadı. Daha sonra yeniden deneyin." };
  }
  if (res.suppressed === "test") return { tone: "warn", text: "Test ortamında alarmlar bilinçle susar." };
  if (res.emailed) {
    return { tone: "ok", text: `Test alarmı gönderildi → ${r.recipient ?? "alıcı"}. Gelen kutunuzda "alarm-test" konulu iletiyi arayın (birkaç dakika sürebilir; spam klasörünü de kontrol edin).` };
  }
  if (!r.recipient) return { tone: "warn", text: "ALERT_EMAIL bu dağıtımda tanımsız: alarm yalnız sunucu günlüğüne düştü ([ALERT] alarm-test). E-posta için Vercel env'ine alıcı adres girilip yeniden dağıtılmalı." };
  if (!r.providerConfigured) return { tone: "warn", text: "E-posta sağlayıcısı (RESEND_API_KEY) bu dağıtımda yok: alarm yalnız sunucu günlüğüne düştü." };
  return { tone: "err", text: "Günlük satırı yazıldı ama e-posta sağlayıcı tarafından KABUL EDİLMEDİ — Vercel günlüğünde \"[email] Resend\" satırına bakın (gönderici domain doğrulaması / anahtar)." };
}

export function AlarmTestPanel({ recipient, providerConfigured }: Props) {
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  async function fire() {
    setBusy(true);
    setOutcome(null);
    try {
      const res = await fetch("/api/admin/alarm-test", { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as ApiResult;
      if (!res.ok) setOutcome({ tone: "err", text: body.error ?? `İstek başarısız (${res.status}).` });
      else setOutcome(outcomeOf(body));
    } catch {
      setOutcome({ tone: "err", text: "Ağ hatası — istek gönderilemedi." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        <dt className="text-[var(--c-ink-3)]">Alıcı</dt>
        <dd className="font-mono text-[var(--c-ink)]">{recipient ?? "— (ALERT_EMAIL tanımsız)"}</dd>
        <dt className="text-[var(--c-ink-3)]">Sağlayıcı</dt>
        <dd className="text-[var(--c-ink)]">{providerConfigured ? "Resend yapılandırılmış" : "yapılandırılmamış (RESEND_API_KEY yok)"}</dd>
      </dl>
      <div className="flex flex-col items-start gap-2 sm:items-end">
        <AuraButton type="button" variant="secondary" size="sm" onClick={fire} disabled={busy}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          Test alarmı gönder
        </AuraButton>
        {outcome && (
          <p role="status" className={`max-w-sm text-xs leading-relaxed ${TONE[outcome.tone]} sm:text-right`}>
            {outcome.text}
          </p>
        )}
      </div>
    </div>
  );
}
