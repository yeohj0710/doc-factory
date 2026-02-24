import { scanFonts } from "@/src/io/scanFonts";
import { scanImages } from "@/src/io/scanImages";
import { generateLayout } from "@/src/layout/generateLayout";
import type { PageSizePreset } from "@/src/layout/pageSize";
import type { DocType } from "@/src/layout/types";
import { renderLayoutsToPptx } from "@/src/render/pptx/renderPptx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function encodeContentDispositionFilename(filename: string): {
  asciiFallback: string;
  utf8Encoded: string;
} {
  const asciiFallback = filename.replace(/[^\x20-\x7E]/g, "_");
  const utf8Encoded = encodeURIComponent(filename)
    .replace(/['()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);

  return {
    asciiFallback,
    utf8Encoded,
  };
}

function parseNumber(value: FormDataEntryValue | null): number | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const parsed = Number.parseFloat(value);
  if (Number.isNaN(parsed)) {
    return undefined;
  }
  return parsed;
}

function parseInteger(value: FormDataEntryValue | null): number | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return undefined;
  }
  return parsed;
}

function parseDocType(value: FormDataEntryValue | null): DocType | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.toLowerCase();
  if (["proposal", "poster", "one-pager", "multi-card", "report"].includes(normalized)) {
    return normalized as DocType;
  }
  return undefined;
}

function parsePageSizePreset(value: FormDataEntryValue | null): PageSizePreset | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.toUpperCase();
  if (["A4P", "A4L", "LETTERP", "LETTERL", "CUSTOM"].includes(normalized)) {
    return normalized as PageSizePreset;
  }
  return undefined;
}

export async function POST(request: Request): Promise<Response> {
  try {
    const formData = await request.formData();

    const variantIndex = parseInteger(formData.get("variantIndex")) ?? 1;
    const seed = parseInteger(formData.get("seed"));
    const requestedDocType = parseDocType(formData.get("docType"));
    const requestedPageSizePreset = parsePageSizePreset(formData.get("pageSizePreset"));
    const pageWidthMm = parseNumber(formData.get("pageWidthMm"));
    const pageHeightMm = parseNumber(formData.get("pageHeightMm"));

    const [images, fonts] = await Promise.all([scanImages(), scanFonts()]);

    if (images.length === 0) {
      return Response.json(
        {
          error: "No images found. Add files to /images first.",
        },
        { status: 400 },
      );
    }

    const result = await generateLayout(images, fonts, {
      intent: "export",
      variantIndex,
      seed,
      requestedDocType,
      requestedPageSizePreset,
      customPageSizeMm:
        requestedPageSizePreset === "CUSTOM" && typeof pageWidthMm === "number" && typeof pageHeightMm === "number"
          ? {
              widthMm: pageWidthMm,
              heightMm: pageHeightMm,
            }
          : undefined,
    });

    if (!result.validation.passed || !result.exportAudit.passed) {
      return Response.json(
        {
          error: "Validation failed. Export aborted.",
          pageErrors: result.validation.pageResults.filter((page) => !page.passed),
          exportAuditIssues: result.exportAudit.issues,
        },
        { status: 400 },
      );
    }

    const pptxBytes = await renderLayoutsToPptx(result.pages, {
      primaryFont: result.tokens.font.primary,
      title: result.plan.docTitle,
      subject: `${result.plan.docType} ${result.plan.pageSizePreset}`,
    });
    const disposition = encodeContentDispositionFilename(result.exportMeta.filename);

    const bodyStream = new ReadableStream({
      start(controller) {
        controller.enqueue(pptxBytes);
        controller.close();
      },
    });

    return new Response(bodyStream, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename="${disposition.asciiFallback}"; filename*=UTF-8''${disposition.utf8Encoded}`,
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
