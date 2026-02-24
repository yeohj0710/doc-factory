import type { ScannedImage } from "@/src/io/scanImages";
import {
  getFallbackTemplate,
  getTemplateSpec,
  type TemplateId,
} from "@/src/layout/templateCatalog";
import { clamp } from "@/src/layout/units";
import type {
  DocumentGoal,
  DocumentPlan,
  PageRole,
  PlannerResult,
  StoryboardItem,
  TopicCluster,
} from "@/src/planner/types";

type PlanOptions = {
  docTitle?: string;
  documentGoal?: DocumentGoal;
};

type TopicInfo = {
  key: string;
  label: string;
  isProofAsset: boolean;
  isLowSignal: boolean;
};

type TopicRule = {
  key: string;
  label: string;
  keywords: readonly string[];
  isProofAsset: boolean;
};

const DEFAULT_DOC_TITLE = "맞춤_건기식_B2B_소개서";

const TOPIC_RULES: readonly TopicRule[] = [
  {
    key: "package",
    label: "패키지/상품구성",
    keywords: ["패키지", "package", "bundle", "plan", "요금", "상품"],
    isProofAsset: false,
  },
  {
    key: "consult",
    label: "상담/전문가",
    keywords: ["약사", "상담", "consult", "advisor", "pharmacist", "clinic"],
    isProofAsset: false,
  },
  {
    key: "proof",
    label: "리포트/지표",
    keywords: ["리포트", "report", "kpi", "metrics", "dashboard", "지표", "증빙"],
    isProofAsset: true,
  },
  {
    key: "ui",
    label: "앱/웹화면",
    keywords: ["앱", "web", "화면", "ui", "screen", "app", "모바일", "서비스"],
    isProofAsset: true,
  },
  {
    key: "process",
    label: "프로세스/운영",
    keywords: ["process", "flow", "프로세스", "운영", "단계", "pipeline"],
    isProofAsset: true,
  },
  {
    key: "product",
    label: "소분/건기식",
    keywords: ["소분", "건기식", "영양", "dose", "pill", "capsule", "제품"],
    isProofAsset: false,
  },
];

const LOW_SIGNAL_KEYWORDS = [
  "stock",
  "generic",
  "people",
  "person",
  "meeting",
  "office",
  "사람",
  "모델",
] as const;

function normalizeForMatch(value: string): string {
  return value.toLowerCase().replace(/[\s_.\-()/\\]+/g, "");
}

function hasAnyKeyword(normalized: string, keywords: readonly string[]): boolean {
  return keywords.some((keyword) => normalized.includes(normalizeForMatch(keyword)));
}

function detectTopic(filename: string): TopicInfo {
  const normalized = normalizeForMatch(filename);
  const matchedRule = TOPIC_RULES.find((rule) => hasAnyKeyword(normalized, rule.keywords));

  if (matchedRule) {
    return {
      key: matchedRule.key,
      label: matchedRule.label,
      isProofAsset: matchedRule.isProofAsset,
      isLowSignal: hasAnyKeyword(normalized, LOW_SIGNAL_KEYWORDS),
    };
  }

  return {
    key: "generic",
    label: "일반",
    isProofAsset: false,
    isLowSignal: hasAnyKeyword(normalized, LOW_SIGNAL_KEYWORDS),
  };
}

function buildTopicClusters(images: ScannedImage[]): {
  clusters: TopicCluster[];
  topicByFilename: Map<string, TopicInfo>;
  lowSignalCount: number;
  proofAssetCount: number;
} {
  const topicByFilename = new Map<string, TopicInfo>();
  const orderedTopicKeys: string[] = [];
  const clusters = new Map<string, TopicCluster>();

  let lowSignalCount = 0;
  let proofAssetCount = 0;

  for (const image of images) {
    const topic = detectTopic(image.filename);
    topicByFilename.set(image.filename, topic);

    if (!clusters.has(topic.key)) {
      orderedTopicKeys.push(topic.key);
      clusters.set(topic.key, {
        key: topic.key,
        label: topic.label,
        images: [],
        proofAssetCount: 0,
        lowSignalCount: 0,
      });
    }

    const cluster = clusters.get(topic.key);
    if (!cluster) {
      continue;
    }

    cluster.images.push(image);

    if (topic.isProofAsset) {
      cluster.proofAssetCount += 1;
      proofAssetCount += 1;
    }
    if (topic.isLowSignal) {
      cluster.lowSignalCount += 1;
      lowSignalCount += 1;
    }
  }

  return {
    clusters: orderedTopicKeys
      .map((key) => clusters.get(key))
      .filter((cluster): cluster is TopicCluster => Boolean(cluster)),
    topicByFilename,
    lowSignalCount,
    proofAssetCount,
  };
}

