import path from "node:path";
import type { ScannedImage } from "@/src/io/scanImages";
import { scanReferences } from "@/src/io/scanReferences";
import { resolvePageSize, type PageSizePreset } from "@/src/layout/pageSize";
import { getStylePresetById, selectStylePreset } from "@/src/layout/stylePresets";
import {
  getTemplateSpec,
  isFullBleedTemplate,
  templateSupportsImage,
  type TemplateId,
} from "@/src/layout/templateCatalog";
import type { DocType } from "@/src/layout/types";
import type {
  AssetTopic,
  DocumentPlan,
  PageRole,
  PlannerResult,
  StoryboardItem,
  TopicCluster,
} from "@/src/planner/types";

type PlanOptions = {
  docTitle?: string;
  requestedDocType?: DocType;
  requestedPageSizePreset?: PageSizePreset;
  customPageSizeMm?: {
    widthMm: number;
    heightMm: number;
  };
  requestedStylePresetId?: string;
  variantIndex: number;
  seed: number;
  rootDir?: string;
};

type TopicDetection = {
  topic: AssetTopic;
  isLowSignal: boolean;
  isProofAsset: boolean;
};

const TOPIC_KEYWORDS: Record<AssetTopic, string[]> = {
  ui: ["ui", "screen", "dashboard", "app", "web", "mock", "wireframe", "화면", "앱"],
  photo: ["photo", "product", "package", "shot", "render", "소분", "패키지", "상품"],
  chart: ["chart", "graph", "table", "report", "metric", "kpi", "지표", "리포트", "표"],
  diagram: ["diagram", "flow", "map", "icon", "schema", "timeline", "프로세스", "흐름"],
  people: ["people", "person", "team", "meeting", "lifestyle", "모델", "사람", "회의"],
  generic: [],
};

const ROLE_TEMPLATE_POOL: Record<PageRole, TemplateId[]> = {
  cover: ["COVER_HERO_BAND", "COVER_SPLIT_MEDIA", "TITLE_MEDIA_SAFE"],
  "section-divider": ["SECTION_DIVIDER", "QUOTE_FOCUS", "TEXT_ONLY_EDITORIAL"],
  agenda: ["AGENDA_EDITORIAL", "TEXT_ONLY_EDITORIAL", "QUOTE_FOCUS"],
  insight: ["TITLE_MEDIA_SAFE", "TWO_COLUMN_MEDIA_TEXT", "TEXT_ONLY_EDITORIAL"],
  solution: ["TWO_COLUMN_MEDIA_TEXT", "TITLE_MEDIA_SAFE", "COMPARISON_TABLE"],
  process: ["PROCESS_FLOW", "TIMELINE_STEPS", "TEXT_ONLY_EDITORIAL"],
  timeline: ["TIMELINE_STEPS", "PROCESS_FLOW", "COMPARISON_TABLE"],
  metrics: ["METRICS_GRID", "COMPARISON_TABLE", "TITLE_MEDIA_SAFE"],
  comparison: ["COMPARISON_TABLE", "METRICS_GRID", "TEXT_ONLY_EDITORIAL"],
  gallery: ["GALLERY_SINGLE", "TITLE_MEDIA_SAFE", "TWO_COLUMN_MEDIA_TEXT"],
  "text-only": ["TEXT_ONLY_EDITORIAL", "QUOTE_FOCUS", "AGENDA_EDITORIAL"],
  cta: ["CTA_CONTACT", "QUOTE_FOCUS", "TEXT_ONLY_EDITORIAL"],
  topic: ["TITLE_MEDIA_SAFE", "TWO_COLUMN_MEDIA_TEXT", "GALLERY_SINGLE"],
};

