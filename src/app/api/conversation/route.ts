import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runConversationAgent } from "@/lib/agent/conversation-agent";

export const dynamic = "force-dynamic";

const ConversationSchema = z.object({
  message: z.string().min(1, "message không được rỗng").max(4000),
  source: z.enum(["web", "robot", "voice", "mobile", "api"]).optional(),
  sessionId: z.string().min(1).optional(),
});

// POST /api/conversation — client đầu tiên gọi Conversation Agent
// (src/lib/agent/conversation-agent.ts), điểm vào chung dự kiến cho mọi client
// tương lai (Web/Robot/Voice/Mobile/API). Route CHỈ validate input + gọi Agent +
// trả response — không đọc Memory/Knowledge, không gọi Model, không resolve
// Intent ở đây (Agent tự làm qua src/lib/agent/intent-resolver.ts).
export async function POST(req: NextRequest) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Body phải là JSON hợp lệ." }, { status: 400 });
  }

  const parsed = ConversationSchema.safeParse(json);
  if (!parsed.success) {
    const message = parsed.error.errors.map((e) => e.message).join(", ");
    return NextResponse.json({ success: false, error: message }, { status: 422 });
  }

  // Error handling (Agent Runtime) — Task Orchestrator đã bọc lỗi từng agent
  // (executeWithRetry, src/lib/orchestrator/orchestrator.ts), nhưng vẫn giữ 1
  // lớp phòng thủ ngoài cùng: nếu có exception KHÔNG lường trước lọt ra tới
  // đây, trả JSON có cấu trúc thay vì để Next.js crash thành trang lỗi 500 mặc định.
  try {
    const result = await runConversationAgent(parsed.data);
    return NextResponse.json(result, { status: result.success ? 200 : 502 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Lỗi không xác định khi xử lý hội thoại.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
