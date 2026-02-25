import { ensureReferenceIndex } from "@/src/io/referenceIndex";
import { computeRequestHash } from "@/src/io/requestHash";
import { resolveCopyDeck } from "@/src/copywriter";
import type { CopyDeckPage, CopywriterAudit } from "@/src/copywriter/types";
import { buildPageBrief } from "@/src/layout/content";
import { getTemplateFallbackChain, type TemplateId } from "@/src/layout/templateCatalog";
import { createLayoutTokens, type LayoutTokens } from "@/src/layout/tokens";
import { buildTemplatePage } from "@/src/layout/templates";
import { createLayoutSignature, validatePageLayout } from "@/src/layout/validation";
import type { LayoutDocument, LayoutValidationIssue, PageLayout } from "@/src/layout/types";
import type { ScannedFont } from "@/src/io/scanFonts";
import type { ScannedImage } from "@/src/io/scanImages";
import { planDocument } from "@/src/planner/documentPlanner";
import type { DocumentPlan, StoryboardItem } from "@/src/planner/types";
import { runExportAudit } from "@/src/qa/exportAudit";
import { createRuntimeValidator } from "@/src/qa/runtimeValidation";
import { writeExportAuditArtifact, writeGeneratedLayoutArtifact } from "@/src/qa/writeGeneratedLayout";
import { runContentQualityGates } from "@/src/quality/contentGates";
import type { RequestSpec } from "@/src/request/requestSpec";

type GenerateIntent = "regenerate" | "export";

export type GenerateLayoutOptions = {
  requestSpec: RequestSpec;
  intent?: GenerateIntent;
  rootDir?: string;
  debug?: boolean;
  disableReferenceDrivenPlanning?: boolean;
};

export type PageValidationSummary = {
  pageNumber: number;
  passed: boolean;
  issues: LayoutValidationIssue[];
  attemptedTemplates: string[];
};

export type GenerateLayoutResult = {
  requestHash: string;
  plan: DocumentPlan;
  storyboard: StoryboardItem[];
  tokens: LayoutTokens;
  pages: PageLayout[];
  logs: string[];
  validation: {
    passed: boolean;
    passedPageCount: number;
    failedPageCount: number;
    pageResults: PageValidationSummary[];
  };
  runtimeGates: {
    available: boolean;
    passed: boolean;
    failedPageCount: number;
  };
  contentQuality: {
    passed: boolean;
    internalTermsPassed: boolean;
    completenessPassed: boolean;
    internalTermLeakCount: number;
    completenessIssueCount: number;
  };
  copywriter: CopywriterAudit;
  exportAudit: ReturnType<typeof runExportAudit>;
  exportMeta: {
    docTitle: string;
    pageSize: string;
    variantIndex: number;
    pageCount: number;
    filename: string;
    auditHash: string;
    referenceDigest: string;
    requestHash: string;
  };
};

type AttemptState = {
  templateIndex: number;
  copyTightness: number;
  compactLevel: number;
};

type AttemptResult = {
  page: PageLayout;
  brief: ReturnType<typeof buildPageBrief>;
  staticIssues: LayoutValidationIssue[];
  runtimeIssues: LayoutValidationIssue[];
  passed: boolean;
  templateId: TemplateId;
};

type AttemptTrace = {
  attempt: number;
  pageNumber: number;
  templateId: TemplateId;
  copyTightness: number;
  compactLevel: number;
  passed: boolean;
  staticIssueCount: number;
  runtimeIssueCount: number;
};

type RuntimeValidatorRef = Awaited<ReturnType<typeof createRuntimeValidator>>;

function validationOptions(plan: DocumentPlan, tokens: LayoutTokens): {
  headerBottomMm: number;
  footerTopMm: number;
  copyDensity?: {
    minTextChars: number;
    minTextBlocks: number;
    minBodyFontPt: number;
  };
} {
  const headerBottomMm = tokens.spacingMm.pageMargin + tokens.spacingMm.headerHeight;
  const footerTopMm = plan.pageSize.heightMm - tokens.spacingMm.pageMargin - tokens.spacingMm.footerHeight;
  const copyDensity =
    plan.requestSpec.docKind === "poster_set"
      ? {
          minTextChars: 220,
          minTextBlocks: 4,
          minBodyFontPt: 16,
        }
      : plan.requestSpec.docKind === "onepager"
        ? {
            minTextChars: 180,
            minTextBlocks: 4,
            minBodyFontPt: 12,
          }
        : undefined;
  return {
    headerBottomMm,
    footerTopMm,
    copyDensity,
  };
}

