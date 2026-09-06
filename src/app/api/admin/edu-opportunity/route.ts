import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { EDU_KIND_LABEL } from "@/lib/edu-opportunities";

// Kariyer EDU küratör API'si (E2, 2026-09-06) — ADMIN. Self-auth (middleware /api'yi korumaz).
//   POST   { kind, title, organizer, country?, deadline?|deadlineNote, startsAt?, eligibility, sourceUrl, verifiedAt?, approve? } → kayıt
//   PATCH  { id, approved: boolean }  → 👤 yayın onayı ver / kaldır (approvedAt)
//   DELETE { id }                     → kayıt + takipleri sil
// ⚖️ İlan dili yasağı (İŞKUR sınırı, tests/unit/edu-tus-data.test ile aynı liste) API'de de uygulanır; "hekim" terim kuralı.
const KINDS = new Set(Object.keys(EDU_KIND_LABEL));
const FORBIDDEN = ["hekim", "ilan", "işe alım", "pozisyon", "kadro", "maaş"];
function parseDay(v: unknown): Date | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const d = new Date(`${v.trim()}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}
function str(v: unknown, max: number): string { return typeof v === "string" ? v.trim().slice(0, max) : ""; }

async function requireAdmin() {
  const user = await getCurrentUser();
  return user && user.role === "ADMIN" ? user : null;
}

export async function POST(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const kind = str(b.kind, 20); const title = str(b.title, 200); const organizer = str(b.organizer, 160);
  const eligibility = str(b.eligibility, 420); const deadlineNote = str(b.deadlineNote, 200) || null; const startsAt = str(b.startsAt, 120) || null;
  const country = str(b.country, 2).toUpperCase() || null;
  if (!KINDS.has(kind)) return NextResponse.json({ error: "Geçerli bir tür seçin (staj · değişim · burs)." }, { status: 400 });
  if (title.length < 8) return NextResponse.json({ error: "Başlık en az 8 karakter olmalı." }, { status: 400 });
  if (organizer.length < 2) return NextResponse.json({ error: "Kurum adı gerekli." }, { status: 400 });
  if (eligibility.length < 20) return NextResponse.json({ error: "Şart özeti en az 20 karakter olmalı (kaynak metni kopyalamayın, kısa özet)." }, { status: 400 });
  const deadline = parseDay(b.deadline);
  if (!deadline && !deadlineNote) return NextResponse.json({ error: "Son başvuru günü ya da dönemsel not gerekli." }, { status: 400 });
  let sourceUrl = "";
  try { const u = new URL(str(b.sourceUrl, 500)); if (u.protocol !== "https:") throw new Error("https"); sourceUrl = u.toString(); }
  catch { return NextResponse.json({ error: "Kaynak https adresi olmalı (kurumun kendi sayfası)." }, { status: 400 }); }
  const text = [title, organizer, eligibility, deadlineNote ?? ""].join(" ").toLocaleLowerCase("tr-TR");
  const bad = FORBIDDEN.find((w) => text.includes(w));
  if (bad) return NextResponse.json({ error: `"${bad}" sözcüğü kullanılamaz (ilan dili / terim kuralı).` }, { status: 400 });
  const verifiedAt = parseDay(b.verifiedAt) ?? new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
  const row = await db.eduOpportunity.create({
    data: { kind, title, organizer, country, deadline, deadlineNote, startsAt, eligibility, sourceUrl, verifiedAt, approvedAt: b.approve === true ? new Date() : null },
    select: { id: true },
  });
  return NextResponse.json({ ok: true, id: row.id });
}

export async function PATCH(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const id = str(b.id, 80);
  if (!id) return NextResponse.json({ error: "id gerekli." }, { status: 400 });
  const approved = b.approved === true;
  const r = await db.eduOpportunity.updateMany({ where: { id }, data: { approvedAt: approved ? new Date() : null } });
  if (!r.count) return NextResponse.json({ error: "Kayıt bulunamadı." }, { status: 404 });
  return NextResponse.json({ ok: true, approved });
}

export async function DELETE(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const id = str(b.id, 80);
  if (!id) return NextResponse.json({ error: "id gerekli." }, { status: 400 });
  await db.$transaction([
    db.eduOpportunityFollow.deleteMany({ where: { opportunityId: id } }),
    db.eduOpportunity.deleteMany({ where: { id } }),
  ]);
  return NextResponse.json({ ok: true });
}
