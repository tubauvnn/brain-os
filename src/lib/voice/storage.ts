import path from "node:path";
import fs from "node:fs";
import { randomUUID } from "node:crypto";

// Lưu trong public/ (khác uploads/media/ dùng cho ảnh access_level=3 riêng tư,
// xem src/lib/media.ts) — audio giọng nói sinh ra từ text người dùng tự nhập
// không phải dữ liệu nhạy cảm cần kiểm soát truy cập, và việc phát lại qua
// <audio src="..."> cần 1 URL Next.js serve trực tiếp được, không qua route
// riêng — tối giản đúng tinh thần "vertical slice", không xây route serve
// bytes riêng cho việc này.
const VOICE_AUDIO_DIR = path.join(process.cwd(), "public", "generated", "voice");

export function ensureVoiceAudioDir(): void {
  fs.mkdirSync(VOICE_AUDIO_DIR, { recursive: true });
}

const EXT_BY_MIME: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
};

export function saveVoiceAudio(buffer: Buffer, mimeType: string): { audioUrl: string; audioPath: string } {
  ensureVoiceAudioDir();
  const ext = EXT_BY_MIME[mimeType] ?? "bin";
  const filename = `${randomUUID()}.${ext}`;
  const absolutePath = path.join(VOICE_AUDIO_DIR, filename);
  fs.writeFileSync(absolutePath, buffer);
  return {
    audioUrl: `/generated/voice/${filename}`,
    audioPath: path.join("public", "generated", "voice", filename),
  };
}
