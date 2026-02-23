import path from "node:path";
import { scanFonts } from "@/src/io/scanFonts";
import { scanImages } from "@/src/io/scanImages";
import { generateLayout } from "@/src/layout/generateLayout";
import { createLayoutTokens } from "@/src/layout/tokens";
import { renderLayoutsToPptx } from "@/src/render/pptx/renderPptx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sanitizeFilename(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "doc-factory";
}

export async function POST(): Promise<Response> {
  try {
    const [images, fonts] = await Promise.all([scanImages(), scanFonts()]);

    if (images.length === 0) {
      return Response.json(
        {
          error: "No images found. Add files to /images first.",
        },
        { status: 400 },
      );
    }

    const tokens = createLayoutTokens(fonts);
    const pages = generateLayout(images, tokens);
    const pptxBytes = await renderLayoutsToPptx(pages, {
      primaryFont: tokens.font.primary,
    });
    const bodyStream = new ReadableStream({
      start(controller) {
        controller.enqueue(pptxBytes);
        controller.close();
      },
    });

    const repoName = sanitizeFilename(path.basename(process.cwd()));
    const filename = `${repoName}-export.pptx`;

    return new Response(bodyStream, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(pptxBytes.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to export PPTX.";
    return Response.json(
      {
        error: "PPTX export failed",
        message,
      },
      { status: 500 },
    );
  }
}
