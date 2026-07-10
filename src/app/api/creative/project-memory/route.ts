import { NextRequest } from "next/server";
import { err, handleError, ok } from "@/lib/api";
import { getProjectCreativeMemory } from "@/lib/creative";

// GET /api/creative/project-memory?projectId=... — Project Memory: địa
// điểm/đạo cụ/nhân vật/asset đã "nhớ" cho project đó (xem
// src/lib/creative/project-memory/project-memory.ts). projectId là id của
// Project JSON (Phase 7, src/lib/project/), không phải model Project SQL.
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    if (!projectId) return err("Thiếu query param projectId.", 422);
    const memory = await getProjectCreativeMemory(projectId);
    return ok(memory);
  } catch (e) {
    return handleError(e);
  }
}
