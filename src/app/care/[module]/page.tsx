import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ModuleLanding } from "@/components/aura/modules/module-landing";
import { MODULES, MODULE_KEYS, isModuleKey, modulePath } from "@/lib/aura-modules/catalog";
import { moduleCopy } from "@/lib/aura-modules/copy";
import { AURA_CANONICAL_URL } from "@/lib/brand";
import { OG_LOCALE, OG_ALTERNATE_LOCALES } from "@/lib/aura-landing/seo";

// Ana platformdaki klinik rotalar aynen kalır. Vitrin DB/oturum gerektirmez.
export const dynamicParams = false;
export function generateStaticParams() {
  return MODULE_KEYS.map(module => ({ module }));
}
type Props = { params: Promise<{ module: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { module } = await params;
  if (!isModuleKey(module)) notFound();
  const text = moduleCopy("en", module);
  const url = `${AURA_CANONICAL_URL}${modulePath(module)}`;
  return {
    title: text.name,
    description: text.description,
    alternates: { canonical: url },
    openGraph: {
      type: "website", url, siteName: "AURA", title: `${text.name} · AURA`,
      description: text.description, locale: OG_LOCALE.en, alternateLocale: OG_ALTERNATE_LOCALES,
      images: [{ url: `${AURA_CANONICAL_URL}${MODULES[module].image}`, width: 1672, height: 941, alt: text.name }],
    },
    twitter: { card: "summary_large_image", title: `${text.name} · AURA`, description: text.description, images: [`${AURA_CANONICAL_URL}${MODULES[module].image}`] },
  };
}

export default async function ModulePage({ params }: Props) {
  const { module } = await params;
  if (!isModuleKey(module)) notFound();
  return <ModuleLanding moduleKey={module} />;
}
