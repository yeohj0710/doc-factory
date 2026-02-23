# doc-factory - Codex Operating Rules (Image-only -> A4 Pages -> PPTX Export)

## Maintenance Mode Intent

This file is the long-lived quality contract for future Codex sessions.

When the user says "MAINTENANCE mode":

- Do not optimize one-off output only.
- Improve reusable workflow, constraints, template system, validation, and architecture.
- Prefer structural fixes over ad-hoc coordinate tweaks.
- Leave clear guardrails so a new session can produce high-quality pages without guesswork.

## Product Goal (must match)

This repository is a local document page builder where:

- The ONLY required user input is placing image files into `/images`.
- Optionally, user can place font files into `/fonts`.
- Codex generates a set of A4 pages (each page = one component/layout) based on the images.
- A local web app (localhost) previews the pages.
- The web app can export ALL pages into a single A4-sized PPTX.
- The human edits the PPTX and exports final PDF (outside this app).

## Absolute Rules

- Keep repo root SIMPLE. Users should only need:
  - `/images` (required input)
  - `/fonts` (optional)
  - Everything else must be under `/src` and standard Next.js folders.
- No external network fetches at runtime (no Google Fonts, no remote images).
- Deterministic output given the same `/images`, `/fonts`, and code.
- Do NOT require the user to edit JSON specs. Codex may generate internal layout files, but users should not touch them.
- PPTX export must be editable (text/shapes), not screenshot-based.
- Slides MUST be A4 sized (portrait by default). Document the choice.

## Design Quality Bar (Non-negotiable)

Every generated page must satisfy ALL of the following:

- No unintentional overlap of semantic blocks (text, cards, metrics, chips, footer).
- No out-of-bounds placement outside A4 canvas.
- No text clipping or unreadable density.
- No arbitrary element collisions caused by random coordinate edits.
- Stable visual rhythm (margins, gutters, vertical spacing) across all pages.
- Content and visual hierarchy must look intentional, not random.

If a template cannot satisfy these constraints for some image ratio/content volume, fall back to a safer template.

## Required Workflow for Any Layout Change

Codex must follow this sequence in order:

1. Intake and ordering
- Scan `/images` and apply the image ordering policy exactly.
- Scan `/fonts` and resolve primary/fallback font choice.

2. Page brief planning (before drawing)
- For each image, create a brief with:
  - chosen template
  - reason for choosing that template
  - expected reading flow (top -> bottom, left -> right)
  - maximum text budget for the page

3. Zone wireframe (before final elements)
- Define non-overlapping zones first (hero, body, metrics, footer, etc.).
- Compute zones from tokens and page dimensions, not arbitrary magic numbers.
- Lock margins, gutters, and reserved footer zone before placing content.

4. Content planning
- Decide title/subtitle/body/callout lengths to fit the allocated zones.
- If reliable text is unavailable, use cleaned filename caption plus minimal neutral helper text.

5. Element emission
- Place image frame first, then text blocks, then supporting shapes.
- Use deterministic anchor and fit values.

6. Validation gates
- Run geometry and text-fit checks.
- If any gate fails, adjust template/zones and re-run.

7. Preview/PPTX parity check
- Verify that web preview and PPTX coordinates produce equivalent composition.

8. Export validation
- Ensure one A4 slide per page and editable objects in PPTX.

## Divide-and-Conquer Page Construction (Required)

For each page, use this decomposition:

1. Template selection
- Choose from a small template set only (3-5 templates).

2. Layout skeleton
- Create structural zones only (no decorative details yet).
- Reserve footer/header lanes early.

3. Primary media placement
- Fit image within its zone with predictable crop logic.

4. Typography pass
- Add title/subtitle/body in strict order of hierarchy.
- Enforce text budget per zone.

5. Support components
- Add chips/metrics/cards only if space remains after text-fit checks.

6. QA pass
- Validate collisions, boundaries, and text overflow.
- Reject page if any hard rule fails.

## Geometry, Spacing, and Typographic Constraints

- Use mm as the canonical layout unit.
- Keep page margin consistent (default 12mm unless explicitly changed in tokens).
- Keep minimum gutter >= 4mm between unrelated blocks.
- Footer must have a reserved lane and must not collide with body content.
- Body text minimum size: 9pt.
- Preferred line height: 1.2 to 1.35.
- Avoid more than 3 visual emphasis layers on one area (for clarity).
- Image frames must not invade text zones.
- Decorative shapes must never hide required text.

## Content Quality Policy

- Keep copy concise, factual, and layout-aware.
- Do not generate nonsense filler text to occupy space.
- Use filename-derived caption when domain-specific text is uncertain.
- Keep language consistent within a page.
- Enforce valid UTF-8 text; never ship mojibake or broken encoding.
- If text density exceeds template capacity, reduce text before shrinking font.

## Template Policy

- Keep a small, consistent template set (3-5 templates).
- Each template must document:
  - intended image ratio range
  - fixed zone map
  - max text budget
  - fallback template when constraints fail
- Avoid uncontrolled per-page custom templates.

Required baseline template family:

- Full-bleed image + small caption/footer
- Title + image (safe margins)
- Two-column (image + text/caption)

## Validation Gates (Must exist and be used)

Codex should maintain reusable validation logic (not manual eyeballing only).

Hard checks:

- Boundary check: every element inside page bounds.
- Collision check: forbidden overlap across protected zones.
- Minimum-size check: text and cards above readability thresholds.
- Text-fit check: line count and estimated overflow within each text box.
- Layering check: text must not be occluded by later shapes.
- Determinism check: same inputs produce identical layout structure.

A session is incomplete if hard checks fail.

## Image Ordering Policy

When building page order:

1. If filenames contain a leading number (e.g., `001_`, `01-`, `p1`, `(1)`), sort by that number.
2. Else sort by file modified time ascending (approx insertion order).
3. Else natural sort by filename.

If uncertain, keep order stable and do not invent complex reordering.

## Font Policy

- Prefer fonts in `/fonts` if present. Otherwise use safe system fonts.
- Do not download fonts.
- If multiple fonts exist, pick one primary and one fallback; keep it consistent.

## Implementation Constraints

- Next.js App Router.
- PPTX export via `pptxgenjs` in Node runtime.
- Preview is a web page rendering A4 pages (CSS sized) from a shared internal layout model.
- IMPORTANT: Do not attempt to convert React to PPTX.
- Use a shared internal layout model (DSL) that both:
  - web preview renderer uses
  - PPTX renderer uses

## Internal Architecture (Required)

- `/images` user input (committable).
- `/fonts` optional input (committable).
- Internal code under:
  - `/src/layout` (layout model types + template selection + layout generation)
  - `/src/render/web` (render layout model to HTML/CSS)
  - `/src/render/pptx` (render layout model to PPTX with pptxgenjs)
  - `/src/io` (scan images/fonts; ordering)
- A generated internal file MAY exist (e.g., `/src/generated/layout.ts`), but keep it minimal.

## UX Requirements

Localhost page shows:

- All pages in order (A4 preview)
- Button: `Export PPTX (A4)`
- Button: `Regenerate Layout` (optional but helpful)

Export returns a single PPTX with one slide per page.

## Done Criteria for Layout-related Sessions

Before declaring completion:

- Quality gates pass on generated pages.
- No known overlap or clipping defects remain.
- Preview and PPTX render stay layout-parity for tested pages.
- A4 portrait dimensions remain exact (`210mm x 297mm`).
- Changes are deterministic and reproducible.

## Commands

- `npm i`
- `npm run dev`
- open `http://localhost:3000`