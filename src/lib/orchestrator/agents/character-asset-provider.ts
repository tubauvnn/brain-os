import { findCharactersMentioned, resolveCharacters } from "@/lib/character";
import type { AssetProvider } from "../types";

// Character Asset Provider — ADAPTER cho seam AssetProvider (orchestrator/
// types.ts), tái dùng findCharactersMentioned/resolveCharacters đã có ở
// src/lib/character/ (KHÔNG duplicate logic tra cứu canon). Chỉ gắn asset khi
// input THỰC SỰ nhắc tên 1 nhân vật đã biết — tránh gắn asset không liên quan
// vào mọi request (vd "chat" không đi qua Orchestrator nên không bị ảnh hưởng,
// nhưng các intent có đi qua Orchestrator mà không nhắc tên nhân vật nào thì
// cũng không cần tải asset).

async function getAssets(intent: string, input: string): Promise<Record<string, unknown> | null> {
  const mentioned = findCharactersMentioned(input);
  if (mentioned.length === 0) return null;

  // input đã xác nhận nhắc tên >=1 nhân vật → resolveCharacters trả đúng tập
  // được nhắc (không rơi vào fallback "load toàn bộ cast").
  const resolved = await resolveCharacters(input);
  return {
    characterCanonAssets: resolved.characters.map((c) => ({
      id: c.character.id,
      name: c.character.name,
      canonImagePath: c.canonImagePath,
      canonImageAvailable: c.canonImageAvailable,
    })),
    heightChartCanonPath: resolved.characters[0]?.heightChartCanonPath ?? null,
  };
}

export const characterAssetProvider: AssetProvider = { getAssets };
