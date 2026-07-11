import { matchesExact } from "./text-match";

// Fast command path — Phase 6I mục 8. CHỈ 2 nhóm thật sự cần chặn phía
// CLIENT trước khi chạm /api/robot/chat:
//   1. "stop_speech" (dừng/im đi/thôi) — phải dừng NGAY, không đợi round-trip
//      mạng nào (mục 6 "must stop speech immediately", mục 5 "under 250ms").
//   2. "replay" (đọc lại) — điều khiển UI thuần, không phải câu hỏi cho AI
//      (đã có từ Phase 6A, xem REPLAY_PHRASES trong page.tsx).
//
// "ngủ đi"/"thức dậy"/"quay trái"/"quay phải"/"chào khách" CỐ TÌNH không có
// ở đây — Intent Resolver (Phase 6A) đã xếp các câu này vào intent
// "robot_command" với TEMPLATE VIẾT SẴN, KHÔNG gọi model (xem
// ROBOT_COMMAND_TEMPLATES trong personality.ts) — tức ĐÃ LÀ đường nhanh ở
// tầng server rồi. Chặn thêm 1 lần nữa ở client sẽ tạo ra "hệ thống hội
// thoại thứ 2" — đúng điều task cấm ("Do not create a second conversation
// system") — nên những lệnh đó vẫn đi qua /api/robot/chat bình thường như
// mọi transcript khác, chỉ là server đã trả lời rất nhanh sẵn.
export const DOCUMENTED_FAST_SERVER_COMMANDS = ["ngủ đi", "thức dậy", "quay trái", "quay phải", "chào khách"];

export type FastCommandKind = "stop_speech" | "replay";

// So khớp CHÍNH XÁC toàn câu (sau chuẩn hoá) — KHÔNG phải substring — để
// "dừng" không vô tình khớp bên trong "robot dừng lại" (lệnh robot thật,
// phải đi qua Conversation Agent, xem ROBOT_ACTION_WORDS trong
// intent-resolver.ts). "dừng"/"im đi"/"thôi" ngắn tới mức substring-có-
// word-boundary (matchesAnyPhrase, dùng cho input gõ tay) vẫn dính nhầm,
// nên lệnh THOẠI phải yêu cầu khớp TOÀN BỘ câu vừa nói.
const STOP_SPEECH_EXACT = ["dung", "im di", "thoi"];
const REPLAY_EXACT = ["doc lai", "noi lai", "lap lai", "nhac lai"];

export function matchFastCommand(transcript: string): FastCommandKind | null {
  if (matchesExact(transcript, STOP_SPEECH_EXACT)) return "stop_speech";
  if (matchesExact(transcript, REPLAY_EXACT)) return "replay";
  return null;
}