function sanitizeFilenamePart(value: string, fallback: string): string {
  const cleaned = value
    .trim()
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, "_");
  return cleaned.length > 0 ? cleaned : fallback;
}

function formatMm(value: number): string {
  return Number(value.toFixed(3)).toString();
}

function mergeIssues(
  staticIssues: LayoutValidationIssue[],
  runtimeIssues: LayoutValidationIssue[],
): LayoutValidationIssue[] {
  return [...staticIssues, ...runtimeIssues];
}

function clonePageWithMeta(params: {
  attempt: AttemptResult;
  item: StoryboardItem;
  attemptedTemplates: TemplateId[];
}): PageLayout {
  const issues = mergeIssues(params.attempt.staticIssues, params.attempt.runtimeIssues);

  return {
    ...params.attempt.page,
    meta: {
      brief: {
        pageRole: params.attempt.brief.pageRole,
        sourceImage: params.attempt.brief.sourceImage,
        imageCaption: params.attempt.brief.imageCaption,
        topic: params.attempt.brief.topic,
        template: params.attempt.brief.template,
        templateReason: params.attempt.brief.templateReason,
        readingFlow: params.attempt.brief.readingFlow,
        maxTextBudget: params.attempt.brief.maxTextBudget,
        copyPipelineLog: params.attempt.brief.copyPipelineLog,
      },
      validation: {
        passed: params.attempt.passed,
        issues,
        attemptedTemplates: params.attemptedTemplates,
        runtimeIssues: params.attempt.runtimeIssues,
      },
    },
    templateId: params.attempt.templateId,
    pageRole: params.item.role,
  };
}

function nextAttemptState(state: AttemptState, issues: LayoutValidationIssue[], chainLength: number): AttemptState {
  const hasLowDensityIssue = issues.some((issue) => issue.code === "content-density" || issue.code === "copy-density");
  const hasOverflowLikeIssue = issues.some((issue) =>
    [
      "min-size",
      "reserved-lane",
      "text-truncation",
      "runtime-overflow",
      "runtime-clip",
      "runtime-truncation",
    ].includes(issue.code),
  );

  if (hasLowDensityIssue && state.templateIndex < chainLength - 1) {
    return {
      templateIndex: state.templateIndex + 1,
      copyTightness: 0,
      compactLevel: 0,
    };
  }

  if (hasLowDensityIssue && state.copyTightness > 0) {
    return {
      ...state,
      copyTightness: Math.max(0, state.copyTightness - 1),
    };
  }

  if (hasOverflowLikeIssue && state.copyTightness < 2) {
    return {
      ...state,
      copyTightness: state.copyTightness + 1,
    };
  }

  if (hasOverflowLikeIssue && state.templateIndex < chainLength - 1) {
    return {
      templateIndex: state.templateIndex + 1,
      copyTightness: 0,
      compactLevel: 0,
    };
  }

  if (hasOverflowLikeIssue && state.compactLevel < 1) {
    return {
      ...state,
      compactLevel: state.compactLevel + 1,
    };
  }

  if (state.templateIndex < chainLength - 1) {
    return {
      templateIndex: state.templateIndex + 1,
      copyTightness: 0,
      compactLevel: 0,
    };
  }

  return {
    ...state,
    copyTightness: Math.min(2, state.copyTightness + 1),
    compactLevel: Math.min(2, state.compactLevel + 1),
  };
}

