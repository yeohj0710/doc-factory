import type { CSSProperties } from "react";
import { scanFonts, type ScannedFont } from "@/src/io/scanFonts";
import { scanImages } from "@/src/io/scanImages";
import type { PageSizePreset } from "@/src/layout/pageSize";
import { generateLayout } from "@/src/layout/generateLayout";
import type { DocType } from "@/src/layout/types";
import { PageView } from "@/src/render/web/PageView";

export const dynamic = "force-dynamic";

type HomeProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const UI_TEXT = {
  builder: "\uBE44\uC8FC\uC5BC \uBB38\uC11C \uC0DD\uC131\uAE30",
  exportPptx: "PPTX \uB0B4\uBCF4\uB0B4\uAE30",
  exportReady: "\uB0B4\uBCF4\uB0B4\uAE30 \uC900\uBE44 \uC644\uB8CC",
  exportBlocked: "\uAC80\uC99D\uC744 \uD1B5\uACFC\uD574\uC57C \uB0B4\uBCF4\uB0BC \uC218 \uC788\uC2B5\uB2C8\uB2E4",
  summary: "\uBB38\uC11C \uC694\uC57D",
  inputImages: "\uC785\uB825 \uC774\uBBF8\uC9C0",
  generatedPages: "\uC0DD\uC131 \uD398\uC774\uC9C0",
  validationPassed: "\uAC80\uC99D \uD1B5\uACFC",
  noImages: "\uC774\uBBF8\uC9C0\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4",
  noImagesHint: "\uD3F4\uB354\uC5D0 \uC774\uBBF8\uC9C0\uB97C \uB123\uC740 \uB4A4 \uC0C8\uB85C\uACE0\uCE68 \uD574\uC8FC\uC138\uC694.",
  detailPanel: "\uC0C1\uC138 \uC815\uBCF4 \uBCF4\uAE30",
  storyboard: "\uC2A4\uD1A0\uB9AC\uBCF4\uB4DC",
  systemInfo: "\uBB38\uC11C \uC815\uBCF4",
  runtimeLog: "Runtime Log",
  page: "Page",
  role: "Role",
  pass: "\uAC80\uC99D \uD1B5\uACFC",
  needsFix: "\uAC80\uC99D \uD544\uC694",
  issueSummary: "\uBB38\uC81C \uC0C1\uC138\uB294 Page \uC0C1\uC138\uC5D0\uC11C \uD655\uC778\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.",
  pageDetail: "Page \uC0C1\uC138",
  template: "Template",
  asset: "Asset",
  diagnostic: "Diagnostics",
  none: "\uC5C6\uC74C",
  noAsset: "\uC774\uBBF8\uC9C0 \uC5C6\uC74C",
  genericTemplate: "Template",
  roleUnknown: "Page",
  unitPage: "\uC7A5",
  unitNth: "\uBC88",
  unitCount: "\uAC74",
  labelDocType: "\uBB38\uC11C \uC720\uD615",
  labelPageSize: "\uD398\uC774\uC9C0 \uD06C\uAE30",
  labelTemplateVariety: "\uD15C\uD50C\uB9BF \uB2E4\uC591\uC131(\uCC98\uC74C 4\uD398\uC774\uC9C0)",
  labelPassedPages: "\uD1B5\uACFC \uD398\uC774\uC9C0",
  labelNextFilename: "\uB2E4\uC74C \uD30C\uC77C\uBA85",
  labelVersion: "version",
} as const;

const DOC_TYPE_LABEL: Record<DocType, string> = {
  proposal: "Proposal",
  poster: "Poster",
  "one-pager": "One-pager",
  "multi-card": "Multi-card",
  report: "Report",
};

const PAGE_SIZE_LABEL: Record<PageSizePreset, string> = {
  A4P: "A4 Portrait",
  A4L: "A4 Landscape",
  LETTERP: "Letter Portrait",
  LETTERL: "Letter Landscape",
  CUSTOM: "Custom",
};

