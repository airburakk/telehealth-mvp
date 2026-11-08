/** Professional work setting, never a specialty or clinical authorization. */
export const PRACTICE_SETTINGS = [
  { key: "asm", label: "ASM / birinci basamak" },
  { key: "egitim-arastirma", label: "Eğitim / araştırma" },
  { key: "diger", label: "Diğer" },
] as const;
export type PracticeSetting = (typeof PRACTICE_SETTINGS)[number]["key"];
export function isPracticeSetting(value: unknown): value is PracticeSetting {
  return typeof value === "string" && PRACTICE_SETTINGS.some(option => option.key === value);
}
export function parsePracticeSetting(value: unknown): PracticeSetting | null {
  return isPracticeSetting(value) ? value : null;
}
