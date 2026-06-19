import { analyzeSite, normalizeUrl } from "@/lib/analyze";
import { generateRoast } from "@/lib/roast";
import type { RoastError, RoastRequest, RoastResult } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: "Request body must be valid JSON." } satisfies RoastError,
      { status: 400 },
    );
  }

  const { url } = (body ?? {}) as Partial<RoastRequest>;
  if (typeof url !== "string" || url.trim().length === 0) {
    return Response.json(
      { error: "A 'url' string is required." } satisfies RoastError,
      { status: 400 },
    );
  }

  // Validate / normalize the URL up front so bad input is a clean 400.
  try {
    normalizeUrl(url);
  } catch (err) {
    return Response.json(
      {
        error:
          err instanceof Error ? err.message : "Invalid URL.",
      } satisfies RoastError,
      { status: 400 },
    );
  }

  try {
    const signals = await analyzeSite(url);
    const result = await generateRoast(signals);
    return Response.json(result satisfies RoastResult);
  } catch (err) {
    console.error("[roast] Unexpected error:", err);
    return Response.json(
      {
        error: "Something went wrong while roasting that site.",
      } satisfies RoastError,
      { status: 500 },
    );
  }
}
