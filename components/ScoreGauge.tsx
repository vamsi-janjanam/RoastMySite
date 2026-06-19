import type { ReactNode } from "react";

/** Returns a tailwind text color band for a 0–10 score. */
export function scoreColor(score: number): string {
  if (score <= 3) return "text-red-500";
  if (score <= 6) return "text-amber-400";
  return "text-green-400";
}

/** Returns a tailwind bg color band for a 0–10 score (used for bars/rings). */
export function scoreBg(score: number): string {
  if (score <= 3) return "bg-red-500";
  if (score <= 6) return "bg-amber-400";
  return "bg-green-400";
}

interface ScoreGaugeProps {
  score: number;
  verdict: string;
  children?: ReactNode;
}

/** Big circular overall-score badge with the savage verdict headline. */
export default function ScoreGauge({ score, verdict, children }: ScoreGaugeProps) {
  const clamped = Math.max(0, Math.min(10, score));
  const pct = (clamped / 10) * 100;

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div className="relative flex h-40 w-40 items-center justify-center sm:h-48 sm:w-48">
        <div
          className={`absolute inset-0 rounded-full ${scoreColor(clamped)}`}
          style={{
            background: `conic-gradient(currentColor ${pct}%, rgba(255,255,255,0.08) ${pct}%)`,
          }}
          aria-hidden
        />
        <div className="absolute inset-3 flex flex-col items-center justify-center rounded-full bg-neutral-950">
          <span className={`text-5xl font-black tabular-nums sm:text-6xl ${scoreColor(clamped)}`}>
            {clamped.toFixed(1)}
          </span>
          <span className="text-xs font-medium uppercase tracking-widest text-neutral-500">
            / 10
          </span>
        </div>
      </div>

      <div className="max-w-2xl">
        <p className="text-balance text-xl font-bold leading-snug text-neutral-100 sm:text-2xl">
          “{verdict}”
        </p>
      </div>
      {children}
    </div>
  );
}
