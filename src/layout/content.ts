import path from "node:path";
import type { ScannedImage } from "@/src/io/scanImages";

export type PageTemplate =
  | "cinematic-hero"
  | "editorial-spread"
  | "mosaic-notes"
  | "focus-rail"
  | "contrast-poster";

export type PageCategory =
  | "dispense"
  | "app"
  | "consult"
  | "report"
  | "package"
  | "generic";

export type NarrativeMetric = {
  label: string;
  value: string;
};

export type Narrative = {
  category: PageCategory;
  kicker: string;
  title: string;
  subtitle: string;
  summary: string;
  bullets: [string, string, string, string];
  chips: [string, string, string];
  callout: string;
  footer: string;
  metrics: [NarrativeMetric, NarrativeMetric, NarrativeMetric];
  panelLabels: [string, string];
};

type CategoryLibrary = {
  kickers: readonly string[];
  subtitles: readonly string[];
  intros: readonly string[];
  bullets: readonly string[];
  chips: readonly string[];
  callouts: readonly string[];
};

const TEMPLATE_LABELS: Record<PageTemplate, string> = {
  "cinematic-hero": "Cinematic Hero",
  "editorial-spread": "Editorial Spread",
  "mosaic-notes": "Mosaic Notes",
  "focus-rail": "Focus Rail",
  "contrast-poster": "Contrast Poster",
};

const LANDSCAPE_CYCLE: PageTemplate[] = [
  "cinematic-hero",
  "contrast-poster",
  "editorial-spread",
  "mosaic-notes",
  "focus-rail",
];

const PORTRAIT_CYCLE: PageTemplate[] = [
  "focus-rail",
  "editorial-spread",
  "cinematic-hero",
  "mosaic-notes",
  "contrast-poster",
];

const DEFAULT_CYCLE: PageTemplate[] = [
  "mosaic-notes",
  "cinematic-hero",
  "editorial-spread",
  "contrast-poster",
  "focus-rail",
];