const PAGE_ROLE_LABEL: Record<string, string> = {
  cover: "\uD45C\uC9C0",
  section: "\uAD6C\uBD84",
  "section-divider": "\uAD6C\uBD84",
  agenda: "\uBAA9\uCC28",
  insight: "\uD575\uC2EC",
  solution: "\uD574\uACB0",
  process: "Process",
  timeline: "Timeline",
  topic: "\uC8FC\uC81C",
  gallery: "\uAC24\uB7EC\uB9AC",
  metrics: "\uC9C0\uD45C",
  comparison: "Comparison",
  "text-only": "\uD14D\uC2A4\uD2B8",
  cta: "\uB9C8\uBB34\uB9AC",
};

const TEMPLATE_LABEL: Record<string, string> = {
  COVER_HERO_BAND: "Cover Hero Band",
  COVER_HERO: "Cover Hero",
  COVER_SPLIT_MEDIA: "Cover Split Media",
  SECTION_DIVIDER: "Section Divider",
  AGENDA_EDITORIAL: "Agenda Editorial",
  TITLE_MEDIA_SAFE: "Title + Media",
  TWO_COLUMN_MEDIA_TEXT: "Two Column Media + Text",
  METRICS_GRID: "Metrics Grid",
  PROCESS_FLOW: "Process Flow",
  TIMELINE_STEPS: "Timeline Steps",
  TIMELINE_FLOW: "Timeline",
  COMPARISON_TABLE: "Comparison Table",
  GALLERY_SINGLE: "Gallery Single",
  TEXT_ONLY_EDITORIAL: "Text-only Editorial",
  QUOTE_FOCUS: "Quote Focus",
  CTA_CONTACT: "CTA Contact",
};

function readSingle(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function parseVariantIndex(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "1", 10);
  if (Number.isNaN(parsed) || parsed < 1) {
    return 1;
  }
  return parsed;
}

function parseDocType(value: string | undefined): DocType | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.toLowerCase();
  if (["proposal", "poster", "one-pager", "multi-card", "report"].includes(normalized)) {
    return normalized as DocType;
  }

  return undefined;
}

function parsePageSizePreset(value: string | undefined): PageSizePreset | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.toUpperCase();
  if (["A4P", "A4L", "LETTERP", "LETTERL", "CUSTOM"].includes(normalized)) {
    return normalized as PageSizePreset;
  }

  return undefined;
}

function parseNumber(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseFloat(value);
  if (Number.isNaN(parsed)) {
    return undefined;
  }
  return parsed;
}

function escapeCssValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function buildFontFaceCss(fonts: ScannedFont[]): string {
  return fonts
    .map((font) => {
      const family = escapeCssValue(font.familyName);
      const src = escapeCssValue(font.publicPath);
      return [
        "@font-face {",
        `  font-family: \"${family}\";`,
        `  src: url(\"${src}\") format(\"${font.format}\");`,
        `  font-style: ${font.style};`,
        `  font-weight: ${font.weight};`,
        "  font-display: swap;",
        "}",
      ].join("\n");
    })
    .join("\n");
}

function previewScaleForPage(pageWidthMm: number): number {
  const mmToPx = 96 / 25.4;
  const targetWidthPx = 462;
  const pageWidthPx = Math.max(1, pageWidthMm * mmToPx);
  const scale = targetWidthPx / pageWidthPx;
  return Math.min(0.7, Math.max(0.26, scale));
}

function previewScaleForMobile(pageWidthMm: number): number {
  const mmToPx = 96 / 25.4;
  const targetWidthPx = 330;
  const pageWidthPx = Math.max(1, pageWidthMm * mmToPx);
  const scale = targetWidthPx / pageWidthPx;
  return Math.min(0.52, Math.max(0.22, scale));
}

function toTemplateLabel(templateId: string): string {
  return TEMPLATE_LABEL[templateId] ?? UI_TEXT.genericTemplate;
}

