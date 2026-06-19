# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

**Implemented.** "Roast My Site" is a working Next.js app. The full product vision lives in `roast_my_site_spec.md`.

## Stack

- Next.js 15 (App Router) + React 19
- TypeScript (strict)
- Tailwind CSS v3
- Anthropic SDK (`@anthropic-ai/sdk`) for the AI roast
- Vitest for tests

## Commands

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm start` — run the production server
- `npm run lint` — ESLint
- `npm run typecheck` — `tsc --noEmit`
- `npm test` — run the Vitest suite

## Product

A user pastes a website URL and an AI returns a brutally funny critique of it, plus an overall score. The roast is organized into seven fixed categories, each scored/commented independently, then aggregated into a final verdict:

- Loading Speed
- Visual Design
- Copywriting
- Originality
- Mobile Responsiveness
- Trust & Credibility
- Popups & Annoyances

The spec also describes a (tongue-in-cheek) paid "roast recovery" upsell CTA — keep the playful, savage tone of the spec in mind when building user-facing copy.

## Architecture / data flow

URL input (`components/RoastForm.tsx`) → `POST /api/roast` (`app/api/roast/route.ts`) → `analyzeSite()` in `lib/analyze.ts` fetches the target page and extracts heuristic `SiteSignals` → `generateRoast()` in `lib/roast.ts` produces a `RoastResult`, either via the Claude API (model `claude-opus-4-8`, when `ANTHROPIC_API_KEY` is set) or a deterministic mock engine fallback (always works offline, and is also used on any Claude error so the route never 500s on AI issues) → results rendered by `components/FinalVerdict.tsx` (a `ScoreGauge` + seven `CategoryCard`s) plus `PaidCta`.

The seven fixed roast categories and the shared types live in `lib/types.ts` (`CategoryKey`, `CATEGORY_META`, `SiteSignals`, `RoastResult`). These types are the contract between the analysis/roast backend and the results UI — respect them exactly.

## Env

- `ANTHROPIC_API_KEY` — optional (see `.env.example`). When absent, the deterministic mock roast engine is used instead of the Claude API.

## Tests

Tests use Vitest, are colocated next to the code as `*.test.ts`, and run via `npm test`. Import test helpers from `vitest` (e.g. `import { describe, it, expect, vi } from "vitest";`).