const CATEGORY_LIBRARY: Record<PageCategory, CategoryLibrary> = {
  dispense: {
    kickers: ["PRECISION DISPENSE", "PERSONAL FORMULA", "MICRO DOSING LOOP"],
    subtitles: [
      "Adaptive composition tuned to the individual rhythm",
      "Dose blocks mapped to daily routines and constraints",
      "Evidence-led updates with repeatable weekly cadence",
    ],
    intros: [
      "This page visualizes a high-control dispensing scenario.",
      "Composition decisions are grouped by outcome and timing.",
      "The layout emphasizes practical execution over generic messaging.",
    ],
    bullets: [
      "Weekly adjustments are tracked as named versions",
      "Each blend maps to one explicit behavioral objective",
      "Risk components are isolated before any scale-up",
      "Operational handoff is documented with ready-to-run checklists",
      "Feedback windows are short to reduce response latency",
      "Dose clarity is prioritized over decorative complexity",
    ],
    chips: ["Dose Logic", "Weekly Refresh", "Safety First", "Actionable"],
    callouts: [
      "Design intent: precise control with clear next actions.",
      "This composition balances speed, stability, and explainability.",
      "Every visible block is editable for downstream tailoring.",
    ],
  },
  app: {
    kickers: ["DIGITAL FLOW", "APP JOURNEY", "AI RECOMMENDATION"],
    subtitles: [
      "From intake to recommendation in a single guided flow",
      "Cross-channel interaction mapped for faster completion",
      "Decision confidence increased through structured prompts",
    ],
    intros: [
      "This page captures product-style onboarding and guidance.",
      "Interface moments are distilled into readable decision blocks.",
      "The visual hierarchy follows a mobile-first interaction path.",
    ],
    bullets: [
      "Entry questions are grouped by confidence impact",
      "Recommendations are attached to transparent rationale tags",
      "Friction points are highlighted as explicit optimization targets",
      "Completion states include suggested follow-up actions",
      "Manual override remains available at each decision step",
      "Outputs are formatted for quick handoff to operations",
    ],
    chips: ["User Flow", "AI Layer", "Fast Handoff", "Traceable"],
    callouts: [
      "Design intent: clear progression from input to decision.",
      "The structure keeps automation visible and editable.",
      "Narrative density is increased without sacrificing legibility.",
    ],
  },
  consult: {
    kickers: ["EXPERT CONSULT", "ONSITE REVIEW", "GUIDED DECISION"],
    subtitles: [
      "Human review anchors the final recommendation step",
      "Context capture and expert judgment are fused in one frame",
      "Operational decisions are logged as editable narrative",
    ],
    intros: [
      "This page frames an expert-led consultation sequence.",
      "Advisory steps are grouped by relevance and urgency.",
      "The layout surfaces how recommendations were finalized.",
    ],
    bullets: [
      "Pre-read data is summarized before live discussion",
      "Decision criteria remain explicit at every stage",
      "Conflicting signals are resolved in traceable notes",
      "Final recommendations include rationale and guardrails",
      "Consult feedback is translated into next-cycle updates",
      "Documentation is optimized for fast stakeholder review",
    ],
    chips: ["Expert Layer", "Traceability", "Decision Notes", "Guided"],
    callouts: [
      "Design intent: make expert judgment legible and reusable.",
      "The page captures both recommendation and reasoning.",
      "Every section supports direct edits in PowerPoint.",
    ],
  },
  report: {
    kickers: ["INSIGHT REPORT", "PERSONAL OUTCOME", "PROGRESS REVIEW"],
    subtitles: [
      "Narrative summary paired with measurable checkpoints",
      "Outcome snapshots translated into clear progression",
      "Review artifacts structured for decision meetings",
    ],
    intros: [
      "This page is optimized for periodic reporting and follow-up.",
      "Key observations are organized into concise review zones.",
      "The composition favors scanning speed during presentations.",
    ],
    bullets: [
      "Milestones are grouped by impact and confidence",
      "Signals are mapped to practical response options",
      "Narrative and metrics remain synchronized by section",
      "Highlights and constraints are presented side-by-side",
      "Next-step ownership is visible in the final strip",
      "Reusable card modules simplify iterative updates",
    ],
    chips: ["Snapshot", "Milestones", "Decision Ready", "Review"],
    callouts: [
      "Design intent: reporting clarity with actionable emphasis.",
      "The visual rhythm supports both reading and presenting.",
      "The template keeps edits local and predictable.",
    ],
  },
  package: {
    kickers: ["PROGRAM PACKAGE", "B2B DEPLOYMENT", "END-TO-END MODEL"],
    subtitles: [
      "Integrated package from intake to recurring delivery",
      "Program modules aligned to scale and governance",
      "Operational coherence across recommendation and reporting",
    ],
    intros: [
      "This page frames the service as a structured package.",
      "Components are displayed as editable, reusable modules.",
      "The focus is on roll-out readiness and governance fit.",
    ],
    bullets: [
      "Module boundaries are clear for phased adoption",
      "Delivery rhythm is tied to realistic operating windows",
      "Escalation paths are visible before launch",
      "Measurement points are embedded in each cycle",
      "Service assets are prepared for low-friction onboarding",
      "Handover artifacts are aligned with enterprise workflows",
    ],
    chips: ["B2B", "Deployable", "Governed", "Scalable"],
    callouts: [
      "Design intent: package coherence with practical rollout detail.",
      "Visual modules are intended for repeated iteration cycles.",
      "The page reads quickly while retaining implementation depth.",
    ],
  },
  generic: {
    kickers: ["VISUAL STORY", "STRUCTURED PAGE", "DESIGN SYSTEM"],
    subtitles: [
      "Balanced narrative and imagery for fast communication",
      "A modular page built for repeated editing cycles",
      "Consistent rhythm with high visual density",
    ],
    intros: [
      "This page applies the default narrative framework.",
      "Layout zones are arranged for quick scanning and editing.",
      "The structure is deterministic and reusable by design.",
    ],
    bullets: [
      "Headline hierarchy is tuned for A4 readability",
      "Image framing and text cards are intentionally paired",
      "Information density is increased with controlled spacing",
      "Decorative accents remain fully editable as shapes",
      "Modules are stable to support repeat production runs",
      "Caption-derived content keeps input requirements minimal",
    ],
    chips: ["Reusable", "Deterministic", "A4 Native", "Editable"],
    callouts: [
      "Design intent: stronger visual cadence and larger typography.",
      "This template family is built for iterative refinement.",
      "Every page remains editable without rasterized capture.",
    ],
  },
};

