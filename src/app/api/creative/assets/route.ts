import { NextRequest } from "next/server";
import { handleError, ok } from "@/lib/api";
import { listAssets, publicUrlForPath } from "@/lib/creative";

// GET /api/creative/assets — Asset Manager: liệt kê GeneratedAsset, lọc theo
// projectId/locationTag/sceneId. Trả kèm `url` (suy ra từ `path` lưu trong
// DB, xem src/lib/creative/asset-manager/storage.ts) để client render ảnh
// trực tiếp.
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId") ?? undefined;
    const locationTag = searchParams.get("locationTag") ?? undefined;
    const sceneId = searchParams.get("sceneId") ?? undefined;
    const assets = await listAssets({ projectId, locationTag, sceneId });
    return ok(assets.map((a) => ({ ...a, url: publicUrlForPath(a.path) })));
  } catch (e) {
    return handleError(e);
  }
}
