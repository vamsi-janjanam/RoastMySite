import Anthropic from "@anthropic-ai/sdk";
import {
  CATEGORY_META,
  type CategoryKey,
  type CategoryResult,
  type RoastResult,
  type SiteSignals,
} from "@/lib/types";

const MODEL = "claude-sonnet-4-6";

const SYSTEM_PROMPT =
  "You are a savage but witty website roast critic. You deliver brutally funny, " +
  "punchy critiques of websites — think a stand-up comedian who also happens to " +
  "be a senior designer. Keep it PG-13: harsh, mean, hilarious, but no slurs or " +
  "explicit content. Score each category from 0 to 10, where 0 is a crime against " +
  "the web and 10 is grudging respect. Be harsh but fair — base your scoring and " +
  "jokes on the actual signals provided. Every roast line should be 1-3 sentences.";

export function clampScore(n: unknown): number {
  const v = typeof n === "number" && Number.isFinite(n) ? Math.round(n) : 0;
  return Math.max(0, Math.min(10, v));
}

interface ParsedCategory {
  key?: string;
  score?: number;
  roast?: string;
}

interface ParsedRoast {
  overallScore?: number;
  verdict?: string;
  categories?: ParsedCategory[];
}

/**
 * Robustly parse the model's JSON reply. Tolerates ```json code fences or a
 * little surrounding prose by extracting the outermost {...} object.
 */
export function parseRoastJson(raw: string): ParsedRoast {
  try {
    return JSON.parse(raw) as ParsedRoast;
  } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start !== -1 && end > start) {
      return JSON.parse(raw.slice(start, end + 1)) as ParsedRoast;
    }
    throw new Error("Claude response was not valid JSON.");
  }
}

function metaFor(key: CategoryKey): { label: string; emoji: string } {
  const m = CATEGORY_META.find((c) => c.key === key);
  return m ? { label: m.label, emoji: m.emoji } : { label: key, emoji: "🔥" };
}

/** Map a parsed model response into full CategoryResult[] in CATEGORY_META order. */
export function buildCategories(parsed: ParsedCategory[] | undefined): CategoryResult[] {
  const byKey = new Map<string, ParsedCategory>();
  for (const c of parsed ?? []) {
    if (c && typeof c.key === "string") byKey.set(c.key, c);
  }

  return CATEGORY_META.map(({ key, label, emoji }) => {
    const found = byKey.get(key);
    if (found) {
      return {
        key,
        label,
        emoji,
        score: clampScore(found.score),
        roast:
          typeof found.roast === "string" && found.roast.trim().length
            ? found.roast.trim()
            : "Apparently this one defied description. That's not a compliment.",
      };
    }
    // Model omitted this category — synthesize a neutral fallback.
    return {
      key,
      label,
      emoji,
      score: 5,
      roast: "The critic ran out of insults here. Consider yourself lucky.",
    };
  });
}

export function buildVerdict(overallScore: number): string {
  if (overallScore <= 2) return "Please delete this from the internet.";
  if (overallScore <= 4) return "A tragedy in HTML form. Seek help (a designer).";
  if (overallScore <= 6) return "Aggressively mediocre. The beige of websites.";
  if (overallScore <= 8) return "Not bad! It only mildly offended me.";
  return "10/10 would roast again. Genuinely solid.";
}

/** Pick a deterministic element from arr based on a numeric seed. */
function pick<T>(arr: T[], seed: number): T {
  if (arr.length === 0) throw new Error("pick: empty array");
  const idx = ((Math.floor(seed) % arr.length) + arr.length) % arr.length;
  return arr[idx];
}

type Band = "brutal" | "mediocre" | "respect";

function bandFor(score: number): Band {
  if (score <= 3) return "brutal";
  if (score <= 6) return "mediocre";
  return "respect";
}

interface TemplateSet {
  brutal: string[];
  mediocre: string[];
  respect: string[];
}

function lineFor(set: TemplateSet, score: number, seed: number): string {
  const band = bandFor(score);
  return pick(set[band], seed);
}

// ---- Deterministic mock scoring ---------------------------------------------

function scoreLoadingSpeed(s: SiteSignals): number {
  if (s.fetchFailed) return 0;
  let score = 10;
  if (s.loadMs > 5000) score -= 6;
  else if (s.loadMs > 2500) score -= 4;
  else if (s.loadMs > 1200) score -= 2;
  else if (s.loadMs > 600) score -= 1;
  if (s.htmlBytes > 2_000_000) score -= 3;
  else if (s.htmlBytes > 800_000) score -= 2;
  else if (s.htmlBytes > 300_000) score -= 1;
  if (s.scriptCount > 40) score -= 2;
  else if (s.scriptCount > 20) score -= 1;
  return clampScore(score);
}

