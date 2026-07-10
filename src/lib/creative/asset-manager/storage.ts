import path from "node:path";
import fs from "node:fs";
import { randomUUID } from "node:crypto";

// Lưu trong public/ — cùng lý do voice audio (src/lib/voice/storage.ts, Phase
// 1, KHÔNG sửa): ảnh minh hoạ sinh cho 1 episode không phải dữ liệu riêng tư
// cần kiểm soát truy cập như MediaFile (ảnh camera cá nhân), và cần 1 URL
// Next.js serve trực tiếp được (<img src="...">) mà không cần route serve
// bytes riêng. Thư mục này đã nằm trong /public/generated/ (đã gitignore).
const CREATIVE_IMAGE_DIR = path.join(process.cwd(), "public", "generated", "images");

function ensureDir(): void {
  fs.mkdirSync(CREATIVE_IMAGE_DIR, { recursive: true });
}

const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export function saveGeneratedImage(buffer: Buffer, mimeType: string): { url: string; relativePath: string } {
  ensureDir();
  const ext = EXT_BY_MIME[mimeType] ?? "bin";
  const filename = `${randomUUID()}.${ext}`;
  const absolutePath = path.join(CREATIVE_IMAGE_DIR, filename);
  fs.writeFileSync(absolutePath, buffer);
  return {
    url: `/generated/images/${filename}`,
    relativePath: path.join("public", "generated", "images", filename),
  };
}

// GeneratedAsset.path lưu đường dẫn fs-relative (giống MediaFile.path,
// src/lib/media.ts) — hàm này suy ra lại URL public phục vụ khi trả API,
// không lưu 2 cột trùng dữ liệu trong DB.
export function publicUrlForPath(relativePath: string): string {
  return `/${relativePath.replace(/^public[/\\]/, "").split(path.sep).join("/")}`;
}
