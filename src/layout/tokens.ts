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
    canvas: "#E6ECF6",
    page: "#FFFFFF",
    text: "#0F1C2F",
    mutedText: "#425068",
    border: "#C5D1E3",
    accent: "#0E6AA8",
    accentDeep: "#0A3C66",
    highlight: "#D86A1D",
    highlightSoft: "#FFE7D3",
    softAccent: "#EAF3FF",
    softAccentAlt: "#F7F1E7",
    inverseText: "#F6FAFF",
  },
  spacingMm: {
    pageMargin: 12,
    gutter: 7,
    footerHeight: 12,
    sectionGap: 8,
  },
  fontScalePt: {
    micro: 11,
    caption: 14,
    body: 16,
    lead: 20,
    subtitle: 28,
    title: 38,
    display: 54,
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

export function createLayoutTokens(fonts: ScannedFont[]): LayoutTokens {
  const primary = fonts[0]?.familyName ?? "Segoe UI";
  const fallback = fonts[1]?.familyName ?? "Arial";

  const cssStack =
    fonts.length >= 2
      ? `${quoteFontFamily(primary)}, ${quoteFontFamily(fallback)}, ${SYSTEM_FONT_STACK}`
      : fonts.length === 1
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
