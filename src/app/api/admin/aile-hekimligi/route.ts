import { getCurrentUser } from "@/lib/auth";
import { EditorialError, executeEditorial, isSameOrigin, listEditorial, parseEditorialCommand, schemaMissing } from "@/lib/family-medicine-editorial";

export const dynamic = "force-dynamic";
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
function failure(error: unknown) {
  if (schemaMissing(error)) return json({ code: "SCHEMA_MISSING", error: "Editoryal tablolar kurulmadı. Yetkili migration uygulanmadan kayıt ve inceleme açılamaz." }, 503);
  if (error instanceof EditorialError) return json({ error: error.message }, error.status);
  if (error && typeof error === "object" && "code" in error && ["P2002", "P2034"].includes(String(error.code))) return json({ error: "Kayıt değişti; yenileyip tekrar deneyin." }, 409);
  return json({ error: "Editoryal işlem tamamlanamadı; hiçbir başarı onayı verilmedi." }, 500);
}
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return json({ error: "Oturum gerekli." }, 401);
  if (user.role !== "ADMIN") return json({ error: "Yönetici yetkisi gerekli." }, 403);
  try { return json(await listEditorial(user.id)); } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return json({ error: "Oturum gerekli." }, 401);
  if (user.role !== "ADMIN") return json({ error: "Yönetici yetkisi gerekli." }, 403);
  if (!isSameOrigin(request)) return json({ error: "Aynı kaynaktan istek gerekli." }, 403);
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return json({ error: "JSON gerekli." }, 415);
  // Stream cap also covers requests without a Content-Length header.
  try {
    const reader = request.body?.getReader();
    if (!reader) return json({ error: "İstek gövdesi gerekli." }, 400);
    const chunks: Uint8Array[] = []; let length = 0;
    while (true) { const { done, value } = await reader.read(); if (done) break; length += value.length; if (length > 65536) { await reader.cancel(); return json({ error: "İstek çok büyük." }, 413); } chunks.push(value); }
    const raw = Buffer.concat(chunks).toString("utf8");
    let parsed: unknown; try { parsed = JSON.parse(raw); } catch { return json({ error: "Geçersiz JSON." }, 400); }
    return json(await executeEditorial(parseEditorialCommand(parsed), user.id));
  } catch (error) { return failure(error); }
}
