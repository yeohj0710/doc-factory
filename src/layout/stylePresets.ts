export type StylePreset = {
  id: string;
  label: string;
  source: "builtin" | "theme-factory";
  tags: string[];
  colors: {
    canvas: string;
    page: string;
    text: string;
    mutedText: string;
    border: string;
    accent: string;
    accentDeep: string;
    highlight: string;
    highlightSoft: string;
    softAccent: string;
    softAccentAlt: string;
    inverseText: string;
  };
  typography: {
    display: number;
    title: number;
    subtitle: number;
    lead: number;
    body: number;
    caption: number;
    micro: number;
    lineHeight: number;
  };
  spacingMm: {
    pageMargin: number;
    gutter: number;
    headerHeight: number;
    footerHeight: number;
    sectionGap: number;
  };
  radiusMm: {
    sm: number;
    md: number;
    lg: number;
  };
  stroke: {
    defaultMm: number;
    strongMm: number;
    shadowOpacity: number;
  };
  background: {
    mode: "solid" | "banded" | "gradient";
    intensity: number;
  };
  accentUsage: {
    maxBlocksPerPage: number;
    maxTextHighlightPerPage: number;
  };
};

export type StyleSelection = {
  candidatePresetIds: string[];
  selectedPresetId: string;
  reason: string;
};

