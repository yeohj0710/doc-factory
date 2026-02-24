# doc-factory — AGENTS.md (Reference-Driven Generic Visual Document Builder)

Updated: 2026-02-24 (rev: reference-index + layout archetypes + deterministic export)

This repo generates an editable PPTX document from ONLY:

- /images (required)
- /fonts (optional; local only)
- /references (optional; if present, MUST influence style + layout via code)

Skills may exist under:

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
- App infers docType + page size, creates a storyboard, generates pages, previews them, and exports ONE PPTX.
- Each slide in PPTX must remain EDITABLE (text/shapes), not screenshot-only.
- Export MUST be blocked unless validation gates pass (static + runtime + readability + reference-usage gates).
- Default size is A4 Portrait, but size can vary.

---

## 1) Hard Constraints

### 1.1 No Network Fetch

- MUST: no runtime external fetch (no remote images, no Google fonts, no CDN CSS).
- MUST: fonts only from /fonts (next/font/local recommended).

### 1.2 Determinism (Reproducible)

Output MUST be deterministic given:

- /images + /fonts + /references contents
- code version
- generation params:
  { pageSizePreset, docType, stylePresetId, variantIndex, seed, referenceDigest }

No reliance on current time, random(), or filesystem mtime for ordering.

### 1.3 Single Source of Truth for Page Size

- MUST: DSL page.widthMm / page.heightMm is the only truth.
- Web + PPTX consume the same docSpec; only unit conversion differs.

---

## 2) Root Simplicity

User-facing root folders ONLY:

- /images
- /fonts
- /references

Users must NOT edit internal layout specs.

---

## 3) “New design every run” (Controlled Variation)

- Clicking "Regenerate Layout" increments variantIndex.
- Same (variantIndex + seed + referenceDigest) must reproduce the same layout.
- Different variantIndex must produce a noticeably different (yet valid) design.

---

## 4) Ordering Policy (MUST; deterministic)

All asset lists (/images, /fonts, /references) MUST be deterministically ordered:

1. If filename has leading number (001\_, 01-, p1, (1)), sort by that number (asc).
2. Else sort by normalized relative path (POSIX) using a locale-independent numeric-aware comparator.
3. If you want filename-agnostic stability, use content-hash IDs produced by the ReferenceIndex (see section 7)
   and sort by those IDs.

DO NOT use modified time for ordering.

---

## 5) Internal Architecture (Required)

Inputs:

- /images
- /fonts
- /references

Code (suggested):

- /src/io (scan assets; ordering; hashing; reference index)
- /src/planner (doc-type + storyboard planner; REQUIRED)
- /src/layout (DSL types, templates, style presets, generator, validation)
- /src/render/web (DSL -> HTML/CSS preview)
- /src/render/pptx (DSL -> PPTX via pptxgenjs)
- /src/qa (runtime validation harness + export audit)

Generated (single allowed):

- /src/generated/layout.(ts|json) — the ONLY generated layout artifact
- /src/generated/reference-index.json — generated from /references (see section 7)

No per-page React components. No per-image special-case maps.

---

## 6) Document Planner (Mandatory; content-agnostic)

The system MUST NOT do “one image = one page” by default.

Before generating pages:

1. Scan /images (apply ordering).
2. Determine docType (generic):
   - Proposal/Brochure (default)
   - Poster (1 page)
   - One-pager (1–2)
   - Multi-card set (4–12)
   - Report/Summary
3. Determine page size (default A4P unless user overrides).
4. Cluster images into topics using filename/type heuristics.
5. Build storyboard (variable length, typical 1–14):
   For each page:
   - pageRole
   - templateId (pattern family, not a fixed layout)
   - primaryAsset (image or none)
   - copyBudget
   - successCriteria
6. Enforce variety:
   - same template family max 2 in a row
   - full-bleed templates <= 35–40% of pages
   - multi-page docs must include at least 1 TEXT_ONLY_EDITORIAL page

Only after storyboard exists: generate pages.

---

## 7) REFERENCES POLICY — MUST influence Style + Layout (Code-enforced)

### 7.0 Key requirement

If /references exists and contains >= 8 images, the system MUST:

- **ingest ALL reference images** (not a small sample) into a ReferenceIndex
- derive BOTH:
  1. Style archetypes (typography scale, spacing density, radius/stroke/shadow, accent rules)
  2. Layout archetypes (grid/column count, hero-vs-text ratio, card density, header/footer proportions, rhythm)

Generation MUST use this index. Export MUST be blocked if reference index is missing/stale/unused.

### 7.1 No 1:1 copying

- MUST NOT copy a reference composition 1:1 (no coordinate matching).
- References guide **archetypes + constraints**, not exact placement.
- Allowed: “this reference tends to 2-column split with large hero and tight captions”
- Forbidden: “place title at x=42,y=61 because reference did so”

### 7.2 ReferenceIndex (mandatory artifact)

On server start OR when /references changes:

- Build `reference-index.json` from ALL reference images.
- Each entry should include:
  - id: content hash (sha256 first 12) ✅ stable even if filename changes
  - relPath
  - width/height/aspect
  - color palette (3–6 dominant colors)
  - density / whitespace ratio
  - layout fingerprint (rough zones: header/body/footer ratios; column guess; blockiness)
  - assigned styleClusterId, layoutClusterId

