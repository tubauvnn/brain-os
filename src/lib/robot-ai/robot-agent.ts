import { recallMemory, rememberIfSafe } from "@/lib/memory";
import { recallKnowledge } from "@/lib/knowledge";
import { getActiveProjectContext, getContinuity } from "@/lib/project";
import { findMentionedPeople } from "@/lib/people";
import { loadSessionHistoryText } from "@/lib/brain/session-context";
import { ModelRouter, DEFAULT_MODEL_PROVIDER } from "@/lib/model";
import { TaskOrchestrator } from "@/lib/orchestrator";
import { getRecentTempImages } from "@/lib/vision/temp-store";
import { getVisionAnalysis, isExplicitSaveRequest } from "./vision-handler";
import { planCapabilities, type Capability, type CapabilityPlan } from "./capability-planner";
import { promoteTempImage } from "@/lib/vision/temp-store";

// Robot Agent — Phase 6D, "single orchestrator" theo đúng yêu cầu mục 13:
// KHÔNG phải Task Orchestrator thứ 2 (vẫn dùng lại TaskOrchestrator có sẵn
// cho device/tool bên dưới), KHÔNG phải Intent Resolver thứ 2 (chỉ chạy sau
// khi Intent Resolver đã xác định intent "chat" — mọi intent xác định khác
// như remember/robot_command/tool_request/video_request/... vẫn đi thẳng qua
// đường cũ, KHÔNG động tới). Đây là bộ não cho nhánh "chat": Capability
// Planner (capability-planner.ts) → chạy song song các capability được chọn
// → Merge (LLM tổng hợp qua ModelRouter, cùng provider handleChat() cũ dùng)
// → trả reply thô cho conversation-agent.ts (Robot Personality áp dụng SAU,
// ở route.ts, y hệt mọi intent khác — KHÔNG áp dụng 2 lần).
//
// Chỉ dùng cho client robot (ctx.source === "robot", xem conversation-agent.ts)
// — web/api/mobile chat vẫn dùng handleChat() gốc, không có camera/vision UI
// nên không cần capability planning này.

type CapabilityResult = {
  text: string;
  /** true = đã là câu trả lời hoàn chỉnh (bỏ qua bước merge nếu là capability DUY NHẤT). */
  isCompleteAnswer: boolean;
  memoryTitles?: string[];
  projectNames?: string[];
};

async function executeMemory(message: string): Promise<CapabilityResult> {
  const [memory, people] = await Promise.all([recallMemory(message), findMentionedPeople(message)]);
  const parts = [
    memory.items.length ? `Memory liên quan:\n${memory.items.map((m) => `- ${m.title}: ${m.content}`).join("\n")}` : "",
    people.length
      ? `Người được nhắc tới:\n${people.map((p) => `- ${p.name}${p.alias ? ` (${p.alias})` : ""}: quan hệ ${p.relation ?? "chưa rõ"}`).join("\n")}`
      : "",
  ].filter(Boolean);
  return { text: parts.join("\n\n"), isCompleteAnswer: false, memoryTitles: memory.items.map((m) => m.title) };
}

async function executeProject(): Promise<CapabilityResult> {
  const [projectContext, continuity] = await Promise.all([getActiveProjectContext(), getContinuity()]);
  const parts = [
    projectContext ? `Dự án sáng tạo đang mở: ${projectContext.name}${projectContext.storyBible ? `\n${projectContext.storyBible}` : ""}` : "",
    `Tiến độ Brain OS: phase hiện tại "${continuity.currentPhase}"; đang làm: ${continuity.currentTask}; vừa xong: ${continuity.lastCompletedAction}; tiếp theo: ${continuity.nextRecommendedAction}.`,
  ].filter(Boolean);
  return { text: parts.join("\n"), isCompleteAnswer: false, projectNames: projectContext ? [projectContext.name] : [] };
}

async function executeKnowledge(): Promise<CapabilityResult> {
  const knowledge = await recallKnowledge();
  return { text: knowledge.items.length ? `Knowledge:\n${knowledge.items.map((k) => `- ${k.summary}`).join("\n")}` : "", isCompleteAnswer: false };
}

// Chưa có provider tìm kiếm web thật trong Brain OS — trả lời TRUNG THỰC,
// không bịa kết quả (đúng nguyên tắc "no mock provider" xuyên suốt dự án).
async function executeSearch(): Promise<CapabilityResult> {
  return { text: "Brain OS chưa có công cụ tìm kiếm web thật.", isCompleteAnswer: true };
}

