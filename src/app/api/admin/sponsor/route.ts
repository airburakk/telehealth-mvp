import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { CATEGORY_LABEL, CAMPAIGN_STATUSES } from "@/lib/sponsor";
import { normalizeBranchPrefs } from "@/lib/doctorium";

export const dynamic = "force-dynamic";

// Doctorium sponsorlu kampanya yönetimi (v6.68 Faz 1) — ADMIN küratörlü, self-auth
// (middleware /api'yi korumaz; /api/admin/congress deseni). İLAÇ kategorisi kabul EDİLMEZ
// (CATEGORY_LABEL'da yok → bilinmeyen kategori fail-closed reddedilir; Modül D parkı).

function parseDate(v: unknown): Date | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const d = new Date(`${v}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

// URL yalnız http(s) — javascript: gibi şemalar hekime tıklatılacak bağlantı olarak yazılmasın
// (/api/admin/congress ile aynı kural; click ucu bu doğrulanmış değeri 302'ler).
function parseHttpUrl(v: unknown): { ok: true; url: string | null } | { ok: false } {
  if (typeof v !== "string" || !v.trim()) return { ok: true, url: null };
  try {
    const u = new URL(v.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return { ok: false };
    return { ok: true, url: u.toString() };
  } catch {
    return { ok: false };
  }
}

function parseCityList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.filter((s): s is string => typeof s === "string" && !!s.trim()).map((s) => s.trim().slice(0, 60)))].slice(0, 30);
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const sponsor = typeof b.sponsor === "string" ? b.sponsor.trim().slice(0, 200) : "";
  const title = typeof b.title === "string" ? b.title.trim().slice(0, 200) : "";
  const body = typeof b.body === "string" ? b.body.trim().slice(0, 600) : "";
  const category = typeof b.category === "string" ? b.category : "";

  if (sponsor.length < 2) return NextResponse.json({ error: "Reklamveren adı en az 2 karakter olmalı." }, { status: 400 });
  if (title.length < 3) return NextResponse.json({ error: "Başlık en az 3 karakter olmalı." }, { status: 400 });
  if (body.length < 3) return NextResponse.json({ error: "Metin en az 3 karakter olmalı." }, { status: 400 });
  if (!CATEGORY_LABEL[category]) return NextResponse.json({ error: "Geçersiz kategori." }, { status: 400 });

  const startsAt = parseDate(b.startsAt);
  const endsAt = parseDate(b.endsAt);
  if (!startsAt || !endsAt) return NextResponse.json({ error: "Başlangıç ve bitiş tarihi zorunlu." }, { status: 400 });
  if (endsAt < startsAt) return NextResponse.json({ error: "Bitiş tarihi başlangıçtan önce olamaz." }, { status: 400 });

  const link = parseHttpUrl(b.linkUrl);
  if (!link.ok) return NextResponse.json({ error: "Geçerli bir http(s) adresi girin." }, { status: 400 });

  const row = await db.sponsorCampaign.create({
    data: {
      sponsor, title, body, category,
      linkUrl: link.url,
      linkLabel: typeof b.linkLabel === "string" && b.linkLabel.trim() ? b.linkLabel.trim().slice(0, 60) : null,
      targetBranches: JSON.stringify(normalizeBranchPrefs(b.targetBranches)),
      targetCities: JSON.stringify(parseCityList(b.targetCities)),
      startsAt, endsAt,
    },
    select: { id: true },
  });
  return NextResponse.json({ ok: true, id: row.id });
}

// PATCH — yalnız durum geçişi (DRAFT→ACTIVE, ACTIVE↔PAUSED, →ENDED). İçerik düzeltmesi için
// kampanyayı ENDED yapıp yenisini açmak tercih edilir (yayınlanmış kreatifin sessizce değişmemesi —
// sayaçlar hangi içeriğe aitti sorusu doğmasın).
export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const id = typeof b.id === "string" ? b.id : "";
  const status = typeof b.status === "string" ? b.status : "";
  if (!id) return NextResponse.json({ error: "id zorunlu." }, { status: 400 });
  if (!(CAMPAIGN_STATUSES as readonly string[]).includes(status)) {
    return NextResponse.json({ error: "Geçersiz durum." }, { status: 400 });
  }

  const found = await db.sponsorCampaign.findUnique({ where: { id }, select: { id: true } });
  if (!found) return NextResponse.json({ error: "Kampanya bulunamadı." }, { status: 404 });

  await db.sponsorCampaign.update({ where: { id }, data: { status } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!id) return NextResponse.json({ error: "id zorunlu." }, { status: 400 });

  // Sayaç geçmişiyle birlikte kalıcı silme yerine ENDED önerilir; DELETE yalnız hiç yayınlanmamış
  // (DRAFT) kayıtlar için serbesttir — yayınlanmış kampanyanın izi (agregat da olsa) korunur.
  const row = await db.sponsorCampaign.findUnique({ where: { id }, select: { status: true } });
  if (!row) return NextResponse.json({ error: "Kampanya bulunamadı." }, { status: 404 });
  if (row.status !== "DRAFT") {
    return NextResponse.json({ error: "Yalnız taslak (DRAFT) kampanya silinebilir; yayınlanmışı ENDED yapın." }, { status: 400 });
  }
  await db.sponsorCampaign.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
