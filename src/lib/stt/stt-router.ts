import type { SttProvider } from "./types";
import { openAiTranscribeProvider } from "./providers/openai-transcribe";

// STT Router — điểm DUY NHẤT biết danh sách STT Provider nào tồn tại, cùng
// vai trò VoiceRouter/VisionRouter/ModelRouter. Thêm provider thứ 2 (Deepgram/
// Azure Speech/tự host Whisper...): 1 file mới trong providers/ implement
// SttProvider + 1 dòng vào map dưới đây — không sửa route.ts, không sửa
// RobotAgent (RobotAgent không đụng audio, chỉ nhận text đã transcribe xong
// qua /api/robot/chat, xem route đó).
const STT_PROVIDERS: Record<string, SttProvider> = {
  openai_transcribe: openAiTranscribeProvider,
};

export const DEFAULT_STT_PROVIDER = "openai_transcribe";

export const SttRouter = {
  resolve(name: string = DEFAULT_STT_PROVIDER): SttProvider | null {
    return STT_PROVIDERS[name] ?? null;
  },
  listProviders(): string[] {
    return Object.keys(STT_PROVIDERS);
  },
};
