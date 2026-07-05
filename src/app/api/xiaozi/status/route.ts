import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const PUBLIC_ENDPOINT = "https://os.irec.vn/api/xiaozi/chat";
const PLACEHOLDER_SECRET = "change-me";

// Chỉ trả cấu hình không nhạy cảm (không có API key/secret thật) cho panel
// "Xiaozi Bridge" ở /robot và cho tài liệu docs/XIAOZI_SETUP.md.
export async function GET() {
  let database: "connected" | "error" = "connected";
  try {
    await prisma.conversationSession.count();
  } catch {
    database = "error";
  }

  const secret = process.env.XIAOZI_WEBHOOK_SECRET;
  const authConfigured = Boolean(secret) && secret !== PLACEHOLDER_SECRET;

  return NextResponse.json({
    ok: true,
    endpoint: PUBLIC_ENDPOINT,
    auth: "x-brainos-secret or Bearer token",
    authConfigured,
    providerMode: {
      AI_PROVIDER: process.env.AI_PROVIDER || "local",
      ENABLE_OPENAI_FALLBACK: process.env.ENABLE_OPENAI_FALLBACK === "true",
      OPENAI_ONLY_FOR_COMPLEX: process.env.OPENAI_ONLY_FOR_COMPLEX !== "false",
    },
    database,
    samplePayload: {
      text: "Brain OS là gì",
      deviceId: "xiaozi-robot-1",
      accessLevel: 3,
    },
  });
}
