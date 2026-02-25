import { stableHashFromParts } from "@/src/io/hash";
import type { CopyDeck, CopyFacts, CopyFactsPage, CopySlot } from "@/src/copywriter/types";

type SeedContext = {
  sharedHints: string[];
  title: string;
  contentBrief: string;
  prompt: string;
};

function sanitizeLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function sentencePool(context: SeedContext): string[] {
  const lines = [
    ...context.sharedHints,
    context.contentBrief,
    context.prompt,
    context.title,
  ]
    .map((line) => sanitizeLine(line))
    .filter(Boolean);

  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    const key = line.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(line);
  }

  return deduped;
}

function pickFromPool(pool: string[], seed: string, fallback: string): string {
  if (pool.length === 0) {
    return fallback;
  }
  const hash = stableHashFromParts([seed], 8);
  const index = Number.parseInt(hash, 16) % pool.length;
  return pool[index] || fallback;
}

function shortText(value: string, maxChars: number): string {
  if (maxChars <= 0) {
    return "";
  }
  const normalized = sanitizeLine(value);
  if (normalized.length <= maxChars) {
    return normalized;
  }

  const sliced = normalized.slice(0, maxChars).trimEnd();
  const byWord = sliced.replace(/\s+\S*$/u, "").trim();
  if (byWord.length >= Math.floor(maxChars * 0.6)) {
    return byWord;
  }
  return sliced;
}

function roleLabel(role: CopyFactsPage["role"]): string {
  const labels: Record<CopyFactsPage["role"], string> = {
    cover: "커버",
    "section-divider": "섹션 전환",
    agenda: "아젠다",
    insight: "인사이트",
    solution: "솔루션",
    process: "프로세스",
    timeline: "타임라인",
    metrics: "지표",
    comparison: "비교",
    gallery: "갤러리",
    "text-only": "텍스트",
    cta: "다음 단계",
    topic: "주제",
  };
  return labels[role] ?? "페이지";
}

function buildBullets(page: CopyFactsPage, pool: string[]): string[] {
  const first = pickFromPool(pool, `bullet-first-${page.pageIndex}`, "핵심 포인트 (추후 기입)");
  const second = pickFromPool(pool, `bullet-second-${page.pageIndex}`, `${page.imageHint} 기준 정리`);
  const third = `${roleLabel(page.role)} 실행 항목: (추후 기입)`;
  const fourth = `연락/링크/수치 등 미확정 정보는 (추후 기입)`;

  return [
    shortText(first, 48),
    shortText(second, 48),
    shortText(third, 48),
    shortText(fourth, 48),
  ];
}

function buildParagraph(page: CopyFactsPage, pool: string[]): string {
  const first = pickFromPool(pool, `paragraph-core-${page.pageIndex}`, `${page.imageHint}를 중심으로 내용을 구성합니다.`);
  const second = pickFromPool(pool, `paragraph-context-${page.pageIndex}`, page.successCriteria);

  return shortText(
    `${first}. ${second}. 확정되지 않은 수치/성과/연락처는 (추후 기입)으로 남기고, 사실 기반 문구만 유지합니다.`,
    240,
  );
}

function buildHeadline(page: CopyFactsPage, context: SeedContext): string {
  return shortText(`${context.title} - ${roleLabel(page.role)} ${page.pageIndex}p`, 44);
}

function buildSubhead(page: CopyFactsPage): string {
  return shortText(`${page.imageHint} / ${page.successCriteria}`, 80);
}

function buildCallout(page: CopyFactsPage): string {
  if (page.role === "cta") {
    return "지금 필요한 결정: 담당/기한/연락처 (추후 기입)";
  }
  return shortText(`다음 검토 항목: ${page.topicLabel} 관련 확인 사항 (추후 기입)`, 88);
}

export function buildLocalCopyDeck(params: {
  facts: CopyFacts;
  slots: CopySlot[];
}): CopyDeck {
  const pool = sentencePool({
    sharedHints: params.facts.sharedHints,
    title: params.facts.title,
    contentBrief: params.facts.contentBrief,
    prompt: params.facts.prompt,
  });

  const pages = params.facts.pages.map((page) => {
    const slot = params.slots.find((item) => item.pageIndex === page.pageIndex);
    const minBlocks = slot?.minBlocks ?? 4;

    const blocks = [
      {
        kind: "headline" as const,
        text: buildHeadline(page, {
          sharedHints: params.facts.sharedHints,
          title: params.facts.title,
          contentBrief: params.facts.contentBrief,
          prompt: params.facts.prompt,
        }),
        constraints: {
          targetChars: 32,
          intent: "informative" as const,
        },
      },
      {
        kind: "subhead" as const,
        text: buildSubhead(page),
        constraints: {
          targetChars: 68,
          intent: "informative" as const,
        },
      },
      {
        kind: "paragraph" as const,
        text: buildParagraph(page, pool),
        constraints: {
          targetChars: 180,
          intent: "informative" as const,
        },
      },
      {
        kind: "bullets" as const,
        items: buildBullets(page, pool),
        constraints: {
          targetChars: 120,
          intent: "informative" as const,
        },
      },
      {
        kind: "callout" as const,
        text: buildCallout(page),
        constraints: {
          targetChars: 60,
          intent: page.role === "cta" ? ("cta" as const) : ("informative" as const),
        },
      },
      {
        kind: "footer" as const,
        text: shortText(`${params.facts.title} / ${page.pageIndex}p / 문의: (추후 기입)`, 96),
        constraints: {
          targetChars: 48,
          intent: "cta" as const,
        },
      },
    ];

    if (minBlocks >= 5) {
      blocks.push({
        kind: "paragraph",
        text: shortText(
          `${page.successCriteria}. 실행 전 확인 질문 3가지를 명시하고, 답이 없으면 (추후 기입)으로 표시합니다.`,
          200,
        ),
        constraints: {
          targetChars: 120,
          intent: "informative",
        },
      });
    }

    return {
      pageIndex: page.pageIndex,
      role: page.role,
      blocks,
    };
  });

  return {
    docKind: params.facts.docKind,
    language: params.facts.language,
    tone: params.facts.tone,
    pages,
  };
}
