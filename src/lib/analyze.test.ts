import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { normalizeUrl, analyzeSite } from "@/lib/analyze";

describe("normalizeUrl", () => {
  it("prepends https:// to a bare domain and normalizes trailing slash", () => {
    expect(normalizeUrl("example.com")).toBe("https://example.com/");
  });

  it("preserves an existing http:// scheme", () => {
    expect(normalizeUrl("http://example.com")).toBe("http://example.com/");
  });

  it("preserves an existing https:// scheme", () => {
    expect(normalizeUrl("https://example.com/path")).toBe(
      "https://example.com/path",
    );
  });

  it("allows localhost (non-dotted host)", () => {
    expect(normalizeUrl("localhost")).toBe("https://localhost/");
    expect(normalizeUrl("http://localhost:3000")).toBe("http://localhost:3000/");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeUrl("  example.com  ")).toBe("https://example.com/");
  });

  it("throws on empty input", () => {
    expect(() => normalizeUrl("")).toThrow();
  });

  it("throws on whitespace-only input", () => {
    expect(() => normalizeUrl("   ")).toThrow();
  });

  it("throws on null/undefined input", () => {
    // @ts-expect-error testing runtime guard for nullish input
    expect(() => normalizeUrl(undefined)).toThrow();
  });

  it("throws on an unsupported protocol (ftp://)", () => {
    expect(() => normalizeUrl("ftp://example.com")).toThrow(
      /Unsupported URL protocol/,
    );
  });

  it("throws on a javascript: protocol", () => {
    // "javascript:" has no // so it gets https:// prepended -> invalid host
    expect(() => normalizeUrl("javascript:alert(1)")).toThrow();
  });

  it("throws on a non-dotted host that isn't localhost", () => {
    expect(() => normalizeUrl("notaurl")).toThrow(/Invalid URL host/);
  });
});

const HTML = `<!doctype html>
<html>
<head>
  <title>  My   Great Site  </title>
  <meta name="description" content="A wonderful description of things">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script src="/app.js"></script>
</head>
<body>
  <h1>Welcome</h1>
  <p>Sign up for our newsletter and read a testimonial from a happy customer.</p>
  <img src="https://images.unsplash.com/photo-1.jpg" alt="a photo" />
  <img src="/local.png" />
</body>
</html>`;

function makeResponse(opts: {
  status?: number;
  url?: string;
  text: string;
}): Response {
  return {
    status: opts.status ?? 200,
    url: opts.url ?? "https://example.com/",
    text: async () => opts.text,
  } as unknown as Response;
}

describe("analyzeSite", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("parses a successful HTML response into signals (fetchFailed:false)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      makeResponse({ status: 200, url: "https://example.com/", text: HTML }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const signals = await analyzeSite("example.com");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(signals.fetchFailed).toBe(false);
    expect(signals.status).toBe(200);
    expect(signals.https).toBe(true);
    expect(signals.url).toBe("https://example.com/");
    expect(signals.finalUrl).toBe("https://example.com/");

    // title: collapsed whitespace + trimmed
    expect(signals.title).toBe("My Great Site");
    expect(signals.metaDescription).toBe("A wonderful description of things");
    expect(signals.hasViewportMeta).toBe(true);

    // two <img> tags, one missing alt
    expect(signals.imageCount).toBe(2);
    expect(signals.imagesMissingAlt).toBe(1);

    // one <script>
    expect(signals.scriptCount).toBe(1);

    // "newsletter" + "subscribe" not present but "newsletter" is one popup term
    expect(signals.popupIndicators).toBeGreaterThanOrEqual(1);
    // "testimonial" is a trust term
    expect(signals.trustMarkers).toBeGreaterThanOrEqual(1);

    // unsplash stock tell
    expect(signals.hasStockPhotoTells).toBe(true);

    expect(signals.htmlBytes).toBeGreaterThan(0);
    expect(signals.textSample).toContain("Welcome");
    // script contents stripped out of the text sample
    expect(signals.textSample).not.toContain("app.js");
  });

  it("uses res.url as finalUrl and recomputes https from it", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      makeResponse({
        status: 200,
        url: "http://redirected.example.org/",
        text: "<title>x</title>",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const signals = await analyzeSite("https://example.com");
    expect(signals.finalUrl).toBe("http://redirected.example.org/");
    expect(signals.https).toBe(false);
  });

  it("returns fetchFailed:true with status 0 when fetch rejects", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);

    const signals = await analyzeSite("example.com");

    expect(signals.fetchFailed).toBe(true);
    expect(signals.status).toBe(0);
    expect(signals.url).toBe("https://example.com/");
    expect(signals.https).toBe(true);
    expect(signals.title).toBeNull();
    expect(signals.imageCount).toBe(0);
  });

  it("propagates a non-200 status without marking fetchFailed", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      makeResponse({ status: 404, url: "https://example.com/", text: "nope" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const signals = await analyzeSite("example.com");
    expect(signals.fetchFailed).toBe(false);
    expect(signals.status).toBe(404);
  });

  it("rejects/throws on an invalid url before fetching", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(analyzeSite("ftp://bad.com")).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