function scoreVisualDesign(s: SiteSignals): number {
  if (s.fetchFailed) return 1;
  let score = 6;
  if (s.imageCount === 0) score -= 2;
  else if (s.imageCount > 3) score += 1;
  if (s.hasStockPhotoTells) score -= 2;
  if (s.imageCount > 0 && s.imagesMissingAlt === s.imageCount) score -= 1;
  if (!s.title) score -= 1;
  return clampScore(score);
}

function scoreCopywriting(s: SiteSignals): number {
  if (s.fetchFailed) return 1;
  let score = 5;
  const len = s.textSample.length;
  if (len < 50) score -= 3;
  else if (len < 200) score -= 1;
  else if (len > 800) score += 1;
  if (s.metaDescription) score += 2;
  if (s.title) score += 1;
  if (s.hasStockPhotoTells) score -= 1; // lorem ipsum tell
  return clampScore(score);
}

function scoreOriginality(s: SiteSignals): number {
  if (s.fetchFailed) return 2;
  let score = 7;
  if (s.hasStockPhotoTells) score -= 4;
  if (!s.metaDescription && !s.title) score -= 2;
  if (s.imageCount > 0 && s.imagesMissingAlt === s.imageCount) score -= 1;
  return clampScore(score);
}

function scoreMobileResponsiveness(s: SiteSignals): number {
  if (s.fetchFailed) return 1;
  let score = s.hasViewportMeta ? 8 : 3;
  if (!s.hasViewportMeta && s.scriptCount > 10) score -= 1;
  return clampScore(score);
}

function scoreTrustCredibility(s: SiteSignals): number {
  if (s.fetchFailed) return 1;
  let score = 4;
  if (s.https) score += 2;
  else score -= 1;
  score += Math.min(3, s.trustMarkers);
  if (s.status >= 400) score -= 3;
  return clampScore(score);
}

function scorePopupsAnnoyances(s: SiteSignals): number {
  if (s.fetchFailed) return 5;
  let score = 10;
  score -= Math.min(8, s.popupIndicators * 2);
  return clampScore(score);
}

// ---- Roast templates --------------------------------------------------------

