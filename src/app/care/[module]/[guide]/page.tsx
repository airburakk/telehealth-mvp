import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isModuleKey } from "@/lib/aura-modules/catalog";
import { GUIDE_INDEX, guidePath } from "@/lib/aura-modules/guide-index";
import { GUIDES } from "@/lib/aura-modules/guides";
import { ModuleGuide } from "@/components/aura/modules/module-guide";
import { AURA_CANONICAL_URL } from "@/lib/brand";

export const dynamicParams = false;
export function generateStaticParams() { return GUIDE_INDEX.map(item => ({ module: item.module, guide: item.slug })); }
type Props = { params: Promise<{ module: string; guide: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { module, guide } = await params;
  const entry = GUIDE_INDEX.find(item => item.module === module && item.slug === guide);
  if (!entry) notFound();
  const url = `${AURA_CANONICAL_URL}${guidePath(entry.module, entry.slug)}`;
  return { title: entry.title.en, description: entry.summary.en, alternates: { canonical: url }, openGraph: { type: "article", title: `${entry.title.en} · AURA`, description: entry.summary.en, url, locale: "en_US" } };
}
export default async function GuidePage({ params }: Props) {
  const { module, guide } = await params;
  if (!isModuleKey(module) || !GUIDE_INDEX.some(item => item.module === module && item.slug === guide)) notFound();
  return <ModuleGuide moduleKey={module} slug={guide} guide={GUIDES[guide]} />;
}
