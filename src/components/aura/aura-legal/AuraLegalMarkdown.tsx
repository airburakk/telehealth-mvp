import type { Block, Inline } from "@/lib/doctorium-legal/markdown";
import { headingId, parseLegalMarkdown } from "@/lib/doctorium-legal/markdown";

// AURA hukuki belge gövdesi (kod Paket A, v6.268 · 2026-09-13) — Doctorium LegalMarkdown'ın AURA vitrin token'lı eşleniği.
// Ayrıştırıcı ORTAK: lib/doctorium-legal/markdown saf ve marka bilmez (metni değiştirmez, yapıya ayırır) — AURA tarafında
// ikinci kopya tutulmaz. Metin bizim sabitimiz → React düğümü olarak basılır, HTML enjeksiyonu yok. Renkler --aura-* rol
// token'ları: kabuk gövdeyi .aura-light şeridine koyar (açık zemin, --aura-ink stone-900); gece bölümünde de doğru çalışır.
// Bağlantı metni rolü --aura-accent-stronger (beyazda 6.83:1; --aura-accent 3.76 eşiğin altında — globals.css notu).

function InlineNodes({ nodes }: { nodes: Inline[] }) {
  return (
    <>
      {nodes.map((n, i) => {
        switch (n.t) {
          case "bold": return <strong key={i} className="font-semibold text-[var(--aura-ink)]">{n.v}</strong>;
          case "italic": return <em key={i}>{n.v}</em>;
          case "code": return <code key={i} className="rounded bg-[var(--aura-surface)] px-1 py-px font-mono text-[0.9em]">{n.v}</code>;
          case "link": return <a key={i} href={n.href} className="font-medium text-[var(--aura-accent-stronger)] underline underline-offset-2 hover:text-[var(--aura-ink)]">{n.v}</a>;
          default: return <span key={i}>{n.v}</span>;
        }
      })}
    </>
  );
}

function BlockNode({ b }: { b: Block }) {
  switch (b.type) {
    case "h2":
      return <h2 id={headingId(b.inline)} className="aura-display mt-10 scroll-mt-24 text-xl font-bold leading-snug text-[var(--aura-ink)] first:mt-0"><InlineNodes nodes={b.inline} /></h2>;
    case "h3":
      return <h3 id={headingId(b.inline)} className="mt-6 scroll-mt-24 text-[15px] font-semibold text-[var(--aura-ink)]"><InlineNodes nodes={b.inline} /></h3>;
    case "p":
      return <p className="mt-3 leading-relaxed"><InlineNodes nodes={b.inline} /></p>;
    case "hr":
      return <hr className="my-8 border-[var(--aura-hairline)]" />;
    case "ul":
      return (
        <ul className="mt-3 list-disc space-y-1.5 pl-5">
          {b.items.map((it, i) => <li key={i} className="leading-relaxed"><InlineNodes nodes={it} /></li>)}
        </ul>
      );
    case "ol":
      return (
        <ol className="mt-3 list-decimal space-y-1.5 pl-5">
          {b.items.map((it, i) => <li key={i} className="leading-relaxed"><InlineNodes nodes={it} /></li>)}
        </ol>
      );
    case "quote":
      return (
        <blockquote className="mt-4 rounded-r-xl border-l-4 border-[var(--aura-accent)] bg-[var(--aura-panel)] px-4 py-3">
          {b.blocks.map((inner, i) => <BlockNode key={i} b={inner} />)}
        </blockquote>
      );
    case "table":
      return (
        <div className="mt-4 overflow-x-auto rounded-xl border border-[var(--aura-hairline)]">
          <table className="w-full border-collapse text-[13px]">
            {b.header.some((h) => h.length) && (
              <thead>
                <tr className="bg-[var(--aura-panel)] text-left">
                  {b.header.map((h, i) => <th key={i} className="border-b border-[var(--aura-hairline)] px-3 py-2 font-semibold text-[var(--aura-ink)]"><InlineNodes nodes={h} /></th>)}
                </tr>
              </thead>
            )}
            <tbody>
              {b.rows.map((r, ri) => (
                <tr key={ri} className="align-top odd:bg-transparent even:bg-[var(--aura-panel)]">
                  {r.map((c, ci) => <td key={ci} className="border-b border-[var(--aura-hairline)] px-3 py-2 leading-relaxed last:border-b-0"><InlineNodes nodes={c} /></td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

export function AuraLegalMarkdown({ markdown }: { markdown: string }) {
  const blocks = parseLegalMarkdown(markdown);
  return (
    <div className="text-[15px] text-[var(--aura-ink)]">
      {blocks.map((b, i) => <BlockNode key={i} b={b} />)}
    </div>
  );
}
