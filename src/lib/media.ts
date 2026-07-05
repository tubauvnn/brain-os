import path from "node:path";
import fs from "node:fs";
import { randomUUID } from "node:crypto";

// Lưu ngoài public/ vì MediaFile mặc định access_level=3 (owner_only) —
// không muốn Next.js serve file tĩnh công khai không qua kiểm soát.
export const MEDIA_UPLOAD_DIR = path.join(process.cwd(), "uploads", "media");

export const ALLOWED_IMAGE_MIME_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export function ensureMediaDir(): void {
  fs.mkdirSync(MEDIA_UPLOAD_DIR, { recursive: true });
}

export function generateMediaFilename(mimeType: string): string {
  const ext = ALLOWED_IMAGE_MIME_TYPES[mimeType] ?? "bin";
  return `${randomUUID()}.${ext}`;
}

export function mediaRelativePath(filename: string): string {
  return path.join("uploads", "media", filename);
}
