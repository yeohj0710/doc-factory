# doc-factory — Codex Operating Rules (Image-only → A4 Pages → PPTX Export)

## Product goal (must match)

This repository is a local “document page builder” where:

- The ONLY required user input is placing image files into `/images`.
- Optionally, user can place font files into `/fonts`.
- Codex generates a set of A4 “pages” (each page = one component/layout) based on the images.
- A local web app (localhost) previews the pages.
- The web app can export ALL pages into a single A4-sized PPTX.
- The human edits the PPTX and exports final PDF (outside this app).

## Absolute rules

- Keep repo root SIMPLE. Users should only need:
  - `/images` (required input)
  - `/fonts` (optional)
  - Everything else must be under `/src` and standard Next.js folders.
- No external network fetches at runtime (no Google Fonts, no remote images).
- Deterministic output given the same `/images`, `/fonts`, and code.
- Do NOT require the user to edit JSON specs. Codex may generate internal layout files, but users should not touch them.
- PPTX export must be editable (text/shapes), not a screenshot-based PPTX.
- Slides MUST be A4 sized (portrait by default). Document the choice.

## Image ordering policy

When building page order:

1. If filenames contain a leading number (e.g., 001\_, 01-, p1, (1)), sort by that number.
2. Else sort by file modified time ascending (approx insertion order).
3. Else natural sort by filename.
   If uncertain, keep order stable and do not invent complex reordering.

## Layout policy

- Each input image becomes at least one A4 page.
- Codex may choose among a SMALL set of page templates (3–5) to make pages look clean.
- Templates must be consistent, minimal, and editable in PPTX:
  - Full-bleed image + small caption/footer
  - Title + image (with safe margins)
  - Two-column (image + text/caption)
- If there is no reliable text, use filename-derived caption (cleaned) as minimal text.
- Keep margins consistent (in mm). Avoid overlapping elements.

## Font policy

- Prefer fonts in `/fonts` if present. Otherwise use safe system fonts.
- Do not download fonts.
- If multiple fonts exist, pick one primary and one fallback; keep it consistent.

## Implementation constraints

- Next.js App Router.
- PPTX export via `pptxgenjs` in Node runtime.
- Preview is a web page rendering A4 pages (CSS sized) based on an internal layout model.
- IMPORTANT: Do not attempt to “convert React to PPTX.” Use a shared internal layout model (DSL) that both:
  - Web preview renderer uses
  - PPTX renderer uses

## Internal architecture (required)

- `/images` user input (committable).
- `/fonts` optional input (committable).
- Internal code under:
  - `/src/layout` (layout model types + template selection + layout generation)
  - `/src/render/web` (render layout model to HTML/CSS)
  - `/src/render/pptx` (render layout model to PPTX with pptxgenjs)
  - `/src/io` (scan images/fonts; ordering)
- A generated internal file MAY exist (e.g., `/src/generated/layout.ts`), but keep it minimal.

## UX requirements

- Localhost page shows:
  - All pages in order (A4 preview)
  - Button: “Export PPTX (A4)”
  - Button: “Regenerate Layout” (optional but helpful)
- Export returns a single PPTX with one slide per page.

## Commands

- npm i
- npm run dev
- open http://localhost:3000
