# doc-factory — AGENTS.md (Generic Visual Document Builder, Skills-Integrated)

Updated: 2026-02-24

This repo generates an editable PPTX document from ONLY:

- /images (required)
- /fonts (optional)
- /references (optional; inspiration only)

Skill folders may exist under:

- .agents/skills/theme-factory
- .agents/skills/webapp-testing
- .agents/skills/playwright
- .agents/skills/pdf
- .agents/skills/vercel-deploy
- .agents/skills/linear

Mode trigger:

- If user message starts with "MAINTENANCE mode:" => maintenance rules
- Otherwise => default to DESIGN mode

---

## 0) Product Goal (Non-negotiable)

- User drops assets into /images (and optionally /fonts, /references).
- App infers document type + page size, creates a storyboard, generates pages, previews them, and exports ONE PPTX.
- Each slide/page in PPTX must remain EDITABLE (text/shapes), not screenshot-only.
- Export MUST be blocked unless validation gates pass (static + runtime).
- Default size is A4 Portrait, but size can vary.

---

## 1) Root Simplicity

User-facing root folders ONLY:

- /images
- /fonts
- /references (optional)

Everything else under /src (Next.js conventions).
Users must NOT edit internal layout specs.

No runtime network fetch (no Google fonts, no remote images).

---

## 2) Page Size Policy (A4 default, variable supported)

Default: A4 Portrait (210mm x 297mm)

System MUST support:

- A4 Portrait / A4 Landscape
- Letter Portrait / Landscape
- Custom (widthMm/heightMm)

Chosen page size becomes a generation parameter and a single source of truth:

- DSL page.widthMm / page.heightMm
- Web renderer and PPTX renderer MUST reference the same values.

---

## 3) Determinism + “New design every run” (Controlled Variation)

The output MUST be deterministic given:

- /images + /fonts + /references
- code version
- generation params:
  { pageSizePreset, docType, stylePresetId, variantIndex, seed }

“New design each time” is implemented by variantIndex/seed:

- Clicking "Regenerate Layout" increments variantIndex.
- Same variantIndex must reproduce the same layout.
- Export filename must include variantIndex.

Users never edit variantIndex/seed manually.

---

## 4) Ordering Policy (MUST)

1. If filename has leading number (001\_, 01-, p1, (1)), sort by that number.
2. Else sort by modified time ascending.
3. Else natural sort by filename.

Order must be stable.

---

## 5) Internal Architecture (Required)

Inputs:

- /images
- /fonts
- /references (optional)

Code:

- /src/io (scan assets; ordering)
- /src/planner (doc-type + storyboard planner; REQUIRED)
- /src/layout (DSL types, templates, style presets, generator, validation)
- /src/render/web (DSL -> HTML/CSS preview)
- /src/render/pptx (DSL -> PPTX via pptxgenjs)
- /src/qa (runtime validation harness + export audit)

Generated (single allowed):

- /src/generated/layout.ts (or layout.json) — the ONLY generated layout artifact.

No per-page React components. No per-image special-case maps.

---

## 6) Document Planner (Mandatory)

The system MUST NOT do “one image = one page” by default.

Before generating any page:

1. Scan /images (apply ordering).
2. Determine docType:
   - Proposal/Brochure (default)
   - Poster (single page)
   - One-pager (1–2)
   - Multi-card set (4–12)
   - Report/Summary (text + charts + tables style)
3. Determine page size preset (default A4P unless user overrides).
4. Cluster images into topics using filename + type:
   - UI/screenshot, product/photo, chart/table, icon/diagram, people/lifestyle (often low-signal)
5. Build a storyboard (variable length, typical 1–14):
   For each page:
   - pageRole
   - templateId
   - primaryAsset (image or none)
   - copyBudget
   - successCriteria
6. Enforce variety:
   - same template max 2 in a row
   - full-bleed templates <= 35–40% of pages
   - multi-page docs must include at least 1 TEXT_ONLY_EDITORIAL page

Only after storyboard exists: generate pages.

---

## 7) Style Presets (Mandatory; Skills-Integrated)

Maintain 8–16 reusable style presets (generic, not industry-specific).
Each preset defines:

- typography scale (title/subtitle/body)
- spacing scale (margins/gutters)
- corner radius + stroke/shadow rules
- background rules
- accent usage constraints

### Optional references