function decidePageCount(params: {
  topicCount: number;
  proofAssetCount: number;
  imageCount: number;
  lowSignalCount: number;
}): number {
  const topicBoost = Math.min(3, Math.max(0, params.topicCount - 1));
  const proofBoost = Math.min(2, Math.floor((params.proofAssetCount + 1) / 2));
  const copyBudgetBoost = params.imageCount >= 10 ? 2 : params.imageCount >= 6 ? 1 : 0;
  const lowSignalPenalty =
    params.imageCount > 0 && params.lowSignalCount > Math.floor(params.imageCount / 2) ? 1 : 0;

  const estimatedPageCount = 6 + topicBoost + proofBoost + copyBudgetBoost - lowSignalPenalty;
  return Math.round(clamp(estimatedPageCount, 6, 12));
}

function buildNarrativeSections(pageCount: number): PageRole[] {
  const baseSections: PageRole[] = [
    "cover",
    "agenda",
    "problem",
    "solution",
    "process",
    "proof",
    "package",
    "cta",
  ];

  const extras = Math.max(0, pageCount - baseSections.length);
  const extraPool: readonly PageRole[] = ["solution", "proof", "process", "topic"];

  for (let index = 0; index < extras; index += 1) {
    const role = extraPool[index % extraPool.length];
    baseSections.splice(baseSections.length - 1, 0, role);
  }

  return baseSections;
}

function templateForRole(role: PageRole, hasAsset: boolean): TemplateId {
  if (role === "cover") {
    return hasAsset ? "COVER_HERO" : "TEXT_ONLY_EDITORIAL";
  }
  if (role === "agenda") {
    return "AGENDA_EDITORIAL";
  }
  if (role === "problem") {
    return hasAsset ? "TITLE_MEDIA_SAFE" : "TEXT_ONLY_EDITORIAL";
  }
  if (role === "solution") {
    return hasAsset ? "TWO_COLUMN_MEDIA_TEXT" : "TEXT_ONLY_EDITORIAL";
  }
  if (role === "process") {
    return "PROCESS_FLOW";
  }
  if (role === "proof") {
    return "METRICS_PROOF";
  }
  if (role === "package") {
    return hasAsset ? "TITLE_MEDIA_SAFE" : "TEXT_ONLY_EDITORIAL";
  }
  if (role === "topic") {
    return hasAsset ? "TWO_COLUMN_MEDIA_TEXT" : "TEXT_ONLY_EDITORIAL";
  }
  return "TEXT_ONLY_EDITORIAL";
}

function preferredTopicKeysByRole(role: PageRole): readonly string[] {
  if (role === "cover") {
    return ["package", "product", "ui", "consult", "proof", "process", "generic"];
  }
  if (role === "problem") {
    return ["proof", "consult", "generic", "product", "ui"];
  }
  if (role === "solution") {
    return ["ui", "product", "process", "package", "consult"];
  }
  if (role === "process") {
    return ["process", "consult", "ui", "product", "generic"];
  }
  if (role === "proof") {
    return ["proof", "ui", "process", "consult", "generic"];
  }
  if (role === "package") {
    return ["package", "product", "consult", "generic"];
  }
  if (role === "topic") {
    return ["ui", "proof", "process", "product", "consult", "package", "generic"];
  }
  return [];
}

function successCriteriaByRole(role: PageRole): string {
  if (role === "cover") {
    return "문서 목적과 대상이 5초 내에 전달된다.";
  }
  if (role === "agenda") {
    return "전체 구성과 읽는 순서가 명확하다.";
  }
  if (role === "problem") {
    return "현재 문제와 개선 필요성이 구체적으로 드러난다.";
  }
  if (role === "solution") {
    return "해결 방법의 구조와 실행 흐름이 이해된다.";
  }
  if (role === "process") {
    return "3~5단계 운영 흐름이 한눈에 보인다.";
  }
  if (role === "proof") {
    return "정량/정성 근거가 최소 3개 제시된다.";
  }
  if (role === "package") {
    return "제공 범위와 운영 패키지가 명확히 구분된다.";
  }
  if (role === "cta") {
    return "다음 액션이 즉시 결정 가능하다.";
  }
  return "핵심 메시지와 근거가 함께 전달된다.";
}

