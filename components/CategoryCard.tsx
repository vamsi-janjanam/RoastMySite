import type { CategoryResult } from "@/lib/types";
import { scoreBg, scoreColor } from "@/components/ScoreGauge";

interface CategoryCardProps {
  category: CategoryResult;
}

/** A single category result: emoji + label, a score bar/pill, and the roast. */
export default function CategoryCard({ category }: CategoryCardProps) {
  const { emoji, label, score, roast } = category;
  const clamped = Math.max(0, Math.min(10, score));
  const pct = (clamped / 10) * 100;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-5 transition-colors hover:border-orange-500/40">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-base font-semibold text-neutral-100">
          <span className="text-2xl" aria-hidden>
            {emoji}
          </span>
          <span>{label}</span>
        </h3>
        <span
          className={`shrink-0 rounded-full bg-black/40 px-3 py-1 text-sm font-bold tabular-nums ${scoreColor(
            clamped,
          )}`}
        >
          {clamped.toFixed(1)}
          <span className="text-neutral-500">/10</span>
        </span>
      </div>

      <div
        className="h-2 w-full overflow-hidden rounded-full bg-white/10"
        role="meter"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={10}
        aria-label={`${label} score`}
      >
        <div
          className={`h-full rounded-full ${scoreBg(clamped)}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <p className="text-sm leading-relaxed text-neutral-300">{roast}</p>
    </div>
  );
}
