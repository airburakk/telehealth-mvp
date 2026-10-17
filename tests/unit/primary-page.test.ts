import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ lookup: vi.fn(), request: vi.fn() }));
vi.mock("node:dns/promises", () => ({ lookup: mocks.lookup }));
vi.mock("node:https", () => ({ request: mocks.request }));
import { readPrimaryPage, readPrimaryPdf } from "@/lib/social-calendar/primary-page";

type Response = EventEmitter & { statusCode: number; headers: Record<string, string>; destroy: (error?: Error) => void };
let response: Response;
let chunks: Buffer[];
beforeEach(() => {
  vi.resetAllMocks(); chunks = [Buffer.from("<h1>Official page</h1>")];
  mocks.lookup.mockResolvedValue([{ address: "1.1.1.1", family: 4 }]);
  response = Object.assign(new EventEmitter(), { statusCode: 200, headers: { "content-type": "text/html" }, destroy: vi.fn((error?: Error) => { if (error) response.emit("error", error); }) });
  mocks.request.mockImplementation((_url: URL, _options: object, callback: (res: Response) => void) => {
    const req = Object.assign(new EventEmitter(), { end: () => queueMicrotask(() => {
      callback(response);
      if (response.statusCode !== 200 || !["text/html", "application/pdf"].includes(response.headers["content-type"]!) || response.headers["content-encoding"]) return;
      for (const chunk of chunks) response.emit("data", chunk);
      response.emit("end");
    }) });
    return req;
  });
});

describe("primary page transport", () => {
  it("pins checked DNS into the request and returns bounded UTF-8 HTML", async () => {
    expect(await readPrimaryPage("https://official.example/page")).toContain("Official page");
    const options = mocks.request.mock.calls[0]![1];
    expect(options).toMatchObject({ agent: false, family: 4, method: "GET", headers: { "Accept-Encoding": "identity" } });
    const callback = vi.fn(); options.lookup("official.example", {}, callback);
    expect(callback).toHaveBeenCalledWith(null, "1.1.1.1", 4);
    expect(mocks.lookup).toHaveBeenCalledTimes(1);
  });
  it("rejects a DNS answer with even one private address before connecting", async () => {
    mocks.lookup.mockResolvedValue([{ address: "1.1.1.1", family: 4 }, { address: "127.0.0.1", family: 4 }]);
    await expect(readPrimaryPage("https://official.example")).rejects.toThrow("primary-address-rejected");
    expect(mocks.request).not.toHaveBeenCalled();
  });
  it.each([302, 403, 429, 500])("rejects HTTP %s without following a redirect", async (status) => {
    response.statusCode = status; response.headers.location = "https://other.example";
    await expect(readPrimaryPage("https://official.example")).rejects.toThrow("primary-response-rejected");
    expect(mocks.request).toHaveBeenCalledTimes(1);
    expect(response.destroy).toHaveBeenCalled();
  });
  it("rejects compressed, non-HTML, and oversized responses", async () => {
    response.headers["content-encoding"] = "gzip";
    await expect(readPrimaryPage("https://official.example")).rejects.toThrow("primary-response-rejected");
    delete response.headers["content-encoding"]; response.headers["content-type"] = "application/pdf";
    await expect(readPrimaryPage("https://official.example")).rejects.toThrow("primary-response-rejected");
    response.headers["content-type"] = "text/html"; chunks = [Buffer.alloc(512_001)];
    await expect(readPrimaryPage("https://official.example")).rejects.toThrow("primary-page-too-large");
  });
  it("times out DNS inside the same four-second budget", async () => {
    vi.useFakeTimers();
    // AbortSignal.timeout uses a runtime timer rather than the fake timer clock.
    const timeout = vi.spyOn(AbortSignal, "timeout"); const controller = new AbortController(); timeout.mockReturnValue(controller.signal);
    mocks.lookup.mockReturnValue(new Promise(() => {}));
    const result = readPrimaryPage("https://official.example");
    controller.abort();
    await expect(result).rejects.toThrow("primary-timeout");
    expect(timeout).toHaveBeenCalledWith(4000);
    expect(mocks.request).not.toHaveBeenCalled();
    timeout.mockRestore(); vi.useRealTimers();
  });
  it("accepts only bounded genuine PDF bytes on the PDF reader", async () => {
    response.headers["content-type"] = "application/pdf"; chunks = [Buffer.from("%PDF-1.7 synthetic")];
    expect((await readPrimaryPdf("https://official.example/call.pdf")).toString()).toContain("%PDF-");
    chunks = [Buffer.from("not a PDF")];
    await expect(readPrimaryPdf("https://official.example/call.pdf")).rejects.toThrow("primary-pdf-rejected");
    chunks = [Buffer.alloc(1_500_001)];
    await expect(readPrimaryPdf("https://official.example/call.pdf")).rejects.toThrow("primary-page-too-large");
  });
});
