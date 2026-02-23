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
    softAccent: string;
  };
  spacingMm: {
    pageMargin: number;
    gutter: number;
    footerHeight: number;
    sectionGap: number;
  };
  fontScalePt: {
    caption: number;
    body: number;
    subtitle: number;
    title: number;
  };
  radiusMm: {
    sm: number;
    md: number;
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
    text: "#0F1F3A",
    mutedText: "#4F5F78",
    border: "#D2DCEC",
    accent: "#245AD9",
    softAccent: "#EDF3FF",
  },
  spacingMm: {
    pageMargin: 12,
    gutter: 7,
    footerHeight: 12,
    sectionGap: 8,
  },
  fontScalePt: {
    caption: 10,
    body: 11,
    subtitle: 15,
    title: 24,
  },
  radiusMm: {
    sm: 2,
    md: 4,
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
