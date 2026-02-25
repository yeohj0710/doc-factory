import type { TemplateId } from "@/src/layout/templateCatalog";
import type { PageRole } from "@/src/planner/types";
import {
  pickRepresentativeLayoutReferenceIds,
  pickRepresentativeStyleReferenceIds,
  type LayoutArchetype,
  type ReferenceIndex,
} from "@/src/io/referenceIndex";
import { stableHashFromParts } from "@/src/io/hash";
import { STYLE_PRESETS, type StylePreset } from "@/src/layout/stylePresets";

type PresetVector = {
  luma: number;
  saturation: number;
  contrast: number;
  temperature: number;
  spacingDensity: number;
};

type ReferenceStyleVector = {
  luma: number;
  saturation: number;
  contrast: number;
  temperature: number;
  spacingDensity: number;
};

export type ReferenceStyleSelection = {
  candidatePresetIds: string[];
  selectedPreset: StylePreset;
  selectedStyleClusterIds: string[];
  representativeRefIds: string[];
  reason: string;
};

export type LayoutAssignment = {
  pageNumber: number;
  layoutClusterId: string;
  layoutTuning: LayoutArchetype;
  preferredTemplateIds: TemplateId[];
};

export type LayoutPlanSelection = {
  source: "references" | "builtin";
  selectedLayoutClusterIds: string[];
  representativeRefIds: string[];
  assignments: LayoutAssignment[];
  usedLayoutClusterIds: string[];
  minRequiredLayoutClusters: number;
  reason: string;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toFixedNumber(value: number, digits = 4): number {
  return Number(value.toFixed(digits));
}

function hashToNumber(parts: readonly string[]): number {
  const hash = stableHashFromParts(parts, 12);
  return Number.parseInt(hash.slice(0, 8), 16) >>> 0;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace("#", "").trim();
  if (normalized.length < 6) {
    return { r: 127, g: 127, b: 127 };
  }
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return {
    r: Number.isNaN(r) ? 127 : r,
    g: Number.isNaN(g) ? 127 : g,
    b: Number.isNaN(b) ? 127 : b,
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const clampRgb = (value: number): number => clamp(Math.round(value), 0, 255);
  const toHex = (value: number): string => clampRgb(value).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function mixHex(baseHex: string, targetHex: string, targetWeight: number): string {
  const weight = clamp(targetWeight, 0, 1);
  const a = hexToRgb(baseHex);
  const b = hexToRgb(targetHex);
  return rgbToHex(
    a.r * (1 - weight) + b.r * weight,
    a.g * (1 - weight) + b.g * weight,
    a.b * (1 - weight) + b.b * weight,
  );
}

function ensureMinLuma(hex: string, minLumaValue: number): string {
  let color = hex;
  let attempts = 0;
  while (attempts < 6) {
    const rgb = hexToRgb(color);
    if (luma(rgb.r, rgb.g, rgb.b) >= minLumaValue) {
      return color;
    }
    color = mixHex(color, "#FFFFFF", 0.24);
    attempts += 1;
  }
  return color;
}

function ensureMaxLuma(hex: string, maxLumaValue: number): string {
  let color = hex;
  let attempts = 0;
  while (attempts < 6) {
    const rgb = hexToRgb(color);
    if (luma(rgb.r, rgb.g, rgb.b) <= maxLumaValue) {
      return color;
    }
    color = mixHex(color, "#111111", 0.2);
    attempts += 1;
  }
  return color;
}

function luma(r: number, g: number, b: number): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function saturation(r: number, g: number, b: number): number {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;
  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  if (max === min) {
    return 0;
  }
  const lightness = (max + min) / 2;
  const denominator = 1 - Math.abs(2 * lightness - 1);
  if (denominator <= 0) {
    return 0;
  }
  return clamp((max - min) / denominator, 0, 1);
}

function presetVector(preset: StylePreset): PresetVector {
  const page = hexToRgb(preset.colors.page);
  const text = hexToRgb(preset.colors.text);
  const accent = hexToRgb(preset.colors.accent);
  const spacingDensity = clamp(1 - preset.spacingMm.pageMargin / 24, 0, 1);
  return {
    luma: luma(page.r, page.g, page.b),
    saturation: saturation(accent.r, accent.g, accent.b),
    contrast: Math.abs(luma(text.r, text.g, text.b) - luma(page.r, page.g, page.b)),
    temperature: clamp((accent.r - accent.b) / 255, -1, 1),
    spacingDensity,
  };
}

function distanceStyleVector(left: PresetVector, right: ReferenceStyleVector): number {
  const dl = left.luma - right.luma;
  const ds = left.saturation - right.saturation;
  const dc = left.contrast - right.contrast;
  const dt = left.temperature - right.temperature;
  const dd = left.spacingDensity - right.spacingDensity;
  return Math.sqrt(dl * dl * 1.3 + ds * ds * 1.1 + dc * dc * 1.2 + dt * dt + dd * dd);
}

function roleFamilyBias(role: PageRole): TemplateId[] {
  if (role === "cover") {
    return ["COVER_HERO_BAND", "COVER_SPLIT_MEDIA", "TITLE_MEDIA_SAFE", "GALLERY_SINGLE"];
  }
  if (role === "section-divider") {
    return ["SECTION_DIVIDER", "AGENDA_EDITORIAL", "TEXT_ONLY_EDITORIAL"];
  }
  if (role === "agenda") {
    return ["AGENDA_EDITORIAL", "TEXT_ONLY_EDITORIAL", "COMPARISON_TABLE"];
  }
  if (role === "metrics") {
    return ["METRICS_GRID", "COMPARISON_TABLE", "TITLE_MEDIA_SAFE"];
  }
  if (role === "process" || role === "timeline") {
    return ["PROCESS_FLOW", "TIMELINE_STEPS", "COMPARISON_TABLE"];
  }
  if (role === "comparison") {
    return ["COMPARISON_TABLE", "METRICS_GRID", "TEXT_ONLY_EDITORIAL"];
  }
  if (role === "gallery") {
    return ["GALLERY_SINGLE", "TITLE_MEDIA_SAFE", "TWO_COLUMN_MEDIA_TEXT"];
  }
  if (role === "cta") {
    return ["CTA_CONTACT", "TEXT_ONLY_EDITORIAL", "AGENDA_EDITORIAL"];
  }
  if (role === "text-only") {
    return ["TEXT_ONLY_EDITORIAL", "AGENDA_EDITORIAL", "COMPARISON_TABLE"];
  }
  return ["TITLE_MEDIA_SAFE", "TWO_COLUMN_MEDIA_TEXT", "TEXT_ONLY_EDITORIAL"];
}

function templatePreferencesForArchetype(archetype: LayoutArchetype, role: PageRole): TemplateId[] {
  const preferred: TemplateId[] = [];

  const push = (templateId: TemplateId): void => {
    if (!preferred.includes(templateId)) {
      preferred.push(templateId);
    }
  };

  const baseRole = roleFamilyBias(role);
  for (const id of baseRole) {
    push(id);
  }

  if (archetype.heroRatio >= 0.58) {
    ["COVER_HERO_BAND", "COVER_SPLIT_MEDIA", "TITLE_MEDIA_SAFE", "GALLERY_SINGLE"].forEach((id) =>
      push(id as TemplateId),
    );
  }

  if (archetype.columns >= 3) {
    ["METRICS_GRID", "COMPARISON_TABLE", "AGENDA_EDITORIAL", "PROCESS_FLOW"].forEach((id) =>
      push(id as TemplateId),
    );
  } else if (archetype.columns === 2) {
    ["TWO_COLUMN_MEDIA_TEXT", "TITLE_MEDIA_SAFE", "COMPARISON_TABLE"].forEach((id) =>
      push(id as TemplateId),
    );
  }

  if (archetype.cardDensity >= 0.52) {
    ["METRICS_GRID", "PROCESS_FLOW", "TIMELINE_STEPS", "COMPARISON_TABLE"].forEach((id) =>
      push(id as TemplateId),
    );
  }

  if (archetype.rhythm === "airy") {
    ["SECTION_DIVIDER", "AGENDA_EDITORIAL", "TEXT_ONLY_EDITORIAL", "QUOTE_FOCUS"].forEach((id) =>
      push(id as TemplateId),
    );
  }

  if (archetype.rhythm === "tight") {
    ["METRICS_GRID", "COMPARISON_TABLE", "TWO_COLUMN_MEDIA_TEXT"].forEach((id) => push(id as TemplateId));
  }

  return preferred;
}

function deriveReferencePreset(basePreset: StylePreset, params: {
  clusterId: string;
  palette: string[];
  typographyScale: number;
  spacingScale: number;
  radiusScale: number;
  strokeScale: number;
  shadowOpacity: number;
  accentRule: "muted" | "balanced" | "bold";
}): StylePreset {
  const pageColor = basePreset.colors.page;
  const accentRaw = params.palette[0] ?? basePreset.colors.accent;
  const accentDeepRaw = params.palette[1] ?? basePreset.colors.accentDeep;
  const highlightRaw = params.palette[2] ?? basePreset.colors.highlight;
  const highlightSoftRaw = params.palette[3] ?? basePreset.colors.highlightSoft;
  const softAccentRaw = params.palette[4] ?? basePreset.colors.softAccent;
  const softAccentAltRaw = params.palette[5] ?? basePreset.colors.softAccentAlt;
  const accent = ensureMaxLuma(ensureMinLuma(accentRaw, 0.26), 0.7);
  const accentDeep = ensureMaxLuma(ensureMinLuma(accentDeepRaw, 0.18), 0.55);
  const highlight = ensureMaxLuma(
    ensureMinLuma(mixHex(mixHex(basePreset.colors.highlight, highlightRaw, 0.28), pageColor, 0.24), 0.42),
    0.84,
  );
  const highlightSoft = ensureMinLuma(
    mixHex(mixHex(basePreset.colors.highlightSoft, highlightSoftRaw, 0.22), pageColor, 0.34),
    0.82,
  );
  const softAccent = ensureMinLuma(
    mixHex(mixHex(basePreset.colors.softAccent, softAccentRaw, 0.24), pageColor, 0.32),
    0.8,
  );
  const softAccentAlt = ensureMinLuma(
    mixHex(mixHex(basePreset.colors.softAccentAlt, softAccentAltRaw, 0.24), pageColor, 0.28),
    0.78,
  );
  const emphasisBoost = params.accentRule === "bold" ? 1 : params.accentRule === "muted" ? -1 : 0;

  return {
    ...basePreset,
    id: `${basePreset.id}__ref_${params.clusterId}`,
    label: `${basePreset.label} / References`,
    source: "references",
    tags: [...new Set([...basePreset.tags, "references"])],
    colors: {
      ...basePreset.colors,
      accent,
      accentDeep,
      highlight,
      highlightSoft,
      softAccent,
      softAccentAlt,
    },
    typography: {
      ...basePreset.typography,
      display: toFixedNumber(clamp(basePreset.typography.display * params.typographyScale, 28, 42), 2),
      title: toFixedNumber(clamp(basePreset.typography.title * params.typographyScale, 21, 34), 2),
      subtitle: toFixedNumber(clamp(basePreset.typography.subtitle * params.typographyScale, 15, 24), 2),
      lead: toFixedNumber(clamp(basePreset.typography.lead * params.typographyScale, 12, 18), 2),
      body: toFixedNumber(clamp(basePreset.typography.body * params.typographyScale, 11, 14), 2),
      caption: toFixedNumber(clamp(basePreset.typography.caption * params.typographyScale, 10, 12.5), 2),
      micro: toFixedNumber(clamp(basePreset.typography.micro * params.typographyScale, 9.5, 11.5), 2),
    },
    spacingMm: {
      ...basePreset.spacingMm,
      pageMargin: toFixedNumber(clamp(basePreset.spacingMm.pageMargin * params.spacingScale, 10, 18), 3),
      gutter: toFixedNumber(clamp(basePreset.spacingMm.gutter * params.spacingScale, 4.2, 10), 3),
      headerHeight: toFixedNumber(clamp(basePreset.spacingMm.headerHeight * params.spacingScale, 16, 30), 3),
      footerHeight: toFixedNumber(clamp(basePreset.spacingMm.footerHeight * params.spacingScale, 12, 20), 3),
      sectionGap: toFixedNumber(clamp(basePreset.spacingMm.sectionGap * params.spacingScale, 5, 12), 3),
    },
    radiusMm: {
      sm: toFixedNumber(clamp(basePreset.radiusMm.sm * params.radiusScale, 1.1, 3.6), 3),
      md: toFixedNumber(clamp(basePreset.radiusMm.md * params.radiusScale, 2.2, 7.8), 3),
      lg: toFixedNumber(clamp(basePreset.radiusMm.lg * params.radiusScale, 4.2, 11.2), 3),
    },
    stroke: {
      defaultMm: toFixedNumber(clamp(basePreset.stroke.defaultMm * params.strokeScale, 0.2, 0.52), 3),
      strongMm: toFixedNumber(clamp(basePreset.stroke.strongMm * params.strokeScale, 0.32, 0.72), 3),
      shadowOpacity: toFixedNumber(clamp(params.shadowOpacity, 0.04, 0.2), 3),
    },
    accentUsage: {
      maxBlocksPerPage: clamp(basePreset.accentUsage.maxBlocksPerPage + emphasisBoost, 1, 5),
      maxTextHighlightPerPage: clamp(basePreset.accentUsage.maxTextHighlightPerPage + emphasisBoost, 1, 4),
    },
  };
}

export function selectReferenceStylePreset(params: {
  referenceIndex: ReferenceIndex;
  seed: number;
  variantIndex: number;
  requestedPresetId?: string;
  themeFactoryAvailable: boolean;
}): ReferenceStyleSelection {
  const representatives = pickRepresentativeStyleReferenceIds(params.referenceIndex, 8, 16);
  const entryById = new Map(params.referenceIndex.entries.map((entry) => [entry.id, entry] as const));
  const representativeEntries = representatives
    .map((id) => entryById.get(id))
    .filter((entry): entry is NonNullable<typeof entry> => entry !== undefined);

  const target: ReferenceStyleVector = representativeEntries.reduce(
    (acc, entry) => {
      acc.luma += entry.styleFingerprint.avgLuma;
      acc.saturation += entry.styleFingerprint.saturation;
      acc.contrast += entry.styleFingerprint.contrast;
      acc.temperature += entry.styleFingerprint.temperature;
      acc.spacingDensity += entry.styleFingerprint.spacingDensity;
      return acc;
    },
    {
      luma: 0,
      saturation: 0,
      contrast: 0,
      temperature: 0,
      spacingDensity: 0,
    },
  );
  const safeCount = Math.max(1, representativeEntries.length);
  target.luma /= safeCount;
  target.saturation /= safeCount;
  target.contrast /= safeCount;
  target.temperature /= safeCount;
  target.spacingDensity /= safeCount;

  const pool = params.themeFactoryAvailable
    ? STYLE_PRESETS.filter((preset) => preset.source === "theme-factory")
    : [...STYLE_PRESETS];
  const effectivePool = pool.length > 0 ? pool : [...STYLE_PRESETS];

  const scored = effectivePool
    .map((preset) => ({
      preset,
      score: distanceStyleVector(presetVector(preset), target),
    }))
    .sort((left, right) => left.score - right.score || left.preset.id.localeCompare(right.preset.id));

  const candidates = scored.slice(0, 3).map((item) => item.preset.id);

  if (params.requestedPresetId) {
    const requestedPreset = effectivePool.find((preset) => preset.id === params.requestedPresetId);
    if (requestedPreset) {
      const styleCluster = params.referenceIndex.styleClusters[0];
      const selected = deriveReferencePreset(requestedPreset, {
        clusterId: styleCluster?.id ?? "style-c01",
        palette: representativeEntries[0]?.palette ?? [],
        typographyScale: styleCluster?.tokenHint.typographyScale ?? 1,
        spacingScale: styleCluster?.tokenHint.spacingScale ?? 1,
        radiusScale: styleCluster?.tokenHint.radiusScale ?? 1,
        strokeScale: styleCluster?.tokenHint.strokeScale ?? 1,
        shadowOpacity: styleCluster?.tokenHint.shadowOpacity ?? 0.1,
        accentRule: styleCluster?.tokenHint.accentRule ?? "balanced",
      });

      return {
        candidatePresetIds: [requestedPreset.id, ...candidates.filter((id) => id !== requestedPreset.id)].slice(0, 3),
        selectedPreset: selected,
        selectedStyleClusterIds: [styleCluster?.id ?? "style-c01"],
        representativeRefIds: representatives,
        reason: "requested preset with reference-driven token adaptation",
      };
    }
  }

  const rotation = hashToNumber([
    String(params.seed),
    String(params.variantIndex),
    params.referenceIndex.referenceDigest,
  ]);
  const selectedCandidateIndex = candidates.length > 0 ? rotation % candidates.length : 0;
  const selectedCandidateId = candidates[selectedCandidateIndex] ?? scored[0]?.preset.id ?? STYLE_PRESETS[0]?.id;
  const selectedBasePreset = effectivePool.find((preset) => preset.id === selectedCandidateId) ?? effectivePool[0] ?? STYLE_PRESETS[0];
  const selectedClusterIndex =
    params.referenceIndex.styleClusters.length > 0 ? rotation % params.referenceIndex.styleClusters.length : 0;
  const selectedCluster = params.referenceIndex.styleClusters[selectedClusterIndex] ?? params.referenceIndex.styleClusters[0];
  const selectedEntry = selectedCluster ? entryById.get(selectedCluster.medoidId) : representativeEntries[0];

  const selectedPreset = deriveReferencePreset(selectedBasePreset, {
    clusterId: selectedCluster?.id ?? "style-c01",
    palette: selectedEntry?.palette ?? representativeEntries[0]?.palette ?? [],
    typographyScale: selectedCluster?.tokenHint.typographyScale ?? 1,
    spacingScale: selectedCluster?.tokenHint.spacingScale ?? 1,
    radiusScale: selectedCluster?.tokenHint.radiusScale ?? 1,
    strokeScale: selectedCluster?.tokenHint.strokeScale ?? 1,
    shadowOpacity: selectedCluster?.tokenHint.shadowOpacity ?? 0.1,
    accentRule: selectedCluster?.tokenHint.accentRule ?? "balanced",
  });

  return {
    candidatePresetIds: candidates,
    selectedPreset,
    selectedStyleClusterIds: selectedCluster ? [selectedCluster.id] : [],
    representativeRefIds: representatives,
    reason: params.themeFactoryAvailable
      ? "theme-factory representative scoring (reference-driven)"
      : "reference style cluster heuristics",
  };
}

function chooseLayoutClusters(params: {
  layoutClusters: ReferenceIndex["layoutClusters"];
  targetCount: number;
  seed: number;
  variantIndex: number;
  referenceDigest: string;
}): ReferenceIndex["layoutClusters"] {
  const sorted = [...params.layoutClusters].sort((a, b) => b.size - a.size || a.id.localeCompare(b.id));
  const targetCount = clamp(params.targetCount, 1, Math.max(1, sorted.length));
  const selected: ReferenceIndex["layoutClusters"] = [];
  const seen = new Set<string>();
  const start = hashToNumber([
    String(params.seed),
    String(params.variantIndex),
    params.referenceDigest,
  ]) % sorted.length;
  const step = Math.max(1, (hashToNumber([params.referenceDigest, String(params.variantIndex)]) % sorted.length) || 1);

  let cursor = start;
  let guard = 0;
  while (selected.length < targetCount && guard < sorted.length * 3) {
    const cluster = sorted[cursor % sorted.length];
    if (cluster && !seen.has(cluster.id)) {
      selected.push(cluster);
      seen.add(cluster.id);
    }
    cursor += step;
    guard += 1;
  }

  if (selected.length < targetCount) {
    for (const cluster of sorted) {
      if (seen.has(cluster.id)) {
        continue;
      }
      selected.push(cluster);
      seen.add(cluster.id);
      if (selected.length >= targetCount) {
        break;
      }
    }
  }

  return selected.slice(0, targetCount);
}

export function selectReferenceLayoutPlan(params: {
  referenceIndex: ReferenceIndex;
  pageCount: number;
  roles: PageRole[];
  seed: number;
  variantIndex: number;
}): LayoutPlanSelection {
  const minRequiredLayoutClusters = params.pageCount >= 6 ? 3 : params.pageCount > 1 ? 2 : 1;
  const targetClusterCount = Math.min(
    params.referenceIndex.layoutClusters.length,
    Math.max(minRequiredLayoutClusters, Math.min(4, params.referenceIndex.layoutClusters.length)),
  );

  const selectedClusters = chooseLayoutClusters({
    layoutClusters: params.referenceIndex.layoutClusters,
    targetCount: Math.max(1, targetClusterCount),
    seed: params.seed,
    variantIndex: params.variantIndex,
    referenceDigest: params.referenceIndex.referenceDigest,
  });

  const assignments: LayoutAssignment[] = params.roles.map((role, index) => {
    const cluster = selectedClusters.length > 0
      ? selectedClusters[(index + params.variantIndex - 1) % selectedClusters.length]
      : undefined;

    const fallbackArchetype: LayoutArchetype = {
      columns: 2,
      heroRatio: 0.5,
      cardDensity: 0.45,
      headerRatio: 0.14,
      footerRatio: 0.1,
      rhythm: "balanced",
    };
    const archetype = cluster?.archetype ?? fallbackArchetype;

    return {
      pageNumber: index + 1,
      layoutClusterId: cluster?.id ?? "layout-c01",
      layoutTuning: archetype,
      preferredTemplateIds: templatePreferencesForArchetype(archetype, role),
    };
  });

  const usedLayoutClusterIds = [...new Set(assignments.map((assignment) => assignment.layoutClusterId))];
  const representativeRefIds = pickRepresentativeLayoutReferenceIds(params.referenceIndex, 8, 16);

  return {
    source: "references",
    selectedLayoutClusterIds: selectedClusters.map((cluster) => cluster.id),
    representativeRefIds,
    assignments,
    usedLayoutClusterIds,
    minRequiredLayoutClusters,
    reason: "layout archetypes mapped to template families and parameters",
  };
}

export function selectBuiltinLayoutPlan(params: {
  pageCount: number;
  roles: PageRole[];
}): LayoutPlanSelection {
  const fallbackArchetype: LayoutArchetype = {
    columns: 2,
    heroRatio: 0.48,
    cardDensity: 0.44,
    headerRatio: 0.14,
    footerRatio: 0.1,
    rhythm: "balanced",
  };

  const assignments: LayoutAssignment[] = params.roles.map((role, index) => ({
    pageNumber: index + 1,
    layoutClusterId: "layout-builtin-01",
    layoutTuning: fallbackArchetype,
    preferredTemplateIds: templatePreferencesForArchetype(fallbackArchetype, role),
  }));

  return {
    source: "builtin",
    selectedLayoutClusterIds: ["layout-builtin-01"],
    representativeRefIds: [],
    assignments,
    usedLayoutClusterIds: ["layout-builtin-01"],
    minRequiredLayoutClusters: params.pageCount >= 6 ? 3 : params.pageCount > 1 ? 2 : 1,
    reason: "fallback layout plan (no fresh reference index)",
  };
}
