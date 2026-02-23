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

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <h1>doc-factory</h1>
          <p>
            Put image files into <code>/images</code>. Optionally add fonts to{" "}
            <code>/fonts</code>. The app builds A4 portrait pages and exports editable PPTX.
          </p>
        </div>

        <div className="topbar-actions">
          <form action="/api/export/pptx" method="post">
            <button className="primary-button" type="submit" disabled={pages.length === 0}>
              Export PPTX (A4)
            </button>
          </form>
          <Link className="secondary-button" href="/">
            Regenerate Layout
          </Link>
        </div>
      </header>

      <section className="meta-strip">
        <span className="badge">{images.length} image(s)</span>
        <span className="badge">{pages.length} page(s)</span>
        <span className="badge">A4 portrait: 210 x 297 mm</span>
        <span className="badge">Font: {tokens.font.primary}</span>
      </section>

      {pages.length === 0 ? (
        <section className="empty-state">
          <h2>No images found</h2>
          <p>
            Add <code>.png</code>, <code>.jpg</code>, <code>.jpeg</code>, or <code>.webp</code>{" "}
            files to <code>/images</code>, then reload or click Regenerate Layout.
          </p>
        </section>
      ) : (
        <section className="pages-stack">
          {pages.map((page) => (
            <article className="page-card" key={page.pageNumber}>
              <div className="page-scroll">
                <PageView page={page} fontFamily={tokens.font.cssStack} />
              </div>
              <p className="page-label">Page {page.pageNumber}</p>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
