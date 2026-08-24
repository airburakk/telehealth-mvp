import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { normalizeBranchPrefs } from "@/lib/doctorium";
import {
  SURVEY_KINDS, SURVEY_STATUSES, MIN_OPTIONS, MAX_OPTIONS, canActivateSurvey,
} from "@/lib/survey";
import { MAX_SURVEY_POINTS } from "@/lib/rewards";

export const dynamic = "force-dynamic";

// Doctorium anket yönetimi (v6.69 Faz 2) — ADMIN küratörlü, self-auth (/api/admin/sponsor deseni).
// ⚠️ HONORARIUM KİLİDİ (fail-closed): honorarium > 0 anket ACTIVE EDİLEMEZ — ödeme/vergi kurgusu
// (👤 gider pusulası ↔ SM makbuzu · GİB özelgesi · kamu doktoru) netleşmeden "ödenir" vaadi yok.

function parseDate(v: unknown): Date | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const d = new Date(`${v}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseCityList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.filter((s): s is string => typeof s === "string" && !!s.trim()).map((s) => s.trim().slice(0, 60)))].slice(0, 30);
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const kind = typeof b.kind === "string" ? b.kind : "";
  if (!(SURVEY_KINDS as readonly string[]).includes(kind)) {
    return NextResponse.json({ error: "Geçersiz anket türü." }, { status: 400 });
  }

  const sponsor = typeof b.sponsor === "string" ? b.sponsor.trim().slice(0, 200) : "";
  if (kind === "SPONSORED" && sponsor.length < 2) {
    return NextResponse.json({ error: "Sponsorlu ankette reklamveren adı zorunlu." }, { status: 400 });
  }

  const question = typeof b.question === "string" ? b.question.trim().slice(0, 300) : "";
  if (question.length < 5) return NextResponse.json({ error: "Soru en az 5 karakter olmalı." }, { status: 400 });

  const options = Array.isArray(b.options)
    ? b.options.filter((o: unknown): o is string => typeof o === "string" && !!o.trim()).map((o: string) => o.trim().slice(0, 120))
    : [];
  if (options.length < MIN_OPTIONS || options.length > MAX_OPTIONS) {
    return NextResponse.json({ error: `Şık sayısı ${MIN_OPTIONS}-${MAX_OPTIONS} arası olmalı.` }, { status: 400 });
  }

  // Honorarium: kuruş, yalnız SPONSORED'da anlamlı. >0 kaydedilebilir (kurgu hazırlığı) ama
  // ACTIVE edilemez — kilit PATCH'te. COMMUNITY'de daima null.
  const honorariumRaw = Number.isInteger(b.honorarium) ? (b.honorarium as number) : 0;
  const honorarium = kind === "SPONSORED" && honorariumRaw > 0 ? honorariumRaw : null;

  // Ödül puanı (v6.88): her iki türde serbest (kullanıcı kararı 2026-08-11 — topluluk anketi de
  // puan taşıyabilir). Nakit honorarium kilidinden BAĞIMSIZ: puanlı anket yayınlanabilir.
  const points = Number.isInteger(b.points) ? (b.points as number) : 0;
  if (points < 0 || points > MAX_SURVEY_POINTS) {
    return NextResponse.json({ error: `Puan 0-${MAX_SURVEY_POINTS} arası olmalı.` }, { status: 400 });
  }

  const startsAt = parseDate(b.startsAt);
  const endsAt = parseDate(b.endsAt);
  if (!startsAt || !endsAt) return NextResponse.json({ error: "Başlangıç ve bitiş tarihi zorunlu." }, { status: 400 });
  if (endsAt < startsAt) return NextResponse.json({ error: "Bitiş tarihi başlangıçtan önce olamaz." }, { status: 400 });

  const row = await db.survey.create({
    data: {
      kind,
      sponsor: kind === "SPONSORED" ? sponsor : null,
      question,
      options: JSON.stringify(options),
      honorarium,
      points,
      targetBranches: JSON.stringify(normalizeBranchPrefs(b.targetBranches)),
      // Şehir hedefi yalnız SPONSORED'da anlamlı (COMMUNITY içerik rejimi şehirle süzülmez).
      targetCities: JSON.stringify(kind === "SPONSORED" ? parseCityList(b.targetCities) : []),
      startsAt, endsAt,
    },
    select: { id: true },
  });
  return NextResponse.json({ ok: true, id: row.id });
}

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const id = typeof b.id === "string" ? b.id : "";
  const status = typeof b.status === "string" ? b.status : "";
  if (!id) return NextResponse.json({ error: "id zorunlu." }, { status: 400 });
  if (!(SURVEY_STATUSES as readonly string[]).includes(status)) {
    return NextResponse.json({ error: "Geçersiz durum." }, { status: 400 });
  }

  const row = await db.survey.findUnique({ where: { id }, select: { honorarium: true } });
  if (!row) return NextResponse.json({ error: "Anket bulunamadı." }, { status: 404 });

  if (status === "ACTIVE" && !canActivateSurvey(row)) {
    return NextResponse.json(
      { error: "Ödeme kurgusu (vergi/makbuz) netleşmeden ücretli anket yayına alınamaz." },
      { status: 400 },
    );
  }

  await db.survey.update({ where: { id }, data: { status } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!id) return NextResponse.json({ error: "id zorunlu." }, { status: 400 });

  const row = await db.survey.findUnique({ where: { id }, select: { status: true } });
  if (!row) return NextResponse.json({ error: "Anket bulunamadı." }, { status: 404 });
  if (row.status !== "DRAFT") {
    return NextResponse.json({ error: "Yalnız taslak (DRAFT) anket silinebilir; yayınlanmışı ENDED yapın." }, { status: 400 });
  }
  await db.survey.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
