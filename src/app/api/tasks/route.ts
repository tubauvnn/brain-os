import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, handleError } from "@/lib/api";
import { log } from "@/lib/logger";

const CreateSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(["todo", "in_progress", "done", "cancelled"]).default("todo"),
  priority: z.number().int().min(1).max(4).default(2),
  project_id: z.string().optional(),
  parent_id: z.string().optional(),
  due_date: z.string().datetime().optional(),
  tags: z.array(z.string()).default([]),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const project_id = searchParams.get("project_id");
    const status = searchParams.get("status");

    const tasks = await prisma.task.findMany({
      where: {
        ...(project_id ? { project_id } : {}),
        ...(status ? { status: status as "todo" | "in_progress" | "done" | "cancelled" } : {}),
      },
      orderBy: [{ priority: "desc" }, { created_at: "desc" }],
      include: { project: true, subtasks: true },
    });
    return ok(tasks);
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = CreateSchema.parse(await req.json());
    const task = await prisma.task.create({
      data: {
        ...body,
        due_date: body.due_date ? new Date(body.due_date) : undefined,
      },
    });
    await log({ action: "task.create", entity: "Task", entity_id: task.id });
    return ok(task, 201);
  } catch (e) {
    return handleError(e);
  }
}
