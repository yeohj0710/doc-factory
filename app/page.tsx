import Link from "next/link";
import { scanFonts } from "@/src/io/scanFonts";
import { scanImages } from "@/src/io/scanImages";
import { generateLayout } from "@/src/layout/generateLayout";
import { createLayoutTokens } from "@/src/layout/tokens";
import { PageView } from "@/src/render/web/PageView";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [images, fonts] = await Promise.all([scanImages(), scanFonts()]);
  const tokens = createLayoutTokens(fonts);
  const pages = generateLayout(images, tokens);
  const hasPages = pages.length > 0;

  return (
    <main className="app-shell">
      <header className="workspace-header">
        <div className="workspace-title-block">
          <p className="workspace-kicker">A4 문서 워크스페이스</p>
          <h1>doc-factory</h1>
          <p className="workspace-description">
            <code>/images</code> 폴더에 이미지를 넣으면 A4 세로 페이지를 자동으로 구성합니다.
            <code>/fonts</code> 폴더에 글꼴을 추가하면 미리보기와 PPTX 내보내기에 함께 반영됩니다.
          </p>
        </div>

        <div className="workspace-controls">
          <form action="/api/export/pptx" method="post">
            <button className="primary-button" type="submit" disabled={!hasPages}>
              PPTX 내보내기 (A4)
            </button>
          </form>
          <Link className="secondary-button" href="/">
            레이아웃 다시 생성
          </Link>
        </div>
      </header>

      <section className="status-panel" aria-label="문서 상태">
        <article className="status-item">
          <p className="status-label">입력 이미지</p>
          <p className="status-value">{images.length}개</p>
        </article>
        <article className="status-item">
          <p className="status-label">생성 페이지</p>
          <p className="status-value">{pages.length}장</p>
        </article>
        <article className="status-item">
          <p className="status-label">슬라이드 규격</p>
          <p className="status-value">A4 세로</p>
          <p className="status-note">210 x 297 mm</p>
        </article>
        <article className="status-item">
          <p className="status-label">기본 글꼴</p>
          <p className="status-value status-value-font">{tokens.font.primary}</p>
        </article>
      </section>

      {!hasPages ? (
        <section className="empty-state">
          <h2>이미지를 찾지 못했습니다</h2>
          <p>
            <code>/images</code> 폴더에 <code>.png</code>, <code>.jpg</code>, <code>.jpeg</code>,{" "}
            <code>.webp</code> 파일을 추가한 뒤 페이지를 새로고침하거나
            <code>레이아웃 다시 생성</code> 버튼을 눌러 주세요.
          </p>
        </section>
      ) : (
        <section className="pages-stack">
          {pages.map((page) => (
            <article className="page-card" key={page.pageNumber}>
              <header className="page-card-header">
                <p className="page-title">페이지 {page.pageNumber}</p>
                <p className="page-subtitle">A4 세로 · 210 x 297 mm</p>
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
