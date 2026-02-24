# doc-factory — AGENTS.md (A4 Proposal Builder Quality Contract)

Updated: 2026-02-24

This repo auto-builds an A4 portrait corporate proposal (editable PPTX) using ONLY:

- /images (required)
- /fonts (optional)

If the user message starts with:

- "MAINTENANCE mode:" => follow MAINTENANCE rules
- Otherwise => default to DESIGN mode

---

## 0) Product Goal (must match)

- User drops images into /images (and optionally fonts into /fonts).
- App generates A4 pages (portrait) with a coherent document narrative.
- Localhost previews all pages.
- Export outputs ONE PPTX containing ONE A4 slide per page.
- PPTX must be fully editable (text/shapes), not screenshot slides.

A4 portrait is exact: 210mm x 297mm.

---

## 1) Absolute Rules

- Repo root must stay simple: only /images and /fonts are user-facing.
- No runtime network fetches (no Google fonts, no remote images).
- Deterministic output given same inputs.
- Users must not edit any layout specs.
- Shared internal layout model (DSL) drives BOTH preview and PPTX. Never “convert React to PPTX”.

---

## 2) Mode Rules

### DESIGN mode (default)

Goal: produce high-quality pages for current /images quickly WITHOUT risky refactors.
Allowed: template tweaks, copy rules, small layout improvements.
Not allowed: large architecture rewrite, moving folders, deleting major systems.

### MAINTENANCE mode

Goal: improve reusable workflow (planning, template system, validation, parity).
Allowed: refactors that reduce drift, add planners, enforce gates, add new templates (within limits).
Not allowed: page-by-page coordinate hacks, per-image custom React pages, one-off patches.

---

## 3) Reset Protocol (MANDATORY at start of MAINTENANCE)

Purpose: remove drift so Codex cannot “patch old results”.

Delete:

- any per-page React components created for specific images
- any per-image coordinate maps / special-case layout files
- any old generated outputs (e.g., /src/generated/\*\*)

Preserve reusable layers:

- /src/io
- /src/layout
- /src/render/web
- /src/render/pptx

After reset, preview + export must still work end-to-end.

---

## 4) Internal Architecture (Required)

Inputs:

- /images
- /fonts

Code:

- /src/io (scan images/fonts; ordering)
- /src/planner (DOCUMENT planner + storyboard; REQUIRED)
- /src/layout (DSL types, templates, generator, validation)
- /src/render/web (DSL -> HTML/CSS preview)
- /src/render/pptx(DSL -> PPTX with pptxgenjs)

Generated internal output (single source allowed):

- /src/generated/layout.ts (or layout.json)
  No other generated page files allowed.

---

## 5) Canonical Units & Constraints

- Canonical unit in DSL: millimeters (mm).
- Default margin: 12mm.
- Minimum gutter between unrelated blocks: 4mm.
- Footer reserved lane: >= 14mm (hard reserved zone).
- Body text: >= 9pt, line height 1.2–1.35.
- Never shrink fonts to fit before reducing text volume.

---

## 6) Image Ordering Policy (MUST)

1. If filename has leading number (001\_, 01-, p1, (1)), sort by that number.
2. Else sort by file modified time ascending.
3. Else natural sort by filename.

Order must be stable.

---

## 7) Font Policy (MUST)

- Use /fonts if present; otherwise safe system fonts.
- Choose 1 primary + 1 fallback. Keep consistent.

---

## 8) CRITICAL: Document Planner (New, Mandatory)

The system must NOT generate “one page per image” blindly.

### 8.1 Document Plan (before any page)

Generate a document-level plan:

- Document title (from user prompt or default)
- Target audience (B2B 담당자/임직원)
- Document goal (소개서/제안서/브로셔)
- Narrative sections (cover → agenda → problem → solution → process → proof → package → CTA)
- Decide page count (variable) based on:
  - number of distinct topics (cluster images by filename keywords)
  - available proof assets (screenshots/report/process)
  - copy budget capacity
    Rules:
- Page count MUST be variable. (Typical: 6–12)
- If images are redundant/low-signal, DO NOT force them into pages.
- Always include at least one TEXT_ONLY page to avoid image-dependence.

### 8.2 Storyboard (page-by-page map)

