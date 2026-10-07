import { describe, it, expect, vi } from "vitest";
import { labelText, labelSourceUrl, mapLabel, readLabelPayload, MAX_LABEL_RESPONSE_BYTES } from "../../src/lib/prospektus-label";

describe("prospektus label integrity", () => {
  it("retains every paragraph and all characters after the old cutoff", () => {
    const long = "Warning ".repeat(2000) + "LAST IMPORTANT WARNING";
    expect(labelText([long, "Second paragraph", "Third paragraph"])).toBe(long + "\n\nSecond paragraph\n\nThird paragraph");
  });
  it("handles missing and empty sections without hiding later nonempty entries", () => {
    expect(labelText(undefined)).toBeNull(); expect(labelText([])).toBeNull();
    expect(labelText(["", " ", null, "later warning", 12])).toBe("later warning");
  });
  it("keeps warnings, cautions and boxed warnings independently", () => {
    const result=mapLabel({warnings:["ordinary"],warnings_and_cautions:["caution"],boxed_warning:["boxed"]});
    expect(result.warnings).toBe("ordinary");expect(result.cautions).toBe("caution");expect(result.boxedWarnings).toBe("boxed");
  });
  it("never interprets markup, links or script content", () => {
    const text='<script>alert(1)</script><img src=x onerror=alert(2)> javascript:alert(3)';
    expect(labelText([text])).toBe(text);
  });
  it("creates an exact-id query only on the fixed HTTPS official host", () => {
    const id="12345678-1234-1234-1234-123456789abc",url=new URL(labelSourceUrl(id)!);
    expect(url.origin).toBe("https://api.fda.gov");expect(url.pathname).toBe("/drug/label.json");
    expect(url.searchParams.get("search")).toBe(`id:"${id}"`);expect(url.searchParams.get("limit")).toBe("1");
  });
  it.each([undefined,"","https://evil.test","javascript:alert(1)",'12345678-1234-1234-1234-123456789abc" OR id:*'])("rejects untrusted source identifier %s", id => {
    expect(labelSourceUrl(id)).toBeNull();
  });
  it("reads large valid payloads without changing section data", async () => {
    const results=[{warnings:["a".repeat(250000),"tail"]}];
    expect(await readLabelPayload(new Response(JSON.stringify({results})))).toEqual({results});
  });
  it("rejects oversized streamed responses rather than returning partial content", async () => {
    const cancel=vi.fn();
    const response=new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array(MAX_LABEL_RESPONSE_BYTES+1));},cancel}));
    await expect(readLabelPayload(response)).rejects.toThrow("too large");expect(cancel).toHaveBeenCalled();
  });
  it.each(['{"results":{}}','broken','null'])("rejects invalid upstream payload %s",async text=>{
    await expect(readLabelPayload(new Response(text))).rejects.toThrow();
  });
});
