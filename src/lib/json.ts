import { Prisma } from "@prisma/client";

export function toJsonValue(
  value: Record<string, unknown> | undefined
): Prisma.InputJsonValue | undefined {
  return value as Prisma.InputJsonValue | undefined;
}
