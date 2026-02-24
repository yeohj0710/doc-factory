import Link from "next/link";
import { scanFonts, type ScannedFont } from "@/src/io/scanFonts";
import { scanImages } from "@/src/io/scanImages";
import { generateLayout } from "@/src/layout/generateLayout";
import { createLayoutTokens } from "@/src/layout/tokens";
import { PageView } from "@/src/render/web/PageView";

export const dynamic = "force-dynamic";

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
        `  font-family: "${family}";`,
        `  src: url("${src}") format("${font.format}");`,
        `  font-style: ${font.style};`,
        `  font-weight: ${font.weight};`,
        "  font-display: swap;",
        "}",
      ].join("\n");
    })
    .join("\n");
}

export default async function Home() {
  const [images, fonts] = await Promise.all([scanImages(), scanFonts()]);
  const tokens = createLayoutTokens(fonts);
  const result = generateLayout(images, tokens, { intent: "regenerate", fontCount: fonts.length });
  const hasPages = result.pages.length > 0;
  const fontFaceCss = buildFontFaceCss(fonts);
  const templateInFirst4 = new Set(result.storyboard.slice(0, 4).map((item) => item.templateId));

  return (
    <main className="app-shell">
      {fontFaceCss ? <style>{fontFaceCss}</style> : null}

      <header className="workspace-header">
        <div className="workspace-title-block">
          <p className="workspace-kicker">A4 Proposal Builder</p>
          <h1>{result.plan.docTitle}</h1>
          <p className="workspace-description">
            문서 단위 planner로 스토리보드가 먼저 결정된 뒤 페이지가 생성됩니다. 검증 게이트가 모두 통과해야
            PPTX export가 가능합니다.
          </p>
        </div>

        <div className="workspace-controls">
          <form action="/api/export/pptx" method="post">
            <button className="primary-button" type="submit" disabled={!hasPages || !result.validation.passed}>
              Export PPTX (A4)
            </button>
          </form>
          <Link className="secondary-button" href="/">
            Regenerate
          </Link>
        </div>
      </header>

      <section className="status-panel" aria-label="document status">
        <article className="status-item">
          <p className="status-label">입력 이미지</p>
          <p className="status-value">{images.length}</p>
        </article>
        <article className="status-item">
          <p className="status-label">생성 페이지</p>
          <p className="status-value">{result.pages.length}</p>
          <p className="status-note">고정값 아님 (6~12 가변)</p>
        </article>
        <article className="status-item">
          <p className="status-label">초반 템플릿 다양성</p>
          <p className="status-value">{templateInFirst4.size}</p>
          <p className="status-note">첫 4p 기준</p>
        </article>
        <article className="status-item">
          <p className="status-label">검증 통과</p>
          <p className="status-value">
            {result.validation.passedPageCount}/{result.pages.length}
          </p>
          <p className="status-note">
            {result.validation.failedPageCount > 0
              ? `${result.validation.failedPageCount}p 수정 필요 (Export 차단)`
              : "모든 게이트 통과"}
          </p>
        </article>
        <article className="status-item">
          <p className="status-label">기본 폰트</p>
          <p className="status-value status-value-font">{tokens.font.primary}</p>
        </article>
        <article className="status-item">
          <p className="status-label">다음 파일명</p>
          <p className="status-value status-value-font">{result.exportMeta.filename}</p>
        </article>
      </section>

      {!hasPages ? (
        <section className="empty-state">
          <h2>이미지가 없습니다.</h2>
          <p>
            <code>/images</code> 폴더에 <code>.png</code>, <code>.jpg</code>, <code>.jpeg</code>,{" "}
            <code>.webp</code> 파일을 넣어주세요.
          </p>
        </section>
      ) : (
        <>
          <section className="page-card">
            <header className="page-card-header">
              <p className="page-title">Storyboard</p>
              <p className="page-subtitle">
                role/template/asset/copy budget/success criteria (page count: {result.storyboard.length})
              </p>
            </header>
            <div className="page-brief">
              {result.storyboard.map((item) => (
                <p className="page-brief-line" key={`story-${item.pageNumber}`}>
                  <strong>P{item.pageNumber}</strong> | {item.role} | {item.templateId} |{" "}
                  {item.primaryAssetFilename ?? "none"} | T{item.copyBudget.title}/S{item.copyBudget.subtitle}/B
                  {item.copyBudget.body}/•{item.copyBudget.bullets} | {item.successCriteria}
                </p>
              ))}
            </div>
          </section>

          <section className="pages-stack">
            {result.pages.map((page) => (
              <article className="page-card" key={page.pageNumber}>
                <header className="page-card-header">
                  <p className="page-title">Page {page.pageNumber}</p>
                  <p className="page-subtitle">
                    {page.meta?.brief.template ?? page.templateId} · {page.meta?.brief.topic ?? "일반"}
                  </p>
                </header>
                <div className="page-scroll">
                  <PageView page={page} fontFamily={tokens.font.cssStack} />
                </div>
                {page.meta ? (
                  <section className="page-brief">
                    <p className="page-brief-line">
                      <strong>역할:</strong> {page.meta.brief.pageRole}
                    </p>
                    <p className="page-brief-line">
                      <strong>자산:</strong> {page.meta.brief.sourceImage ?? "none"}
                    </p>
                    <p className="page-brief-line">
                      <strong>선정 이유:</strong> {page.meta.brief.templateReason}
                    </p>
                    <p className="page-brief-line">
                      <strong>텍스트 예산:</strong> title {page.meta.brief.maxTextBudget.title} / subtitle{" "}
                      {page.meta.brief.maxTextBudget.subtitle} / body {page.meta.brief.maxTextBudget.body}
                    </p>
                    <p className={page.meta.validation.passed ? "page-validation-ok" : "page-validation-fail"}>
                      {page.meta.validation.passed
                        ? "검증 게이트 통과"
                        : `검증 게이트 실패 (${page.meta.validation.issues.length}건)`}
                    </p>
                    {!page.meta.validation.passed ? (
                      <p className="page-validation-issues">
                        {page.meta.validation.issues
                          .map((issue) => `[${issue.code}] ${issue.message}`)
                          .join(" / ")}
                      </p>
                    ) : null}
                  </section>
                ) : null}
              </article>
            ))}
          </section>

          <section className="page-card">
            <header className="page-card-header">
              <p className="page-title">Pipeline Log</p>
            </header>
            <div className="page-brief">
              {result.logs.map((line, index) => (
                <p className="page-brief-line" key={`log-${index}`}>
                  {line}
                </p>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
