import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, err, handleError } from "@/lib/api";
import { log } from "@/lib/logger";

const UpdateSchema = z.object({
  name: z.string().min(1).optional(),
  alias: z.string().optional(),
  bio: z.string().optional(),
  avatar_url: z.string().url().optional(),
  timezone: z.string().optional(),
  locale: z.string().optional(),
});

export async function GET() {
  try {
    const profile = await prisma.profile.findFirst({ include: { preferences: true } });
    if (!profile) return err("Chưa có profile", 404);
    return ok(profile);
  } catch (e) {
    return handleError(e);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = UpdateSchema.parse(await req.json());
    const profile = await prisma.profile.findFirst();
    if (!profile) return err("Chưa có profile", 404);
    const updated = await prisma.profile.update({ where: { id: profile.id }, data: body });
    await log({ action: "profile.update", entity: "Profile", entity_id: profile.id });
    return ok(updated);
  } catch (e) {
    return handleError(e);
  }
}
