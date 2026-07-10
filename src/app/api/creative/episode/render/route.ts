import { NextRequest } from "next/server";
import { z } from "zod";
import { err, handleError, ok } from "@/lib/api";
import { renderEpisode } from "@/lib/creative";

const RenderSchema = z.object({
  projectId: z.string().min(1).optional(),
  episodeId: z.string().min(1, "episodeId không được rỗng"),
  format: z.enum(["vertical", "horizontal", "square"]).default("vertical"),
  resolution: z.string().regex(/^\d+x\d+$/, "resolution phải theo dạng WxH, vd 1080x1920"),
  fps: z.number().int().positive(),
  // Tuỳ chọn, KHÔNG thuộc hợp đồng API gốc (chỉ có projectId/episodeId/
  // format/resolution/fps) — additive field, bỏ qua hoàn toàn không ảnh
  // hưởng hành vi mặc định (không set → render toàn bộ scene như cũ). Dùng
  // để render 1 tập con scene (vd preview/test ngắn) từ 1 episode dài hơn.
  sceneIds: z.array(z.string().min(1)).optional(),
  // Tuỳ chọn, additive — ghi đè tên thư mục episode trong output path (mặc
  // định = episodeId). Dùng cho việc đặt tên thư mục dễ đọc/test cụ thể.
  outputDirName: z.string().min(1).optional(),
});

// POST /api/creative/episode/render — Story JSON (đã có) → scene images (đã
// render qua Render Queue, Phase 4) → character voice MP3 (tổng hợp tại
// đây) → timeline → subtitle → ffmpeg → final MP4. Yêu cầu MỌI scene của
// episode đã có ảnh render sẵn — route KHÔNG tự động enqueue/generate ảnh
// (đó là việc của /api/creative/scenes/:id/render + /render-queue/process,
// Phase 4, không lặp lại ở đây). Chạy đồng bộ (không có hạ tầng job/queue
// nền mới — xem src/lib/creative/renderer/episode-render-service.ts) nên
// response trả về kết quả CUỐI CÙNG luôn, không phải trạng thái "đang chạy"
// để poll.
export async function POST(req: NextRequest) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return err("Body phải là JSON hợp lệ.", 400);
  }

  const parsed = RenderSchema.safeParse(json);
  if (!parsed.success) {
    return err(parsed.error.errors.map((e) => e.message).join(", "), 422);
  }

  const [width, height] = parsed.data.resolution.split("x").map(Number);

  try {
    const result = await renderEpisode({
      episodeId: parsed.data.episodeId,
      projectId: parsed.data.projectId ?? null,
      format: parsed.data.format,
      resolution: { width, height },
      fps: parsed.data.fps,
      sceneIds: parsed.data.sceneIds,
      episodeDirName: parsed.data.outputDirName,
    });

    return ok(
      {
        jobId: result.jobId,
        status: result.status,
        progress: result.progress,
        outputPath: result.outputPath,
        duration: result.duration,
        cost: result.cost,
      },
      result.status === "completed" ? 201 : 502,
    );
  } catch (e) {
    if (e instanceof Error && (e.message.includes("Không tìm thấy episode") || e.message.includes("chưa có scene") || e.message.includes("chưa có ảnh đã render") || e.message.includes("không khớp project"))) {
      return err(e.message, 422);
    }
    return handleError(e);
  }
}
