import path from "node:path";
import PptxGenJS from "pptxgenjs";
import { resolveCoverCropWindow, resolveImagePlacement } from "@/src/layout/imagePlacement";
import { mmToIn, mmToPt } from "@/src/layout/pageSize";
import type { Element, PageLayout } from "@/src/layout/types";

export type RenderPptxOptions = {
  primaryFont: string;
  rootDir?: string;
  subject?: string;
  title?: string;
};

function toHex(color: string): string {
  return color.replace(/^#/, "").toUpperCase();
}

function opacityToTransparency(opacity: number | undefined): number | undefined {
  if (typeof opacity !== "number" || Number.isNaN(opacity)) {
    return undefined;
  }
  const clamped = Math.min(Math.max(opacity, 0), 1);
  return Math.round((1 - clamped) * 100);
}

function decodePathValue(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function sanitizeFilename(rawValue: string): string {
  const decoded = decodePathValue(rawValue);
  const normalized = path.posix.normalize(decoded.replace(/\\/g, "/"));

  if (normalized !== path.posix.basename(normalized)) {
    throw new Error(`Invalid filename: ${rawValue}`);
  }
  if (normalized === "." || normalized === "..") {
    throw new Error(`Invalid filename: ${rawValue}`);
  }
  return normalized;
}

function resolvePublicPath(srcPublicPath: string, rootDir: string): string {
  const decoded = decodePathValue(srcPublicPath);
  const relativePosix = path.posix.normalize(decoded.replace(/^\/+/, ""));

  if (relativePosix.startsWith("..")) {
    throw new Error(`Invalid image path: ${srcPublicPath}`);
  }

  const imageApiPrefix = "api/assets/images/";
  if (relativePosix.startsWith(imageApiPrefix)) {
    const filename = sanitizeFilename(relativePosix.slice(imageApiPrefix.length));
    return path.join(rootDir, "images", filename);
  }

  return path.join(rootDir, "public", ...relativePosix.split("/"));
}

function addElement(
  pptx: PptxGenJS,
  slide: PptxGenJS.Slide,
  element: Element,
  rootDir: string,
  primaryFont: string,
): void {
  if (element.type === "image") {
    const frame = {
      x: mmToIn(element.xMm),
      y: mmToIn(element.yMm),
      w: mmToIn(element.wMm),
      h: mmToIn(element.hMm),
    };

    const pathOnDisk = resolvePublicPath(element.srcPublicPath, rootDir);

    try {
      const placement = resolveImagePlacement(element);
      if (placement && element.fit === "cover") {
        const cropWindow = resolveCoverCropWindow(element, placement);
        if (cropWindow) {
          slide.addImage({
            path: pathOnDisk,
            x: mmToIn(element.xMm),
            y: mmToIn(element.yMm),
            w: mmToIn(placement.wMm),
            h: mmToIn(placement.hMm),
            sizing: {
              type: "crop",
              x: mmToIn(cropWindow.xMm),
              y: mmToIn(cropWindow.yMm),
              w: mmToIn(cropWindow.wMm),
              h: mmToIn(cropWindow.hMm),
            },
          });
          return;
        }
      }

      if (placement) {
        slide.addImage({
          path: pathOnDisk,
          x: mmToIn(placement.xMm),
          y: mmToIn(placement.yMm),
          w: mmToIn(placement.wMm),
          h: mmToIn(placement.hMm),
        });
        return;
      }

      slide.addImage({
        path: pathOnDisk,
        ...frame,
        sizing: {
          type: element.fit,
          x: 0,
          y: 0,
          w: frame.w,
          h: frame.h,
        },
      });
      return;
    } catch {
      slide.addShape(pptx.ShapeType.rect, {
        ...frame,
        fill: { color: "F2F4F8" },
        line: { color: "CBD3E0" },
      });
      slide.addText("Image unavailable", {
        ...frame,
        fontFace: primaryFont,
        fontSize: 11,
        align: "center",
        valign: "middle",
        color: "4D5F7A",
      });
      return;
    }
  }

  if (element.type === "text") {
    slide.addText(element.text, {
      x: mmToIn(element.xMm),
      y: mmToIn(element.yMm),
      w: mmToIn(element.wMm),
      h: mmToIn(element.hMm),
      fontFace: primaryFont,
      fontSize: element.fontSizePt,
      bold: element.bold ?? false,
      align: element.align ?? "left",
      valign: "top",
      margin: 0,
      color: toHex(element.color ?? "#10213A"),
    });
    return;
  }

  if (element.type === "rect") {
    const fillTransparency = opacityToTransparency(element.fillOpacity);

    slide.addShape(
      element.radiusMm && element.radiusMm > 0 ? pptx.ShapeType.roundRect : pptx.ShapeType.rect,
      {
        x: mmToIn(element.xMm),
        y: mmToIn(element.yMm),
        w: mmToIn(element.wMm),
        h: mmToIn(element.hMm),
        fill:
          fillTransparency === undefined
            ? { color: toHex(element.fill) }
            : { color: toHex(element.fill), transparency: fillTransparency },
        line: element.stroke
          ? {
              color: toHex(element.stroke),
              pt: mmToPt(element.strokeWidthMm ?? 0.25),
            }
          : { color: toHex(element.fill), transparency: 100 },
      },
    );
    return;
  }

  const dxMm = element.x2Mm - element.x1Mm;
  const dyMm = element.y2Mm - element.y1Mm;
  const lengthMm = Math.max(Math.sqrt(dxMm * dxMm + dyMm * dyMm), 0.01);
  const angleDeg = (Math.atan2(dyMm, dxMm) * 180) / Math.PI;

  slide.addShape(pptx.ShapeType.line, {
    x: mmToIn(element.x1Mm),
    y: mmToIn(element.y1Mm),
    w: mmToIn(lengthMm),
    h: 0.001,
    rotate: angleDeg,
    line: {
      color: toHex(element.stroke),
      pt: mmToPt(element.widthMm),
    },
  });
}

export async function renderLayoutsToPptx(
  pages: PageLayout[],
  options: RenderPptxOptions,
): Promise<Uint8Array> {
  const rootDir = options.rootDir ?? process.cwd();
  const pptx = new PptxGenJS();

  const firstPage = pages[0];
  const widthMm = firstPage?.widthMm ?? 210;
  const heightMm = firstPage?.heightMm ?? 297;
  const layoutName = `DOC_FACTORY_${widthMm.toFixed(1)}x${heightMm.toFixed(1)}`;

  pptx.defineLayout({
    name: layoutName,
    width: mmToIn(widthMm),
    height: mmToIn(heightMm),
  });

  pptx.layout = layoutName;
  pptx.author = "doc-factory";
  pptx.subject = options.subject ?? "Editable visual document";
  pptx.title = options.title ?? "visual-document";

  for (const page of pages) {
    const slide = pptx.addSlide();
    slide.background = { color: "FFFFFF" };
    for (const element of page.elements) {
      addElement(pptx, slide, element, rootDir, options.primaryFont);
    }
  }

  const arrayBuffer = (await pptx.write({ outputType: "arraybuffer" })) as ArrayBuffer;
  return new Uint8Array(arrayBuffer);
}