const BASE_PRESETS: StylePreset[] = [
  {
    id: "theme-ocean-depths",
    label: "Ocean Depths",
    source: "theme-factory",
    tags: ["cool", "professional", "report"],
    colors: {
      canvas: "#E8EFF3",
      page: "#F9FBFC",
      text: "#1A2332",
      mutedText: "#42556B",
      border: "#BFD1D6",
      accent: "#2D8B8B",
      accentDeep: "#1E6363",
      highlight: "#A8DADC",
      highlightSoft: "#EAF7F7",
      softAccent: "#E3F0F1",
      softAccentAlt: "#D3E8EA",
      inverseText: "#F1FAEE",
    },
    typography: {
      display: 34,
      title: 26,
      subtitle: 18,
      lead: 14,
      body: 11,
      caption: 10,
      micro: 9,
      lineHeight: 1.28,
    },
    spacingMm: {
      pageMargin: 12,
      gutter: 6,
      headerHeight: 22,
      footerHeight: 14,
      sectionGap: 7,
    },
    radiusMm: { sm: 2, md: 4.5, lg: 8 },
    stroke: { defaultMm: 0.25, strongMm: 0.45, shadowOpacity: 0.1 },
    background: { mode: "banded", intensity: 0.35 },
    accentUsage: { maxBlocksPerPage: 3, maxTextHighlightPerPage: 2 },
  },
  {
    id: "theme-sunset-boulevard",
    label: "Sunset Boulevard",
    source: "theme-factory",
    tags: ["warm", "creative", "marketing"],
    colors: {
      canvas: "#FFF4EB",
      page: "#FFFBF7",
      text: "#264653",
      mutedText: "#5C6A72",
      border: "#E6C8AF",
      accent: "#E76F51",
      accentDeep: "#B34D33",
      highlight: "#F4A261",
      highlightSoft: "#FBE7D2",
      softAccent: "#FFF0DD",
      softAccentAlt: "#FCE0C2",
      inverseText: "#FFF8EF",
    },
    typography: {
      display: 35,
      title: 27,
      subtitle: 18,
      lead: 14,
      body: 11,
      caption: 10,
      micro: 9,
      lineHeight: 1.26,
    },
    spacingMm: {
      pageMargin: 12,
      gutter: 6,
      headerHeight: 20,
      footerHeight: 14,
      sectionGap: 7,
    },
    radiusMm: { sm: 2.4, md: 5.5, lg: 9 },
    stroke: { defaultMm: 0.25, strongMm: 0.48, shadowOpacity: 0.12 },
    background: { mode: "gradient", intensity: 0.42 },
    accentUsage: { maxBlocksPerPage: 4, maxTextHighlightPerPage: 2 },
  },
  {
    id: "theme-forest-canopy",
    label: "Forest Canopy",
    source: "theme-factory",
    tags: ["nature", "grounded", "wellness"],
    colors: {
      canvas: "#EEF1EC",
      page: "#FBFCFA",
      text: "#2D4A2B",
      mutedText: "#596558",
      border: "#C8D0C0",
      accent: "#7D8471",
      accentDeep: "#4D5743",
      highlight: "#A4AC86",
      highlightSoft: "#EDF1E4",
      softAccent: "#EFF4EC",
      softAccentAlt: "#DEE8D7",
      inverseText: "#FAF9F6",
    },
    typography: {
      display: 33,
      title: 25,
      subtitle: 17,
      lead: 13,
      body: 11,
      caption: 10,
      micro: 9,
      lineHeight: 1.27,
    },
    spacingMm: {
      pageMargin: 13,
      gutter: 6,
      headerHeight: 20,
      footerHeight: 14,
      sectionGap: 7,
    },
    radiusMm: { sm: 2, md: 4.2, lg: 8 },
    stroke: { defaultMm: 0.24, strongMm: 0.42, shadowOpacity: 0.09 },
    background: { mode: "banded", intensity: 0.32 },
    accentUsage: { maxBlocksPerPage: 3, maxTextHighlightPerPage: 1 },
  },
  {
    id: "theme-modern-minimalist",
    label: "Modern Minimalist",
    source: "theme-factory",
    tags: ["minimal", "neutral", "proposal"],
    colors: {
      canvas: "#F0F2F4",
      page: "#FFFFFF",
      text: "#36454F",
      mutedText: "#5D6872",
      border: "#D4DCE3",
      accent: "#708090",
      accentDeep: "#3E4B55",
      highlight: "#9AA7B4",
      highlightSoft: "#E9EDF1",
      softAccent: "#F3F5F7",
      softAccentAlt: "#E4E8EC",
      inverseText: "#FFFFFF",
    },
    typography: {
      display: 33,
      title: 24,
      subtitle: 17,
      lead: 13,
      body: 11,
      caption: 10,
      micro: 9,
      lineHeight: 1.3,
    },
    spacingMm: {
      pageMargin: 14,
      gutter: 6,
      headerHeight: 18,
      footerHeight: 14,
      sectionGap: 7,
    },
    radiusMm: { sm: 1.4, md: 3, lg: 6 },
    stroke: { defaultMm: 0.22, strongMm: 0.4, shadowOpacity: 0.06 },
    background: { mode: "solid", intensity: 0.1 },
    accentUsage: { maxBlocksPerPage: 2, maxTextHighlightPerPage: 1 },
  },
  {
    id: "theme-golden-hour",
    label: "Golden Hour",
    source: "theme-factory",
    tags: ["warm", "hospitality", "storytelling"],
    colors: {
      canvas: "#F7F0E7",
      page: "#FFFDFB",
      text: "#4A403A",
      mutedText: "#6C5E52",
      border: "#E1CDB5",
      accent: "#F4A900",
      accentDeep: "#B97D00",
      highlight: "#C1666B",
      highlightSoft: "#F7E3D9",
      softAccent: "#FDF3E5",
      softAccentAlt: "#F5DFC8",
      inverseText: "#FFF7ED",
    },
    typography: {
      display: 34,
      title: 26,
      subtitle: 18,
      lead: 14,
      body: 11,
      caption: 10,
      micro: 9,
      lineHeight: 1.27,
    },
    spacingMm: {
      pageMargin: 12,
      gutter: 6,
      headerHeight: 20,
      footerHeight: 14,
      sectionGap: 7,
    },
    radiusMm: { sm: 2.2, md: 5.2, lg: 8.8 },
    stroke: { defaultMm: 0.25, strongMm: 0.46, shadowOpacity: 0.11 },
    background: { mode: "gradient", intensity: 0.35 },
    accentUsage: { maxBlocksPerPage: 4, maxTextHighlightPerPage: 2 },
  },
  {
    id: "theme-arctic-frost",
    label: "Arctic Frost",
    source: "theme-factory",
    tags: ["cool", "healthcare", "precision"],
    colors: {
      canvas: "#EFF4FB",
      page: "#FCFDFF",
      text: "#2A3A52",
      mutedText: "#4D5E76",
      border: "#CCD7E7",
      accent: "#4A6FA5",
      accentDeep: "#2E4E7A",
      highlight: "#9BB4D2",
      highlightSoft: "#ECF2FA",
      softAccent: "#E8F0FB",
      softAccentAlt: "#DCE7F6",
      inverseText: "#FAFAFA",
    },
    typography: {
      display: 33,
      title: 25,
      subtitle: 17,
      lead: 13,
      body: 11,
      caption: 10,
      micro: 9,
      lineHeight: 1.3,
    },
    spacingMm: {
      pageMargin: 13,
      gutter: 6,
      headerHeight: 19,
      footerHeight: 14,
      sectionGap: 7,
    },
    radiusMm: { sm: 1.8, md: 3.8, lg: 7 },
    stroke: { defaultMm: 0.23, strongMm: 0.4, shadowOpacity: 0.08 },
    background: { mode: "solid", intensity: 0.2 },
    accentUsage: { maxBlocksPerPage: 3, maxTextHighlightPerPage: 2 },
  },
  {
    id: "theme-desert-rose",
    label: "Desert Rose",
    source: "theme-factory",
    tags: ["warm", "boutique", "editorial"],
    colors: {
      canvas: "#F7EFEB",
      page: "#FFFCFA",
      text: "#5D2E46",
      mutedText: "#735768",
      border: "#E4CCBF",
      accent: "#B87D6D",
      accentDeep: "#8A5749",
      highlight: "#D4A5A5",
      highlightSoft: "#F6E8E3",
      softAccent: "#F9EFEA",
      softAccentAlt: "#F0D9CF",
      inverseText: "#FFF5F0",
    },
    typography: {
      display: 34,
      title: 25,
      subtitle: 17,
      lead: 13,
      body: 11,
      caption: 10,
      micro: 9,
      lineHeight: 1.28,
    },
    spacingMm: {
      pageMargin: 12,
      gutter: 6,
      headerHeight: 20,
      footerHeight: 14,
      sectionGap: 7,
    },
    radiusMm: { sm: 2.3, md: 5.4, lg: 9 },
    stroke: { defaultMm: 0.24, strongMm: 0.46, shadowOpacity: 0.12 },
    background: { mode: "gradient", intensity: 0.3 },
    accentUsage: { maxBlocksPerPage: 3, maxTextHighlightPerPage: 2 },
  },
  {
    id: "theme-tech-innovation",
    label: "Tech Innovation",
    source: "theme-factory",
    tags: ["tech", "bold", "dark"],
    colors: {
      canvas: "#E8EEF8",
      page: "#FDFEFF",
      text: "#18243A",
      mutedText: "#3E526E",
      border: "#C9D4E8",
      accent: "#0066FF",
      accentDeep: "#003FA3",
      highlight: "#00C4D6",
      highlightSoft: "#E4F7FA",
      softAccent: "#EAF1FE",
      softAccentAlt: "#D7E6FF",
      inverseText: "#FFFFFF",
    },
    typography: {
      display: 35,
      title: 27,
      subtitle: 18,
      lead: 14,
      body: 11,
      caption: 10,
      micro: 9,
      lineHeight: 1.29,
    },
    spacingMm: {
      pageMargin: 12,
      gutter: 6,
      headerHeight: 20,
      footerHeight: 14,
      sectionGap: 7,
    },
    radiusMm: { sm: 1.8, md: 4.2, lg: 7.5 },
    stroke: { defaultMm: 0.24, strongMm: 0.45, shadowOpacity: 0.1 },
    background: { mode: "banded", intensity: 0.38 },
    accentUsage: { maxBlocksPerPage: 4, maxTextHighlightPerPage: 2 },
  },
  {
    id: "theme-botanical-garden",
    label: "Botanical Garden",
    source: "theme-factory",
    tags: ["nature", "food", "organic"],
    colors: {
      canvas: "#F1F4EE",
      page: "#FFFDF8",
      text: "#2F4A3A",
      mutedText: "#566A5E",
      border: "#CBD8CF",
      accent: "#4A7C59",
      accentDeep: "#2F573D",
      highlight: "#F9A620",
      highlightSoft: "#FFF1D7",
      softAccent: "#EAF3E9",
      softAccentAlt: "#DDEBDD",
      inverseText: "#F5F3ED",
    },
    typography: {
      display: 33,
      title: 25,
      subtitle: 17,
      lead: 13,
      body: 11,
      caption: 10,
      micro: 9,
      lineHeight: 1.28,
    },
    spacingMm: {
      pageMargin: 13,
      gutter: 6,
      headerHeight: 20,
      footerHeight: 14,
      sectionGap: 7,
    },
    radiusMm: { sm: 2, md: 4.6, lg: 8 },
    stroke: { defaultMm: 0.23, strongMm: 0.42, shadowOpacity: 0.09 },
    background: { mode: "banded", intensity: 0.3 },
    accentUsage: { maxBlocksPerPage: 3, maxTextHighlightPerPage: 2 },
  },
  {
    id: "theme-midnight-galaxy",
    label: "Midnight Galaxy",
    source: "theme-factory",
    tags: ["dramatic", "creative", "dark"],
    colors: {
      canvas: "#ECE9F4",
      page: "#FDFBFF",
      text: "#2B1E3E",
      mutedText: "#54486B",
      border: "#D8D2E7",
      accent: "#4A4E8F",
      accentDeep: "#303266",
      highlight: "#A490C2",
      highlightSoft: "#EEE8F9",
      softAccent: "#E8E4F3",
      softAccentAlt: "#DDD4EE",
      inverseText: "#E6E6FA",
    },
    typography: {
      display: 34,
      title: 26,
      subtitle: 18,
      lead: 14,
      body: 11,
      caption: 10,
      micro: 9,
      lineHeight: 1.28,
    },
    spacingMm: {
      pageMargin: 12,
      gutter: 6,
      headerHeight: 20,
      footerHeight: 14,
      sectionGap: 7,
    },
    radiusMm: { sm: 2.2, md: 5, lg: 8.4 },
    stroke: { defaultMm: 0.24, strongMm: 0.44, shadowOpacity: 0.11 },
    background: { mode: "gradient", intensity: 0.36 },
    accentUsage: { maxBlocksPerPage: 3, maxTextHighlightPerPage: 2 },
  },
  {
    id: "preset-civic-blueprint",
    label: "Civic Blueprint",
    source: "builtin",
    tags: ["report", "structured", "neutral"],
    colors: {
      canvas: "#EEF3F8",
      page: "#FFFFFF",
      text: "#14304A",
      mutedText: "#47637E",
      border: "#C9D5E2",
      accent: "#1F75B7",
      accentDeep: "#124C79",
      highlight: "#5EA6D8",
      highlightSoft: "#E5F2FA",
      softAccent: "#EBF4FB",
      softAccentAlt: "#DDEAF6",
      inverseText: "#F7FBFF",
    },
    typography: {
      display: 34,
      title: 25,
      subtitle: 17,
      lead: 13,
      body: 11,
      caption: 10,
      micro: 9,
      lineHeight: 1.3,
    },
    spacingMm: {
      pageMargin: 13,
      gutter: 6,
      headerHeight: 19,
      footerHeight: 14,
      sectionGap: 7,
    },
    radiusMm: { sm: 1.8, md: 3.8, lg: 6.8 },
    stroke: { defaultMm: 0.23, strongMm: 0.4, shadowOpacity: 0.08 },
    background: { mode: "solid", intensity: 0.22 },
    accentUsage: { maxBlocksPerPage: 3, maxTextHighlightPerPage: 1 },
  },
  {
    id: "preset-paper-grid",
    label: "Paper Grid",
    source: "builtin",
    tags: ["minimal", "editorial", "proposal"],
    colors: {
      canvas: "#F3F2EE",
      page: "#FFFDF8",
      text: "#2E2D2A",
      mutedText: "#61605C",
      border: "#D9D5CC",
      accent: "#8B6F47",
      accentDeep: "#5F4B2F",
      highlight: "#BFA37A",
      highlightSoft: "#F1E7D8",
      softAccent: "#F8F2E9",
      softAccentAlt: "#EFE4D3",
      inverseText: "#FFFDF8",
    },
    typography: {
      display: 32,
      title: 24,
      subtitle: 17,
      lead: 13,
      body: 11,
      caption: 10,
      micro: 9,
      lineHeight: 1.31,
    },
    spacingMm: {
      pageMargin: 14,
      gutter: 6,
      headerHeight: 18,
      footerHeight: 14,
      sectionGap: 7,
    },
    radiusMm: { sm: 1.6, md: 3.2, lg: 6.5 },
    stroke: { defaultMm: 0.22, strongMm: 0.38, shadowOpacity: 0.05 },
    background: { mode: "solid", intensity: 0.12 },
    accentUsage: { maxBlocksPerPage: 2, maxTextHighlightPerPage: 1 },
  },
];