Create a storyboard table:

- Page #, Page role, Template, Primary asset (image or none), Copy budget, Success criteria
  Storyboard must ensure variety:
- Do NOT use the same template more than 2 times in a row.
- Max 40% of pages can be full-bleed image style.
- At least 2 different templates must appear in first 4 pages.

Only after storyboard is approved internally, proceed to page generation.

---

## 9) Template System (3–7 templates, enforce variety)

Keep a small set, but enough to avoid monotony.

Required templates:
T0) COVER_HERO (cover only)
T1) AGENDA_EDITORIAL (text-heavy agenda / section divider)
T2) TITLE_MEDIA_SAFE (classic title + media + bullets)
T3) TWO_COLUMN_MEDIA_TEXT (UI screenshot + explanation)
T4) PROCESS_FLOW (3–5 step timeline/flow; image optional)
T5) METRICS_PROOF (KPIs / proof cards; image optional)
T6) TEXT_ONLY_EDITORIAL (no image; strong typography + cards)

Each template documents:

- intended use
- zone map with reserved footer
- max text budget
- fallback template

Template diversity rules MUST be enforced by planner.

---

## 10) Image Usage Policy (prevents “image spam”)

Defaults:

- 0 or 1 image per page.
  Hard rules:
- Never duplicate the same image multiple times in one page.
- Never mosaic/collage unless a dedicated collage template exists (not recommended).
- Preserve aspect ratio always. Never stretch.
  Fit policy:
- UI screenshot => prefer CONTAIN (no cropping).
- Lifestyle/photo => prefer COVER (controlled cropping).
  Low-signal images (generic stock people) => prefer TEXT_ONLY or PROCESS templates.

---

## 11) Copy Policy (Anti-AI tone, concise Korean)

No filler text. No vague buzzwords without evidence.
Avoid: “혁신/고도화/최적화” unless tied to concrete mechanism or metric.

Per-page copy budget (default):

- Title: <= 14–18 Korean words (or 1 short sentence)
- Subtitle: <= 1 sentence
- Bullets: 3–5 max, each bullet ideally 12–18 chars per chunk, 1 line
- Body paragraphs discouraged; use bullets/cards
  If text does not fit:

1. reduce bullets
2. shorten bullets
3. drop secondary components (chips/metrics)
4. switch template
   Only then minor font reduction (never below 9pt body).

If domain-specific text is uncertain:

- derive a clean caption from filename
- add one neutral helper sentence only

---

## 12) Required Build Sequence (Divide-and-Conquer)

For every run:

1. Intake: scan /images + /fonts; apply ordering.
2. Document Plan: decide narrative + page count.
3. Storyboard: map pages to roles/templates/assets.
4. For each page:
   4.1 Page brief (template + rationale + reading flow + text budget)
   4.2 Zone wireframe (non-overlapping zones; footer reserved)
   4.3 Content draft within budget
   4.4 Emit elements (media -> text -> shapes)
   4.5 QA (validation gates)
5. Parity check: preview vs PPTX composition must match materially.
6. Export validation + filename generation.

---

## 13) Validation Gates (MUST exist + MUST be enforced)

Hard fail gates (abort regenerate/export):

- Boundary: nothing out of A4 bounds
- Footer lane: nothing invades reserved footer
- Collision: protected zones do not overlap
- Text-fit: estimated overflow must be false for each text box
- Layering: text not occluded by shapes
- Determinism: same inputs => same layout structure

These gates MUST run on:

- Regenerate Layout
- Export PPTX (A4)
  Export must abort if any gate fails and show errors per page.

---

## 14) Export Filename Policy (New)

Export PPTX filename must be auto-generated:
Format:
{docTitle}_{brandOrClient}_{YYYYMMDD}_v{N}\_A4_{pageCount}p.pptx
Rules:

- docTitle from planner (default: "맞춤*건기식\_B2B*소개서")
- brandOrClient from user config or default ("WellnessBox")
- version increments when layout regenerated in the same session

---

## 15) Done Criteria

Before completion:

- Storyboard exists and templates vary.
- Page count is not artificially fixed.
- All pages pass hard gates.
- Preview/PPTX parity holds for tested pages.
- Export filename follows policy.
