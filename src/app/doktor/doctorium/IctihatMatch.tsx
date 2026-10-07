import { literalParts } from "@/lib/ictihat-search";

export function IctihatMatch({ text, query }: { text: string; query: string }) {
  return <>{literalParts(text, query).map((p, i) => p.match
    ? <mark key={i} className="rounded px-0.5" style={{ color: "var(--c-ink)", background: "var(--c-surface-2)", textDecoration: "underline", textDecorationThickness: "2px" }}>{p.text}</mark>
    : p.text)}</>;
}
