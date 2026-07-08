import { prisma } from "@/lib/prisma";

const DEFAULT_HISTORY_LIMIT = 20;

// Lấy N tin nhắn gần nhất của 1 session, dựng lại thành text theo thứ tự thời
// gian (cũ → mới) để đưa vào context cho AI — giúp robot "nhớ" vài câu vừa nói
// trong phiên hiện tại. Best-effort: lỗi DB thì trả rỗng, không throw.
export async function loadSessionHistoryText(sessionId: string, limit = DEFAULT_HISTORY_LIMIT): Promise<string> {
  try {
    const rows = await prisma.conversationMessage.findMany({
      where: { session_id: sessionId },
      orderBy: { created_at: "desc" },
      take: limit,
      select: { role: true, content: true },
    });
    if (rows.length === 0) return "";
    return rows
      .reverse()
      .map((m) => `${m.role === "user" ? "User" : "Chuối"}: ${m.content}`)
      .join("\n");
  } catch {
    return "";
  }
}

// Đảm bảo ConversationSession tồn tại trước khi dùng làm khoá ngoại cho
// ConversationMessage (id do client tự sinh, chưa chắc đã có row DB tương ứng).
// Trả về false nếu tạo thất bại — caller nên coi như "không có session" thay vì
// throw, để chat vẫn hoạt động dù DB có vấn đề.
export async function ensureSession(sessionId: string): Promise<boolean> {
  try {
    await prisma.conversationSession.upsert({
      where: { id: sessionId },
      update: {},
      create: { id: sessionId, source: "robot" },
    });
    return true;
  } catch {
    return false;
  }
}

export async function countSessionMessages(sessionId: string): Promise<number | null> {
  try {
    return await prisma.conversationMessage.count({ where: { session_id: sessionId } });
  } catch {
    return null;
  }
}
