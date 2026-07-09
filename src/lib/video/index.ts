// Điểm vào duy nhất mà code ngoài src/lib/video/ nên import — không import
// trực tiếp từ video-agent.ts/providers/* ở nơi khác.
//
// Side-effect import: đăng ký toàn bộ provider đã biết vào Video Agent (xem
// providers/registry.ts, composition root).
import "./providers/registry";

export { VideoAgent } from "./video-agent";
export type {
  VideoRequest,
  VideoScene,
  VideoPlan,
  VideoGenerationInput,
  VideoGenerationResult,
  VideoGeneratorProvider,
} from "./types";