const ROLE_TOPIC_PRIORITY: Record<PageRole, AssetTopic[]> = {
  cover: ["photo", "ui", "chart", "diagram", "generic", "people"],
  "section-divider": ["generic", "ui", "photo", "chart", "diagram", "people"],
  agenda: ["generic", "chart", "ui", "diagram", "photo", "people"],
  insight: ["chart", "ui", "diagram", "photo", "generic", "people"],
  solution: ["ui", "diagram", "photo", "chart", "generic", "people"],
  process: ["diagram", "ui", "chart", "photo", "generic", "people"],
  timeline: ["diagram", "chart", "ui", "photo", "generic", "people"],
  metrics: ["chart", "ui", "diagram", "photo", "generic", "people"],
  comparison: ["chart", "diagram", "ui", "photo", "generic", "people"],
  gallery: ["photo", "ui", "chart", "diagram", "generic", "people"],
  "text-only": ["generic", "chart", "ui", "diagram", "photo", "people"],
  cta: ["generic", "chart", "ui", "diagram", "photo", "people"],
  topic: ["ui", "photo", "chart", "diagram", "generic", "people"],
};

const DEFAULT_DOC_TITLE = "Visual_Document";

function normalize(value: string): string {
  return value.toLowerCase().replace(/[\s_.\-()/\\]+/g, "");
}

