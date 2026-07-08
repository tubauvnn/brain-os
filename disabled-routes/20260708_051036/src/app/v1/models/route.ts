import { NextRequest, NextResponse } from "next/server";
import { verifyXiaoziWebhook } from "@/lib/brain/webhook-auth";

// Danh sách model giả lập cho client OpenAI-compatible (Xiaozhi) — chỉ để
// hiện trong UI chọn model, không ảnh hưởng logic xử lý thật (luôn đi qua
// handleXiaoziMessage() ở /v1/chat/completions bất kể tên model gửi lên).
export async function GET(req: NextRequest) {
  const auth = verifyXiaoziWebhook(req, {});
  if (!auth.ok) {
    return NextResponse.json(
      { error: { message: "Unauthorized Brain OS compatible API", type: "unauthorized" } },
      { status: 401 }
    );
  }

  return NextResponse.json({
    object: "list",
    data: [
      { id: "brainos-local", object: "model", created: 0, owned_by: "brain-os" },
      { id: "brainos-auto", object: "model", created: 0, owned_by: "brain-os" },
    ],
  });
}
