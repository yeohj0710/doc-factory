import { scanFonts } from "@/src/io/scanFonts";
import { scanImages } from "@/src/io/scanImages";
import { generateLayout } from "@/src/layout/generateLayout";
import { createLayoutTokens } from "@/src/layout/tokens";
import { renderLayoutsToPptx } from "@/src/render/pptx/renderPptx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    const result = generateLayout(images, tokens, {
      intent: "export",
      fontCount: fonts.length,
    });

    if (!result.validation.passed) {
      return Response.json(
        {
          error: "Validation failed. Export aborted.",
          pageErrors: result.validation.pageResults
            .filter((page) => !page.passed)
            .map((page) => ({
              pageNumber: page.pageNumber,
              issues: page.issues,
            })),
        },
        { status: 400 },
      );
    }

    const pptxBytes = await renderLayoutsToPptx(result.pages, {
      primaryFont: tokens.font.primary,
    });

    const bodyStream = new ReadableStream({
      start(controller) {
        controller.enqueue(pptxBytes);
        controller.close();
      },
    });

    return new Response(bodyStream, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename="${result.exportMeta.filename}"`,
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