export const STYLE_PRESETS: StylePreset[] = BASE_PRESETS;

const REFERENCE_TAG_MAP: Record<string, string> = {
  warm: "warm",
  orange: "warm",
  sunset: "warm",
  red: "warm",
  cool: "cool",
  blue: "cool",
  frost: "cool",
  tech: "tech",
  ui: "tech",
  app: "tech",
  minimal: "minimal",
  clean: "minimal",
  report: "report",
  chart: "report",
  nature: "nature",
  green: "nature",
  plant: "nature",
  night: "dark",
  dark: "dark",
  galaxy: "dark",
};

function collectReferenceTags(referenceFilenames: string[]): string[] {
  const tagSet = new Set<string>();

  for (const filename of referenceFilenames) {
    const normalized = filename.toLowerCase();
    for (const [keyword, tag] of Object.entries(REFERENCE_TAG_MAP)) {
      if (normalized.includes(keyword)) {
        tagSet.add(tag);
      }
    }
  }

  return [...tagSet];
}

function scorePreset(preset: StylePreset, referenceTags: string[]): number {
  if (referenceTags.length === 0) {
    return 0;
  }

  let score = 0;
  for (const tag of referenceTags) {
    if (preset.tags.includes(tag)) {
      score += 2;
    }
  }
  return score;
}

