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
    canvas: "#EAF0F7",
    page: "#FFFFFF",
    text: "#0C1A2C",
    mutedText: "#3F516C",
    border: "#C8D3E5",
    accent: "#1F5EB8",
    accentDeep: "#143E7A",
    softAccent: "#EDF3FF",
    softAccentAlt: "#E7EEF8",
    inverseText: "#F7FAFF",
  },
  spacingMm: {
    pageMargin: 10,
    gutter: 6,
    footerHeight: 12,
    sectionGap: 6,
  },
  fontScalePt: {
    micro: 10,
    caption: 12,
    body: 14,
    lead: 16,
    subtitle: 22,
    title: 34,
    display: 42,
  },
  radiusMm: {
    sm: 2,
    md: 4,
    lg: 7,
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
