// openFDA SPL text stays plain text; never interpret label content as HTML.
export interface FdaLabel {
  id?: string;
  effective_time?: string;
  openfda?: { brand_name?: string[]; generic_name?: string[]; manufacturer_name?: string[] };
  indications_and_usage?: string[];
  dosage_and_administration?: string[];
  warnings?: string[];
  warnings_and_cautions?: string[];
  boxed_warning?: string[];
  contraindications?: string[];
  adverse_reactions?: string[];
}

export function labelText(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  const paragraphs = value.filter((v): v is string => typeof v === "string" && !!v.trim());
  return paragraphs.length ? paragraphs.map(v => v.trim()).join("\n\n") : null;
}

export function labelSourceUrl(id: unknown): string | null {
  if (typeof id !== "string" || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) return null;
  const params = new URLSearchParams({ search: `id:"${id}"`, limit: "1" });
  return `https://api.fda.gov/drug/label.json?${params}`;
}

export function mapLabel(r: FdaLabel) {
  return {
    id: r.id ?? null, sourceUrl: labelSourceUrl(r.id),
    brand: r.openfda?.brand_name?.[0] ?? null,
    generic: r.openfda?.generic_name?.[0] ?? null,
    manufacturer: r.openfda?.manufacturer_name?.[0] ?? null,
    effectiveTime: r.effective_time ?? null,
    indications: labelText(r.indications_and_usage), dosage: labelText(r.dosage_and_administration),
    warnings: labelText(r.warnings), cautions: labelText(r.warnings_and_cautions),
    boxedWarnings: labelText(r.boxed_warning), contraindications: labelText(r.contraindications),
    adverse: labelText(r.adverse_reactions),
  };
}

export type LabelResult = ReturnType<typeof mapLabel>;
export const MAX_LABEL_RESPONSE_BYTES = 8 * 1024 * 1024;

// Reject oversized responses explicitly instead of silently dropping label text.
export async function readLabelPayload(response: Response): Promise<{ results?: FdaLabel[] }> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Missing label response body");
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_LABEL_RESPONSE_BYTES) { await reader.cancel(); throw new Error("Label response too large"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  const payload = JSON.parse(new TextDecoder().decode(bytes));
  if (!payload || typeof payload !== "object" || (payload.results !== undefined && !Array.isArray(payload.results))) throw new Error("Invalid label response");
  return payload;
}
