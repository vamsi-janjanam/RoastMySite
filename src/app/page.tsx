"use client";

import { useState } from "react";
import type { RoastResult, RoastError } from "@/lib/types";
import RoastForm from "@/components/RoastForm";
import FinalVerdict from "@/components/FinalVerdict";
import PaidCta from "@/components/PaidCta";

const HOW_IT_WORKS = [
  { n: "1", text: "Paste the URL of the website you (foolishly) built." },
  { n: "2", text: "We fetch it and unleash an AI critic with zero chill." },
  { n: "3", text: "Receive a scored, brutally honest, deeply funny roast." },
];

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RoastResult | null>(null);

  async function handleRoast(url: string) {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/roast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data: RoastResult | RoastError = await res.json();
      if (!res.ok || "error" in data) {
        const message =
          "error" in data && data.error
            ? data.error
            : "Something went up in flames. Try again.";
        setError(message);
        return;
      }
      setResult(data);
    } catch {
      setError(
        "Couldn't reach the roast kitchen. Check your connection and try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setResult(null);
    setError(null);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-12 px-4 py-12 sm:py-16">
      <header className="flex flex-col items-center gap-5 text-center">
        <h1 className="text-balance text-4xl font-black tracking-tight text-orange-500 animate-fire-flicker sm:text-6xl">
          🔥 Roast My Site 🔥
        </h1>
        <p className="max-w-2xl text-balance text-base text-neutral-300 sm:text-lg">
          Paste your URL, and we&apos;ll roast it like it&apos;s 2026 and your
          design is still stuck in 2010.
        </p>
      </header>

      {!result && (
        <>
          <RoastForm onSubmit={handleRoast} loading={loading} />

          {error && (
            <div
              role="alert"
              className="mx-auto w-full max-w-2xl rounded-2xl border border-red-500/40 bg-red-950/40 p-5 text-center"
            >
              <p className="text-sm font-semibold text-red-300">
                🧯 {error}
              </p>
              <p className="mt-1 text-xs text-neutral-400">
                Fix the URL above and hit roast again.
              </p>
            </div>
          )}

          {!loading && (
            <section className="mx-auto w-full max-w-3xl">
              <h2 className="mb-5 text-center text-sm font-semibold uppercase tracking-widest text-neutral-500">
                How It Works
              </h2>
              <ol className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {HOW_IT_WORKS.map((step) => (
                  <li
                    key={step.n}
                    className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-5 text-center"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-r from-red-600 to-orange-500 text-sm font-black text-white">
                      {step.n}
                    </span>
                    <p className="text-sm text-neutral-300">{step.text}</p>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </>
      )}

      {result && (
        <div className="flex flex-col gap-10">
          <FinalVerdict result={result} />
          <PaidCta />
          <div className="flex justify-center">
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-neutral-200 transition-colors hover:border-orange-500/50 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/50"
            >
              🔁 Roast another site
            </button>
          </div>
        </div>
      )}

      <footer className="mt-auto pt-8 text-center text-xs text-neutral-600">
        Roast My Site — no websites were permanently harmed (probably).
      </footer>
    </main>
  );
}
