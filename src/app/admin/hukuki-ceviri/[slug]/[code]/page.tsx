import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AURA_LEGAL_VERSION, auraLegalDoc } from "@/lib/aura-legal";
import { LANG_NATIVE_NAME, legalDir } from "@/lib/aura-legal/display";
import { LANG_NAME_BY_CODE } from "@/lib/constants";
import { isTranslatableLegalLang } from "@/lib/legal-translate";
import { legalUnitPairs } from "@/lib/legal-markdown-split";
import { getLegalApproval, LEGAL_QUEUE_STATE_LABEL, legalApprovalEdited, legalQueueState, resolveLegalBody } from "@/lib/legal-approval";
import { PageHeader } from "@/components/ui/PageHeader";
import { AuraPanel } from "@/components/ui/AuraPanel";
import { EmptyState } from "@/components/ui/EmptyState";
import { LegalMarkdown } from "@/components/aura/doctorium-legal/LegalMarkdown";
import { LegalApprovalActions } from "../../LegalApprovalActions";
import { LegalTranslationEditor } from "../../LegalTranslationEditor";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string; code: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug, code } = await params;
  const doc = auraLegalDoc(slug);
  return { title: doc ? `${doc.title.tr} · ${LANG_NAME_BY_CODE[code] ?? code}` : "Hukuki Çeviri" };
}

// Hukuki çeviri inceleme (7-C, v6.286 · 2026-09-20) — TR kanonik ile çeviri YAN YANA; "Onayla" sağdaki metni olduğu gibi dondurur.
// Gövde Doctorium LegalMarkdown'la çizilir (/admin ağacı Doctorium kromu, --c-* token'ları). Çeviri ÖNBELLEKTEN okunur
// (generate:false) — üretim yalnız düğmeyle (audit'li). Yalnız ADMIN.
// Editör (2026-10-03): sağ panelde "Düzenle" → birim çiftleri (TR kaynak ↔ çeviri) yerinde düzenlenir; okuma görünümü sunucuda
// çizilen LegalMarkdown (children). "düzenlenmiş çeviri" etiketi = dondurulmuş hash ≠ otomatik önbellek hash'i.
export default async function LegalTranslationReviewPage({ params }: { params: Params }) {
  const { slug, code } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/giris?next=/admin/hukuki-ceviri/${slug}/${code}`);
  if (user.role !== "ADMIN") redirect("/");

  const doc = auraLegalDoc(slug);
  const lang = LANG_NAME_BY_CODE[code];
  if (!doc?.published || !isTranslatableLegalLang(lang)) notFound();

  const [row, body] = await Promise.all([getLegalApproval(doc.slug, lang), resolveLegalBody(doc.slug, lang, { generate: false })]);
  const state = legalQueueState(row, doc.slug, body ? { complete: !body.partial } : null);
  const edited = state === "reviewed" && row ? await legalApprovalEdited(row, doc.slug, lang) : null;
  const pairs = body && !body.partial ? legalUnitPairs(doc.body.tr, body.markdown) : null;
  const native = LANG_NATIVE_NAME[lang] ?? lang;
  const translationMeta =
    body?.status === "reviewed"
      ? `dondurulmuş onaylı metin${edited ? " · düzenlenmiş" : ""}`
      : body?.partial
        ? "otomatik · eksik birimler Türkçe kaldı"
        : "otomatik çeviri";

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <PageHeader
        eyebrow={<Link href="/admin/hukuki-ceviri" className="hover:underline">← Hukuki Çeviriler</Link>}
        title={`${doc.title.tr} · ${native}`}
        sub={`${lang} (${code}) · Sürüm ${AURA_LEGAL_VERSION} · Durum: ${LEGAL_QUEUE_STATE_LABEL[state]}${edited ? " · düzenlenmiş çeviri" : ""}`}
      />

      <AuraPanel
        title="İnceleme"
        meta={row && !row.revokedAt ? `Son onay ${row.approvedAt.toLocaleDateString("tr-TR")} · ${row.approvedBy}` : undefined}
        className="mt-6"
        level="h2"
      >
        <p className="text-xs leading-relaxed text-[var(--c-ink-3)]">
          {"Onay = sağdaki çeviri olduğu gibi dondurulur ve hastaya \"İncelenmiş çeviri\" rozetiyle sunulur; onam kanıtında okunan metnin hash'i bu metne bağlanır. "}
          {"Hukuken bağlayıcı metin Türkçe kanoniktir; çeviri bilgilendirme amaçlıdır. Türkçe kaynak ya da sürüm değişince onay kendiliğinden eskir. "}
          {"Düzenle ile paragrafı yerinde düzeltebilirsiniz; onay, düzenlenmiş metni dondurur."}
        </p>
        {row?.note && <p className="mt-2 text-xs text-[var(--c-ink-2)]">Not: {row.note}</p>}
        {state === "stale" && (
          <p className="mt-2 text-xs font-medium text-[var(--c-danger)]">
            Türkçe kaynak metin ya da belge sürümü onaydan sonra değişti — hasta şu an OTOMATİK çeviriyi görüyor; sağdaki metni yeniden inceleyin.
          </p>
        )}
        {state === "incomplete" && body && (
          <p className="mt-2 text-xs font-medium text-[var(--c-danger)]">{"Bazı birimler çevrilemedi (Türkçe kaldı) — onaydan önce \"Eksik birimleri üret\"."}</p>
        )}
        <div className="mt-4">
          <LegalApprovalActions slug={doc.slug} code={code} textHash={body && !body.partial ? body.textHash : null} state={state} />
        </div>
      </AuraPanel>

      {body ? (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <AuraPanel title="Türkçe kanonik" meta="bağlayıcı metin" level="h2">
            <div lang="tr">
              <LegalMarkdown markdown={doc.body.tr} />
            </div>
          </AuraPanel>
          <AuraPanel title={`Çeviri · ${native}`} meta={translationMeta} level="h2">
            <LegalTranslationEditor slug={doc.slug} code={code} textHash={body.partial ? null : body.textHash} pairs={pairs} edited={edited} dir={legalDir(code)}>
              <div lang={code} dir={legalDir(code)}>
                <LegalMarkdown markdown={body.markdown} />
              </div>
            </LegalTranslationEditor>
          </AuraPanel>
        </div>
      ) : (
        <EmptyState
          className="mt-6"
          title="Bu dil için çeviri henüz üretilmedi"
          sub="'Çeviriyi üret' ile önbelleğe alın (belge başına ~30–60 sn), sonra Türkçe kanonikle yan yana inceleyin."
        />
      )}
    </div>
  );
}
