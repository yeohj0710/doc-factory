import { createHash } from "node:crypto";

export function sha256Hex(input: string | Buffer | Uint8Array): string {
  return createHash("sha256").update(input).digest("hex");
}

export function sha256HexShort(input: string | Buffer | Uint8Array, length = 12): string {
  const size = Math.max(6, Math.min(length, 64));
  return sha256Hex(input).slice(0, size);
}

export function stableHashFromParts(parts: readonly string[], length = 16): string {
  return sha256HexShort(parts.join("|"), length);
}

