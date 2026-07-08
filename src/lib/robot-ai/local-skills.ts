import type { RobotChatResult } from "./types";
import { DEMO_SCENARIOS, type ScenarioReply } from "./demo-scenarios";
import { checkLanguageGuard } from "./language-guard";

// Local skill engine v2 — trả lời ngay cho các câu lệnh/câu hỏi phổ biến, không
// tốn round-trip gọi OpenAI. Chạy TRƯỚC provider AI trong /api/robot/chat; chỉ
// những câu không khớp bước nào mới rơi xuống OpenAI.
//
// Thứ tự xử lý (matchLocalSkill):
//   1. normalize text
//   2. language guard (chặn script lạ, xem language-guard.ts)
//   3. demo scenarios (greet_customer/introduce/sales_demo/turn_left/turn_right/sleep/wake)
//   4. robot commands (lệnh rời rạc không phải "màn trình diễn": nhìn tôi, cười,
//      dừng, demo gia đình/bảo vệ/robot, test mic)
//   5. identity fallback (biến thể hỏi danh tính không khớp keyword ở bước 3)
//   6. trả null — để caller (route.ts) gọi OpenAI

function stripDiacritics(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

export function normalizeVietnamese(text: string): string {
  return stripDiacritics(text.toLowerCase().trim()).replace(/\s+/g, " ");
}

// So khớp theo "từ/cụm từ trọn vẹn" (có khoảng trắng bao quanh) để tránh khớp
// nhầm chuỗi con bên trong từ khác (vd "dung" trong "dung lai" không khớp "dung nham").
function includesPhrase(normalizedText: string, phrase: string): boolean {
  return ` ${normalizedText} `.includes(` ${phrase} `);
}

function matchKeywords(normalized: string, keywords: string[]): boolean {
  return keywords.some((keyword) => includesPhrase(normalized, keyword));
}

function toResult(reply: ScenarioReply): RobotChatResult {
  return { ok: true, provider: "local", ...reply };
}

function matchDemoScenario(normalized: string): RobotChatResult | null {
  for (const scenario of DEMO_SCENARIOS) {
    if (matchKeywords(normalized, scenario.keywords)) return toResult(scenario.reply);
  }
  return null;
}

type RobotCommand = { id: string; keywords: string[]; reply: ScenarioReply };

// Lệnh rời rạc không phải "màn demo" (không cần câu dài/gợi ý bước tiếp theo) —
// vẫn trả structured đầy đủ, chỉ ngắn gọn hơn scenario.
const ROBOT_COMMANDS: RobotCommand[] = [
  {
    id: "look_at_me",
    keywords: ["nhin toi", "nhin minh"],
    reply: {
      reply: "Chuối đang nhìn bạn đây.",
      mood: "happy",
      action: "look_center",
      eyes: "track",
      mouth: "smile",
      hardwareCommand: { type: "servo", command: "look_center" },
      brainNote: "local command",
    },
  },
  {
    id: "smile",
    keywords: ["cuoi len", "cuoi di"],
    reply: {
      reply: "Chuối cười đây, hihi.",
      mood: "happy",
      action: "smile",
      eyes: "center",
      mouth: "smile",
      brainNote: "local command",
    },
  },
  {
    id: "stop",
    keywords: ["dung lai", "dung"],
    reply: {
      reply: "Chuối dừng lại rồi.",
      mood: "idle",
      action: "stop",
      eyes: "center",
      mouth: "idle",
      hardwareCommand: { type: "motor", command: "stop" },
      brainNote: "local command",
    },
  },
  {
    id: "demo_family",
    keywords: ["demo gia dinh"],
    reply: {
      reply: "Ở nhà, Chuối có thể chào người thân, nhắc việc nhẹ và làm bạn với các bạn nhỏ.",
      mood: "happy",
      action: "demo_family",
      eyes: "center",
      mouth: "speaking",
      suggestedNextActions: ["Chào khách", "Demo bán hàng"],
      brainNote: "local command",
    },
  },
  {
    id: "demo_security",
    keywords: ["demo bao ve"],
    reply: {
      reply: "Chuối có thể đứng gác, phát hiện chuyển động và báo khi có người lại gần.",
      mood: "thinking",
      action: "demo_security",
      eyes: "center",
      mouth: "speaking",
      suggestedNextActions: ["Quay trái", "Quay phải"],
      brainNote: "local command",
    },
  },
  {
    id: "demo_robot",
    keywords: ["demo robot"],
    reply: {
      reply: "Chuối demo luôn: quay trái, quay phải, nhìn theo và cười chào bạn nhé.",
      mood: "happy",
      action: "demo_robot",
      eyes: "track",
      mouth: "smile",
      suggestedNextActions: ["Quay trái", "Quay phải", "Chào khách"],
      brainNote: "local command",
    },
  },
  {
    id: "test_mic",
    keywords: ["test mic"],
    reply: {
      reply: "Mic đã sẵn sàng. Bạn nói ngắn thôi để Chuối nghe rõ hơn.",
      mood: "listening",
      action: "none",
      eyes: "center",
      mouth: "idle",
      brainNote: "local command",
    },
  },
];

function matchRobotCommand(normalized: string): RobotChatResult | null {
  for (const command of ROBOT_COMMANDS) {
    if (matchKeywords(normalized, command.keywords)) return toResult(command.reply);
  }
  return null;
}

// Biến thể hỏi danh tính không khớp keyword của scenario "introduce" (bước 3)
// — lưới an toàn thứ 2, dùng lại đúng câu trả lời của introduce.
const IDENTITY_FALLBACK_KEYWORDS = ["ten la gi", "may la robot gi", "day la ai", "may la gi"];

function matchIdentityFallback(normalized: string): RobotChatResult | null {
  if (!matchKeywords(normalized, IDENTITY_FALLBACK_KEYWORDS)) return null;
  const introduce = DEMO_SCENARIOS.find((s) => s.id === "introduce");
  return introduce ? toResult(introduce.reply) : null;
}

export function matchLocalSkill(text: string): RobotChatResult | null {
  const normalized = normalizeVietnamese(text);
  if (!normalized) return null;

  const guarded = checkLanguageGuard(text);
  if (guarded) return guarded;

  const scenario = matchDemoScenario(normalized);
  if (scenario) return scenario;

  const command = matchRobotCommand(normalized);
  if (command) return command;

  const identity = matchIdentityFallback(normalized);
  if (identity) return identity;

  return null;
}
