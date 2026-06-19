import type { SiteSignals } from "@/lib/types";

/**
 * Normalize a user-supplied URL: prepend https:// if no protocol is present,
 * and validate it parses via the WHATWG URL parser.
 * Throws an Error for clearly invalid input.
 */
export function normalizeUrl(raw: string): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) {
    throw new Error("URL is empty.");
  }

  // Reject obvious non-URLs (whitespace in the middle, no dot and not localhost).
  let candidate = trimmed;
  if (!/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(candidate)) {
    // No scheme — assume https.
    candidate = `https://${candidate}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error(`Invalid URL: ${raw}`);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Unsupported URL protocol: ${parsed.protocol}`);
  }

  if (!parsed.hostname || !parsed.hostname.includes(".")) {
    // Allow localhost-style hosts; otherwise require a dotted hostname.
    if (parsed.hostname !== "localhost") {
      throw new Error(`Invalid URL host: ${raw}`);
    }
  }

  return parsed.toString();
}

const POPUP_TERMS = [
  "modal",
  "popup",
  "overlay",
  "newsletter",
  "subscribe",
  "exit-intent",
  "cookie-consent",
];

const TRUST_TERMS = [
  "testimonial",
  "review",
  "secure",
  "verified",
  "guarantee",
  "badge",
  "ssl",
  "as seen",
];

const STOCK_TELLS = ["unsplash", "shutterstock", "istockphoto", "lorem ipsum"];

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let idx = haystack.indexOf(needle);
  while (idx !== -1) {
    count++;
    idx = haystack.indexOf(needle, idx + needle.length);
  }
  return count;
}

function extractTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!m) return null;
  const text = m[1].replace(/\s+/g, " ").trim();
  return text.length ? text.slice(0, 300) : null;
}

function extractMetaDescription(html: string): string | null {
  // name="description" in either attribute order.
  const metaTags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of metaTags) {
    if (/name\s*=\s*["']?description["']?/i.test(tag)) {
      const content = tag.match(/content\s*=\s*"([^"]*)"/i) ?? tag.match(/content\s*=\s*'([^']*)'/i);
      if (content) {
        const text = content[1].replace(/\s+/g, " ").trim();
        return text.length ? text.slice(0, 500) : null;
      }
    }
  }
  return null;
}

function hasViewportMeta(html: string): boolean {
  const metaTags = html.match(/<meta\b[^>]*>/gi) ?? [];
  return metaTags.some((tag) => /name\s*=\s*["']?viewport["']?/i.test(tag));
}

function buildTextSample(html: string): string {
  const stripped = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
  return stripped.slice(0, 1500);
}

function parseSignals(
  html: string,
  base: SiteSignals,
): SiteSignals {
  const lower = html.toLowerCase();

  const imgTags = html.match(/<img\b[^>]*>/gi) ?? [];
  const imageCount = imgTags.length;
  const imagesMissingAlt = imgTags.filter(
    (tag) => !/\balt\s*=/i.test(tag),
  ).length;

  const scriptCount = (html.match(/<script\b/gi) ?? []).length;

  const popupIndicators = POPUP_TERMS.reduce(
    (sum, term) => sum + countOccurrences(lower, term),
    0,
  );
  const trustMarkers = TRUST_TERMS.reduce(
    (sum, term) => sum + countOccurrences(lower, term),
    0,
  );
  const hasStockPhotoTells = STOCK_TELLS.some((tell) => lower.includes(tell));

  return {
    ...base,
    title: extractTitle(html),
    metaDescription: extractMetaDescription(html),
    hasViewportMeta: hasViewportMeta(html),
    imageCount,
    imagesMissingAlt,
    scriptCount,
    popupIndicators,
    trustMarkers,
    hasStockPhotoTells,
    textSample: buildTextSample(html),
  };
}

/**
 * Fetch and heuristically analyze a target site. Never throws except for an
 * invalid URL (which surfaces as a 400 in the route). All fetch/parse failures
 * degrade gracefully into a SiteSignals object with fetchFailed: true.
 */
export async function analyzeSite(rawUrl: string): Promise<SiteSignals> {
  const url = normalizeUrl(rawUrl); // may throw on invalid input

  const failed: SiteSignals = {
    url,
    finalUrl: url,
    status: 0,
    https: url.startsWith("https://"),
    title: null,
    metaDescription: null,
    htmlBytes: 0,
    loadMs: 0,
    hasViewportMeta: false,
    imageCount: 0,
    imagesMissingAlt: 0,
    scriptCount: 0,
    popupIndicators: 0,
    trustMarkers: 0,
    hasStockPhotoTells: false,
    textSample: "",
    fetchFailed: true,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  const start = Date.now();

  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    const loadMs = Date.now() - start;
    let html = "";
    try {
      html = await res.text();
    } catch {
      html = "";
    }

    const finalUrl = res.url || url;
    let htmlBytes = 0;
    try {
      htmlBytes =
        typeof TextEncoder !== "undefined"
          ? new TextEncoder().encode(html).length
          : Buffer.byteLength(html, "utf8");
    } catch {
      htmlBytes = html.length;
    }

    const base: SiteSignals = {
      url,
      finalUrl,
      status: res.status,
      https: finalUrl.startsWith("https://"),
      title: null,
      metaDescription: null,
      htmlBytes,
      loadMs,
      hasViewportMeta: false,
      imageCount: 0,
      imagesMissingAlt: 0,
      scriptCount: 0,
      popupIndicators: 0,
      trustMarkers: 0,
      hasStockPhotoTells: false,
      textSample: "",
      fetchFailed: false,
    };

    try {
      return parseSignals(html, base);
    } catch {
      // Parsing blew up — return what we have rather than throwing.
      return base;
    }
  } catch {
    failed.loadMs = Date.now() - start;
    return failed;
  } finally {
    clearTimeout(timeout);
  }
}
