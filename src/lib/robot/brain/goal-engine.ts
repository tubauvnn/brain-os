import type { GoalDefinition, GoalId, WorldState } from "./types";

// GoalEngine — Phase 6G mục "Goals". Thuần logic. 9 goal ĐÚNG tên yêu cầu,
// mỗi goal có priority/interruptible/timeout/completion condition. Timeout
// dùng ms tuyệt đối so với lúc goal bắt đầu (PriorityEngine tự theo dõi
// goalStartedAt, GoalDefinition chỉ khai báo NGƯỠNG) — tách khỏi
// isComplete() vì nhiều goal ở đây hoàn toàn "hết hạn theo giờ", không có
// điều kiện world nào đánh dấu xong tự nhiên.

// "Đang được để ý" — cùng ngưỡng attentionScore với MoodEngine ("curious",
// Phase 6F) để 1 con số nói lên 1 ý nghĩa xuyên suốt cả robot, không có 2
// ngưỡng khác nhau cho cùng 1 khái niệm.
const WATCH_ATTENTION_THRESHOLD = 0.35;
// Im lặng hoàn toàn (không chat, không ai qua lại, không hành vi ý nghĩa gì)
// đủ lâu mới coi là nên ngủ — đủ dài để không ngủ giữa chừng lúc chỉ đang
// idle animation bình thường.
const SLEEP_IDLE_SECONDS = 120;

export const GOALS: Record<GoalId, GoalDefinition> = {
  Conversation: {
    id: "Conversation",
    priority: 100,
    interruptible: false, // "never interrupt" (Phase 6F mục 3, vẫn đúng ở Phase 6G)
    timeoutMs: null,
    isComplete: (world) => world.conversationState !== "speaking",
  },
  Listening: {
    id: "Listening",
    priority: 95,
    interruptible: false,
    timeoutMs: null,
    isComplete: (world) => world.conversationState !== "mic_listening",
  },
  Thinking: {
    id: "Thinking",
    priority: 90,
    interruptible: false,
    timeoutMs: 8_000, // an toàn — nếu robot "kẹt" ở thinking quá lâu (lỗi mạng...), vẫn phải nhường lại chứ không treo goal mãi
    isComplete: (world) => world.conversationState !== "thinking",
  },
  Greeting: {
    id: "Greeting",
    priority: 80,
    interruptible: true,
    timeoutMs: 4_000, // đủ thời gian nói xong 1 câu chào ngắn
    isComplete: () => false, // hoàn toàn hết hạn theo giờ, không có điều kiện world nào đánh dấu "xong" sớm hơn
  },
  Selling: {
    id: "Selling",
    priority: 70,
    interruptible: true,
    timeoutMs: 8_000,
    isComplete: (world) => !world.sellingContext, // đổi project context giữa chừng thì thôi bán hàng luôn
  },
  Waiting: {
    id: "Waiting",
    priority: 60,
    interruptible: true,
    timeoutMs: 15_000, // đợi người ta phản hồi lời mời — quá lâu thì thôi, quay lại Watching/Idle
    isComplete: (world) => world.conversationState !== "none", // họ bắt đầu nói chuyện thật thì "đợi" xong nhiệm vụ
  },
  Watching: {
    id: "Watching",
    priority: 50,
    interruptible: true,
    timeoutMs: 12_000,
    isComplete: (world) => world.attentionScore < WATCH_ATTENTION_THRESHOLD, // họ nhìn đi chỗ khác/rời đi
  },
  Idle: {
    id: "Idle",
    priority: 20,
    interruptible: true,
    timeoutMs: null,
    isComplete: () => false, // fallback mặc định — không tự "xong", chỉ bị goal khác thay thế
  },
  Sleeping: {
    id: "Sleeping",
    priority: 10,
    interruptible: true,
    timeoutMs: null,
    isComplete: (world) => world.idleSeconds < SLEEP_IDLE_SECONDS, // có hoạt động ý nghĩa trở lại thì thức dậy
  },
};

// desiredGoal — "Think" step: goal NÊN là gì ngay bây giờ, tính THUẦN từ
// WorldState hiện tại, không quan tâm goal đang chạy là gì (PriorityEngine ở
// bước "Prioritize" mới quyết định có CHUYỂN sang goal này hay không).
// Thứ tự if là thứ tự ưu tiên — khớp ví dụ yêu cầu "Talking to user >
// Greeting new visitor > Selling > Idle animation > Sleep".
export function desiredGoal(world: WorldState): GoalId {
  if (world.conversationState === "speaking") return "Conversation";
  if (world.conversationState === "thinking") return "Thinking";
  if (world.conversationState === "mic_listening") return "Listening";
  if (world.pendingInvite) return world.sellingContext ? "Selling" : "Waiting";
  if (world.pendingGreeting) return "Greeting";
  if (world.attentionScore >= WATCH_ATTENTION_THRESHOLD) return "Watching";
  if (world.idleSeconds >= SLEEP_IDLE_SECONDS) return "Sleeping";
  return "Idle";
}
