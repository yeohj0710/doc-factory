import type { ScannedFont } from "@/src/io/scanFonts";
import { SYSTEM_FONT_STACK } from "@/src/io/scanFonts";
import type { StylePreset } from "@/src/layout/stylePresets";

export type LayoutTokens = {
  presetId: string;
  presetLabel: string;
  colors: StylePreset["colors"];
  spacingMm: StylePreset["spacingMm"];
  radiusMm: StylePreset["radiusMm"];
  stroke: StylePreset["stroke"];
  background: StylePreset["background"];
  accentUsage: StylePreset["accentUsage"];
  fontScalePt: {
    micro: number;
    caption: number;
    body: number;
    lead: number;
    subtitle: number;
    title: number;
    display: number;
    lineHeight: number;
  };
  font: {
    primary: string;
    fallback: string;
    cssStack: string;
  };
};

function quoteFontFamily(name: string): string {
  return `"${name.replace(/"/g, '\\"')}"`;
}

function readableFontScale(typography: StylePreset["typography"]): LayoutTokens["fontScalePt"] {
  const body = Math.max(12, typography.body);
  const caption = Math.max(10, typography.caption);
  const micro = Math.max(9.5, typography.micro);
  const lead = Math.max(body + 1, typography.lead);
  const subtitle = Math.max(lead + 2, typography.subtitle);
  const title = Math.max(subtitle + 6, typography.title);
  const display = Math.max(title + 7, typography.display);

  return {
    micro,
    caption,
    body,
    lead,
    subtitle,
    title,
    display,
    lineHeight: typography.lineHeight,
  };
}

function pickPrimaryAndFallback(fonts: ScannedFont[]): {
  primary: string;
  fallback: string;
} {
  if (fonts.length === 0) {
    return { primary: "Segoe UI", fallback: "Malgun Gothic" };
  }

  const familyMap = new Map<string, number[]>();
  for (const font of fonts) {
    const weights = familyMap.get(font.familyName) ?? [];
    weights.push(font.weight);
    familyMap.set(font.familyName, weights);
  }

  const families = [...familyMap.entries()];
  families.sort((a, b) => {
    const [familyA, weightsA] = a;
    const [familyB, weightsB] = b;
    const bestWeightA = Math.min(...weightsA.map((weight) => Math.abs(weight - 400)));
    const bestWeightB = Math.min(...weightsB.map((weight) => Math.abs(weight - 400)));

    if (bestWeightA !== bestWeightB) {
      return bestWeightA - bestWeightB;
    }
    if (weightsA.length !== weightsB.length) {
      return weightsB.length - weightsA.length;
    }
    return familyA.localeCompare(familyB, "en", { sensitivity: "base" });
  });

  const primary = families[0]?.[0] ?? "Segoe UI";
  const fallback = families.find(([name]) => name !== primary)?.[0] ?? "Malgun Gothic";
  return { primary, fallback };
}

export function createLayoutTokens(fonts: ScannedFont[], preset: StylePreset): LayoutTokens {
  const { primary, fallback } = pickPrimaryAndFallback(fonts);
  const fontScalePt = readableFontScale(preset.typography);

  const cssStack =
    fonts.length >= 2 && primary !== fallback
      ? `${quoteFontFamily(primary)}, ${quoteFontFamily(fallback)}, ${SYSTEM_FONT_STACK}`
      : fonts.length >= 1
        ? `${quoteFontFamily(primary)}, ${SYSTEM_FONT_STACK}`
        : SYSTEM_FONT_STACK;

  return {
    presetId: preset.id,
    presetLabel: preset.label,
    colors: preset.colors,
    spacingMm: preset.spacingMm,
    radiusMm: preset.radiusMm,
    stroke: preset.stroke,
    background: preset.background,
    accentUsage: preset.accentUsage,
    fontScalePt,
    font: {
      primary,
      fallback,
      cssStack,
    },
  };
}

