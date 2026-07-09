import { VideoAgent } from "../video-agent";
import { mockVideoGeneratorProvider } from "./mock-generator";

// Provider Registry — composition root DUY NHẤT biết provider cụ thể nào tồn
// tại và đăng ký vào Video Agent. video-agent.ts KHÔNG import file này và
// KHÔNG import bất kỳ provider nào — cùng pattern
// src/lib/device/providers/registry.ts.
//
// Thêm provider mới (Veo/OpenAI/Kling...):
//   1. Viết 1 file trong providers/ implement VideoGeneratorProvider.
//   2. Import + register() thêm 1 dòng ở đây.
// KHÔNG sửa video-agent.ts.

VideoAgent.register(mockVideoGeneratorProvider);