async function runAttempt(params: {
  item: StoryboardItem;
  plan: DocumentPlan;
  templateId: TemplateId;
  copyTightness: number;
  compactLevel: number;
  showDebugMeta: boolean;
  tokens: LayoutTokens;
  imageByFilename: Map<string, ScannedImage>;
  copyDeckPageByNumber: Map<number, CopyDeckPage>;
  runtimeValidator: Awaited<ReturnType<typeof createRuntimeValidator>>;
}): Promise<AttemptResult> {
  const sourceImage = params.item.primaryAssetFilename
    ? params.imageByFilename.get(params.item.primaryAssetFilename) ?? null
    : null;

  const brief = buildPageBrief({
    item: params.item,
    plan: params.plan,
    templateId: params.templateId,
    copyTightness: params.copyTightness,
    tokens: params.tokens,
    copyDeckPage: params.copyDeckPageByNumber.get(params.item.pageNumber) ?? null,
  });

  const page = buildTemplatePage({
    sourceImage,
    brief,
    pageNumber: params.item.pageNumber,
    tokens: params.tokens,
    templateId: params.templateId,
    pageWidthMm: params.plan.pageSize.widthMm,
    pageHeightMm: params.plan.pageSize.heightMm,
    layoutTuning: params.item.layoutTuning,
    compactLevel: params.compactLevel,
    showDebugMeta: params.showDebugMeta,
  });

  const staticValidation = validatePageLayout(page, validationOptions(params.plan, params.tokens));

  const runtimeValidation = await params.runtimeValidator.validatePages([page]);
  const runtimeIssues = runtimeValidation.pageResults[0]?.issues ?? [];

  const passed = staticValidation.passed && runtimeIssues.length === 0;

  return {
    page,
    brief,
    staticIssues: staticValidation.issues,
    runtimeIssues,
    passed,
    templateId: params.templateId,
  };
}

async function revalidatePages(params: {
  pages: PageLayout[];
  plan: DocumentPlan;
  tokens: LayoutTokens;
  runtimeValidator: RuntimeValidatorRef;
}): Promise<PageLayout[]> {
  const runtimeValidation = await params.runtimeValidator.validatePages(params.pages);
  const runtimeByPage = new Map(
    runtimeValidation.pageResults.map((result) => [result.pageNumber, result.issues] as const),
  );

  return params.pages.map((page) => {
    const staticValidation = validatePageLayout(page, validationOptions(params.plan, params.tokens));
    const runtimeIssues = runtimeByPage.get(page.pageNumber) ?? [];
    const merged = mergeIssues(staticValidation.issues, runtimeIssues);
    const attemptedTemplates = page.meta?.validation.attemptedTemplates ?? [page.templateId];

    if (!page.meta) {
      return page;
    }

    return {
      ...page,
      meta: {
        ...page.meta,
        validation: {
          passed: staticValidation.passed && runtimeIssues.length === 0,
          issues: merged,
          attemptedTemplates,
          runtimeIssues,
        },
      },
    };
  });
}

async function resolvePageWithAutofix(params: {
  item: StoryboardItem;
  plan: DocumentPlan;
  tokens: LayoutTokens;
  imageByFilename: Map<string, ScannedImage>;
  copyDeckPageByNumber: Map<number, CopyDeckPage>;
  runtimeValidator: Awaited<ReturnType<typeof createRuntimeValidator>>;
  showDebugMeta: boolean;
  maxAttempts: number;
  initialState?: AttemptState;
  logs: string[];
  onAttempt?: (trace: AttemptTrace) => void;
}): Promise<PageLayout> {
  const templateChain = getTemplateFallbackChain(params.item.templateId);
  const attemptedTemplates: TemplateId[] = [];

  let state: AttemptState = params.initialState ?? {
    templateIndex: 0,
    copyTightness: 0,
    compactLevel: 0,
  };

  let lastAttempt: AttemptResult | null = null;

  for (let attempt = 0; attempt < params.maxAttempts; attempt += 1) {
    const templateId = templateChain[Math.min(state.templateIndex, templateChain.length - 1)] ?? "TEXT_ONLY_EDITORIAL";
    attemptedTemplates.push(templateId);

    const result = await runAttempt({
      item: params.item,
      plan: params.plan,
      templateId,
      copyTightness: state.copyTightness,
      compactLevel: state.compactLevel,
      showDebugMeta: params.showDebugMeta,
      tokens: params.tokens,
      imageByFilename: params.imageByFilename,
      copyDeckPageByNumber: params.copyDeckPageByNumber,
      runtimeValidator: params.runtimeValidator,
    });

    lastAttempt = result;

    params.onAttempt?.({
      attempt: attempt + 1,
      pageNumber: params.item.pageNumber,
      templateId,
      copyTightness: state.copyTightness,
      compactLevel: state.compactLevel,
      passed: result.passed,
      staticIssueCount: result.staticIssues.length,
      runtimeIssueCount: result.runtimeIssues.length,
    });

    if (result.passed) {
      if (attempt > 0) {
        params.logs.push(
          `[autofix] page ${params.item.pageNumber} resolved on attempt ${attempt + 1} (template=${templateId}, tighten=${state.copyTightness}, compact=${state.compactLevel})`,
        );
      }
      return clonePageWithMeta({
        attempt: result,
        item: params.item,
        attemptedTemplates,
      });
    }

    const mergedIssues = mergeIssues(result.staticIssues, result.runtimeIssues);
    state = nextAttemptState(state, mergedIssues, templateChain.length);
  }

  if (!lastAttempt) {
    throw new Error(`failed to build page ${params.item.pageNumber}`);
  }

  params.logs.push(
    `[autofix] page ${params.item.pageNumber} unresolved after ${params.maxAttempts} attempts (template=${lastAttempt.templateId})`,
  );

  return clonePageWithMeta({
    attempt: {
      ...lastAttempt,
      passed: false,
    },
    item: params.item,
    attemptedTemplates,
  });
}

