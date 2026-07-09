import { NextResponse } from "next/server";
import { DeviceManager } from "@/lib/device";

export const dynamic = "force-dynamic";

// GET /api/device-manager/devices — danh sách device mà Device Manager biết
// điều khiển (in-memory, runtime orchestration). KHÔNG phải Physical Device
// Registry (/api/devices, bảng Device/Postgres) — hai endpoint độc lập, xem
// src/lib/device/device-manager.ts.
export async function GET() {
  return NextResponse.json({ devices: DeviceManager.list() });
}