const CAMERA_DEVICE_PHRASES = ["mở camera", "bật camera", "tắt camera"];
const VPS_DEVICE_PHRASES = ["mở vps", "vps"];

async function executeDevice(message: string): Promise<CapabilityResult> {
  const lower = message.toLowerCase();
  // Camera là hành động PHÍA TRÌNH DUYỆT (getUserMedia, xem
  // src/app/robot/page.tsx openCamera()) — server không tự bật camera người
  // dùng được, nói thật thay vì bịa đã mở.
  if (CAMERA_DEVICE_PHRASES.some((p) => lower.includes(p))) {
    return {
      text: "Mình không tự bật camera từ xa được — bạn bấm nút camera trên giao diện giúp mình, có ảnh là mình xem ngay.",
      isCompleteAnswer: true,
    };
  }
  if (VPS_DEVICE_PHRASES.some((p) => lower.includes(p))) {
    return { text: "Mình chưa có quyền điều khiển VPS trực tiếp, bạn thao tác giúp mình nhé.", isCompleteAnswer: true };
  }
  // Câu thiết bị khác (chuyển động/ngủ/thức...) lọt qua khỏi robot_command
  // chuẩn — vẫn đi ĐÚNG đường cũ (Orchestrator → robot-task-agent → Device
  // Manager), không viết lại logic điều khiển thiết bị.
  const result = await TaskOrchestrator.run("robot_command", message);
  const output = result.finalOutput as { message?: string } | undefined;
  return {
    text: result.success && output?.message ? output.message : "Mình chưa thực hiện được lệnh thiết bị này.",
    isCompleteAnswer: true,
  };
}

async function executeTool(message: string): Promise<CapabilityResult> {
  const result = await TaskOrchestrator.run("tool_request", message);
  const output = result.finalOutput as { result?: string } | undefined;
  return {
    text: result.success && output?.result ? `Kết quả: ${output.result}.` : "Mình chưa thực hiện được yêu cầu này.",
    isCompleteAnswer: true,
  };
}

async function executeVision(message: string, sessionId: string | undefined): Promise<CapabilityResult> {
  const images = await getRecentTempImages({ sessionId, limit: 1 });
  const image = images[0];
  if (!image) {
    return {
      text: "Chưa có ảnh nào trong phiên này để xem — bạn chụp hoặc tải ảnh lên giúp mình nhé.",
      isCompleteAnswer: true,
    };
  }

  const raw = await getVisionAnalysis({ image, prompt: message, sessionId });
  if (raw.status === "error") {
    return { text: raw.text, isCompleteAnswer: true };
  }

  let text = raw.text;
  if (isExplicitSaveRequest(message)) {
    const stored = await promoteTempImage(image.id);
    if (stored) {
      await rememberIfSafe(`Ảnh đã lưu (${image.filename}): ${raw.text}`.slice(0, 500), "robot-agent:vision");
      text += " (Đã lưu ảnh này lại.)";
    }
  }

  return { text, isCompleteAnswer: true, memoryTitles: raw.memoryUsed, projectNames: raw.projectContextUsed };
}

// Thứ tự dùng khi merge — mục 6 "Context ranking" (ảnh > dự án > quan hệ/
// memory > knowledge > search). "device"/"tool" là hành động vừa thực hiện,
// xếp đầu (ngang "current conversation") vì đó là điều VỪA XẢY RA, liên quan
// trực tiếp nhất tới câu hỏi.
const CAPABILITY_RANK: Capability[] = ["device", "tool", "vision", "project", "memory", "knowledge", "search"];

