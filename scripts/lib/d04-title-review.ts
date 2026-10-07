// Offline review only. No DB client, environment loader, network or writes.
export const D04_REFERENCE = {
  id: "cmuumitjt000rl704fd2wcxye",
  pmid: "42537682",
  doajId: "647d81103462451694bc03af0c855097",
  doi: "10.1016/j.lanmic.2026.101462",
  title: "Detection of Trichophyton indotineae using a species-specific genomic marker: a marker identification and assay validation study",
  sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/42537682/",
} as const;

export interface TitleSnapshot {
  id: string;
  source: string;
  externalId: string;
  doi: string | null;
  title: string;
  titleOriginal: string | null;
}

export function reviewD04Title(row: TitleSnapshot) {
  const sourceMatched = (row.source === "pubmed" && row.externalId === D04_REFERENCE.pmid) ||
    (row.source === "doaj" && row.externalId === D04_REFERENCE.doajId);
  if (row.id !== D04_REFERENCE.id || !sourceMatched || row.doi !== D04_REFERENCE.doi) {
    return { mode: "dry-run", status: "identity-mismatch", update: null } as const;
  }
  const original = row.titleOriginal ?? row.title;
  if (original === D04_REFERENCE.title && row.title !== "Detection of") {
    return { mode: "dry-run", status: "no-proven-title-defect", update: null } as const;
  }
  // Only the reported exact fragment warrants this draft; never infer from length.
  if (row.title !== "Detection of" ||
      (row.titleOriginal !== null && row.titleOriginal !== "Detection of" &&
       row.titleOriginal !== D04_REFERENCE.title)) {
    return { mode: "dry-run", status: "manual-review-required", update: null } as const;
  }
  return {
    mode: "dry-run", status: "approval-required",
    evidence: D04_REFERENCE,
    // Every old value must still match in a future separately approved transaction.
    expectedOldValue: { ...row },
    proposed: { title: D04_REFERENCE.title, titleOriginal: null },
    update: "DRAFT ONLY: restore verified English title; do not generate a Turkish translation",
    preserve: ["summary", "summaryOriginal", "aiSummary", "publishedAt", "createdAt", "branchSlugs"],
    followUp: "Inspect Translation.source/translated for the exact old title hash before changing any cache entry",
  } as const;
}
