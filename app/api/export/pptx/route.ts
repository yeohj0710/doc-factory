import { scanFonts } from "@/src/io/scanFonts";
import { scanImages } from "@/src/io/scanImages";
import { generateLayout } from "@/src/layout/generateLayout";
import { normalizeRequestSpecFromFormData } from "@/src/request/requestSpec";
import { renderLayoutsToPptx } from "@/src/render/pptx/renderPptx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function createExportLogger(requestId: string): {
  log: (stage: string, detail?: string) => void;
  elapsedMs: () => number;
} {
  const startedAt = Date.now();

  return {
    log(stage, detail) {
      const elapsed = Date.now() - startedAt;
      if (detail) {
        console.log(`[export:pptx][${requestId}][+${elapsed}ms] ${stage} :: ${detail}`);
      } else {
        console.log(`[export:pptx][${requestId}][+${elapsed}ms] ${stage}`);
      }
    },
    elapsedMs() {
      return Date.now() - startedAt;
    },
  };
}

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

function parseBoolean(value: FormDataEntryValue | null): boolean | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on") {
    return true;
  }
  if (normalized === "0" || normalized === "false" || normalized === "no" || normalized === "off") {
    return false;
  }
  return undefined;
}

export async function POST(request: Request): Promise<Response> {
  const requestId = `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const logger = createExportLogger(requestId);

  try {
    logger.log("export start");
    const formData = await request.formData();

    const requestSpec = normalizeRequestSpecFromFormData(formData);
    const requestedDebug = formData.get("debug");
    const qaDisableReferenceUsage = parseBoolean(formData.get("qaDisableReferenceUsage")) ?? false;
    logger.log(
      "request parsed",
      `job=${requestSpec.jobId} docKind=${requestSpec.docKind} pageCount=${requestSpec.pageCount.mode} variant=${requestSpec.variantIndex} seed=${requestSpec.seed} debug=${typeof requestedDebug === "string" ? requestedDebug : "0"} qaDisableReferenceUsage=${qaDisableReferenceUsage ? "1" : "0"}`,
    );

    logger.log("asset scan start");
    const [images, fonts] = await Promise.all([scanImages(), scanFonts()]);
    logger.log("asset scan done", `images=${images.length} fonts=${fonts.length}`);

    if (images.length === 0) {
      logger.log("export blocked", "no images");
      return Response.json(
        {
          error: "No images found. Add files to /images first.",
        },
        { status: 400 },
      );
    }

    logger.log("layout generation start");
    const result = await generateLayout(images, fonts, {
      requestSpec,
      intent: "export",
      debug: false,
      disableReferenceDrivenPlanning: qaDisableReferenceUsage,
    });
    logger.log(
      "layout generation done",
      `requestHash=${result.requestHash} pages=${result.pages.length} validation=${result.validation.passed} audit=${result.exportAudit.passed}`,
    );

    if (!result.validation.passed || !result.exportAudit.passed) {
      logger.log(
        "export blocked",
        `validationFailures=${result.validation.failedPageCount} auditIssues=${result.exportAudit.issues.length}`,
      );
      return Response.json(
        {
          error: "Validation failed. Export aborted.",
          pageErrors: result.validation.pageResults.filter((page) => !page.passed),
          exportAuditIssues: result.exportAudit.issues,
          exportAuditHash: result.exportAudit.auditHash,
          exportGateProof: result.exportAudit.gateProof,
          referenceUsageReport: result.exportAudit.referenceUsageReport,
          requestHash: result.requestHash,
        },
        { status: 400 },
      );
    }

    logger.log("pptx render start", `slides=${result.pages.length}`);
    const pptxBytes = await renderLayoutsToPptx(result.pages, {
      primaryFont: result.tokens.font.primary,
      title: result.plan.docTitle,
      subject: `${result.plan.docType} ${result.plan.pageSizePreset}`,
    });
    logger.log("pptx render done", `bytes=${pptxBytes.byteLength}`);
    const disposition = encodeContentDispositionFilename(result.exportMeta.filename);
    logger.log("response stream prepare", `filename=${result.exportMeta.filename}`);
    const refReport = result.exportAudit.referenceUsageReport;

    const bodyStream = new ReadableStream({
      start(controller) {
        logger.log("write start", `bytes=${pptxBytes.byteLength}`);
        controller.enqueue(pptxBytes);
        controller.close();
        logger.log("write done");
      },
    });

    logger.log("response ready", `total=${logger.elapsedMs()}ms`);
    return new Response(bodyStream, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename="${disposition.asciiFallback}"; filename*=UTF-8''${disposition.utf8Encoded}`,
        "Content-Length": String(pptxBytes.byteLength),
        "Cache-Control": "no-store",
        "X-DocFactory-Export-Debug": "0",
        "X-DocFactory-Audit-Hash": result.exportAudit.auditHash,
        "X-DocFactory-Request-Hash": result.requestHash,
        "X-DocFactory-Reference-Index-Status": result.plan.referenceIndexStatus,
        "X-DocFactory-Reference-Digest": result.plan.referenceDigest || "none",
        "X-DocFactory-Ref-Used-Style-Clusters": String(refReport?.usedStyleClusterIds.length ?? 0),
        "X-DocFactory-Ref-Used-Layout-Clusters": String(refReport?.usedLayoutClusterIds.length ?? 0),
        "X-DocFactory-Ref-Layout-Coverage-Required": String(result.exportAudit.gateProof.requiredLayoutClusters),
        "X-DocFactory-Style-Preset-Id": result.plan.stylePresetId,
        "X-DocFactory-Layout-Clusters": result.plan.referenceUsageReport.usedLayoutClusterIds.join(","),
        "X-DocFactory-ThemeFactory": result.plan.themeFactoryProof.status,
        "X-DocFactory-Runtime-Gates": result.runtimeGates.passed ? "pass" : "fail",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to export PPTX.";
    logger.log("export error", message);
    return Response.json(
      {
        error: "PPTX export failed",
        message,
      },
      { status: 500 },
    );
  }
}
