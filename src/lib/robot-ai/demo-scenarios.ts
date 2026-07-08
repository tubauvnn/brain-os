import type { RobotChatResult } from "./types";

// Kịch bản demo của Chuối — thay cho các câu local-skill cụt ngủn trước đây.
// Mỗi scenario trả lời như 1 màn trình diễn nhỏ (câu dài hơn, có ngữ cảnh, có
// gợi ý bước tiếp theo) thay vì 1 câu xác nhận khô khan. Không gọi OpenAI.
export type DemoScenarioId = "greet_customer" | "introduce" | "sales_demo" | "turn_left" | "turn_right" | "sleep" | "wake";

export type ScenarioReply = Omit<RobotChatResult, "ok" | "provider" | "model">;

export type DemoScenario = { id: DemoScenarioId; keywords: string[]; reply: ScenarioReply };

// Thứ tự trong mảng có ý nghĩa — scenario đứng trước được match trước khi so
// khớp keyword (xem matchDemoScenario trong local-skills.ts).
export const DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: "greet_customer",
    keywords: ["chao khach", "chuoi oi", "xin chao", "chao"],
    reply: {
      reply: "Xin chào, mình là Chuối. Rất vui được gặp bạn, bạn có muốn xem mình demo một chút không?",
      mood: "happy",
      action: "greet",
      eyes: "center",
      mouth: "speaking",
      hardwareCommand: { type: "face", command: "greet" },
      suggestedNextActions: ["Demo bán hàng", "Mày là ai", "Ngủ đi"],
      brainNote: "local scenario",
    },
  },
  {
    id: "introduce",
    keywords: ["may la ai", "ban la ai", "cau la ai", "gioi thieu"],
    reply: {
      reply: "Mình là Chuối, robot demo của Brain OS. Bản web này là mô phỏng trước khi mình được lắp vào ESP32-S3.",
      mood: "happy",
      action: "introduce",
      eyes: "center",
      mouth: "speaking",
      suggestedNextActions: ["Chào khách", "Demo bán hàng", "Quay trái"],
      brainNote: "local scenario",
    },
  },
  {
    id: "sales_demo",
    keywords: ["demo ban hang", "gioi thieu ban hang", "ban hang"],
    reply: {
      reply:
        "Ở quầy bán hàng, Chuối có thể chào khách, giới thiệu món và nhắc chương trình khuyến mãi. Sau này mình còn có thể báo tồn hàng và gọi chủ quầy.",
      mood: "happy",
      action: "demo_sales",
      eyes: "center",
      mouth: "speaking",
      hardwareCommand: { type: "face", command: "sales_mode" },
      suggestedNextActions: ["Chào khách", "Quay trái", "Quay phải"],
      brainNote: "local scenario",
    },
  },
  {
    id: "turn_left",
    keywords: ["quay trai", "nhin trai", "re trai", "trai"],
    reply: {
      reply: "Ok, Chuối nhìn sang trái.",
      mood: "idle",
      action: "turn_left",
      eyes: "left",
      mouth: "speaking",
      hardwareCommand: { type: "servo", command: "look_left", payload: { angle: -35 } },
      suggestedNextActions: ["Quay phải", "Chào khách"],
      brainNote: "local scenario",
    },
  },
  {
    id: "turn_right",
    keywords: ["quay phai", "nhin phai", "re phai", "phai"],
    reply: {
      reply: "Ok, Chuối nhìn sang phải.",
      mood: "idle",
      action: "turn_right",
      eyes: "right",
      mouth: "speaking",
      hardwareCommand: { type: "servo", command: "look_right", payload: { angle: 35 } },
      suggestedNextActions: ["Quay trái", "Chào khách"],
      brainNote: "local scenario",
    },
  },
  {
    id: "sleep",
    keywords: ["ngu di", "nghi di"],
    reply: {
      reply: "Chuối ngủ một chút nhé. Gọi mình dậy khi cần demo tiếp.",
      mood: "sleepy",
      action: "sleep",
      eyes: "closed",
      mouth: "sleep",
      hardwareCommand: { type: "face", command: "sleep" },
      suggestedNextActions: ["Thức dậy"],
      brainNote: "local scenario",
    },
  },
  {
    id: "wake",
    keywords: ["day di", "thuc day"],
    reply: {
      reply: "Chuối dậy rồi đây.",
      mood: "happy",
      action: "wake",
      eyes: "center",
      mouth: "speaking",
      hardwareCommand: { type: "face", command: "wake" },
      suggestedNextActions: ["Chào khách", "Mày là ai"],
      brainNote: "local scenario",
    },
  },
];