function takeAsset(
  pool: ScannedImage[],
  topicByFilename: Map<string, TopicInfo>,
  preferredTopics: readonly string[],
  optional: boolean,
): ScannedImage | null {
  const preferredIndex = pool.findIndex((image) => {
    const topic = topicByFilename.get(image.filename);
    return topic ? preferredTopics.includes(topic.key) && !topic.isLowSignal : false;
  });

  if (preferredIndex >= 0) {
    return pool.splice(preferredIndex, 1)[0] ?? null;
  }

  const fallbackIndex = pool.findIndex((image) => {
    const topic = topicByFilename.get(image.filename);
    return topic ? preferredTopics.includes(topic.key) : false;
  });

  if (fallbackIndex >= 0) {
    return pool.splice(fallbackIndex, 1)[0] ?? null;
  }

  if (optional) {
    return null;
  }

  return pool.shift() ?? null;
}

function applyTemplate(
  item: StoryboardItem,
  templateId: TemplateId,
): StoryboardItem {
  const templateSpec = getTemplateSpec(templateId);
  return {
    ...item,
    templateId,
    copyBudget: templateSpec.maxTextBudget,
    fullBleed: templateSpec.isFullBleed,
    isTextOnly: templateSpec.imagePolicy === "none" || item.primaryAssetFilename === null,
  };
}

function normalizeTemplateForAsset(item: StoryboardItem): StoryboardItem {
  let current = item;

  for (let attempts = 0; attempts < 5; attempts += 1) {
    const spec = getTemplateSpec(current.templateId);
    if (spec.imagePolicy !== "required" || current.primaryAssetFilename !== null) {
      return applyTemplate(current, current.templateId);
    }

    const fallback = getFallbackTemplate(current.templateId);
    if (fallback === current.templateId) {
      return applyTemplate(current, current.templateId);
    }

    current = applyTemplate(current, fallback);
  }

  return applyTemplate(current, "TEXT_ONLY_EDITORIAL");
}

function candidateTemplates(item: StoryboardItem): TemplateId[] {
  return [
    getFallbackTemplate(item.templateId),
    "TITLE_MEDIA_SAFE",
    "TWO_COLUMN_MEDIA_TEXT",
    "PROCESS_FLOW",
    "METRICS_PROOF",
    "TEXT_ONLY_EDITORIAL",
    "AGENDA_EDITORIAL",
  ];
}

function canUseTemplate(templateId: TemplateId, hasAsset: boolean): boolean {
  const spec = getTemplateSpec(templateId);
  if (spec.imagePolicy === "required" && !hasAsset) {
    return false;
  }
  return true;
}

function enforceStoryboardDiversity(storyboard: StoryboardItem[], logs: string[]): StoryboardItem[] {
  if (storyboard.length === 0) {
    return storyboard;
  }

  const next = storyboard.map((item) => normalizeTemplateForAsset(item));

  const fullBleedLimit = Math.max(1, Math.floor(next.length * 0.4));
  let fullBleedCount = next.filter((item) => item.fullBleed).length;

  if (fullBleedCount > fullBleedLimit) {
    for (let index = 1; index < next.length && fullBleedCount > fullBleedLimit; index += 1) {
      if (!next[index]?.fullBleed) {
        continue;
      }

      const fallbackId = getFallbackTemplate(next[index].templateId);
      next[index] = normalizeTemplateForAsset(applyTemplate(next[index], fallbackId));
      fullBleedCount = next.filter((item) => item.fullBleed).length;
    }
  }

  for (let index = 2; index < next.length; index += 1) {
    const current = next[index];
    const prev = next[index - 1];
    const prevPrev = next[index - 2];

    if (!current || !prev || !prevPrev) {
      continue;
    }

    if (current.templateId !== prev.templateId || current.templateId !== prevPrev.templateId) {
      continue;
    }

    const forbidden = new Set<TemplateId>([prev.templateId]);
    const hasAsset = current.primaryAssetFilename !== null;

    const replacement = candidateTemplates(current).find(
      (candidate) => !forbidden.has(candidate) && canUseTemplate(candidate, hasAsset),
    );

    if (replacement) {
      next[index] = normalizeTemplateForAsset(applyTemplate(current, replacement));
    }
  }

  const firstFour = next.slice(0, 4);
  const firstFourTemplateCount = new Set(firstFour.map((item) => item.templateId)).size;
  if (firstFour.length >= 2 && firstFourTemplateCount < 2) {
    const page2 = next[1];
    if (page2) {
      const hasAsset = page2.primaryAssetFilename !== null;
      const replacement = candidateTemplates(page2).find((candidate) => canUseTemplate(candidate, hasAsset));
      if (replacement) {
        next[1] = normalizeTemplateForAsset(applyTemplate(page2, replacement));
      }
    }
  }

  if (!next.some((item) => item.isTextOnly)) {
    const targetIndex = next.findIndex((item) => item.role !== "cover");
    if (targetIndex >= 0) {
      next[targetIndex] = normalizeTemplateForAsset(
        applyTemplate({ ...next[targetIndex], primaryAssetFilename: null }, "TEXT_ONLY_EDITORIAL"),
      );
    }
  }

  const runLengths: string[] = [];
  let runCount = 1;
  for (let index = 1; index < next.length; index += 1) {
    if (next[index].templateId === next[index - 1].templateId) {
      runCount += 1;
    } else {
      runLengths.push(`${next[index - 1].templateId}x${runCount}`);
      runCount = 1;
    }
  }
  runLengths.push(`${next[next.length - 1].templateId}x${runCount}`);

  logs.push(
    `[3.2] Diversity rules enforced: max-run=${Math.max(...runLengths.map((part) => Number(part.split("x")[1])))} ` +
      `full-bleed=${next.filter((item) => item.fullBleed).length}/${next.length}`,
  );

  return next;
}

