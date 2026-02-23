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
  const pages = generateLayout(images, tokens);
  const hasPages = pages.length > 0;
  const fontFaceCss = buildFontFaceCss(fonts);

  return (
    <main className="app-shell">
      {fontFaceCss ? <style>{fontFaceCss}</style> : null}

      <header className="workspace-header">
        <div className="workspace-title-block">
          <p className="workspace-kicker">A4 기업 제안서 빌더</p>
          <h1>웰니스박스 서비스 소개서</h1>
          <p className="workspace-description">
            <code>/images</code>와 <code>/fonts</code> 자산만으로 A4 소개서 페이지를 자동 생성합니다.
            미리보기 확인 후 <code>Export PPTX (A4)</code>를 누르면 편집 가능한 PPTX를 한 번에
            내보낼 수 있습니다.
          </p>
        </div>

        <div className="workspace-controls">
          <form action="/api/export/pptx" method="post">
            <button className="primary-button" type="submit" disabled={!hasPages}>
              Export PPTX (A4)
            </button>
          </form>
          <Link className="secondary-button" href="/">
            레이아웃 재생성
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
          <p className="status-value">{pages.length}</p>
        </article>
        <article className="status-item">
          <p className="status-label">슬라이드 크기</p>
          <p className="status-value">A4 Portrait</p>
          <p className="status-note">210 x 297 mm</p>
        </article>
        <article className="status-item">
          <p className="status-label">기본 폰트</p>
          <p className="status-value status-value-font">{tokens.font.primary}</p>
        </article>
      </section>

      {!hasPages ? (
        <section className="empty-state">
          <h2>이미지가 없습니다.</h2>
          <p>
            <code>/images</code> 폴더에 <code>.png</code>, <code>.jpg</code>, <code>.jpeg</code>,{" "}
            <code>.webp</code> 파일을 추가한 뒤 <code>레이아웃 재생성</code>을 눌러주세요.
          </p>
        </section>
      ) : (
        <section className="pages-stack">
          {pages.map((page) => (
            <article className="page-card" key={page.pageNumber}>
              <header className="page-card-header">
                <p className="page-title">페이지 {page.pageNumber}</p>
                <p className="page-subtitle">A4 세로형 · 210 x 297 mm</p>
              </header>
              <div className="page-scroll">
                <PageView page={page} fontFamily={tokens.font.cssStack} />
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