function shortText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function stableHash(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function toTitleCase(value: string): string {
  return value
    .split(" ")
    .filter((token) => token.length > 0)
    .map((token) => token[0].toUpperCase() + token.slice(1))
    .join(" ");
}

function cleanCaptionFromFilename(filename: string): string {
  const stem = path.parse(filename).name;
  const withoutPrefix = stem.replace(
    /^\s*(?:\(\s*\d+\s*\)|p\s*\d+|\d+)(?:[\s._-]+)?/i,
    "",
  );

  const normalized = withoutPrefix.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (normalized.length > 0) {
    return normalized;
  }

  const fallback = stem.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return fallback || "Untitled image";
}

function normalizeForKeywordMatch(filename: string): string {
  return path.parse(filename).name.toLowerCase().replace(/\s+/g, "");
}

export function detectCategory(filename: string): PageCategory {
  const normalized = normalizeForKeywordMatch(filename);

  if (
    normalized.includes("\uc57d\uc0ac") ||
    normalized.includes("consult") ||
    normalized.includes("advisor") ||
    normalized.includes("pharmacist") ||
    normalized.includes("clinic")
  ) {
    return "consult";
  }
  if (
    normalized.includes("\ub808\ud3ec\ud2b8") ||
    normalized.includes("report") ||
    normalized.includes("summary") ||
    normalized.includes("insight")
  ) {
    return "report";
  }
  if (
    normalized.includes("\ud328\ud0a4\uc9c0") ||
    normalized.includes("package") ||
    normalized.includes("bundle") ||
    normalized.includes("program")
  ) {
    return "package";
  }
  if (
    normalized.includes("\uc571") ||
    normalized.includes("app") ||
    normalized.includes("mobile") ||
    normalized.includes("web") ||
    normalized.includes("screen")
  ) {
    return "app";
  }
  if (
    normalized.includes("\uc18c\ubd84") ||
    normalized.includes("\ubd84\ud560") ||
    normalized.includes("dispense") ||
    normalized.includes("dose") ||
    normalized.includes("formula")
  ) {
    return "dispense";
  }

  return "generic";
}

function pickTemplateFromCycle(cycle: readonly PageTemplate[], index: number): PageTemplate {
  return cycle[index % cycle.length];
}

export function pickTemplate(image: ScannedImage, index: number): PageTemplate {
  const width = image.widthPx ?? 1;
  const height = image.heightPx ?? 1;
  const ratio = width / height;

  if (ratio >= 1.2) {
    return pickTemplateFromCycle(LANDSCAPE_CYCLE, index);
  }
  if (ratio <= 0.85) {
    return pickTemplateFromCycle(PORTRAIT_CYCLE, index);
  }

  return pickTemplateFromCycle(DEFAULT_CYCLE, index);
}

function pickBySeed<T>(values: readonly T[], seed: number, offset = 0): T {
  return values[(seed + offset) % values.length];
}

function pickUnique(values: readonly string[], count: number, seed: number): string[] {
  if (values.length === 0) {
    return [];
  }

  const results: string[] = [];
  let cursor = seed % values.length;

  while (results.length < count) {
    const candidate = values[cursor];
    if (!results.includes(candidate)) {
      results.push(candidate);
    }

    cursor = (cursor + 1) % values.length;
    if (results.length === values.length) {
      break;
    }
  }

  return results;
}

function describeAspect(image: ScannedImage): string {
  if (!image.widthPx || !image.heightPx) {
    return "Unknown";
  }

  const ratio = image.widthPx / image.heightPx;
  const shape = ratio > 1.15 ? "Landscape" : ratio < 0.88 ? "Portrait" : "Balanced";
  return `${shape} ${ratio.toFixed(2)}:1`;
}

function describeResolution(image: ScannedImage): string {
  if (!image.widthPx || !image.heightPx) {
    return "Not detected";
  }
  return `${image.widthPx}x${image.heightPx}px`;
}

function buildPanelLabels(chips: readonly string[], seed: number): [string, string] {
  const left = pickBySeed(chips, seed, 0);
  const right = pickBySeed(chips, seed, 1);
  if (left === right) {
    return [left, pickBySeed(chips, seed, 2)];
  }
  return [left, right];
}

export function buildNarrative(
  image: ScannedImage,
  pageNumber: number,
  template: PageTemplate,
  categoryIndex: number,
): Narrative {
  const caption = cleanCaptionFromFilename(image.filename);
  const category = detectCategory(image.filename);
  const library = CATEGORY_LIBRARY[category];
  const seed = stableHash(`${image.filename}|${pageNumber}|${template}|${categoryIndex}`);
  const cleanedTitle = toTitleCase(caption);
  const title = shortText(cleanedTitle, 58);
  const subtitle = shortText(pickBySeed(library.subtitles, seed, 3), 88);
  const intro = pickBySeed(library.intros, seed, 7);
  const summary = shortText(`${intro} Built around "${shortText(title, 34)}".`, 150);
  const selectedBullets = pickUnique(library.bullets, 4, seed + 11);
  const selectedChips = pickUnique(library.chips, 3, seed + 19);
  const [chipA, chipB, chipC] = [
    selectedChips[0] ?? library.chips[0] ?? "Editable",
    selectedChips[1] ?? library.chips[1] ?? "Structured",
    selectedChips[2] ?? library.chips[2] ?? "Deterministic",
  ] as const;
  const [bulletA, bulletB, bulletC, bulletD] = [
    shortText(selectedBullets[0] ?? library.bullets[0] ?? "Structured content block", 66),
    shortText(selectedBullets[1] ?? library.bullets[1] ?? "Visual hierarchy tuned for A4", 66),
    shortText(selectedBullets[2] ?? library.bullets[2] ?? "Editable objects for fast iteration", 66),
    shortText(selectedBullets[3] ?? library.bullets[3] ?? "Deterministic output for repeated use", 66),
  ] as const;
  const callout = shortText(
    `${pickBySeed(library.callouts, seed, 13)} ${pickBySeed(library.intros, seed, 17)}`,
    150,
  );
  const panelLabels = buildPanelLabels([chipA, chipB, chipC], seed);
  const metrics: [NarrativeMetric, NarrativeMetric, NarrativeMetric] = [
    {
      label: "Aspect",
      value: describeAspect(image),
    },
    {
      label: "Resolution",
      value: describeResolution(image),
    },
    {
      label: "Template",
      value: TEMPLATE_LABELS[template],
    },
  ];

  return {
    category,
    kicker: pickBySeed(library.kickers, seed, 1),
    title,
    subtitle,
    summary,
    bullets: [bulletA, bulletB, bulletC, bulletD],
    chips: [chipA, chipB, chipC],
    callout,
    footer: `${shortText(title, 26)} | ${TEMPLATE_LABELS[template]} | Page ${pageNumber}`,
    metrics,
    panelLabels,
  };
}