function uniquePush(list: string[], value: string): void {
  if (!list.includes(value)) {
    list.push(value);
  }
}

function seededStep(seed: number): number {
  const safeSeed = Math.abs(seed) || 1;
  return (safeSeed % 7) + 3;
}

export function selectStylePreset(params: {
  seed: number;
  variantIndex: number;
  requestedPresetId?: string;
  referenceFilenames: string[];
}): StyleSelection {
  if (params.requestedPresetId && STYLE_PRESETS.some((preset) => preset.id === params.requestedPresetId)) {
    return {
      candidatePresetIds: [params.requestedPresetId],
      selectedPresetId: params.requestedPresetId,
      reason: "requested preset",
    };
  }

  const referenceTags = collectReferenceTags(params.referenceFilenames);
  const ordered = [...STYLE_PRESETS].sort((a, b) => {
    const scoreDiff = scorePreset(b, referenceTags) - scorePreset(a, referenceTags);
    if (scoreDiff !== 0) {
      return scoreDiff;
    }
    return a.id.localeCompare(b.id);
  });

  const candidateIds: string[] = [];
  const step = seededStep(params.seed + params.variantIndex);
  let cursor = Math.abs(params.seed + params.variantIndex * 13) % ordered.length;

  while (candidateIds.length < 3 && candidateIds.length < ordered.length) {
    const preset = ordered[cursor % ordered.length];
    if (preset) {
      uniquePush(candidateIds, preset.id);
    }
    cursor += step;
  }

  if (candidateIds.length < 3) {
    for (const preset of ordered) {
      uniquePush(candidateIds, preset.id);
      if (candidateIds.length >= 3) {
        break;
      }
    }
  }

  const selectedPresetId = candidateIds[0] ?? STYLE_PRESETS[0]?.id ?? "theme-ocean-depths";
  const reason = referenceTags.length > 0 ? `reference tags: ${referenceTags.join(", ")}` : "seeded default";

  return {
    candidatePresetIds: candidateIds,
    selectedPresetId,
    reason,
  };
}

export function getStylePresetById(id: string): StylePreset {
  const preset = STYLE_PRESETS.find((item) => item.id === id);
  if (!preset) {
    return STYLE_PRESETS[0];
  }
  return preset;
}

