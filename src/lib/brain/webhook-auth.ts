import type { NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";

// Bảo vệ webhook public /api/xiaozi/chat bằng secret token — xem docs/XIAOZI_SETUP.md.
//
// Lưu ý quan trọng (khác 1 chút so với đặc tả gốc "bypass nếu NODE_ENV=development"):
// app này hiện chạy bằng `next dev` ngay cả cho endpoint public (chưa tách
// build production riêng), nghĩa là NODE_ENV luôn là "development" kể cả với
// request đi qua domain public — nếu bypass thẳng theo NODE_ENV thì auth coi
// như vô tác dụng với request public thật. Nên bypass ở đây chỉ dựa vào
// "request có phải gọi tới localhost/127.0.0.1 không" (đúng tinh thần "cho
// test nội bộ", nhưng vẫn đảm bảo request qua domain public luôn cần secret).

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 60;

const rateLimitBuckets = new Map<string, { count: number; windowStart: number }>();

export function getClientIp(req: NextRequest): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  // `req.ip` chỉ có giá trị trên môi trường edge/Vercel — self-host (VPS này)
  // luôn undefined, dựa vào x-forwarded-for/x-real-ip (do NPM set) là chính.
  return req.ip || "unknown";
}

function isLocalRequest(req: NextRequest): boolean {
  const host = (req.headers.get("host") || "").split(":")[0];
  if (host === "127.0.0.1" || host === "localhost" || host === "::1") return true;
  const ip = getClientIp(req);
  return ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
}

function secretsMatch(provided: string, configured: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(configured);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function verifyXiaoziWebhook(
  req: NextRequest,
  body: Record<string, unknown>
): { ok: boolean; reason?: string } {
  if (isLocalRequest(req)) return { ok: true };

  const configuredSecret = process.env.XIAOZI_WEBHOOK_SECRET;
  if (!configuredSecret) {
    // Chưa cấu hình secret thật -> luôn từ chối request public (fail closed),
    // không được coi "thiếu secret ở cả 2 phía" là hợp lệ.
    return { ok: false, reason: "Unauthorized Xiaozi webhook" };
  }

  const headerSecret = req.headers.get("x-brainos-secret");
  const authHeader = req.headers.get("authorization");
  const bearerSecret =
    authHeader && authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : null;
  const bodySecret = typeof body.secret === "string" ? body.secret : null;

  const provided = headerSecret || bearerSecret || bodySecret;
  if (!provided || !secretsMatch(provided, configuredSecret)) {
    return { ok: false, reason: "Unauthorized Xiaozi webhook" };
  }
  return { ok: true };
}

// Rate limit đơn giản in-memory (không Redis, đủ cho MVP 1 tiến trình) — cửa sổ
// trượt thô 60s/key, key nên là deviceId (ổn định hơn IP sau NAT/proxy dùng
// chung IP). Map không tự dọn entry cũ — chấp nhận được ở quy mô MVP 1 VPS,
// cần revisit nếu số lượng deviceId/IP riêng biệt tăng lớn.
export function simpleRateLimit(key: string): boolean {
  const now = Date.now();
  const bucket = rateLimitBuckets.get(key);

  if (!bucket || now - bucket.windowStart >= RATE_LIMIT_WINDOW_MS) {
    rateLimitBuckets.set(key, { count: 1, windowStart: now });
    return true;
  }

  bucket.count += 1;
  return bucket.count <= RATE_LIMIT_MAX;
}
