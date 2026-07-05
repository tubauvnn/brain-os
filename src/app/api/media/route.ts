import { NextRequest } from "next/server";
import { MediaSourceType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ok, handleError } from "@/lib/api";

export const dynamic = "force-dynamic";

const SOURCE_TYPES = new Set(Object.values(MediaSourceType));

function parseSourceType(value: string | null): MediaSourceType | undefined {
  return value && SOURCE_TYPES.has(value as MediaSourceType) ? (value as MediaSourceType) : undefined;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const source_type = parseSourceType(searchParams.get("source_type"));
    const device_id = searchParams.get("device_id") ?? undefined;
    const project_id = searchParams.get("project_id") ?? undefined;
    const person_id = searchParams.get("person_id") ?? undefined;
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200);

    const items = await prisma.mediaFile.findMany({
      where: {
        ...(source_type ? { source_type } : {}),
        ...(device_id ? { device_id } : {}),
        ...(project_id ? { project_id } : {}),
        ...(person_id ? { person_id } : {}),
      },
      orderBy: { created_at: "desc" },
      take: limit,
    });

    return ok(items);
  } catch (e) {
    return handleError(e);
  }
}
