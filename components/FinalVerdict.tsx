import type { RoastResult } from "@/lib/types";
import ScoreGauge from "@/components/ScoreGauge";
import CategoryCard from "@/components/CategoryCard";

interface FinalVerdictProps {
  result: RoastResult;
}

/** Renders the overall score gauge + verdict and the 7 category cards. */
export default function FinalVerdict({ result }: FinalVerdictProps) {
  return (
    <div className="flex flex-col gap-10 animate-fade-up">
      <section className="flex flex-col items-center gap-4 rounded-3xl border border-white/10 bg-white/5 p-8">
        <p className="max-w-full truncate text-sm text-neutral-400">
          Verdict for{" "}
          <span className="font-medium text-orange-300">{result.url}</span>
        </p>
        <ScoreGauge score={result.overallScore} verdict={result.verdict}>
          {result.mock && (
            <span className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[11px] text-neutral-500">
              Demo mode (no AI key) — roasts are pre-baked.
            </span>
          )}
        </ScoreGauge>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-bold text-neutral-200">
          The category breakdown
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {result.categories.map((category) => (
            <CategoryCard key={category.key} category={category} />
          ))}
        </div>
      </section>
    </div>
  );
}
