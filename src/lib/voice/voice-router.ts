import type { VoiceProvider } from "./types";
import { elevenLabsProvider } from "./providers/elevenlabs";

// Voice Router — điểm DUY NHẤT trong Brain OS biết danh sách Voice Provider
// nào tồn tại. Không phải nơi chứa logic của bất kỳ vendor nào (đó là việc
// của từng file trong providers/) — chỉ đăng ký + phân giải theo tên.
//
//     Brain OS → Voice Router → Voice Provider Interface → ElevenLabs Provider
//
// Thêm provider thứ 2 (OpenAI/Cartesia/Azure/Piper/Coqui...): viết 1 file mới
// trong providers/ implement VoiceProvider, rồi thêm đúng 1 dòng vào map dưới
// đây. Không sửa route.ts, không sửa VoiceRouter, không sửa provider khác.
const VOICE_PROVIDERS: Record<string, VoiceProvider> = {
  elevenlabs: elevenLabsProvider,
};

export const DEFAULT_VOICE_PROVIDER = "elevenlabs";

export const VoiceRouter = {
  /** Phân giải tên provider → instance. Không tìm thấy → null (caller tự quyết định trả lỗi gì). */
  resolve(name: string = DEFAULT_VOICE_PROVIDER): VoiceProvider | null {
    return VOICE_PROVIDERS[name] ?? null;
  },

  /** Danh sách tên provider đã đăng ký — dùng cho debug/UI, không phải đường dẫn nghiệp vụ chính. */
  listProviders(): string[] {
    return Object.keys(VOICE_PROVIDERS);
  },
};