Also compute:

- referenceDigest = hash of sorted reference ids + their fingerprints
  Used as a generation input for determinism.

Caching:

- MUST cache index and reuse unless references changed.
- MUST NOT re-read all images on every render if index is fresh.

### 7.3 Style selection (theme-factory integrated)

If .agents/skills/theme-factory exists:

- Use the ReferenceIndex to pick **representative refs** (e.g., medoids) from style clusters
  (8–16 representatives), then ask theme-factory to propose 3 style candidates.
- Select 1 preset deterministically using (seed + variantIndex + referenceDigest).
- Store chosen presetId + tokens in internal state.

If theme-factory absent:

- Derive tokens from style clusters directly (deterministic heuristics).

### 7.4 Layout selection (reference-driven)

- Maintain 12–20 template families (patterns).
- For each run, create a LayoutPlan by mapping pages to layout archetypes:
  - choose a subset of layoutClusterIds deterministically (variantIndex + seed + referenceDigest)
  - ensure coverage across at least 3 distinct layout archetypes for multi-page docs
  - use archetype constraints to parametrize template families
    (grid columns, hero ratio, caption style, card density, section divider style, etc.)

### 7.5 Reference-usage gate (hard)

If /references contains >= 8 images:

- Export MUST be blocked unless the run proves:
  - referenceIndexStatus = "fresh"
  - style derived from references (stylePreset.source = "references")
  - layout derived from references (layoutPlan.source = "references")
  - referenceUsage.coverage:
    - usedStyleClusters >= 1
    - usedLayoutClusters >= 3 (for docs >= 6 pages) else >= 2
  - referenceUsageReport is included in export audit

---

## 8) Template Pack (Generic Patterns; parametrized by archetypes)

Keep 12–20 template families, e.g.:

- COVER_HERO (param: heroRatio, titleScale, accentRule)
- SECTION_DIVIDER (param: typographic style, density)
- AGENDA_EDITORIAL (param: columns, numbering style)
- TWO_COLUMN_MEDIA_TEXT (param: split ratio, caption style)
- METRICS_GRID (param: grid size, card density)
- PROCESS_FLOW / TIMELINE (param: lane count, spacing)
- COMPARISON_TABLE (param: table density)
- GALLERY_SINGLE (param: frame style)
- TEXT_ONLY_EDITORIAL (param: leading/measure)
- CTA_CONTACT (param: emphasis)

Templates must compute zones from tokens/page size; no magic numbers.

---

## 9) Copy Policy (Anti-AI tone via constraints)

No filler. Avoid buzzwords unless tied to a mechanism/metric.
Pipeline MUST be: Draft -> Budget-aware shorten -> Remove vague words -> Bulletize -> Fit-check.

If text doesn’t fit:

1. shorten text
2. remove secondary blocks (chips/extra cards)
3. fallback template family variant
4. (allowed) increase page count
   Never reduce body below readability minimums.

---

## 10) Main Quality Rules (HARD)

### 10.1 No Ellipsis / No Silent Truncation

- Text must never end with "..." or "…" in preview or PPTX.
- Do NOT use CSS line-clamp or ellipsis to “make it fit”.
- If text doesn't fit: shorten or change template.

### 10.2 Readability Minimums (scale with page size)

A4 defaults:

- Body >= 11pt (12 recommended)
- Caption >= 10pt
- Small labels >= 9.5pt
  Never go below; reduce text first.

### 10.3 Debug/Meta must never export

- Debug/meta blocks visible only when debug=1.
- Export MUST force debug=false and MUST exclude debugOnly elements.

---

## 11) Validation Gates (Hard; export blocked)

### 11.1 Static DSL gates

- boundary
- reserved lanes
- collision
- min-size readability thresholds
- layering
- determinism

### 11.2 Runtime gates (preferred via webapp-testing)

Headless DOM measurement:

- overflow/clip/overlap
- truncation styles or markers
  Auto-fix loop: shorten -> remove secondary -> fallback -> re-layout -> re-run.

### 11.3 Reference-usage gates (see 7.5)

- If references exist (>=8), missing/unused reference index => export blocked.

---

## 12) Preview ↔ PPTX Parity + Export Audit

Both renderers consume the same DSL. Only unit conversion differs.
Export audit MUST verify:

- slide count equals page count
- all objects within bounds
- editable objects present
- page size matches preset
- debug=false
- no truncation markers/styles
- referenceUsageReport present when references exist

---

## 13) Export Filename (Deterministic by default)

Default (deterministic):
{docTitle}_{docType}_{w}x{h}mm*{pageCount}p_v{variantIndex}*{hash8}.pptx

hash8 = hash(prompt + ordered image ids + docSpec + variantIndex + referenceDigest)

Optional (user-toggle, OFF by default):
prefix YYYYMMDD\_

---

## 14) Done Criteria

- storyboard exists and demonstrates variety
- page count variable (not fixed)
- all pages pass static + runtime + readability + reference-usage gates
- no ellipsis/truncation anywhere important
- preview/pptx parity acceptable
- export filename policy satisfied
- if references exist: index fresh + used + reported
