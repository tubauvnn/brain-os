import { prisma } from "@/lib/prisma";

// People service — cổng đọc DUY NHẤT của Conversation Agent vào "relationship
// memory" (bảng People/Profile đã có sẵn từ trước, prisma/schema.prisma —
// KHÔNG tạo bảng/model mới, cùng nguyên tắc src/lib/memory/, src/lib/knowledge/).
// People đã có đủ name/alias/relation/access_level/notes/tags cho
// "owner/family/known collaborators/ChinChin team members" (Phase 6B mục 6).
// "last_interaction" chưa có cột riêng (chưa có log tương tác theo người) —
// dùng tạm `updated_at` của record People làm xấp xỉ, không bịa thêm field.
// KHÔNG làm nhận diện khuôn mặt ở đây — FaceProfile tồn tại trong schema
// nhưng ngoài phạm vi Phase 6B ("Do not implement face recognition yet").

export type PersonContext = {
  name: string;
  alias: string | null;
  relation: string | null;
  accessLevel: number;
  notes: string | null;
  lastKnownUpdateAt: string;
};

export type OwnerContext = { name: string; alias: string | null; bio: string | null };

function stripDiacritics(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

// Chủ hệ thống (Profile — luôn đúng 1 dòng, xem seed script) — dùng để trả
// lời trung thực các câu hỏi "tao là ai"/"tôi là ai" thay vì đoán bừa.
export async function getOwnerContext(): Promise<OwnerContext | null> {
  return prisma.profile.findFirst({ select: { name: true, alias: true, bio: true } });
}

// Quét People theo tên/alias xuất hiện trong message — bounded (bảng People
// quy mô cá nhân, không cần index full-text). Trả rỗng nếu chưa có ai trong
// bảng (KHÔNG bịa người).
export async function findMentionedPeople(text: string): Promise<PersonContext[]> {
  const normalizedText = stripDiacritics(text);
  const all = await prisma.people.findMany({
    select: { name: true, alias: true, relation: true, access_level: true, notes: true, updated_at: true },
  });

  return all
    .filter((p) => {
      if (normalizedText.includes(stripDiacritics(p.name))) return true;
      if (p.alias && normalizedText.includes(stripDiacritics(p.alias))) return true;
      return false;
    })
    .map((p) => ({
      name: p.name,
      alias: p.alias,
      relation: p.relation,
      accessLevel: p.access_level,
      notes: p.notes,
      lastKnownUpdateAt: p.updated_at.toISOString(),
    }));
}