function createRng(seed: number): () => number {
  let state = (seed >>> 0) || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

function pickOne<T>(list: readonly T[], rng: () => number, offset = 0): T {
  const index = Math.floor(rng() * list.length + offset) % list.length;
  return list[index] as T;
}

function detectTopic(image: ScannedImage): TopicDetection {
  const name = normalize(image.filename);

  const aspect =
    image.widthPx && image.heightPx && image.heightPx > 0
      ? image.widthPx / image.heightPx
      : 1;

  if (TOPIC_KEYWORDS.chart.some((keyword) => name.includes(normalize(keyword)))) {
    return { topic: "chart", isLowSignal: false, isProofAsset: true };
  }
  if (TOPIC_KEYWORDS.ui.some((keyword) => name.includes(normalize(keyword)))) {
    return { topic: "ui", isLowSignal: false, isProofAsset: true };
  }
  if (TOPIC_KEYWORDS.diagram.some((keyword) => name.includes(normalize(keyword)))) {
    return { topic: "diagram", isLowSignal: false, isProofAsset: true };
  }
  if (TOPIC_KEYWORDS.people.some((keyword) => name.includes(normalize(keyword)))) {
    return { topic: "people", isLowSignal: true, isProofAsset: false };
  }
  if (TOPIC_KEYWORDS.photo.some((keyword) => name.includes(normalize(keyword)))) {
    return { topic: "photo", isLowSignal: false, isProofAsset: false };
  }

  if (aspect > 1.45) {
    return { topic: "ui", isLowSignal: false, isProofAsset: true };
  }
  if (aspect < 0.78) {
    return { topic: "photo", isLowSignal: false, isProofAsset: false };
  }

  return { topic: "generic", isLowSignal: false, isProofAsset: false };
}

function buildTopicClusters(images: ScannedImage[]): {
  clusters: TopicCluster[];
  topicByFilename: Map<string, TopicDetection>;
  proofAssetCount: number;
  lowSignalAssetCount: number;
} {
  const topicByFilename = new Map<string, TopicDetection>();
  const grouped = new Map<AssetTopic, ScannedImage[]>();

  let proofAssetCount = 0;
  let lowSignalAssetCount = 0;

  for (const image of images) {
    const topic = detectTopic(image);
    topicByFilename.set(image.filename, topic);

    const bucket = grouped.get(topic.topic) ?? [];
    bucket.push(image);
    grouped.set(topic.topic, bucket);

    if (topic.isProofAsset) {
      proofAssetCount += 1;
    }
    if (topic.isLowSignal) {
      lowSignalAssetCount += 1;
    }
  }

  const clusters: TopicCluster[] = [...grouped.entries()].map(([topic, bucket]) => ({
    topic,
    images: bucket,
    lowSignalCount: bucket.filter((image) => topicByFilename.get(image.filename)?.isLowSignal).length,
  }));

  clusters.sort((a, b) => b.images.length - a.images.length || a.topic.localeCompare(b.topic));

  return {
    clusters,
    topicByFilename,
    proofAssetCount,
    lowSignalAssetCount,
  };
}

function inferDocType(images: ScannedImage[], proofAssetCount: number, topicCount: number): DocType {
  if (images.length <= 1) {
    return "poster";
  }
  if (images.length <= 2) {
    return "one-pager";
  }
  if (proofAssetCount >= Math.ceil(images.length * 0.45)) {
    return "report";
  }
  if (images.length >= 8 || topicCount >= 4) {
    return "multi-card";
  }
  return "proposal";
}

function inferPageSizePreset(params: {
  requested?: PageSizePreset;
  docType: DocType;
  images: ScannedImage[];
  topicByFilename: Map<string, TopicDetection>;
}): PageSizePreset {
  if (params.requested) {
    return params.requested;
  }

  if (params.docType === "poster") {
    const first = params.images[0];
    const ratio =
      first?.widthPx && first?.heightPx && first.heightPx > 0
        ? first.widthPx / first.heightPx
        : 1;
    return ratio > 1.15 ? "A4L" : "A4P";
  }

  const landscapeCount = params.images.filter((image) => {
    if (!image.widthPx || !image.heightPx || image.heightPx <= 0) {
      return false;
    }
    return image.widthPx / image.heightPx >= 1.2;
  }).length;

  const reportLikeCount = params.images.filter((image) => {
    const topic = params.topicByFilename.get(image.filename)?.topic;
    return topic === "ui" || topic === "chart";
  }).length;

  if (params.docType === "report" && reportLikeCount >= Math.ceil(params.images.length * 0.5) && landscapeCount >= Math.ceil(params.images.length * 0.45)) {
    return "LETTERL";
  }

  if (landscapeCount >= Math.ceil(params.images.length * 0.6)) {
    return "A4L";
  }

  return "A4P";
}

function decidePageCount(params: {
  docType: DocType;
  imageCount: number;
  topicCount: number;
  proofAssetCount: number;
  lowSignalAssetCount: number;
}): number {
  if (params.docType === "poster") {
    return 1;
  }
  if (params.docType === "one-pager") {
    return params.imageCount <= 1 ? 1 : 2;
  }

  const lowSignalPenalty = params.lowSignalAssetCount > Math.floor(params.imageCount / 2) ? 1 : 0;

  if (params.docType === "multi-card") {
    return Math.max(4, Math.min(12, 4 + params.topicCount + Math.floor(params.imageCount / 3) - lowSignalPenalty));
  }

  if (params.docType === "report") {
    return Math.max(6, Math.min(14, 6 + params.topicCount + Math.floor(params.proofAssetCount / 2) - lowSignalPenalty));
  }

  return Math.max(4, Math.min(10, 5 + params.topicCount + Math.floor(params.imageCount / 4) - lowSignalPenalty));
}

function titleFromImages(images: ScannedImage[]): string {
  if (images.length === 0) {
    return DEFAULT_DOC_TITLE;
  }

  const stem = path.parse(images[0].filename).name;
  const cleaned = stem
    .replace(/^\s*(?:\(\s*\d+\s*\)|p\s*\d+|\d+)(?:[\s._-]+)?/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    return DEFAULT_DOC_TITLE;
  }

  return cleaned.slice(0, 56).replace(/\s+/g, "_");
}

function buildRoleSequence(docType: DocType, pageCount: number): PageRole[] {
  if (docType === "poster") {
    return ["cover"];
  }

  if (docType === "one-pager") {
    return pageCount === 1 ? ["cover"] : ["cover", "text-only"];
  }

  const base: PageRole[] =
    docType === "report"
      ? ["cover", "agenda", "metrics", "comparison", "process", "text-only", "cta"]
      : docType === "multi-card"
        ? ["cover", "topic", "topic", "gallery", "metrics", "text-only", "cta"]
        : ["cover", "agenda", "insight", "solution", "process", "text-only", "cta"];

  if (pageCount <= base.length) {
    return base.slice(0, pageCount);
  }

  const extrasNeeded = pageCount - base.length;
  const extraPool: PageRole[] =
    docType === "report"
      ? ["metrics", "comparison", "timeline", "insight", "section-divider"]
      : docType === "multi-card"
        ? ["topic", "gallery", "comparison", "process", "section-divider"]
        : ["insight", "solution", "metrics", "timeline", "section-divider"];

  const next = [...base];
  for (let index = 0; index < extrasNeeded; index += 1) {
    const role = extraPool[index % extraPool.length] as PageRole;
    next.splice(next.length - 1, 0, role);
  }

  return next.slice(0, pageCount);
}

function successCriteria(role: PageRole): string {
  if (role === "cover") return "5초 내 문서 목적이 이해된다.";
  if (role === "section-divider") return "섹션 전환 의도가 짧고 명확하다.";
  if (role === "agenda") return "전체 흐름과 읽는 순서가 분명하다.";
  if (role === "insight") return "핵심 인사이트와 근거가 연결된다.";
  if (role === "solution") return "실행안과 운영 책임이 구분된다.";
  if (role === "process") return "단계별 산출물이 끊김 없이 이어진다.";
  if (role === "timeline") return "일정/마일스톤이 한 페이지에서 확인된다.";
  if (role === "metrics") return "정량 지표 최소 3개가 읽힌다.";
  if (role === "comparison") return "선택지 차이가 명확하다.";
  if (role === "gallery") return "대표 이미지가 메시지 중심으로 배치된다.";
  if (role === "text-only") return "이미지 없이도 메시지가 완결된다.";
  if (role === "cta") return "다음 액션이 바로 결정 가능하다.";
  return "주제별 핵심 포인트가 간결하게 전달된다.";
}

function templateForRole(params: {
  role: PageRole;
  hasAsset: boolean;
  rng: () => number;
  excludeTemplateId?: TemplateId;
  preferNonFullBleed?: boolean;
}): TemplateId {
  const pool = ROLE_TEMPLATE_POOL[params.role] ?? ROLE_TEMPLATE_POOL.topic;
  const candidates = pool.filter((templateId) => {
    if (params.excludeTemplateId && templateId === params.excludeTemplateId) {
      return false;
    }
    if (!templateSupportsImage(templateId, params.hasAsset)) {
      return false;
    }
    if (params.preferNonFullBleed && isFullBleedTemplate(templateId)) {
      return false;
    }
    return true;
  });

  if (candidates.length > 0) {
    return pickOne(candidates, params.rng);
  }

  const fallback = pool.find((templateId) => templateSupportsImage(templateId, params.hasAsset));
  if (fallback) {
    return fallback;
  }

  return "TEXT_ONLY_EDITORIAL";
}

function requiresAsset(role: PageRole): boolean {
  return role === "cover" || role === "gallery";
}

function optionalAsset(role: PageRole): boolean {
  return role === "insight" || role === "solution" || role === "metrics" || role === "topic";
}

function takeAsset(params: {
  pools: Map<AssetTopic, ScannedImage[]>;
  topicByFilename: Map<string, TopicDetection>;
  preferredTopics: AssetTopic[];
  required: boolean;
}): ScannedImage | null {
  const tryTake = (topics: AssetTopic[], includeLowSignal: boolean): ScannedImage | null => {
    for (const topic of topics) {
      const bucket = params.pools.get(topic) ?? [];
      const index = bucket.findIndex((image) => {
        const isLowSignal = params.topicByFilename.get(image.filename)?.isLowSignal ?? false;
        return includeLowSignal || !isLowSignal;
      });

      if (index >= 0) {
        const [picked] = bucket.splice(index, 1);
        params.pools.set(topic, bucket);
        return picked ?? null;
      }
    }
    return null;
  };

  const preferred = tryTake(params.preferredTopics, false);
  if (preferred) {
    return preferred;
  }

  const allTopics: AssetTopic[] = ["ui", "photo", "chart", "diagram", "generic", "people"];
  const fallback = tryTake(allTopics, false);
  if (fallback) {
    return fallback;
  }

  if (!params.required) {
    return null;
  }

  return tryTake(allTopics, true);
}

function ensureDiversity(storyboard: StoryboardItem[], rng: () => number): StoryboardItem[] {
  const next = [...storyboard];

  for (let index = 2; index < next.length; index += 1) {
    const a = next[index - 2];
    const b = next[index - 1];
    const c = next[index];
    if (!a || !b || !c) {
      continue;
    }
    if (a.templateId === b.templateId && b.templateId === c.templateId) {
      const replacement = templateForRole({
        role: c.role,
        hasAsset: c.primaryAssetFilename !== null,
        excludeTemplateId: c.templateId,
        rng,
      });
      const spec = getTemplateSpec(replacement);
      next[index] = {
        ...c,
        templateId: replacement,
        copyBudget: spec.maxTextBudget,
        isTextOnly: spec.imagePolicy === "none" || c.primaryAssetFilename === null,
        isFullBleed: spec.isFullBleed,
      };
    }
  }

  const fullBleedLimit = Math.max(1, Math.floor(next.length * 0.4));
  let fullBleedCount = next.filter((item) => item.isFullBleed).length;
  if (fullBleedCount > fullBleedLimit) {
    for (let index = 0; index < next.length && fullBleedCount > fullBleedLimit; index += 1) {
      const item = next[index];
      if (!item || !item.isFullBleed) {
        continue;
      }
      const replacement = templateForRole({
        role: item.role,
        hasAsset: item.primaryAssetFilename !== null,
        excludeTemplateId: item.templateId,
        preferNonFullBleed: true,
        rng,
      });
      const spec = getTemplateSpec(replacement);
      next[index] = {
        ...item,
        templateId: replacement,
        copyBudget: spec.maxTextBudget,
        isTextOnly: spec.imagePolicy === "none" || item.primaryAssetFilename === null,
        isFullBleed: spec.isFullBleed,
      };
      fullBleedCount = next.filter((entry) => entry.isFullBleed).length;
    }
  }

  if (next.length > 1 && !next.some((item) => item.isTextOnly)) {
    const targetIndex = next.findIndex((item) => item.role !== "cover");
    if (targetIndex >= 0) {
      const spec = getTemplateSpec("TEXT_ONLY_EDITORIAL");
      next[targetIndex] = {
        ...next[targetIndex],
        role: "text-only",
        primaryAssetFilename: null,
        topicLabel: "text",
        templateId: "TEXT_ONLY_EDITORIAL",
        copyBudget: spec.maxTextBudget,
        isTextOnly: true,
        isFullBleed: false,
      };
    }
  }

  return next;
}

export async function planDocument(images: ScannedImage[], options: PlanOptions): Promise<PlannerResult> {
  const logs: string[] = [];
  const variantIndex = Math.max(1, options.variantIndex || 1);
  const seed = options.seed;
  const rng = createRng(seed + variantIndex * 17);

  const { clusters, topicByFilename, proofAssetCount, lowSignalAssetCount } = buildTopicClusters(images);
  logs.push(
    `[planner] clusters=${clusters.length} proofAssets=${proofAssetCount} lowSignal=${lowSignalAssetCount}`,
  );

  const inferredDocType = inferDocType(images, proofAssetCount, clusters.length);
  const docType = options.requestedDocType ?? inferredDocType;

  const pageSizePreset = inferPageSizePreset({
    requested: options.requestedPageSizePreset,
    docType,
    images,
    topicByFilename,
  });

  const pageSize = resolvePageSize({
    preset: pageSizePreset,
    widthMm: options.customPageSizeMm?.widthMm,
    heightMm: options.customPageSizeMm?.heightMm,
  });

  const pageCount = decidePageCount({
    docType,
    imageCount: images.length,
    topicCount: Math.max(clusters.length, 1),
    proofAssetCount,
    lowSignalAssetCount,
  });

  const roleSequence = buildRoleSequence(docType, pageCount);

  logs.push(`[planner] docType=${docType} pageSize=${pageSize.preset}(${pageSize.widthMm}x${pageSize.heightMm}mm) pageCount=${pageCount}`);
  logs.push(`[planner] role sequence: ${roleSequence.join(" -> ")}`);

  const references = await scanReferences(options.rootDir ?? process.cwd(), seed + variantIndex);
  const styleSelection = selectStylePreset({
    seed,
    variantIndex,
    requestedPresetId: options.requestedStylePresetId,
    referenceFilenames: references.sampled.map((item) => item.relPath),
  });

  const selectedPreset = getStylePresetById(styleSelection.selectedPresetId);
  logs.push(
    `[planner] style candidates=${styleSelection.candidatePresetIds.join(", ")} selected=${selectedPreset.id} reason=${styleSelection.reason}`,
  );
  logs.push(
    `[planner] reference sampling=${references.sampled.length}/${references.all.length} (style token selection only; no composition copy)`,
  );

  const pools = new Map<AssetTopic, ScannedImage[]>();
  for (const topic of ["ui", "photo", "chart", "diagram", "people", "generic"] as const) {
    const topicImages = images.filter((image) => (topicByFilename.get(image.filename)?.topic ?? "generic") === topic);
    pools.set(topic, [...topicImages]);
  }

  const storyboardDraft: StoryboardItem[] = roleSequence.map((role, index) => {
    const required = requiresAsset(role);
    const canHaveAsset = optionalAsset(role) || required;
    const asset = canHaveAsset
      ? takeAsset({
          pools,
          topicByFilename,
          preferredTopics: ROLE_TOPIC_PRIORITY[role],
          required,
        })
      : null;

    const hasAsset = asset !== null;
    const templateId = templateForRole({
      role,
      hasAsset,
      rng,
    });

    const spec = getTemplateSpec(templateId);
    const topic = asset ? topicByFilename.get(asset.filename)?.topic ?? "generic" : "generic";

    return {
      pageNumber: index + 1,
      role,
      templateId,
      primaryAssetFilename: asset?.filename ?? null,
      topicLabel: topic,
      copyBudget: spec.maxTextBudget,
      successCriteria: successCriteria(role),
      isTextOnly: spec.imagePolicy === "none" || !hasAsset,
      isFullBleed: spec.isFullBleed,
    };
  });

  const storyboard = ensureDiversity(storyboardDraft, rng);

  const plan: DocumentPlan = {
    docTitle: options.docTitle?.trim() || titleFromImages(images),
    docType,
    pageSizePreset: pageSize.preset,
    pageSize,
    pageCount,
    variantIndex,
    seed,
    stylePresetId: selectedPreset.id,
    styleCandidateIds: styleSelection.candidatePresetIds,
    referenceSample: references.sampled,
    topicClusters: clusters,
    proofAssetCount,
    lowSignalAssetCount,
  };

  const templateRuns: string[] = [];
  let runCount = 1;
  for (let index = 1; index < storyboard.length; index += 1) {
    if (storyboard[index].templateId === storyboard[index - 1].templateId) {
      runCount += 1;
      continue;
    }
    templateRuns.push(`${storyboard[index - 1].templateId}x${runCount}`);
    runCount = 1;
  }
  if (storyboard.length > 0) {
    templateRuns.push(`${storyboard[storyboard.length - 1].templateId}x${runCount}`);
  }

  logs.push(
    `[planner] storyboard pages=${storyboard.length}, textOnly=${storyboard.filter((item) => item.isTextOnly).length}, fullBleed=${storyboard.filter((item) => item.isFullBleed).length}`,
  );
  logs.push(`[planner] template runs: ${templateRuns.join(", ")}`);

  return {
    plan,
    storyboard,
    logs,
  };
}

