"use client";

/** Tongue-in-cheek paid "roast recovery" upsell banner from the spec. */
export default function PaidCta() {
  return (
    <div className="overflow-hidden rounded-2xl bg-gradient-to-r from-red-600 via-orange-600 to-amber-500 p-[2px] shadow-xl shadow-orange-900/30 animate-fade-up">
      <div className="rounded-2xl bg-neutral-950/85 p-6 text-center sm:p-8">
        <h2 className="text-balance text-2xl font-black text-white sm:text-3xl">
          💸 Your site is doomed... but I do take Venmo
        </h2>
        <p className="mt-3 text-sm text-neutral-300 sm:text-base">
          I roasted it for free. Fixing it costs extra. Hire me before your
          users do the roasting for you.
        </p>
        <button
          type="button"
          onClick={() =>
            alert("Just kidding... mostly. Slide into my DMs and let's talk.")
          }
          className="mt-6 inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-red-500 to-orange-500 px-6 py-3 text-sm font-bold text-white shadow-lg transition-transform hover:scale-[1.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 sm:text-base"
        >
          🔥 HIRE ME TO UN-ROAST IT
        </button>
      </div>
    </div>
  );
}
