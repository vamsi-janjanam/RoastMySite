import { describe, it, expect, vi, beforeEach } from "vitest";
import { CATEGORY_META } from "@/lib/types";
import type { RoastResult } from "@/lib/types";

// Mock the analyze module: keep the REAL normalizeUrl (used for validation)
// but stub analyzeSite so the route never performs a real network fetch.
const analyzeSite = vi.fn();
vi.mock("@/lib/analyze", async () => {
  const actual = await vi.importActual<typeof import("@/lib/analyze")>(
    "@/lib/analyze",
  );
  return {
    normalizeUrl: actual.normalizeUrl,
    analyzeSite,
  };
});

// Mock the roast module: generateRoast returns a fixed RoastResult.
const generateRoast = vi.fn();
vi.mock("@/lib/roast", () => ({
  generateRoast,
}));

// Imported AFTER the mocks are registered.
import { POST } from "./route";

const FIXTURE: RoastResult = {
  url: "https://example.com/",
  overallScore: 7,
  verdict: "Aggressively mediocre. The beige of websites.",
  categories: CATEGORY_META.map(({ key, label, emoji }) => ({
    key,
    label,
    emoji,
    score: 7,
    roast: "A perfectly cromulent roast line for testing.",
  })),
  fetchedAt: new Date().toISOString(),
  mock: true,
};

// A representative SiteSignals stand-in for the analyzeSite mock return.
const SIGNALS = { url: "https://example.com/", fetchFailed: false } as never;

function makeRequest(body: string): Request {
  return new Request("http://localhost/api/roast", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

function makeJsonRequest(payload: unknown): Request {
  return makeRequest(JSON.stringify(payload));
}

describe("POST /api/roast", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    analyzeSite.mockResolvedValue(SIGNALS);
    generateRoast.mockResolvedValue(FIXTURE);
  });

  it("returns 400 when the body is not valid JSON", async () => {
    const res = await POST(makeRequest("not json{"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "Request body must be valid JSON.",
    });
    expect(analyzeSite).not.toHaveBeenCalled();
    expect(generateRoast).not.toHaveBeenCalled();
  });

  it("returns 400 when url is missing", async () => {
    const res = await POST(makeJsonRequest({}));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "A 'url' string is required.",
    });
    expect(analyzeSite).not.toHaveBeenCalled();
  });

  it("returns 400 when url is an empty string", async () => {
    const res = await POST(makeJsonRequest({ url: "   " }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "A 'url' string is required.",
    });
    expect(analyzeSite).not.toHaveBeenCalled();
  });

  it("returns 400 with the normalizeUrl message for an invalid url", async () => {
    const res = await POST(makeJsonRequest({ url: "ftp://example.com" }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Unsupported URL protocol: ftp:");
    expect(analyzeSite).not.toHaveBeenCalled();
    expect(generateRoast).not.toHaveBeenCalled();
  });

  it("returns 200 with the roast result for a valid url", async () => {
    const res = await POST(makeJsonRequest({ url: "example.com" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(FIXTURE);

    expect(analyzeSite).toHaveBeenCalledTimes(1);
    expect(analyzeSite).toHaveBeenCalledWith("example.com");
    expect(generateRoast).toHaveBeenCalledTimes(1);
    expect(generateRoast).toHaveBeenCalledWith(SIGNALS);
  });

  it("returns 500 when analyzeSite throws", async () => {
    analyzeSite.mockRejectedValueOnce(new Error("boom"));
    const res = await POST(makeJsonRequest({ url: "example.com" }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: "Something went wrong while roasting that site.",
    });
    expect(generateRoast).not.toHaveBeenCalled();
  });
});