function enforceDeterminismSignature(params: {
  pages: PageLayout[];
}): { pages: PageLayout[]; passed: boolean } {
  const firstSignature = createLayoutSignature(params.pages);
  const reconstructed = params.pages.map((page) => ({
    ...page,
    elements: [...page.elements],
  }));
  const secondSignature = createLayoutSignature(reconstructed);

  if (firstSignature === secondSignature) {
    return {
      pages: params.pages,
      passed: true,
    };
  }

  const determinismIssue: LayoutValidationIssue = {
    code: "determinism",
    message: "same params produced a different DSL signature",
  };

  const nextPages = params.pages.map((page) => {
    if (!page.meta) {
      return page;
    }

    return {
      ...page,
      meta: {
        ...page.meta,
        validation: {
          ...page.meta.validation,
          passed: false,
          issues: [...page.meta.validation.issues, determinismIssue],
        },
      },
    };
  });

  return {
    pages: nextPages,
    passed: false,
  };
}

function applyQualityIssuesToPages(params: {
  pages: PageLayout[];
  issues: ReturnType<typeof runContentQualityGates>["issues"];
}): PageLayout[] {
  const byPage = new Map<number, LayoutValidationIssue[]>();
  for (const finding of params.issues) {
    const bucket = byPage.get(finding.pageNumber) ?? [];
    bucket.push(finding.issue);
    byPage.set(finding.pageNumber, bucket);
  }

  return params.pages.map((page) => {
    const extraIssues = byPage.get(page.pageNumber) ?? [];
    if (extraIssues.length === 0 || !page.meta) {
      return page;
    }

    return {
      ...page,
      meta: {
        ...page.meta,
        validation: {
          ...page.meta.validation,
          passed: false,
          issues: [...page.meta.validation.issues, ...extraIssues],
        },
      },
    };
  });
}

function buildExportFilename(params: {
  docTitle: string;
  docKind: RequestSpec["docKind"];
  widthMm: number;
  heightMm: number;
  pageCount: number;
  variantIndex: number;
  requestHash: string;
}): string {
  const hash8 = params.requestHash.slice(0, 8);
  return `${sanitizeFilenamePart(params.docTitle, "Visual_Document")}_${params.docKind}_${formatMm(params.widthMm)}x${formatMm(params.heightMm)}mm_${params.pageCount}p_v${params.variantIndex}_${hash8}.pptx`;
}

