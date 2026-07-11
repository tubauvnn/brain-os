// Tiện ích so khớp câu tiếng Việt dùng chung — trước Phase 6I hàm này sống
// riêng trong src/app/robot/page.tsx, giờ tách ra đây vì fast-commands.ts
// (lib thuần) cũng cần dùng — page.tsx import lại từ đây, không giữ bản sao
// thứ 2 (tránh 2 định nghĩa lệch nhau).

export function stripDiacriticsForMatch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    // Dấu câu cuối câu (STT thoại hay tự chèn "Dừng." "Thôi!" v.v.) — bỏ hẳn
    // (không thay bằng khoảng trắng, vì đứng cạnh dấu câu luôn có sẵn khoảng
    // trắng bao quanh trong lời nói tự nhiên, không sợ dính chữ liền nhau).
    .replace(/[.,!?;:'"…]/g, "")
    .trim();
}

/** So khớp SUBSTRING có word-boundary (cụm nằm trong câu dài hơn cũng khớp) — dùng cho input chữ gõ tay/câu dài. */
export function matchesAnyPhrase(text: string, phrases: string[]): boolean {
  const normalized = ` ${stripDiacriticsForMatch(text)} `;
  return phrases.some((p) => normalized.includes(` ${stripDiacriticsForMatch(p)} `));
}

/** So khớp TOÀN BỘ câu (sau chuẩn hoá) — dùng cho lệnh thoại ngắn (mục 8 Phase 6I) nơi substring sẽ dính nhầm câu dài hơn (vd "dừng" bên trong "robot dừng lại"). */
export function matchesExact(text: string, phrases: string[]): boolean {
  const normalized = stripDiacriticsForMatch(text);
  return phrases.includes(normalized);
}
