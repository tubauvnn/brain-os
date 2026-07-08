import type { RobotChatResult } from "./types";

// Local skill engine — trả lời ngay cho các câu lệnh/câu hỏi phổ biến, không tốn
// round-trip gọi OpenAI. Chạy TRƯỚC provider AI trong /api/robot/chat; chỉ những
// câu không khớp skill nào mới rơi xuống OpenAI.

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

type LocalSkillReply = Omit<RobotChatResult, "ok" | "provider" | "model">;

type LocalSkill = {
  id: string;
  keywords: string[];
  reply: LocalSkillReply;
};

const LOCAL_SKILLS: LocalSkill[] = [
  {
    id: "greet",
    keywords: ["xin chao", "hello", "chao chuoi", "chuoi oi"],
    reply: {
      reply: "Xin chào, mình là Chuối đây.",
      mood: "happy",
      action: "greet",
      eyes: "center",
      mouth: "speaking",
    },
  },
  {
    id: "introduce",
    keywords: ["may la ai", "ban la ai", "cau la ai", "gioi thieu"],
    reply: {
      reply: "Mình là Chuối, robot demo của Brain OS.",
      mood: "happy",
      action: "introduce",
      eyes: "center",
      mouth: "speaking",
    },
  },
  {
    id: "greet_customer",
    keywords: ["chao khach"],
    reply: {
      reply: "Xin chào, rất vui được gặp bạn. Mời bạn thử nói chuyện với Chuối nhé.",
      mood: "happy",
      action: "greet",
      eyes: "center",
      mouth: "speaking",
      hardwareCommand: { type: "face", command: "greet" },
    },
  },
  {
    id: "turn_left",
    keywords: ["quay trai", "re trai"],
    reply: {
      reply: "Ok, Chuối quay trái.",
      mood: "idle",
      action: "turn_left",
      eyes: "left",
      mouth: "speaking",
      hardwareCommand: { type: "motor", command: "turn_left" },
    },
  },
  {
    id: "turn_right",
    keywords: ["quay phai", "re phai"],
    reply: {
      reply: "Ok, Chuối quay phải.",
      mood: "idle",
      action: "turn_right",
      eyes: "right",
      mouth: "speaking",
      hardwareCommand: { type: "motor", command: "turn_right" },
    },
  },
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
    },
  },
  {
    id: "sleep",
    keywords: ["ngu di", "di ngu"],
    reply: {
      reply: "Chuối ngủ một chút nhé.",
      mood: "sleepy",
      action: "sleep",
      eyes: "center",
      mouth: "sleep",
      hardwareCommand: { type: "face", command: "sleep" },
    },
  },
  {
    id: "wake",
    keywords: ["thuc day", "day di"],
    reply: {
      reply: "Chuối dậy rồi đây.",
      mood: "happy",
      action: "wake",
      eyes: "center",
      mouth: "speaking",
      hardwareCommand: { type: "face", command: "wake" },
    },
  },
  {
    id: "demo_sales",
    keywords: ["demo ban hang"],
    reply: {
      reply: "Xin chào, hôm nay Chuối có thể chào khách, giới thiệu món và nhắc chương trình mini game.",
      mood: "happy",
      action: "demo_sales",
      eyes: "center",
      mouth: "speaking",
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
    },
  },
];

// Khớp theo thứ tự khai báo — skill khai báo trước (cụm cụ thể hơn, vd "chao khach")
// được ưu tiên trước skill khai báo sau có cụm chung hơn (vd "xin chao").
export function matchLocalSkill(text: string): RobotChatResult | null {
  const normalized = normalizeVietnamese(text);
  if (!normalized) return null;

  for (const skill of LOCAL_SKILLS) {
    if (skill.keywords.some((keyword) => includesPhrase(normalized, keyword))) {
      return { ok: true, provider: "local", ...skill.reply };
    }
  }
  return null;
}
