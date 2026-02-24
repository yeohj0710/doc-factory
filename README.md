# doc-factory

Generic visual document builder that creates **one editable PPTX** from local assets only.

## Inputs

- `/images` (required)
- `/fonts` (optional)
- `/references` (optional, style inspiration only)

No network assets are fetched at runtime.

## What the pipeline does

1. Scans assets with stable ordering rules.
2. Infers `docType` and `pageSize` (default `A4P`, supports A4/Letter/Custom mm).
3. Builds a variable-length storyboard (1-14 pages) with template diversity constraints.
4. Selects style preset candidates (theme-factory integrated) and picks one deterministically.
5. Generates editable DSL pages (text/shape/image, no screenshot-only slides).
6. Runs static DSL gates + runtime Playwright gates.
7. Blocks export unless all validations and export audit pass.

## Determinism + variation

Generation is deterministic for:

- assets (`/images`, `/fonts`, `/references`)
- code version
- params `{ pageSizePreset, docType, stylePresetId, variantIndex, seed }`

Regenerate uses `variantIndex` (`?v=` query param). Same variant reproduces the same layout.

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Runtime gate proofs (webapp-testing skill)

```bash
npm run qa:runtime-gates
npm run qa:export-gates
```

These scripts use `.agents/skills/webapp-testing/scripts/with_server.py` + Playwright.

## Export filename policy

`{docTitle}_{pageSize}_{YYYYMMDD}_v{variantIndex}_{pageCount}p.pptx`
