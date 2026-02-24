import type { ScannedFont } from "@/src/io/scanFonts";
import { SYSTEM_FONT_STACK } from "@/src/io/scanFonts";

export type LayoutTokens = {
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
  spacingMm: {
    pageMargin: number;
    gutter: number;
    footerHeight: number;
    sectionGap: number;
  };
  fontScalePt: {
    micro: number;
    caption: number;
    body: number;
    lead: number;
    subtitle: number;
    title: number;
    display: number;
  };
  radiusMm: {
    sm: number;
    md: number;
    lg: number;
  };
  font: {
    primary: string;
    fallback: string;
    cssStack: string;
  };
};

const BASE_TOKENS = {
  colors: {
    canvas: "#E9EFF7",
    page: "#FFFFFF",
    text: "#102037",
    mutedText: "#445672",
    border: "#C4D0E2",
    accent: "#0E6AA8",
    accentDeep: "#0A3E69",
    highlight: "#D67223",
    highlightSoft: "#FFEAD7",
    softAccent: "#EAF3FF",
    softAccentAlt: "#F6F1E8",
    inverseText: "#F7FBFF",
  },
  spacingMm: {
    pageMargin: 12,
    gutter: 6,
    footerHeight: 12,
    sectionGap: 7,
  },
  fontScalePt: {
    micro: 9.5,
    caption: 10.5,
    body: 11.5,
    lead: 13.5,
    subtitle: 18,
    title: 24,
    display: 34,
  },
  radiusMm: {
    sm: 2,
    md: 5,
    lg: 8,
  },
} as const;

function quoteFontFamily(name: string): string {
  return `"${name.replace(/"/g, '\\"')}"`;
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
  const secondFamily = families.find(([name]) => name !== primary)?.[0];
  return {
    primary,
    fallback: secondFamily ?? "Malgun Gothic",
  };
}

export function createLayoutTokens(fonts: ScannedFont[]): LayoutTokens {
  const { primary, fallback } = pickPrimaryAndFallback(fonts);

  const cssStack =
    fonts.length >= 2 && primary !== fallback
      ? `${quoteFontFamily(primary)}, ${quoteFontFamily(fallback)}, ${SYSTEM_FONT_STACK}`
      : fonts.length >= 1
        ? `${quoteFontFamily(primary)}, ${SYSTEM_FONT_STACK}`
      : SYSTEM_FONT_STACK;

  return {
    ...BASE_TOKENS,
    font: {
      primary,
      fallback,
      cssStack,
    },
  };
}
