import { promises as fs } from "node:fs";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    filename: string;
  }>;
};

function decodePathSegment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function sanitizeFilename(value: string): string | null {
  const decoded = decodePathSegment(value);
  const normalized = path.posix.normalize(decoded.replace(/\\/g, "/"));

  if (normalized !== path.posix.basename(normalized)) {
    return null;
  }
  if (normalized === "." || normalized === "..") {
    return null;
  }
  return normalized;
}

function detectImageContentType(filename: string): string {
  const extension = path.extname(filename).toLowerCase();
  if (extension === ".png") {
    return "image/png";
  }
  if (extension === ".jpg" || extension === ".jpeg") {
    return "image/jpeg";
  }
  if (extension === ".webp") {
    return "image/webp";
  }
  return "application/octet-stream";
}

export async function GET(_: Request, context: RouteContext): Promise<Response> {
  const { filename: rawFilename } = await context.params;
  const filename = sanitizeFilename(rawFilename);

  if (!filename) {
    return new Response("Invalid filename", { status: 400 });
  }

  const filePath = path.join(process.cwd(), "images", filename);

  try {
    const bytes = await fs.readFile(filePath);

    return new Response(bytes, {
      status: 200,
      headers: {
        "Content-Type": detectImageContentType(filename),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      return new Response("Not found", { status: 404 });
    }
    return new Response("Failed to read image", { status: 500 });
  }
}
