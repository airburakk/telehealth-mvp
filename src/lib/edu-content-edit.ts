/** Public editorial fields only. No approval, identity, follow or delete operations. */
export function parseEduContentEdit(b: unknown) {
  const fail = (error: string) => ({ ok: false as const, error });
  if (!b || typeof b !== "object" || Array.isArray(b)) return fail("Geçersiz veri.");
  const v = b as Record<string, unknown>;
  const keys = ["id", "expectedUpdatedAt", "deadline", "deadlineNote", "eligibility", "sourceUrl", "verifiedAt"];
  if (Object.keys(v).some((k) => !keys.includes(k))) return fail("Desteklenmeyen alan.");
  const text = (k: string) => typeof v[k] === "string" ? (v[k] as string).trim() : "";
  const id = text("id");
  const stamp = text("expectedUpdatedAt");
  if (!id || id.length > 80 || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(stamp)) return fail("Kayıt sürümü gerekli.");
  const expectedUpdatedAt = new Date(stamp);
  if (!Number.isFinite(expectedUpdatedAt.getTime()) || expectedUpdatedAt.toISOString() !== stamp) return fail("Geçersiz kayıt sürümü.");
  const day = (s: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    const d = new Date(`${s}T00:00:00.000Z`);
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === s ? d : null;
  };
  const deadlineText = text("deadline");
  const deadline = deadlineText ? day(deadlineText) : null;
  const deadlineNote = text("deadlineNote") || null;
  const verifiedAt = day(text("verifiedAt"));
  const eligibility = text("eligibility");
  if ((deadlineText && !deadline) || !verifiedAt || (!deadline && !deadlineNote)) return fail("Geçerli tarihler veya dönemsel not gerekli.");
  if ((deadlineNote?.length ?? 0) > 200 || eligibility.length < 20 || eligibility.length > 420) return fail("Metin uzunluğu geçersiz.");
  if (["hekim", "ilan", "işe alım", "pozisyon", "kadro", "maaş"].some((w) => `${eligibility} ${deadlineNote ?? ""}`.toLocaleLowerCase("tr-TR").includes(w))) return fail("İçerik terim kuralına uymuyor.");
  let sourceUrl: string;
  try {
    const raw = text("sourceUrl");
    const u = new URL(raw);
    if (raw.length > 500 || u.protocol !== "https:" || u.username || u.password) throw new Error();
    sourceUrl = u.toString();
  } catch { return fail("Geçerli https kaynak adresi gerekli."); }
  return { ok: true as const, id, expectedUpdatedAt, data: { deadline, deadlineNote, eligibility, sourceUrl, verifiedAt } };
}
