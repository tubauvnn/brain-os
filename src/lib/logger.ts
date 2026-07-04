import { prisma } from "./prisma";
import { toJsonValue } from "./json";

type LogParams = {
  action: string;
  entity?: string;
  entity_id?: string;
  actor?: string;
  device_id?: string;
  payload?: Record<string, unknown>;
  ip_address?: string;
};

export async function log(params: LogParams) {
  try {
    await prisma.activityLog.create({
      data: {
        action: params.action,
        entity: params.entity,
        entity_id: params.entity_id,
        actor: params.actor ?? "owner",
        device_id: params.device_id,
        payload: toJsonValue(params.payload),
        ip_address: params.ip_address,
      },
    });
  } catch {
    // non-blocking
  }
}