If /references exists:

- NEVER copy layout compositions 1:1.
- Use references ONLY for style token selection (density/type/radius/accent usage).
- Sample 8–16 references per run (stratified by subfolders if present).
- References must not directly dictate element coordinates.

### Skill: theme-factory (preferred)

If .agents/skills/theme-factory exists:

- Use it at planning time to propose 3 candidate style presets (or token sets).
- Select 1 primary preset for the whole document (divider pages may use a mild variant).
- Store the selected presetId and tokens in internal state (not user-editable).

---

## 8) Template Pack (Generic Patterns; Enough Variety)

Keep 12–20 templates (patterns, not industries), e.g.:

- COVER_HERO (2–3 variants)
- SECTION_DIVIDER
- AGENDA_EDITORIAL
- TITLE_MEDIA_SAFE
- TWO_COLUMN_MEDIA_TEXT
- METRICS_GRID
- PROCESS_FLOW / TIMELINE
- COMPARISON_TABLE
- GALLERY_SINGLE (1 image only)
- TEXT_ONLY_EDITORIAL
- CTA_CONTACT

Each template MUST document:

- intended use + acceptable aspect ratios
- zone map (including reserved footer lane)
- max copy budget
- fallback template(s)

Templates must compute zones from page tokens (width/height/margins), not magic numbers.

---

## 9) Image Policy (Prevents Spam)

Defaults:

- 0 or 1 image per page.

Hard rules:

- Never duplicate the same image multiple times on one page.
- No mosaic/collage unless a dedicated collage template exists (avoid by default).
- Preserve aspect ratio; never stretch.

Fit:

- UI screenshot => CONTAIN
- photo => COVER (controlled)

Low-signal images (generic lifestyle) must NOT force pages; prefer text/process/metrics templates.

---

## 10) Copy Policy (Anti-AI Tone via Constraints)

No filler. Avoid buzzwords unless tied to a mechanism/metric.

Pipeline MUST be: Draft -> Budget-aware shorten -> Remove vague words -> Bulletize -> Fit-check.

If text doesn’t fit:

1. shorten text
2. remove secondary blocks (chips/extra cards)
3. fallback template
   Never reduce body below 9pt.

If meaning is unknown:

- derive caption from filename
- add one neutral helper sentence only

---

## 11) Validation Gates (Hard; Export must be blocked)

Two layers:

### 11.1 Static DSL gates (always)

- boundary: all elements inside page bounds
- reserved lanes: header/footer protected zones never invaded
- collision: semantic blocks do not overlap
- min-size: readability thresholds
- layering: text not occluded
- determinism: same params -> same DSL structure

### 11.2 Runtime gates (preferred via webapp-testing skill)

Use a headless browser to measure real DOM:

- text overflow (scrollHeight > clientHeight)
- clipped elements (bounding rect exceeds page container)
- unintended overlaps (rect intersections over threshold)

If runtime gates fail:

- auto-fix loop: shorten -> fallback template -> re-layout -> re-run runtime gates
  Export only when all gates pass.

### Skill: webapp-testing (preferred)

If .agents/skills/webapp-testing exists:

- use it to run runtime gates on every Regenerate and Export
- produce a page-by-page failure report for the UI

---

## 12) Preview ↔ PPTX Parity + Export Audit

Both renderers consume the same DSL. Only unit conversion differs.

Export audit MUST verify:

- expected slide count equals page count
- all objects are within slide bounds
- slides contain editable objects (text/shapes) and are not raster-only
- page size matches selected preset

If audit fails: block export and show errors.

---

## 13) Export Filename (Mandatory)

Auto-generate:
{docTitle}_{pageSize}_{YYYYMMDD}_v{variantIndex}_{pageCount}p.pptx

docTitle inferred from prompt; default "Visual_Document".

---

## 14) UI Requirements

Localhost page must show:

- doc title + inferred docType + pageSize preset
- counts (input images, generated pages, validation pass/fail)
- per-page validation issues
- buttons:
  - Export PPTX
  - Regenerate Layout (increments variantIndex)

Export must be disabled if validation fails.

---

## 15) Done Criteria

Before declaring completion:

- storyboard exists and demonstrates variety
- page count is variable (not fixed to image count)
- all pages pass static + runtime gates
- preview/pptx parity is acceptable
- export filename follows policy
