import type { ImageElement } from "@/src/layout/types";

export type PositionedImage = {
  xMm: number;
  yMm: number;
  wMm: number;
  hMm: number;
};

export type CropWindow = {
  xMm: number;
  yMm: number;
  wMm: number;
  hMm: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function resolveAnchor(anchor: number | undefined): number {
  if (typeof anchor !== "number" || Number.isNaN(anchor)) {
    return 0.5;
  }
  return clamp(anchor, 0, 1);
}

export function resolveImagePlacement(element: ImageElement): PositionedImage | null {
  const imageWidthPx = element.intrinsicWidthPx ?? 0;
  const imageHeightPx = element.intrinsicHeightPx ?? 0;

  if (imageWidthPx <= 0 || imageHeightPx <= 0 || element.wMm <= 0 || element.hMm <= 0) {
    return null;
  }

  const frameRatio = element.wMm / element.hMm;
  const imageRatio = imageWidthPx / imageHeightPx;
  const useHeight =
    element.fit === "cover" ? imageRatio > frameRatio : imageRatio < frameRatio;

  const renderedWidthMm = useHeight ? element.hMm * imageRatio : element.wMm;
  const renderedHeightMm = useHeight ? element.hMm : element.wMm / imageRatio;

  const overflowX = renderedWidthMm - element.wMm;
  const overflowY = renderedHeightMm - element.hMm;
  const anchorX = resolveAnchor(element.anchorX);
  const anchorY = resolveAnchor(element.anchorY);

  return {
    xMm: element.xMm - overflowX * anchorX,
    yMm: element.yMm - overflowY * anchorY,
    wMm: renderedWidthMm,
    hMm: renderedHeightMm,
  };
}

export function resolveCoverCropWindow(
  element: ImageElement,
  placementInput?: PositionedImage,
): CropWindow | null {
  if (element.fit !== "cover") {
    return null;
  }

  const placement = placementInput ?? resolveImagePlacement(element);
  if (!placement) {
    return null;
  }

  const cropX = clamp(element.xMm - placement.xMm, 0, Math.max(placement.wMm - 0.01, 0));
  const cropY = clamp(element.yMm - placement.yMm, 0, Math.max(placement.hMm - 0.01, 0));
  const maxCropW = placement.wMm - cropX;
  const maxCropH = placement.hMm - cropY;

  if (maxCropW <= 0 || maxCropH <= 0) {
    return null;
  }

  return {
    xMm: cropX,
    yMm: cropY,
    wMm: clamp(element.wMm, 0.01, maxCropW),
    hMm: clamp(element.hMm, 0.01, maxCropH),
  };
}
