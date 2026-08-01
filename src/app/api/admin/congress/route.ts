import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { normalizeBranchPrefs } from "@/lib/doctorium";

// Doctorium Modül E — kongre kaydı yönetimi (v6.48). Otomatik kaynak YOK (dernek/kongre siteleri
// makine-okunur takvim yayımlamıyor) → ADMIN küratörlü. Self-auth: middleware /api'yi korumaz.
function parseDate(v: unknown): Date | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const d = new Date(`${v}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const title = typeof b.title === "string" ? b.title.trim().slice(0, 300) : "";
  const startDate = parseDate(b.startDate);
  if (title.length < 3) return NextResponse.json({ error: "Kongre adı en az 3 karakter olmalı." }, { status: 400 });
  if (!startDate) return NextResponse.json({ error: "Geçerli bir başlangıç tarihi girin." }, { status: 400 });

  const endDate = parseDate(b.endDate);
  if (endDate && endDate < startDate) {
    return NextResponse.json({ error: "Bitiş tarihi başlangıçtan önce olamaz." }, { status: 400 });
  }
  // URL yalnız http(s) — javascript: gibi şemalar hekime tıklatılacak bağlantı olarak yazılmasın.
  let url: string | null = null;
  if (typeof b.url === "string" && b.url.trim()) {
    try {
      const u = new URL(b.url.trim());
      if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("şema");
      url = u.toString();
    } catch {
      return NextResponse.json({ error: "Geçerli bir http(s) adresi girin." }, { status: 400 });
    }
  }

  const row = await db.medicalCongress.create({
    data: {
      title,
      organizer: typeof b.organizer === "string" && b.organizer.trim() ? b.organizer.trim().slice(0, 200) : null,
      city: typeof b.city === "string" && b.city.trim() ? b.city.trim().slice(0, 100) : null,
      country: typeof b.country === "string" && b.country.trim() ? b.country.trim().slice(0, 60) : "TR",
      startDate,
      endDate,
      abstractDeadline: parseDate(b.abstractDeadline),
      earlyBirdDeadline: parseDate(b.earlyBirdDeadline),
      url,
      branchSlugs: JSON.stringify(normalizeBranchPrefs(b.branchSlugs)),
    },
    select: { id: true },
  });
  return NextResponse.json({ ok: true, id: row.id });
}

export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id gerekli." }, { status: 400 });
  await db.medicalCongress.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
