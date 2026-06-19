"use client";

import { useEffect, useState } from "react";

const LOADING_MESSAGES = [
  "Preheating the oven…",
  "Sharpening insults…",
  "Judging your font choices…",
  "Counting your popups…",
  "Measuring load times with a sundial…",
  "Questioning that hero image…",
  "Consulting the design gods…",
  "Lighting the roasting fire 🔥",
];

interface RoastFormProps {
  onSubmit: (url: string) => void;
  loading: boolean;
}

/** URL input form + the cheeky rotating loading status. */
export default function RoastForm({ onSubmit, loading }: RoastFormProps) {
  const [url, setUrl] = useState("");
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    if (!loading) {
      setMsgIndex(0);
      return;
    }
    const id = setInterval(() => {
      setMsgIndex((i) => (i + 1) % LOADING_MESSAGES.length);
    }, 1400);
    return () => clearInterval(id);
  }, [loading]);

  return (
    <div className="mx-auto w-full max-w-2xl">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const trimmed = url.trim();
          if (trimmed && !loading) onSubmit(trimmed);
        }}
        className="flex flex-col gap-3 sm:flex-row"
      >
        <label htmlFor="site-url" className="sr-only">
          Website URL to roast
        </label>
        <input
          id="site-url"
          type="url"
          inputMode="url"
          autoComplete="url"
          required
          disabled={loading}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://your-questionable-website.com"
          className="w-full flex-1 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-base text-neutral-100 placeholder:text-neutral-500 focus:border-orange-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/50 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={loading || !url.trim()}
          className="inline-flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-red-600 to-orange-500 px-6 py-3 text-base font-bold text-white shadow-lg shadow-orange-900/30 transition-transform hover:scale-[1.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
        >
          {loading ? "Roasting…" : "🔥 Roast It"}
        </button>
      </form>

      {loading && (
        <p
          className="mt-5 text-center text-sm font-medium text-orange-300 animate-fire-flicker"
          aria-live="polite"
        >
          {LOADING_MESSAGES[msgIndex]}
        </p>
      )}
    </div>
  );
}