const TEMPLATES: Record<CategoryKey, TemplateSet> = {
  loadingSpeed: {
    brutal: [
      "This site loaded so slowly I aged a year waiting. {loadMs}ms is not a speed, it's a hostage situation.",
      "{htmlBytes} bytes of HTML? Did you ship the entire internet? My browser filed for hazard pay.",
      "I've seen glaciers move faster. {loadMs}ms and still counting — somewhere a loading spinner is screaming.",
    ],
    mediocre: [
      "It loaded in {loadMs}ms, which is fine, the same way lukewarm coffee is fine.",
      "Not slow, not fast — {loadMs}ms of pure 'meh'. The internet equivalent of a shrug.",
      "{scriptCount} scripts later, it eventually showed up. Punctuality: questionable.",
    ],
    respect: [
      "Genuinely snappy at {loadMs}ms. I'm annoyed I have nothing to complain about.",
      "Fast load, lean payload. Someone here actually read a performance blog. Suspicious.",
      "{loadMs}ms. Quick enough that I almost respect you. Almost.",
    ],
  },
  visualDesign: {
    brutal: [
      "This design looks like it was assembled during a power outage. With mittens on.",
      "Did a CSS file get into a fight and lose? Because something visually traumatic happened here.",
      "Stock photo energy detected. It looks like a template that gave up halfway through.",
    ],
    mediocre: [
      "It's... a website. It has a layout. The bar was on the floor and you cleared it.",
      "Inoffensive and forgettable, like elevator music rendered in pixels.",
      "Visually it's beige with extra steps. Not ugly, just deeply unbothered.",
    ],
    respect: [
      "Actually pretty clean. Whoever designed this has touched grass and a design system.",
      "Solid visual hierarchy. I came to roast and left mildly impressed. How dare you.",
      "It looks intentional, which on this internet is a genuine miracle.",
    ],
  },
  copywriting: {
    brutal: [
      "The copy reads like it was written by a fax machine having a bad day.",
      "There's barely any text here, and what exists says nothing. Bold strategy.",
      "I've read cereal boxes with more compelling narratives than this.",
    ],
    mediocre: [
      "The words are present and grammatically alive. That's the nicest thing I can say.",
      "Copywriting that's technically correct — the most boring kind of correct.",
      "It tells me what you do, eventually, after I lose interest.",
    ],
    respect: [
      "The copy actually has a voice. Someone here can string a sentence together — rare.",
      "Clear, punchy, and it has a meta description. Look at you being competent.",
      "I read it without falling asleep. That's a five-star review from me.",
    ],
  },
  originality: {
    brutal: [
      "Unsplash and lorem ipsum walked in and never left. This is a template wearing a trench coat.",
      "I've seen this exact site 4,000 times. Originality went out for cigarettes and never came back.",
      "If 'generic' were a website, it would sue you for copyright.",
    ],
    mediocre: [
      "It's not a clone, but it's not exactly fresh either. Lukewarm originality.",
      "Familiar in a 'I've definitely seen a cousin of this' kind of way.",
      "Plays it safe. Safe is the enemy of memorable, but here we are.",
    ],
    respect: [
      "Actually has a point of view. Refreshingly not a copy of every other site.",
      "There's a real identity here. I didn't expect to say that today.",
      "Distinctive without trying too hard. Respect, grudgingly granted.",
    ],
  },
  mobileResponsiveness: {
    brutal: [
      "No viewport meta tag. On mobile this thing is a pinch-and-zoom escape room.",
      "Phone users will need a magnifying glass and a support group. Tragic.",
      "Responsive? This site responds to mobile the way a brick responds to questions.",
    ],
    mediocre: [
      "It probably works on mobile. 'Probably' is doing a lot of heavy lifting.",
      "Mobile-ready in the loosest sense, like a couch that technically fits through the door.",
      "It has a viewport tag and a prayer. We'll call it functional.",
    ],
    respect: [
      "Proper viewport setup — it actually thought about phones. Modern miracle.",
      "Mobile-friendly and unbothered by small screens. Nicely done.",
      "Works on mobile without a fight. That's the bar, and you cleared it well.",
    ],
  },
  trustCredibility: {
    brutal: [
      "No HTTPS, no trust markers — entering my card here would be an act of reckless faith.",
      "This site has the credibility of a 'free iPhone' popup. I trust it zero percent.",
      "Status code drama and no proof of legitimacy. Hard pass from my wallet.",
    ],
    mediocre: [
      "It's secure-ish and vaguely trustworthy. I'd hover over the back button, just in case.",
      "A couple of trust signals, but nothing that fully convinces me you're real.",
      "Credibility: present but shy. Could use a testimonial or two that aren't suspicious.",
    ],
    respect: [
      "HTTPS plus actual trust markers. I'd give you my email without flinching. High praise.",
      "It feels legit — secure, with credibility signals doing their job. Nice.",
      "Trustworthy enough that I'd read the privacy policy. (I won't, but I'd consider it.)",
    ],
  },
  popupsAnnoyances: {
    brutal: [
      "{popupIndicators} popup signals detected. This site is less a webpage and more a whack-a-mole arcade.",
      "Newsletter, cookies, exit-intent — I came to read and stayed to dismiss modals forever.",
      "The popups have popups. I needed three clicks just to confirm I didn't want anything.",
    ],
    mediocre: [
      "A few interruptions, but survivable. I only sighed twice.",
      "Mild popup activity. Annoying, but not 'close the tab in rage' annoying.",
      "There's a modal lurking somewhere, but it knows its place. Barely.",
    ],
    respect: [
      "Almost no popups. I could actually read in peace — what is this, a functional website?",
      "Clean and interruption-free. My cursor thanks you for the lack of newsletter ambushes.",
      "No annoying overlays jumping me. Restraint! On the internet! Incredible.",
    ],
  },
};

function fillTemplate(template: string, s: SiteSignals): string {
  return template
    .replace(/\{loadMs\}/g, String(s.loadMs))
    .replace(/\{htmlBytes\}/g, String(s.htmlBytes))
    .replace(/\{scriptCount\}/g, String(s.scriptCount))
    .replace(/\{popupIndicators\}/g, String(s.popupIndicators));
}

