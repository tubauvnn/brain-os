import type { HumorCategory } from "./types";

// HumorEngine — Phase 6F mục 5+6. KHÔNG gọi AI provider nào — chọn ngẫu
// nhiên có kiểm soát (anti-repeat) trong các câu viết sẵn theo giọng miền
// Bắc, thân thiện, hơi tinh nghịch, dễ thương, KHÔNG BAO GIỜ phản cảm. Các
// câu có dấu (*) là nguyên văn ví dụ trong yêu cầu gốc.
//
// Cố tình dùng "tớ/mình" (KHÔNG phải "tao/mày" như lớp Personality của chat
// text/voice từ 2026-07-11, xem src/lib/robot-ai/personality.ts) — đây là
// giọng MASCOT xã giao/chủ động dành cho KHÁCH VÃNG LAI ẩn danh qua camera
// (Phase 6F), khác hẳn ngữ cảnh chat/voice (mặc định coi là CHỦ, vì hệ
// thống chỉ có 1 người dùng thật gõ/nói vào, không đăng nhập nhiều người).
// "tớ/mình" ở đây CHÍNH LÀ bản dịch của yêu cầu "Visitors receive polite
// replies" — khách lạ được giọng lịch sự hơn owner, không phải giọng
// tao/mày. KHÔNG trộn 2 giọng vào cùng 1 nhóm câu — nếu sau này cần thêm
// câu "chủ động" kiểu tao/mày (mục PROACTIVE của yêu cầu persona), đó là
// việc của 1 kênh khác (chat/voice-side idle nudge, hiện CHƯA có cơ chế
// này), không phải nhét vào đây.

const LINES: Record<HumorCategory, string[]> = {
  greeting: [
    "Chào bạn, ghé chơi với tớ tí nha!",
    "Ơ có bạn mới ghé kìa, chào nha!",
    "Chào bạn, tớ là Chuối đây, đứng lại chơi tí đi!",
    "Alo alo, có bạn nào đó vừa xuất hiện nè, chào nhé!",
  ],
  returning_greeting: [
    "Ơ lại là bạn.", // (*)
    "À hình như mình vừa gặp bạn lúc nãy.",
    "Ơ, bạn quay lại nữa à, vui ghê.",
    "Lại thấy bạn rồi, chào lại phát nha.",
  ],
  invite: [
    "Đứng nhìn lâu thế, có gì trên mặt tớ à?", // (*)
    "Đừng nhìn nữa ngại.", // (*)
    "Hôm nay trông vui thế.", // (*)
    "Bạn cứ đứng đấy hoài, hay là nói chuyện với tớ luôn đi?",
    "Tớ đoán bạn tò mò lắm rồi đúng không, hỏi tớ gì cũng được nha.",
  ],
  joke: [
    "No pressure nhé.", // (*)
    "Tớ không cắn đâu, yên tâm.",
    "Đứng tạo dáng cho tớ ngắm chắc?",
    "Bạn nhìn tớ chăm thế, tớ ngại quá đi mất.",
  ],
  goodbye: [
    "Hẹn gặp lại bạn nhé!",
    "Tớ ở đây, lúc nào ghé lại cứ gọi tớ.",
    "Bái bai, nhớ quay lại chơi nha.",
    "Tạm biệt bạn, giữ sức khoẻ nhé!",
  ],
  // Mục 7 — bám sát menu THẬT của ChinChin đã có trong dự án (cơm nắm kiểu
  // Nhật, xem src/lib/image/image-agent.ts "cửa hàng cơm nắm") thay vì bịa
  // sản phẩm mới. KHÔNG chốt giá/khuyến mãi cụ thể (có thể sai/lỗi thời) —
  // luôn gợi ý kèm giọng phỏng đoán cho phần chưa chắc (đúng tinh thần "no
  // fabrication" toàn dự án), để "tự nhiên, không như đọc kịch bản".
  sales: [
    "Hôm nay quầy có cơm nắm mới ra lò đó, ghé thử xem sao.",
    "Combo cơm nắm với mỳ trộn đang được nhiều bạn gọi lắm nha.",
    "Nếu bạn chưa biết ăn gì, cơm nắm ở đây là lựa chọn không tệ đâu.",
    "Hình như đang có ưu đãi hay ho ở quầy, hỏi nhân viên cho chắc nha.",
    "Cơm nắm gà Hàn hôm nay nhiều người chọn lắm.",
  ],
};

// Nhớ tối đa 2 câu vừa dùng mỗi nhóm (hoặc ít hơn nếu nhóm có <3 câu) — đủ để
// "xoay vòng tự nhiên" (mục 6) mà không đòi hỏi nhóm phải rất dài.
const HISTORY_SIZE = 2;

export class HumorEngine {
  private recent: Record<HumorCategory, string[]> = {
    greeting: [],
    returning_greeting: [],
    invite: [],
    joke: [],
    goodbye: [],
    sales: [],
  };

  pick(category: HumorCategory): string {
    const pool = LINES[category];
    const recentForCategory = this.recent[category];
    const candidates = pool.filter((line) => !recentForCategory.includes(line));
    // Nhóm quá nhỏ, recent đã chặn hết ứng viên — rơi về cả nhóm thay vì lỗi.
    const choices = candidates.length > 0 ? candidates : pool;
    const picked = choices[Math.floor(Math.random() * choices.length)];

    recentForCategory.push(picked);
    const cap = Math.min(HISTORY_SIZE, pool.length - 1);
    while (recentForCategory.length > cap) recentForCategory.shift();

    return picked;
  }
}
