import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { ALLOWED_IMAGE_MIME_TYPES, MEDIA_UPLOAD_DIR, ensureMediaDir, generateMediaFilename, mediaRelativePath } from "@/lib/media";

// Vision Temp Store — Phase 6C. KHÔNG phải kho lưu trữ mới: dùng lại NGUYÊN
// bảng MediaFile + uploads/media/ đã có sẵn (src/lib/media.ts, cùng route
// /api/media/upload dùng) — chỉ thêm 1 QUY ƯỚC metadata (`temporary: true`,
// `expiresAt`, `sessionId`) để phân biệt "ảnh vision tạm" với ảnh lưu vĩnh
// viễn khác (Creative Studio assets, face enrollment...). Không có cron/
// background worker trong deployment này — dọn dẹp bằng "lazy sweep": mỗi
// lần route vision gọi tới đây, các bản ghi hết hạn bị xoá luôn (đủ dùng cho
// quy mô cá nhân, không cần job riêng).
//
// access_level giữ mặc định 3 (owner_only, riêng tư) — KHÔNG serve qua
// public/, ảnh không bao giờ có URL công khai (Phase 6C mục 9).

const DEFAULT_RETENTION_MS = 30 * 60 * 1000; // 30 phút — đủ cho 1 phiên demo, cấu hình qua env
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB, Phase 6C mục 2B

function retentionMs(): number {
  const raw = process.env.ROBOT_VISION_RETENTION_MS;
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_RETENTION_MS;
}

export type TempImageMetadata = {
  temporary: true;
  expiresAt: string;
  sessionId?: string;
  captureOrigin: "camera" | "upload";
};

export type TempImageRecord = {
  id: string;
  filename: string;
  mimeType: string;
  path: string;
  createdAt: Date;
  expiresAt: Date;
  sessionId?: string;
};

function isMediaFileTemp(m: { metadata: unknown }): m is { metadata: TempImageMetadata } {
  const meta = m.metadata as Partial<TempImageMetadata> | null;
  return !!meta && meta.temporary === true && typeof meta.expiresAt === "string";
}

function toTempRecord(m: { id: string; filename: string; mime_type: string; path: string; created_at: Date; metadata: unknown }): TempImageRecord | null {
  if (!isMediaFileTemp(m)) return null;
  return {
    id: m.id,
    filename: m.filename,
    mimeType: m.mime_type,
    path: m.path,
    createdAt: m.created_at,
    expiresAt: new Date(m.metadata.expiresAt),
    sessionId: m.metadata.sessionId,
  };
}

async function deleteMediaFileAndBytes(id: string, relativePath: string): Promise<void> {
  try {
    await prisma.mediaFile.delete({ where: { id } });
  } catch {
    // đã xoá rồi/không tồn tại — bỏ qua
  }
  try {
    fs.unlinkSync(path.join(process.cwd(), relativePath));
  } catch {
    // file không còn/đã xoá — bỏ qua, không chặn flow
  }
}

// Dọn các bản ghi vision-temp đã hết hạn (source_type "camera"/"upload" +
// metadata.temporary=true + expiresAt < now). Gọi ở đầu mỗi route vision.
export async function sweepExpiredTempImages(): Promise<number> {
  const candidates = await prisma.mediaFile.findMany({
    where: { source_type: { in: ["camera", "upload"] } },
    orderBy: { created_at: "desc" },
    take: 200,
    select: { id: true, path: true, metadata: true },
  });

  const now = Date.now();
  let deleted = 0;
  for (const m of candidates) {
    const meta = m.metadata as Partial<TempImageMetadata> | null;
    if (meta?.temporary === true && meta.expiresAt && new Date(meta.expiresAt).getTime() < now) {
      await deleteMediaFileAndBytes(m.id, m.path);
      deleted += 1;
    }
  }
  return deleted;
}

export type CreateTempImageInput = {
  buffer: Buffer;
  mimeType: string;
  originalName: string;
  captureOrigin: "camera" | "upload";
  sessionId?: string;
};

