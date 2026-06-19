import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  mockRoast,
  generateRoast,
  parseRoastJson,
  buildVerdict,
  clampScore,
} from "@/lib/roast";
import { CATEGORY_META } from "@/lib/types";
import type { SiteSignals } from "@/lib/types";

/** Factory for SiteSignals so we don't repeat ~16 fields everywhere. */
function makeSignals(overrides: Partial<SiteSignals> = {}): SiteSignals {
  return {
    url: "https://example.com/",
    finalUrl: "https://example.com/",
    status: 200,
    https: true,
    title: "Example",
    metaDescription: "A fine description",
    htmlBytes: 50_000,
    loadMs: 400,
    hasViewportMeta: true,
    imageCount: 4,
    imagesMissingAlt: 0,
    scriptCount: 5,
    popupIndicators: 0,
    trustMarkers: 2,
    hasStockPhotoTells: false,
    textSample: "x".repeat(900),
    fetchFailed: false,
    ...overrides,
  };
}

const CATEGORY_KEYS = CATEGORY_META.map((c) => c.key);

describe("clampScore", () => {
  it("rounds and clamps into 0..10", () => {
    expect(clampScore(5.4)).toBe(5);
    expect(clampScore(5.6)).toBe(6);
    expect(clampScore(-3)).toBe(0);
    expect(clampScore(99)).toBe(10);
    expect(clampScore("nope")).toBe(0);
    expect(clampScore(NaN)).toBe(0);
    expect(clampScore(undefined)).toBe(0);
  });
});

describe("buildVerdict", () => {
  it("returns the right band string per score", () => {
    expect(buildVerdict(0)).toBe("Please delete this from the internet.");
    expect(buildVerdict(2)).toBe("Please delete this from the internet.");
    expect(buildVerdict(4)).toBe(
      "A tragedy in HTML form. Seek help (a designer).",
    );
    expect(buildVerdict(6)).toBe("Aggressively mediocre. The beige of websites.");
    expect(buildVerdict(8)).toBe("Not bad! It only mildly offended me.");
    expect(buildVerdict(10)).toBe("10/10 would roast again. Genuinely solid.");
  });
});

describe("parseRoastJson", () => {
  it("parses raw JSON", () => {
    const parsed = parseRoastJson('{"overallScore":7,"verdict":"ok"}');
    expect(parsed.overallScore).toBe(7);
    expect(parsed.verdict).toBe("ok");
  });

  it("parses JSON wrapped in ```json fences", () => {
    const raw = '```json\n{"overallScore":3,"verdict":"meh"}\n```';
    const parsed = parseRoastJson(raw);
    expect(parsed.overallScore).toBe(3);
    expect(parsed.verdict).toBe("meh");
  });

  it("parses JSON surrounded by prose", () => {
    const raw = 'Here is your roast: {"overallScore":5} Hope you like it!';
    const parsed = parseRoastJson(raw);
    expect(parsed.overallScore).toBe(5);
  });

  it("throws on garbage with no object", () => {
    expect(() => parseRoastJson("absolutely not json")).toThrow(
      /not valid JSON/,
    );
  });
});

describe("mockRoast", () => {
  it("is deterministic given the same signals (ignoring fetchedAt)", () => {
    const s = makeSignals();
    const a = mockRoast(s);
    const b = mockRoast(s);

    expect(a.url).toBe(b.url);
    expect(a.overallScore).toBe(b.overallScore);
    expect(a.verdict).toBe(b.verdict);
    expect(a.categories).toEqual(b.categories);
    expect(a.mock).toBe(true);
  });

  it("can differ for different urls", () => {
    const a = mockRoast(makeSignals({ url: "https://a.com/" }));
    const b = mockRoast(makeSignals({ url: "https://totally-different.org/" }));
    // Roast lines are url-seeded; at least one should differ.
    const aLines = a.categories.map((c) => c.roast).join("|");
    const bLines = b.categories.map((c) => c.roast).join("|");
    expect(aLines).not.toBe(bLines);
  });

  it("returns exactly 7 categories in CATEGORY_META key order", () => {
    const r = mockRoast(makeSignals());
    expect(r.categories).toHaveLength(7);
    expect(r.categories.map((c) => c.key)).toEqual(CATEGORY_KEYS);
  });

  it("carries correct label/emoji for each category", () => {
    const r = mockRoast(makeSignals());
    for (const cat of r.categories) {
      const meta = CATEGORY_META.find((m) => m.key === cat.key)!;
      expect(cat.label).toBe(meta.label);
      expect(cat.emoji).toBe(meta.emoji);
      expect(cat.roast.length).toBeGreaterThan(0);
    }
  });

  it("produces integer scores in 0..10 and a valid overallScore", () => {
    const r = mockRoast(makeSignals());
    for (const cat of r.categories) {
      expect(Number.isInteger(cat.score)).toBe(true);
      expect(cat.score).toBeGreaterThanOrEqual(0);
      expect(cat.score).toBeLessThanOrEqual(10);
    }
    expect(Number.isInteger(r.overallScore)).toBe(true);
    expect(r.overallScore).toBeGreaterThanOrEqual(0);
    expect(r.overallScore).toBeLessThanOrEqual(10);
  });

  it("scores a great site highly", () => {
    const great = makeSignals({
      loadMs: 200,
      htmlBytes: 30_000,
      scriptCount: 3,
      hasViewportMeta: true,
      https: true,
      trustMarkers: 5,
      title: "Great",
      metaDescription: "Great desc",
      textSample: "x".repeat(1000),
      imageCount: 5,
      imagesMissingAlt: 0,
      popupIndicators: 0,
      hasStockPhotoTells: false,
      status: 200,
    });
    const r = mockRoast(great);
    expect(r.overallScore).toBeGreaterThanOrEqual(7);
  });

  it("scores a terrible / fetchFailed site low", () => {
    const terrible = makeSignals({
      fetchFailed: true,
      status: 0,
      https: false,
      title: null,
      metaDescription: null,
      hasViewportMeta: false,
      loadMs: 9000,
      htmlBytes: 0,
      textSample: "",
      trustMarkers: 0,
      popupIndicators: 10,
      hasStockPhotoTells: true,
    });
    const r = mockRoast(terrible);
    expect(r.overallScore).toBeLessThanOrEqual(3);
  });
});

describe("generateRoast", () => {
  const original = process.env.ANTHROPIC_API_KEY;

  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  afterEach(() => {
    if (original === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = original;
  });

  it("falls back to mockRoast when ANTHROPIC_API_KEY is unset", async () => {
    const s = makeSignals();
    const result = await generateRoast(s);
    const expected = mockRoast(s);

    expect(result.mock).toBe(true);
    expect(result.overallScore).toBe(expected.overallScore);
    expect(result.verdict).toBe(expected.verdict);
    expect(result.categories).toEqual(expected.categories);
  });
});
