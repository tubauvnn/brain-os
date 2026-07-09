import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Health check nhẹ cho Brain OS — chỉ xác nhận API process còn sống.
// Không kiểm tra DB ở đây, dùng /api/health/db cho việc đó.
export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "Brain OS",
    phase: 1,
    version: "v1",
    timestamp: new Date().toISOString(),
    uptime: `${Math.floor(process.uptime())}s`,
    checks: {
      api: "ok",
    },
  });
}
