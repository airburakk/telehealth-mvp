// FHIR HTTP yardımcıları — route'lar için ortak yanıt biçimi.
// (fhir.ts saf/next'siz kalsın diye NextResponse bağımlılığı burada izole edilir.)
import { NextResponse } from "next/server";

export const FHIR_CT = "application/fhir+json; charset=utf-8";

export function fhirJson(body: unknown, status = 200): NextResponse {
  return new NextResponse(JSON.stringify(body, null, 2), { status, headers: { "content-type": FHIR_CT } });
}

export function operationOutcome(status: number, code: string, diagnostics: string): NextResponse {
  return fhirJson({ resourceType: "OperationOutcome", issue: [{ severity: "error", code, diagnostics }] }, status);
}