async function mergeResults(
  message: string,
  plan: CapabilityPlan,
  results: Partial<Record<Capability, CapabilityResult>>,
  sessionId: string | undefined
): Promise<{ reply: string; model?: string }> {
  // Chỉ 1 capability VÀ đã là câu trả lời hoàn chỉnh → dùng thẳng, bỏ qua
  // bước gọi model lần nữa ("avoid duplicate provider calls", mục 10).
  if (plan.capabilities.length === 1) {
    const only = results[plan.capabilities[0]];
    if (only?.isCompleteAnswer) return { reply: only.text };
  }

  const historyText = sessionId ? await loadSessionHistoryText(sessionId) : "";
  const orderedTexts = CAPABILITY_RANK.filter((cap) => plan.capabilities.includes(cap))
    .map((cap) => results[cap]?.text)
    .filter((t): t is string => !!t && t.trim().length > 0);

  if (orderedTexts.length === 0 && !historyText) {
    return { reply: "Mình chưa có đủ thông tin để trả lời chắc chắn, bạn nói rõ hơn giúp mình nhé." };
  }

  // Hướng dẫn merge (mục 5) gắn vào `context` của LƯỢT GỌI NÀY thôi — KHÔNG
  // sửa system prompt dùng chung của ModelRouter (src/lib/model/providers/
  // openai.ts, các client khác ngoài robot cũng dùng chung, không được đụng).
  //
  // NGẮN GỌN xử lý Ở ĐÂY (2026-07-11) — chỗ SỚM NHẤT sinh ra nội dung thô cho
  // nhánh chat của robot. TRƯỚC đây độ dài bị ép ở personality.ts (lớp PHONG
  // CÁCH, chạy SAU) — model vừa phải nén nội dung dài vừa phải đổi giọng cùng
  // lúc, không đáng tin cậy (nguồn càng dài càng dễ bỏ qua chỉ dẫn độ dài).
  // Personality giờ CHỈ đổi giọng, TIN TƯỞNG reply gốc đã đủ ngắn từ đây —
  // không nén lại lần 2.
  const contextText = [
    "Trả lời TRỰC TIẾP câu hỏi trước tiên — không rào đón, không liệt kê hết mọi nguồn thông tin bên dưới, không lặp lại ngữ cảnh đã biết. Mặc định 8-20 từ, TỐI ĐA 2 câu ngắn — CHỈ dài hơn khi người dùng RÕ RÀNG yêu cầu giải thích/chi tiết thêm. Nếu nhiều nguồn bên dưới đều liên quan, chỉ chọn ĐÚNG phần liên quan trực tiếp nhất tới câu hỏi, bỏ qua phần còn lại — không cố tổng hợp hết. Nếu 2 nguồn mâu thuẫn, ưu tiên nguồn chắc chắn hơn (quan sát trực tiếp > trí nhớ > suy luận chung) và nói rõ nếu có phần không chắc.",
    historyText ? `Lịch sử hội thoại gần đây:\n${historyText}` : "",
    ...orderedTexts,
  ]
    .filter(Boolean)
    .join("\n\n");

  const provider = ModelRouter.resolve(DEFAULT_MODEL_PROVIDER);
  if (!provider) return { reply: orderedTexts[0] ?? "Mình chưa kết nối được bộ não trả lời, thử lại giúp mình nhé." };

  const result = await provider.generate({ message, context: contextText });
  if (result.status === "error" || !result.reply) {
    return { reply: orderedTexts[0] ?? "Mình chưa trả lời được, thử lại giúp mình nhé." };
  }
  return { reply: result.reply, model: result.model };
}

export type RobotAgentOutcome = {
  reply: string;
  model?: string;
  memoryUsed: number;
  knowledgeUsed: number;
  /** Nội bộ — KHÔNG BAO GIỜ trả ra client (mục 3/7: không lộ planner/reasoning). */
  capabilitiesUsed: Capability[];
};

export async function runRobotAgent(message: string, sessionId: string | undefined): Promise<RobotAgentOutcome> {
  const recentImages = await getRecentTempImages({ sessionId, limit: 1 });
  const plan = planCapabilities(message, { hasImage: recentImages.length > 0 });

  // Chạy song song mọi capability ĐÃ CHỌN — "Parallel execution" mục 4,
  // "Cancel unnecessary capability execution" mục 10 (capability không nằm
  // trong plan thì đơn giản không được gọi, không có promise nào tạo ra).
  const entries = await Promise.all(
    plan.capabilities.map(async (cap): Promise<[Capability, CapabilityResult]> => {
      switch (cap) {
        case "memory":
          return [cap, await executeMemory(message)];
        case "project":
          return [cap, await executeProject()];
        case "knowledge":
          return [cap, await executeKnowledge()];
        case "search":
          return [cap, await executeSearch()];
        case "device":
          return [cap, await executeDevice(message)];
        case "tool":
          return [cap, await executeTool(message)];
        case "vision":
          return [cap, await executeVision(message, sessionId)];
      }
    })
  );
  const results = Object.fromEntries(entries) as Partial<Record<Capability, CapabilityResult>>;

  const { reply, model } = await mergeResults(message, plan, results, sessionId);

  return {
    reply,
    model,
    memoryUsed: results.memory?.memoryTitles?.length ?? 0,
    knowledgeUsed: results.knowledge?.text ? 1 : 0,
    capabilitiesUsed: plan.capabilities,
  };
}