export async function generateLayout(
  orderedImages: ScannedImage[],
  fonts: ScannedFont[],
  options: GenerateLayoutOptions,
): Promise<GenerateLayoutResult> {
  const logs: string[] = [];
  const startedAt = Date.now();
  const intent = options.intent ?? "regenerate";
  const requestSpec = options.requestSpec;
  const debugExport = intent === "export" && process.env.DOC_FACTORY_DEBUG_LAYOUT === "1";
  const emitDebug = (line: string): void => {
    if (!debugExport) {
      return;
    }
    const elapsed = Date.now() - startedAt;
    console.log(`[generateLayout][+${elapsed}ms] ${line}`);
  };

  const variantIndex = Math.max(1, requestSpec.variantIndex || 1);
  const seed = requestSpec.seed;
  const rootDir = options.rootDir ?? process.cwd();

  const referenceContext = await ensureReferenceIndex({
    rootDir,
    allowRebuild: intent !== "export",
    minRequiredCount: 8,
  });

  const requestHash = computeRequestHash({
    requestSpec,
    orderedImageIds: orderedImages.map((image) => image.id),
    referenceDigest: referenceContext.referenceDigest,
    pageSpec: {
      widthMm: requestSpec.pageSize.widthMm,
      heightMm: requestSpec.pageSize.heightMm,
    },
    variantIndex,
    seed,
  });

  logs.push(
    `[intake] requestHash=${requestHash} job=${requestSpec.jobId} images=${orderedImages.length} fonts=${fonts.length} variantIndex=${variantIndex} seed=${seed}`,
  );
  emitDebug(`intake requestHash=${requestHash} images=${orderedImages.length} variant=${variantIndex} seed=${seed}`);

  emitDebug("planner start");
  const plannerResult = await planDocument(orderedImages, {
    requestSpec,
    requestHash,
    intent,
    rootDir,
    disableReferenceDrivenPlanning: options.disableReferenceDrivenPlanning,
    referenceContext,
  });
  emitDebug(`planner done pages=${plannerResult.storyboard.length} style=${plannerResult.plan.stylePresetId}`);

  logs.push(...plannerResult.logs);

  const copywriterResult = await resolveCopyDeck({
    input: {
      requestHash,
      plan: plannerResult.plan,
      storyboard: plannerResult.storyboard,
      orderedImages,
    },
    rootDir,
    forceRegenerate: requestSpec.forceRegenerateCopy,
    modeOverride: requestSpec.copywriterMode,
  });
  logs.push(...copywriterResult.logs);
  emitDebug(
    `copywriter mode=${copywriterResult.audit.effectiveMode} cacheHit=${copywriterResult.audit.cacheHit} key=${copywriterResult.audit.cacheKey.slice(0, 12)}`,
  );

  const copyDeckPageByNumber = new Map(
    (copywriterResult.copyDeck?.pages ?? []).map((page) => [page.pageIndex, page] as const),
  );

  const preset = plannerResult.plan.stylePreset;
  const tokens = createLayoutTokens(fonts, preset);

  logs.push(`[style] applied preset=${preset.id} (${preset.label}) source=${plannerResult.plan.stylePresetSource}`);

  const imageByFilename = new Map(orderedImages.map((image) => [image.filename, image] as const));
  const storyboardByPageNumber = new Map(plannerResult.storyboard.map((item) => [item.pageNumber, item] as const));
  const showDebugMeta = intent === "export" ? false : options.debug === true;
  if (intent === "export" && options.debug) {
    logs.push("[debug] export path forced debug=false");
  }

  const runtimeValidator = await createRuntimeValidator();
  logs.push(...runtimeValidator.startupLogs.map((line) => `[runtime] ${line}`));
  emitDebug(`runtime validator ready available=${runtimeValidator.available}`);

  let pages: PageLayout[] = [];

  for (const item of plannerResult.storyboard) {
    emitDebug(`page ${item.pageNumber} v1 start role=${item.role} template=${item.templateId}`);
    const resolved = await resolvePageWithAutofix({
      item,
      plan: plannerResult.plan,
      tokens,
      imageByFilename,
      copyDeckPageByNumber,
      runtimeValidator,
      showDebugMeta,
      maxAttempts: 1,
      logs,
      onAttempt: (trace) => {
        emitDebug(
          `v1 page ${trace.pageNumber} attempt ${trace.attempt} template=${trace.templateId} tighten=${trace.copyTightness} compact=${trace.compactLevel} passed=${trace.passed} static=${trace.staticIssueCount} runtime=${trace.runtimeIssueCount}`,
        );
      },
    });
    pages.push(resolved);
  }

  pages = await revalidatePages({
    pages,
    plan: plannerResult.plan,
    tokens,
    runtimeValidator,
  });

  let failedPageNumbers = pages
    .filter((page) => !(page.meta?.validation.passed ?? false))
    .map((page) => page.pageNumber);
  logs.push(
    `[quality] v1 failedPages=${failedPageNumbers.length}${failedPageNumbers.length > 0 ? ` (${failedPageNumbers.join(", ")})` : ""}`,
  );

  const maxQualityVersion = intent === "regenerate" ? 3 : 2;
  const minQualityVersion = intent === "regenerate" ? 2 : 1;

  for (let qualityVersion = 2; qualityVersion <= maxQualityVersion; qualityVersion += 1) {
    const shouldRun = qualityVersion <= minQualityVersion || failedPageNumbers.length > 0;
    if (!shouldRun) {
      break;
    }

    logs.push(`[quality] v${qualityVersion} start failedPages=${failedPageNumbers.length}`);
    emitDebug(`quality v${qualityVersion} start failed=${failedPageNumbers.join(",") || "none"}`);

    if (failedPageNumbers.length > 0) {
      const pagesByNumber = new Map(pages.map((page) => [page.pageNumber, page] as const));

      for (const pageNumber of failedPageNumbers) {
        const item = storyboardByPageNumber.get(pageNumber);
        if (!item) {
          continue;
        }

        const previous = pagesByNumber.get(pageNumber);
        const hasLowDensityIssue =
          previous?.meta?.validation.issues.some((issue) => issue.code === "content-density" || issue.code === "copy-density") ??
          false;
        const maxAttemptsForPage = hasLowDensityIssue ? (qualityVersion === 2 ? 4 : 5) : qualityVersion === 2 ? 8 : 10;

        const resolved = await resolvePageWithAutofix({
          item,
          plan: plannerResult.plan,
          tokens,
          imageByFilename,
          copyDeckPageByNumber,
          runtimeValidator,
          showDebugMeta,
          maxAttempts: maxAttemptsForPage,
          initialState: {
            templateIndex: 0,
            copyTightness: hasLowDensityIssue ? 0 : 1,
            compactLevel: 0,
          },
          logs,
          onAttempt: (trace) => {
            emitDebug(
              `v${qualityVersion} page ${trace.pageNumber} attempt ${trace.attempt} template=${trace.templateId} tighten=${trace.copyTightness} compact=${trace.compactLevel} passed=${trace.passed} static=${trace.staticIssueCount} runtime=${trace.runtimeIssueCount}`,
            );
          },
        });
        pagesByNumber.set(pageNumber, resolved);
      }

      pages = plannerResult.storyboard
        .map((item) => pagesByNumber.get(item.pageNumber))
        .filter((page): page is PageLayout => page !== undefined);
    }

    pages = await revalidatePages({
      pages,
      plan: plannerResult.plan,
      tokens,
      runtimeValidator,
    });

    failedPageNumbers = pages
      .filter((page) => !(page.meta?.validation.passed ?? false))
      .map((page) => page.pageNumber);
    logs.push(
      `[quality] v${qualityVersion} failedPages=${failedPageNumbers.length}${failedPageNumbers.length > 0 ? ` (${failedPageNumbers.join(", ")})` : ""}`,
    );
  }

  if (failedPageNumbers.length > 0) {
    logs.push(
      `[quality] unresolved after v${maxQualityVersion}; export remains blocked until truncation/readability/layout issues are fixed`,
    );
  }

  await runtimeValidator.close();
  emitDebug("runtime validator closed");

  const deterministic = enforceDeterminismSignature({
    pages,
  });

  if (!deterministic.passed) {
    logs.push("[determinism] signature mismatch detected and marked as failure");
  }

  const contentQuality = runContentQualityGates({
    pages: deterministic.pages,
    docKind: requestSpec.docKind,
  });
  const qualityAdjustedPages = applyQualityIssuesToPages({
    pages: deterministic.pages,
    issues: contentQuality.issues,
  });

  if (!contentQuality.passed) {
    logs.push(
      `[content-quality] failed internal=${contentQuality.internalTermLeakCount} completeness=${contentQuality.completenessIssueCount}`,
    );
  } else {
    logs.push("[content-quality] passed");
  }

  const pageResults: PageValidationSummary[] = qualityAdjustedPages.map((page) => {
    const passed = page.meta?.validation.passed ?? false;
    return {
      pageNumber: page.pageNumber,
      passed,
      issues: page.meta?.validation.issues ?? [],
      attemptedTemplates: page.meta?.validation.attemptedTemplates ?? [page.templateId],
    };
  });

  const passedPageCount = pageResults.filter((result) => result.passed).length;
  const failedPageCount = pageResults.length - passedPageCount;

  const runtimeGateFailedPageCount = pageResults.filter((result) =>
    result.issues.some((issue) => issue.code.startsWith("runtime-")),
  ).length;
  const runtimeGatesPassed = runtimeGateFailedPageCount === 0;

  logs.push(`[validation] static+runtime+content passed=${passedPageCount}/${qualityAdjustedPages.length}`);

  const exportAudit = runExportAudit({
    pages: qualityAdjustedPages,
    expectedPageCount: plannerResult.plan.pageCount,
    pageSize: plannerResult.plan.pageSize,
    debugEnabled: intent === "export" ? showDebugMeta : false,
    referenceRequired: plannerResult.plan.referenceUsageReport.required,
    referenceUsageReport: plannerResult.plan.referenceUsageReport,
    requestHash,
    themeFactoryStatus: plannerResult.plan.themeFactoryProof.status,
    runtimeGatesPassed,
    contentQuality,
    copywriterAudit: copywriterResult.audit,
  });
  emitDebug(`export audit passed=${exportAudit.passed} issues=${exportAudit.issues.length} hash=${exportAudit.auditHash}`);

  if (!exportAudit.passed) {
    logs.push(`[audit] export audit failed (${exportAudit.issues.length} issues) hash=${exportAudit.auditHash}`);
  } else {
    logs.push(`[audit] export audit passed hash=${exportAudit.auditHash}`);
  }

  const filename = buildExportFilename({
    docTitle: plannerResult.plan.docTitle,
    docKind: requestSpec.docKind,
    widthMm: plannerResult.plan.pageSize.widthMm,
    heightMm: plannerResult.plan.pageSize.heightMm,
    pageCount: deterministic.pages.length,
    variantIndex,
    requestHash,
  });

  logs.push(`[export] filename=${filename}`);

  const documentArtifact: LayoutDocument = {
    params: {
      pageSizePreset: plannerResult.plan.pageSizePreset,
      customPageSize: plannerResult.plan.pageSizePreset === "CUSTOM"
        ? {
            widthMm: plannerResult.plan.pageSize.widthMm,
            heightMm: plannerResult.plan.pageSize.heightMm,
          }
        : undefined,
      docType: plannerResult.plan.docType,
      stylePresetId: plannerResult.plan.stylePreset.id,
      variantIndex,
      seed,
      referenceDigest: plannerResult.plan.referenceDigest,
      requestHash,
    },
    pages: qualityAdjustedPages,
  };

  try {
    await writeGeneratedLayoutArtifact({
      document: documentArtifact,
      requestHash,
      rootDir,
    });
    await writeExportAuditArtifact({
      audit: exportAudit,
      requestHash,
      rootDir,
    });
    logs.push(`[artifact] src/generated/jobs/${requestHash}/layout.json updated`);
    emitDebug("artifact write done");
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    logs.push(`[artifact] failed to write generated layout: ${message}`);
  }
  emitDebug("generateLayout return");

  return {
    requestHash,
    plan: plannerResult.plan,
    storyboard: plannerResult.storyboard,
    tokens,
    pages: qualityAdjustedPages,
    logs,
    validation: {
      passed: failedPageCount === 0,
      passedPageCount,
      failedPageCount,
      pageResults,
    },
    runtimeGates: {
      available: runtimeValidator.available,
      passed: runtimeGatesPassed,
      failedPageCount: runtimeGateFailedPageCount,
    },
    contentQuality: {
      passed: contentQuality.passed,
      internalTermsPassed: contentQuality.internalTermsPassed,
      completenessPassed: contentQuality.completenessPassed,
      internalTermLeakCount: contentQuality.internalTermLeakCount,
      completenessIssueCount: contentQuality.completenessIssueCount,
    },
    copywriter: copywriterResult.audit,
    exportAudit,
    exportMeta: {
      docTitle: plannerResult.plan.docTitle,
      pageSize: plannerResult.plan.pageSizePreset,
      variantIndex,
      pageCount: qualityAdjustedPages.length,
      filename,
      auditHash: exportAudit.auditHash,
      referenceDigest: plannerResult.plan.referenceDigest,
      requestHash,
    },
  };
}