function buildStoryboard(params: {
  sections: PageRole[];
  plan: DocumentPlan;
  images: ScannedImage[];
  topicByFilename: Map<string, TopicInfo>;
  logs: string[];
}): StoryboardItem[] {
  const unusedImages = [...params.images];

  const storyboard = params.sections.map((role, index) => {
    const optionalAsset = role === "agenda" || role === "cta";
    const asset = optionalAsset
      ? null
      : takeAsset(
          unusedImages,
          params.topicByFilename,
          preferredTopicKeysByRole(role),
          role === "process" || role === "proof" || role === "topic",
        );

    const topicLabel = asset ? params.topicByFilename.get(asset.filename)?.label ?? "일반" : "텍스트 중심";
    const templateId = templateForRole(role, asset !== null);
    const spec = getTemplateSpec(templateId);

    return {
      pageNumber: index + 1,
      role,
      templateId,
      primaryAssetFilename: asset?.filename ?? null,
      topicLabel,
      copyBudget: spec.maxTextBudget,
      successCriteria: successCriteriaByRole(role),
      isTextOnly: spec.imagePolicy === "none" || asset === null,
      fullBleed: spec.isFullBleed,
    };
  });

  params.logs.push(
    `[3.1] Storyboard drafted: pages=${storyboard.length}, image-pages=${storyboard.filter((item) => item.primaryAssetFilename).length}, text-only=${storyboard.filter((item) => item.isTextOnly).length}`,
  );

  return enforceStoryboardDiversity(storyboard, params.logs);
}

export function planDocument(images: ScannedImage[], options: PlanOptions = {}): PlannerResult {
  const logs: string[] = [];

  const { clusters, topicByFilename, lowSignalCount, proofAssetCount } = buildTopicClusters(images);

  const pageCount = decidePageCount({
    topicCount: Math.max(clusters.length, 1),
    proofAssetCount,
    imageCount: images.length,
    lowSignalCount,
  });

  logs.push(
    `[2.1] Topic clustering complete: topics=${Math.max(clusters.length, 1)} proof-assets=${proofAssetCount} low-signal=${lowSignalCount}`,
  );
  logs.push(`[2.2] Variable page count decided: ${pageCount} (range 6~12)`);

  const narrativeSections = buildNarrativeSections(pageCount);
  const plan: DocumentPlan = {
    docTitle: options.docTitle?.trim() || DEFAULT_DOC_TITLE,
    targetAudience: "B2B 담당자/임직원",
    documentGoal: options.documentGoal ?? "소개서",
    narrativeSections,
    pageCount,
    topicClusters: clusters,
    proofAssetCount,
  };

  logs.push(`[2.3] Section sequence: ${narrativeSections.join(" -> ")}`);

  const storyboard = buildStoryboard({
    sections: narrativeSections,
    plan,
    images,
    topicByFilename,
    logs,
  });

  const firstFourTemplateCount = new Set(storyboard.slice(0, 4).map((item) => item.templateId)).size;
  logs.push(
    `[3.3] Storyboard finalized: first4-template-variety=${firstFourTemplateCount} text-only-pages=${storyboard.filter((item) => item.isTextOnly).length}`,
  );

  return {
    plan,
    storyboard,
    logs,
  };
}