export async function createTempImage(input: CreateTempImageInput): Promise<TempImageRecord> {
  if (!ALLOWED_IMAGE_MIME_TYPES[input.mimeType]) {
    throw new Error(`Định dạng ảnh không hỗ trợ: ${input.mimeType || "unknown"}`);
  }
  if (input.buffer.length > MAX_IMAGE_BYTES) {
    throw new Error(`Ảnh vượt quá ${MAX_IMAGE_BYTES / (1024 * 1024)}MB.`);
  }

  ensureMediaDir();
  const filename = generateMediaFilename(input.mimeType);
  fs.writeFileSync(path.join(MEDIA_UPLOAD_DIR, filename), input.buffer);

  const metadata: TempImageMetadata = {
    temporary: true,
    expiresAt: new Date(Date.now() + retentionMs()).toISOString(),
    sessionId: input.sessionId,
    captureOrigin: input.captureOrigin,
  };

  const media = await prisma.mediaFile.create({
    data: {
      filename,
      original_name: input.originalName,
      mime_type: input.mimeType,
      size: input.buffer.length,
      path: mediaRelativePath(filename),
      source_type: input.captureOrigin,
      access_level: 3,
      metadata,
    },
  });

  const record = toTempRecord(media);
  if (!record) throw new Error("Không tạo được bản ghi ảnh tạm.");
  return record;
}

// Trả null nếu không tồn tại/đã hết hạn (và TỰ xoá luôn nếu hết hạn — lazy
// cleanup) — caller (route analyze) coi null là "ảnh không còn, yêu cầu gửi
// lại", không phải lỗi hệ thống.
export async function getTempImage(id: string): Promise<TempImageRecord | null> {
  const media = await prisma.mediaFile.findUnique({ where: { id } });
  if (!media) return null;
  const record = toTempRecord(media);
  if (!record) return null;
  if (record.expiresAt.getTime() < Date.now()) {
    await deleteMediaFileAndBytes(media.id, media.path);
    return null;
  }
  return record;
}

export function readTempImageBytes(record: TempImageRecord): Buffer {
  return fs.readFileSync(path.join(process.cwd(), record.path));
}

// N ảnh vision-temp gần nhất, còn hạn, cùng sessionId (nếu có) — dùng cho
// mode "compare_with_previous" (Phase 6C mục 5, test E: "2 ảnh tạm gần nhất").
export async function getRecentTempImages(opts: { sessionId?: string; excludeId?: string; limit: number }): Promise<TempImageRecord[]> {
  const candidates = await prisma.mediaFile.findMany({
    where: { source_type: { in: ["camera", "upload"] } },
    orderBy: { created_at: "desc" },
    take: 50,
    select: { id: true, filename: true, mime_type: true, path: true, created_at: true, metadata: true },
  });

  const now = Date.now();
  const result: TempImageRecord[] = [];
  for (const m of candidates) {
    const record = toTempRecord(m);
    if (!record) continue;
    if (record.expiresAt.getTime() < now) continue;
    if (opts.excludeId && record.id === opts.excludeId) continue;
    if (opts.sessionId && record.sessionId !== opts.sessionId) continue;
    result.push(record);
    if (result.length >= opts.limit) break;
  }
  return result;
}

// Bỏ cờ "temporary" — dùng khi user xác nhận muốn lưu ảnh lâu dài (Phase 6C
// mục 8: "explicit user request"/"confirmed important project asset"...).
// Ảnh này từ đây trở đi KHÔNG còn bị lazy-sweep xoá nữa. Trả boolean (không
// phải TempImageRecord — record đó theo định nghĩa CHỈ tồn tại khi
// temporary=true, xem toTempRecord/isMediaFileTemp, nên không dùng lại được
// ở đây để báo "đã promote thành công").
export async function promoteTempImage(id: string, projectId?: string): Promise<boolean> {
  const existing = await prisma.mediaFile.findUnique({ where: { id } });
  if (!existing) return false;
  const meta = existing.metadata as Partial<TempImageMetadata> | null;
  if (!meta?.temporary) return true; // đã là permanent rồi

  await prisma.mediaFile.update({
    where: { id },
    data: {
      project_id: projectId,
      metadata: { ...meta, temporary: false },
    },
  });
  return true;
}

// Xoá 1 ảnh tạm theo yêu cầu người dùng (nút "Remove image"/DELETE endpoint)
// — CHỈ xoá nếu vẫn còn cờ temporary=true (không cho xoá nhầm ảnh đã lưu
// vĩnh viễn qua route này).
export async function deleteTempImage(id: string): Promise<boolean> {
  const media = await prisma.mediaFile.findUnique({ where: { id } });
  if (!media) return false;
  const meta = media.metadata as Partial<TempImageMetadata> | null;
  if (!meta?.temporary) return false;
  await deleteMediaFileAndBytes(media.id, media.path);
  return true;
}
