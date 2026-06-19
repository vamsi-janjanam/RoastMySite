// Shared contract between the analysis/roast backend and the results UI.
// Both Developer Agents must respect these types exactly.

/** The seven fixed roast categories from the product spec. */
export type CategoryKey =
  | "loadingSpeed"
  | "visualDesign"
  | "copywriting"
  | "originality"
  | "mobileResponsiveness"
  | "trustCredibility"
  | "popupsAnnoyances";

/** Static, ordered metadata for each category (label + emoji for the UI). */
export const CATEGORY_META: { key: CategoryKey; label: string; emoji: string }[] = [
  { key: "loadingSpeed", label: "Loading Speed", emoji: "⚡" },
  { key: "visualDesign", label: "Visual Design", emoji: "🎨" },
  { key: "copywriting", label: "Copywriting", emoji: "✍️" },
  { key: "originality", label: "Originality", emoji: "🌟" },
  { key: "mobileResponsiveness", label: "Mobile Responsiveness", emoji: "📱" },
  { key: "trustCredibility", label: "Trust & Credibility", emoji: "🛡️" },
  { key: "popupsAnnoyances", label: "Popups & Annoyances", emoji: "🪟" },
];

/** A single scored + roasted category in the final result. */
export interface CategoryResult {
  key: CategoryKey;
  label: string;
  emoji: string;
  /** 0–10, where 10 is great and 0 is a war crime against the web. */
  score: number;
  /** The brutally funny one-to-three sentence critique for this category. */
  roast: string;
}

/** The full roast returned by POST /api/roast and rendered by the UI. */
export interface RoastResult {
  /** The (normalized) URL that was roasted. */
  url: string;
  /** Aggregate 0–10 score. */
  overallScore: number;
  /** Savage overall summary / final verdict. */
  verdict: string;
  /** Per-category breakdown, in CATEGORY_META order. */
  categories: CategoryResult[];
  /** ISO timestamp of when the roast was generated. */
  fetchedAt: string;
  /** True when the deterministic mock engine produced this (no API key). */
  mock: boolean;
}

/** Request body for POST /api/roast. */
export interface RoastRequest {
  url: string;
}

/** Error response shape for POST /api/roast. */
export interface RoastError {
  error: string;
}

/**
 * Heuristic signals extracted from the fetched target page. Feeds both the
 * mock engine and the Claude prompt. All fields are best-effort.
 */
export interface SiteSignals {
  url: string;
  /** Final URL after redirects. */
  finalUrl: string;
  /** HTTP status of the fetch. */
  status: number;
  /** Whether the site was served over HTTPS. */
  https: boolean;
  /** <title> text, if any. */
  title: string | null;
  /** <meta name="description"> content, if any. */
  metaDescription: string | null;
  /** Rough byte size of the returned HTML document. */
  htmlBytes: number;
  /** Milliseconds the document took to fetch. */
  loadMs: number;
  /** Whether a responsive <meta name="viewport"> tag is present. */
  hasViewportMeta: boolean;
  /** Count of <img> tags. */
  imageCount: number;
  /** Count of <img> tags missing an alt attribute. */
  imagesMissingAlt: number;
  /** Count of <script> tags. */
  scriptCount: number;
  /** Heuristic count of popup/modal/overlay/newsletter indicators. */
  popupIndicators: number;
  /** Heuristic count of trust markers (testimonial, secure, badge, reviews…). */
  trustMarkers: number;
  /** Whether the page references common stock-photo / template tells. */
  hasStockPhotoTells: boolean;
  /** First chunk of visible-ish text content, for tone/copy analysis. */
  textSample: string;
  /** True if the page could not be fetched/parsed (signals are degraded). */
  fetchFailed: boolean;
}
