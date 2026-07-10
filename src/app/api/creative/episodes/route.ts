import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, err, handleError } from "@/lib/api";
import { createEpisode, listEpisodes } from "@/lib/creative";

const CreateSchema = z.object({
  topic: z.string().min(1, "topic không được rỗng"),
  projectId: z.string().min(1).optional(),
});

// POST /api/creative/episodes — Story Agent → Scene Planner → persist. Có
// thể tốn 1 lượt gọi OpenAI Chat Completions thật (qua Model Router, Phase
// 1/3, không sửa) — KHÔNG sinh ảnh ở bước này (xem
// scenes/[id]/render, render-queue/process).
export async function POST(req: NextRequest) {
  try {
    const body = CreateSchema.parse(await req.json());
    const result = await createEpisode(body.topic, body.projectId ?? null);
    if (!result.success) return err(result.error, 502);
    return ok(result.episode, 201);
  } catch (e) {
    return handleError(e);
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId") ?? undefined;
    const episodes = await listEpisodes(projectId);
    return ok(episodes);
  } catch (e) {
    return handleError(e);
  }
}
