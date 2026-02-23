# doc-factory

Local image-only document page builder:

- Put images in `/images` (required).
- Optionally put `.ttf`/`.otf` files in `/fonts`.
- Preview A4 portrait pages at `http://localhost:3000`.
- Export all pages as one editable A4 PPTX.
- Default page copy is tuned for a Korean B2B wellness service brochure.

## Run

```bash
npm i
npm run dev
```

Then open `http://localhost:3000`.

## How page order is decided

1. If a filename has a leading number pattern (`001_`, `01-`, `p1`, `(1)`), that number is used.
2. Otherwise files are ordered by modified time ascending.
3. If modified time is equal, natural filename sort is used.

## Notes

- Filenames are cleaned and used as captions.
- Slides are exported in A4 portrait size (`210mm x 297mm`).
- A4 portrait is used for both web preview and PPTX export to keep layout parity.
