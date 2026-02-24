import path from "node:path";

type Token =
  | {
      type: "number";
      normalizedDigits: string;
      raw: string;
    }
  | {
      type: "text";
      value: string;
    };

function isDigitCode(code: number): boolean {
  return code >= 48 && code <= 57;
}

function toPosixPath(input: string): string {
  return input.replace(/\\/g, "/");
}

function normalizeTextToken(value: string): string {
  return value.toLowerCase();
}

function normalizeOrderingPath(value: string): string {
  return toPosixPath(value).toLowerCase();
}

function normalizeDigits(rawDigits: string): string {
  const normalized = rawDigits.replace(/^0+/, "");
  return normalized.length > 0 ? normalized : "0";
}

function tokenizeNumericAware(input: string): Token[] {
  const normalized = normalizeOrderingPath(input);
  const tokens: Token[] = [];
  let cursor = 0;

  while (cursor < normalized.length) {
    const code = normalized.charCodeAt(cursor);
    if (isDigitCode(code)) {
      let end = cursor + 1;
      while (end < normalized.length && isDigitCode(normalized.charCodeAt(end))) {
        end += 1;
      }
      const raw = normalized.slice(cursor, end);
      tokens.push({
        type: "number",
        normalizedDigits: normalizeDigits(raw),
        raw,
      });
      cursor = end;
      continue;
    }

    let end = cursor + 1;
    while (end < normalized.length && !isDigitCode(normalized.charCodeAt(end))) {
      end += 1;
    }
    tokens.push({
      type: "text",
      value: normalizeTextToken(normalized.slice(cursor, end)),
    });
    cursor = end;
  }

  return tokens;
}

function compareNumberTokens(a: Extract<Token, { type: "number" }>, b: Extract<Token, { type: "number" }>): number {
  if (a.normalizedDigits.length !== b.normalizedDigits.length) {
    return a.normalizedDigits.length - b.normalizedDigits.length;
  }

  if (a.normalizedDigits !== b.normalizedDigits) {
    return a.normalizedDigits < b.normalizedDigits ? -1 : 1;
  }

  if (a.raw.length !== b.raw.length) {
    return a.raw.length - b.raw.length;
  }

  return 0;
}

function compareTextTokens(a: Extract<Token, { type: "text" }>, b: Extract<Token, { type: "text" }>): number {
  if (a.value === b.value) {
    return 0;
  }
  return a.value < b.value ? -1 : 1;
}

export function compareNumericAwareAscii(left: string, right: string): number {
  if (left === right) {
    return 0;
  }

  const a = tokenizeNumericAware(left);
  const b = tokenizeNumericAware(right);
  const length = Math.min(a.length, b.length);

  for (let index = 0; index < length; index += 1) {
    const tokenA = a[index];
    const tokenB = b[index];
    if (!tokenA || !tokenB) {
      continue;
    }

    if (tokenA.type === tokenB.type) {
      const cmp =
        tokenA.type === "number" && tokenB.type === "number"
          ? compareNumberTokens(tokenA, tokenB)
          : tokenA.type === "text" && tokenB.type === "text"
            ? compareTextTokens(tokenA, tokenB)
            : 0;
      if (cmp !== 0) {
        return cmp;
      }
      continue;
    }

    if (tokenA.type === "number") {
      return -1;
    }
    return 1;
  }

  if (a.length !== b.length) {
    return a.length - b.length;
  }

  const normalizedLeft = normalizeOrderingPath(left);
  const normalizedRight = normalizeOrderingPath(right);
  if (normalizedLeft === normalizedRight) {
    return 0;
  }
  return normalizedLeft < normalizedRight ? -1 : 1;
}

export function parseLeadingOrderNumber(filenameOrPath: string): number | null {
  const basename = path.posix.basename(toPosixPath(filenameOrPath));
  const stem = basename.replace(/\.[^.]+$/, "");

  const patterns = [
    /^\s*0*(\d+)(?=[\s._-]|$)/,
    /^\s*p\s*0*(\d+)(?=[\s._-]|$)/i,
    /^\s*\(\s*0*(\d+)\s*\)(?=[\s._-]|$)/,
  ];

  for (const pattern of patterns) {
    const match = stem.match(pattern);
    if (!match?.[1]) {
      continue;
    }
    const parsed = Number.parseInt(match[1], 10);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return null;
}

export function compareOrderedAssetPath(leftPath: string, rightPath: string): number {
  const leftPosix = normalizeOrderingPath(leftPath);
  const rightPosix = normalizeOrderingPath(rightPath);

  const leftLeading = parseLeadingOrderNumber(leftPosix);
  const rightLeading = parseLeadingOrderNumber(rightPosix);

  if (leftLeading !== null || rightLeading !== null) {
    if (leftLeading === null) {
      return 1;
    }
    if (rightLeading === null) {
      return -1;
    }
    if (leftLeading !== rightLeading) {
      return leftLeading - rightLeading;
    }
  }

  return compareNumericAwareAscii(leftPosix, rightPosix);
}

export function sortByDeterministicAssetOrder<T>(items: readonly T[], getPath: (item: T) => string): T[] {
  return [...items].sort((left, right) => compareOrderedAssetPath(getPath(left), getPath(right)));
}

export function normalizeRelativePosixPath(value: string): string {
  return toPosixPath(value);
}
