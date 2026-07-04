import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

export function err(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export function handleError(e: unknown) {
  if (e instanceof ZodError) {
    return err(e.errors.map((x) => x.message).join(", "), 422);
  }
  if (e instanceof Error) return err(e.message, 500);
  return err("Lỗi không xác định", 500);
}
