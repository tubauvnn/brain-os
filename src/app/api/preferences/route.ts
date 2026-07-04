import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, err, handleError } from "@/lib/api";

const Schema = z.object({
  profile_id: z.string(),
  key: z.string().min(1),
  value: z.string(),
  group: z.string().optional(),
});

export async function GET() {
  try {
    const profile = await prisma.profile.findFirst();
    if (!profile) return err("Chưa có profile", 404);
    const prefs = await prisma.preference.findMany({ where: { profile_id: profile.id } });
    return ok(prefs);
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = Schema.parse(await req.json());
    const pref = await prisma.preference.upsert({
      where: { profile_id_key: { profile_id: body.profile_id, key: body.key } },
      update: { value: body.value, group: body.group },
      create: body,
    });
    return ok(pref, 201);
  } catch (e) {
    return handleError(e);
  }
}
