// [S1+S2+S3] Vitrin rotaları klinik başvuru rotalarından ayrıdır.
export const MODULES = {
  "second-opinion": {
    domain: "aurasecondopinion.com",
    image: "/assets/modules/second-opinion.webp",
    application: "/second-opinion/basvur",
  },
  "medical-tourism": {
    domain: "auramedicaltourism.com",
    image: "/assets/modules/medical-tourism.webp",
    application: "/saglik-turizmi",
  },
  "medical-aesthetics": {
    domain: "auramedicalaesthetics.com",
    image: "/assets/modules/medical-aesthetics.webp",
    application: "/saglik-turizmi",
  },
} as const;

export type ModuleKey = keyof typeof MODULES;
export const MODULE_KEYS = Object.keys(MODULES) as ModuleKey[];
export function isModuleKey(value: string): value is ModuleKey {
  return Object.prototype.hasOwnProperty.call(MODULES, value);
}
export function modulePath(key: ModuleKey) { return `/care/${key}`; }
