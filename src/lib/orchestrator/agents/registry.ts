import { TaskOrchestrator } from "../orchestrator";
import { videoTaskAgent } from "./video-task-agent";
import { characterTaskAgent } from "./character-task-agent";

// Agent Registry — composition root DUY NHẤT biết TaskAgent cụ thể nào tồn
// tại và đăng ký vào Task Orchestrator. orchestrator.ts KHÔNG import file này
// và KHÔNG import bất kỳ agent nào — cùng pattern
// src/lib/device/providers/registry.ts, src/lib/video/providers/registry.ts.
//
// Thêm agent mới (ImageAgent/CharacterAgent/RobotAgent/VoiceAgent/SEOAgent/
// SocialAgent/CameraAgent...):
//   1. Viết 1 file trong agents/ implement TaskAgent (adapter mỏng nếu agent
//      thật đã có module riêng, như video-task-agent.ts bọc src/lib/video/).
//   2. Import + register() thêm 1 dòng ở đây, đúng thứ tự muốn chạy trong plan
//      nhiều bước (vd Character → Image → Video → Voice).
// KHÔNG sửa orchestrator.ts.

TaskOrchestrator.register(videoTaskAgent);
TaskOrchestrator.register(characterTaskAgent);