/** Deterministic mock roast derived entirely from the signals. */
export function mockRoast(signals: SiteSignals): RoastResult {
  const scorers: Record<CategoryKey, (s: SiteSignals) => number> = {
    loadingSpeed: scoreLoadingSpeed,
    visualDesign: scoreVisualDesign,
    copywriting: scoreCopywriting,
    originality: scoreOriginality,
    mobileResponsiveness: scoreMobileResponsiveness,
    trustCredibility: scoreTrustCredibility,
    popupsAnnoyances: scorePopupsAnnoyances,
  };

  // Deterministic seed from the URL so the same site always reads the same way.
  let urlSeed = 0;
  for (let i = 0; i < signals.url.length; i++) {
    urlSeed = (urlSeed * 31 + signals.url.charCodeAt(i)) >>> 0;
  }

  const categories: CategoryResult[] = CATEGORY_META.map(
    ({ key, label, emoji }, i) => {
      const score = scorers[key](signals);
      const seed = urlSeed + score * 7 + i;
      const roast = fillTemplate(lineFor(TEMPLATES[key], score, seed), signals);
      return { key, label, emoji, score, roast };
    },
  );

  const overallScore = clampScore(
    Math.round(
      categories.reduce((sum, c) => sum + c.score, 0) / categories.length,
    ),
  );

  return {
    url: signals.url,
    overallScore,
    verdict: buildVerdict(overallScore),
    categories,
    fetchedAt: new Date().toISOString(),
    mock: true,
  };
}

function serializeSignals(s: SiteSignals): string {
  return JSON.stringify(
    {
      url: s.url,
      finalUrl: s.finalUrl,
      status: s.status,
      https: s.https,
      fetchFailed: s.fetchFailed,
      title: s.title,
      metaDescription: s.metaDescription,
      htmlBytes: s.htmlBytes,
      loadMs: s.loadMs,
      hasViewportMeta: s.hasViewportMeta,
      imageCount: s.imageCount,
      imagesMissingAlt: s.imagesMissingAlt,
      scriptCount: s.scriptCount,
      popupIndicators: s.popupIndicators,
      trustMarkers: s.trustMarkers,
      hasStockPhotoTells: s.hasStockPhotoTells,
      textSample: s.textSample,
    },
    null,
    2,
  );
}

async function claudeRoast(signals: SiteSignals): Promise<RoastResult> {
  const client = new Anthropic();

  const categoryList = CATEGORY_META.map(
    (c) => `- "${c.key}" (${c.label})`,
  ).join("\n");

  const userContent = [
    "Roast the following website based on these analyzed signals.",
    "",
    "SIGNALS:",
    serializeSignals(signals),
    "",
    signals.fetchFailed
      ? "NOTE: The site could not be fetched at all. Roast the fact that it wouldn't even load."
      : "",
    "Produce a roast for ALL seven categories below, each with an integer score 0-10 and a 1-3 sentence roast line. Then give an overall integer score 0-10 and a single savage verdict line.",
    "",
    "CATEGORIES (use these exact keys):",
    categoryList,
    "",
    "Respond with ONLY a single raw JSON object (no markdown, no code fences, no prose) matching exactly this shape:",
    JSON.stringify(
      {
        overallScore: 0,
        verdict: "string",
        categories: CATEGORY_META.map((c) => ({
          key: c.key,
          score: 0,
          roast: "string",
        })),
      },
      null,
      2,
    ),
  ]
    .filter(Boolean)
    .join("\n");

  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userContent }],
  });

  // Parse the first text block's JSON.
  const textBlock = res.content.find(
    (b): b is Anthropic.TextBlock => b.type === "text",
  );
  if (!textBlock) {
    throw new Error("No text block in Claude response.");
  }

  const parsed = parseRoastJson(textBlock.text);
  const categories = buildCategories(parsed.categories);
  const overallScore = clampScore(parsed.overallScore);
  const verdict =
    typeof parsed.verdict === "string" && parsed.verdict.trim().length
      ? parsed.verdict.trim()
      : buildVerdict(overallScore);

  return {
    url: signals.url,
    overallScore,
    verdict,
    categories,
    fetchedAt: new Date().toISOString(),
    mock: false,
  };
}

/**
 * Generate a roast. Uses the Claude API when ANTHROPIC_API_KEY is set,
 * otherwise (and on ANY Claude error) falls back to the deterministic mock
 * engine so the route never 500s on AI issues.
 */
export async function generateRoast(signals: SiteSignals): Promise<RoastResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return mockRoast(signals);
  }

  try {
    return await claudeRoast(signals);
  } catch (err) {
    console.warn(
      "[roast] Claude roast failed, falling back to mock engine:",
      err instanceof Error ? err.message : err,
    );
    return mockRoast(signals);
  }
}