function toPageRoleLabel(role: string | undefined): string {
  if (!role) {
    return UI_TEXT.roleUnknown;
  }
  return PAGE_ROLE_LABEL[role] ?? UI_TEXT.roleUnknown;
}

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;

  const variantIndex = parseVariantIndex(readSingle(params.v));
  const requestedDocType = parseDocType(readSingle(params.docType));
  const requestedPageSizePreset = parsePageSizePreset(readSingle(params.size));
  const showDebug = readSingle(params.debug) === "1";
  const customWidthMm = parseNumber(readSingle(params.w));
  const customHeightMm = parseNumber(readSingle(params.h));
  const customPageSizeMm =
    requestedPageSizePreset === "CUSTOM" && typeof customWidthMm === "number" && typeof customHeightMm === "number"
      ? { widthMm: customWidthMm, heightMm: customHeightMm }
      : undefined;

  const [images, fonts] = await Promise.all([scanImages(), scanFonts()]);

  const result = await generateLayout(images, fonts, {
    variantIndex,
    requestedDocType,
    requestedPageSizePreset,
    customPageSizeMm,
    intent: "regenerate",
  });

  const hasPages = result.pages.length > 0;
  const fontFaceCss = buildFontFaceCss(fonts);
  const templateInFirst4 = new Set(result.storyboard.slice(0, 4).map((item) => item.templateId));
  const exportBlocked = !result.validation.passed || !result.exportAudit.passed;
  const docTypeLabel = DOC_TYPE_LABEL[result.plan.docType] ?? result.plan.docType;
  const pageSizeLabel = PAGE_SIZE_LABEL[result.plan.pageSizePreset] ?? result.plan.pageSizePreset;

  return (
    <main className="app-shell">
      {fontFaceCss ? <style>{fontFaceCss}</style> : null}

      <header className="hero-card">
        <div className="hero-copy">
          <p className="hero-kicker">{UI_TEXT.builder}</p>
          <h1>{result.plan.docTitle}</h1>
          <p className="hero-meta">
            {docTypeLabel} / {pageSizeLabel} ({result.plan.pageSize.widthMm}mm x {result.plan.pageSize.heightMm}mm) / {UI_TEXT.labelVersion}{" "}
            {result.plan.variantIndex}
          </p>
        </div>

        <div className="hero-action">
          <form action="/api/export/pptx" method="post">
            <input type="hidden" name="variantIndex" value={String(result.plan.variantIndex)} />
            <input type="hidden" name="seed" value={String(result.plan.seed)} />
            <input type="hidden" name="docType" value={result.plan.docType} />
            <input type="hidden" name="pageSizePreset" value={result.plan.pageSizePreset} />
            <input type="hidden" name="pageWidthMm" value={String(result.plan.pageSize.widthMm)} />
            <input type="hidden" name="pageHeightMm" value={String(result.plan.pageSize.heightMm)} />
            <button className="primary-button" type="submit" disabled={!hasPages || exportBlocked}>
              {UI_TEXT.exportPptx}
            </button>
          </form>
          <p className={`export-state ${exportBlocked ? "is-blocked" : "is-ready"}`}>
            {exportBlocked ? UI_TEXT.exportBlocked : UI_TEXT.exportReady}
          </p>
        </div>
      </header>

      <section className="quick-strip" aria-label={UI_TEXT.summary}>
        <p>
          <strong>{images.length}{UI_TEXT.unitPage}</strong> {UI_TEXT.inputImages}
        </p>
        <p>
          <strong>{result.pages.length}{UI_TEXT.unitPage}</strong> {UI_TEXT.generatedPages}
        </p>
        <p>
          <strong>
            {result.validation.passedPageCount}/{result.pages.length}
          </strong>{" "}
          {UI_TEXT.validationPassed}
        </p>
      </section>

      {!hasPages ? (
        <section className="empty-state">
          <h2>{UI_TEXT.noImages}</h2>
          <p>
            <code>/images</code> {UI_TEXT.noImagesHint}
          </p>
        </section>
      ) : (
        <>
          <section className="pages-grid">
            {result.pages.map((page) => {
              const previewScale = previewScaleForPage(page.widthMm);
              const previewScaleMobile = previewScaleForMobile(page.widthMm);
              const frameStyle: CSSProperties = {
                ["--page-width-mm" as string]: String(page.widthMm),
                ["--page-height-mm" as string]: String(page.heightMm),
                ["--scale-desktop" as string]: String(previewScale),
                ["--scale-mobile" as string]: String(previewScaleMobile),
              };

              const pageRoleLabel = toPageRoleLabel(page.pageRole ?? page.meta?.brief.pageRole);
              const issueCount = page.meta?.validation.issues.length ?? 0;

              return (
                <article className="preview-card" key={page.pageNumber}>
                  <header className="preview-head">
                    <div>
                      <p className="preview-index">
                        {page.pageNumber}{UI_TEXT.unitNth} {UI_TEXT.page}
                      </p>
                      <p className="preview-role">
                        {UI_TEXT.role}: {pageRoleLabel}
                      </p>
                    </div>
                    <p className={`preview-state ${page.meta?.validation.passed ? "is-pass" : "is-fail"}`}>
                      {page.meta?.validation.passed
                        ? UI_TEXT.pass
                        : `${UI_TEXT.needsFix} (${issueCount}${UI_TEXT.unitCount})`}
                    </p>
                  </header>

                  <div className="preview-frame">
                    <div className="preview-scale" style={frameStyle}>
                      <div className="preview-scale-inner">
                        <PageView page={page} fontFamily={result.tokens.font.cssStack} />
                      </div>
                    </div>
                  </div>

                  {page.meta && !page.meta.validation.passed ? (
                    <p className="preview-issues">{UI_TEXT.issueSummary}</p>
                  ) : null}

                  {page.meta ? (
                    <details className="inline-detail">
                      <summary>{UI_TEXT.pageDetail}</summary>
                      <div className="detail-body">
                        <p>
                          <strong>{UI_TEXT.template}:</strong> {toTemplateLabel(page.meta.brief.template)}
                        </p>
                        <p>
                          <strong>{UI_TEXT.asset}:</strong> {page.meta.brief.sourceImage ?? UI_TEXT.none}
                        </p>
                        {showDebug && !page.meta.validation.passed ? (
                          <details className="inline-detail nested-detail">
                            <summary>{UI_TEXT.diagnostic}</summary>
                            <div className="detail-body issue-lines">
                              {page.meta.validation.issues.map((issue, index) => (
                                <p key={`issue-${page.pageNumber}-${index}`}>[{issue.code}] {issue.message}</p>
                              ))}
                            </div>
                          </details>
                        ) : null}
                      </div>
                    </details>
                  ) : null}
                </article>
              );
            })}
          </section>

          <details className="fold-card">
            <summary>{UI_TEXT.detailPanel}</summary>
            <div className="fold-body fold-stack">
              <details className="inline-detail">
                <summary>{UI_TEXT.storyboard}</summary>
                <div className="detail-body">
                  {result.storyboard.map((item) => (
                    <p className="story-line" key={`story-${item.pageNumber}`}>
                      <strong>{item.pageNumber}p</strong> / {toPageRoleLabel(item.role)} / {item.primaryAssetFilename ?? UI_TEXT.noAsset}
                    </p>
                  ))}
                </div>
              </details>

              <details className="inline-detail">
                <summary>{UI_TEXT.systemInfo}</summary>
                <div className="detail-body">
                  <p>
                    {UI_TEXT.labelDocType}: <strong>{docTypeLabel}</strong>
                  </p>
                  <p>
                    {UI_TEXT.labelPageSize}: <strong>{pageSizeLabel}</strong>
                  </p>
                  <p>
                    {UI_TEXT.labelTemplateVariety}: <strong>{templateInFirst4.size}</strong>
                  </p>
                  <p>
                    {UI_TEXT.labelPassedPages}: <strong>{result.validation.passedPageCount}/{result.pages.length}</strong>
                  </p>
                  <p>
                    {UI_TEXT.labelNextFilename}: <strong>{result.exportMeta.filename}</strong>
                  </p>
                </div>
              </details>

              {showDebug ? (
                <details className="inline-detail">
                  <summary>{UI_TEXT.runtimeLog}</summary>
                  <div className="detail-body issue-lines">
                    {result.logs.map((line, index) => (
                      <p className="log-line" key={`log-${index}`}>
                        {line}
                      </p>
                    ))}
                  </div>
                </details>
              ) : null}
            </div>
          </details>
        </>
      )}
    </main>
  );
}
