import fs from "node:fs/promises";
import path from "node:path";
import { VoiceRouter, DEFAULT_VOICE_PROVIDER } from "@/lib/voice";
import { findCharacterByName } from "@/lib/character";
import { getMediaDurationSeconds } from "./ffmpeg";

// Voice Synthesis — per DIALOGUE LINE (not per scene), reusing the existing
// Voice Provider (src/lib/voice/, Phase 1/3, UNMODIFIED — same VoiceRouter/
// ElevenLabs path /api/voice/generate already uses). Per-line so each line
// gets its OWN measured duration via ffprobe (getMediaDurationSeconds,
// ffmpeg.ts) — real audio timing, not Scene Planner's estimate (the one idea
// worth adapting from the OpenMontage audit, §8/9: derive timing from real
// synthesized audio). Character → voice ID resolved through
// findCharacterByName (Character Agent, Phase 3, unmodified) → the
// already-configured CAM_VOICE_ID/TRANG_VOICE_ID/NAU_VOICE_ID env vars; no
// mapping found → voiceId left undefined, and the ElevenLabs provider's own
// existing fallback (ELEVENLABS_DEFAULT_VOICE_ID) applies — no new fallback
// logic duplicated here.

const CHARACTER_VOICE_ENV: Record<string, string | undefined> = {
  cam: process.env.CAM_VOICE_ID,
  trang: process.env.TRANG_VOICE_ID,
  nau: process.env.NAU_VOICE_ID,
};

function resolveVoiceId(characterName: string): string | undefined {
  const character = findCharacterByName(characterName);
  if (!character) return undefined;
  return CHARACTER_VOICE_ENV[character.id];
}

export type DialogueLineInput = { index: number; character: string; text: string };

export type SynthesizedLine = {
  index: number;
  character: string;
  text: string;
  audioPath: string;
  durationSeconds: number;
  costUsd?: number;
};

// Tuần tự (không Promise.all) — tránh dồn dập gọi ElevenLabs cùng lúc, cùng
// triết lý xử lý tuần tự đã dùng ở Render Queue (render-queue.ts).
export async function synthesizeDialogueLines(lines: DialogueLineInput[], workDir: string): Promise<SynthesizedLine[]> {
  const provider = VoiceRouter.resolve(DEFAULT_VOICE_PROVIDER);
  if (!provider) throw new Error(`Không tìm thấy voice provider "${DEFAULT_VOICE_PROVIDER}".`);

  await fs.mkdir(workDir, { recursive: true });

  const results: SynthesizedLine[] = [];
  for (const line of lines) {
    const text = line.text.trim();
    if (!text) continue;

    const voiceId = resolveVoiceId(line.character);
    const result = await provider.generate({ text, voiceId });
    if (result.status === "error" || !result.audioBuffer) {
      throw new Error(`Sinh voice thất bại cho lời thoại #${line.index} ("${line.character}"): ${result.error ?? "không xác định"}`);
    }

    const audioPath = path.join(workDir, `line-${String(line.index).padStart(3, "0")}.mp3`);
    await fs.writeFile(audioPath, result.audioBuffer);
    const durationSeconds = await getMediaDurationSeconds(audioPath);

    results.push({ index: line.index, character: line.character, text, audioPath, durationSeconds, costUsd: result.cost });
  }
  return results;
}
