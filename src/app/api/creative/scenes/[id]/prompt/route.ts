import { NextRequest } from "next/server";
import { err, handleError, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { buildScenePrompt } from "@/lib/creative";

type Ctx = { params: { id: string } };

// POST /api/creative/scenes/:id/prompt — Prompt Builder: (re)build và lưu
// imagePrompt/negativePrompts cho 1 scene (merge character canon + project
// style + location context + negative prompts — xem
// src/lib/creative/prompt-builder/prompt-builder.ts). Gọi lại nhiều lần sẽ
// GHI ĐÈ prompt cũ — dùng khi muốn làm mới sau khi sửa scene/project.
export async function POST(_: NextRequest, { params }: Ctx) {
  try {
    const scene = await prisma.storyScene.findUnique({ where: { id: params.id }, include: { episode: true } });
    if (!scene) return err("Không tìm thấy scene.", 404);

    const built = await buildScenePrompt(
      {
        description: scene.description,
        characterIds: scene.character_ids,
        locationTag: scene.location_tag ?? "unknown",
        propTags: scene.prop_tags,
      },
      scene.episode.project_id,
    );

    const updated = await prisma.storyScene.update({
      where: { id: scene.id },
      data: { image_prompt: built.prompt, negative_prompts: built.negativePrompts, status: "prompted" },
    });

    return ok({ scene: updated, canonWarnings: built.canonWarnings });
  } catch (e) {
    return handleError(e);
  }
}
