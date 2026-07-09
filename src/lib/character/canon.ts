import fs from "fs";
import path from "path";

// ChinChin Character Canon — nguồn ẢNH THẬT DUY NHẤT cho ngoại hình nhân vật,
// upload thủ công tại assets/chinchin/characters/ (NGOÀI src/, không qua git —
// đây là tài sản IP, không phải source code). QUY TẮC TUYỆT ĐỐI:
//   - KHÔNG BAO GIỜ tự thiết kế lại tỉ lệ/màu sắc/silhouette/biểu tượng/nét mặt.
//   - Mọi workflow liên quan hình ảnh (artwork/animation/storyboard/comic/
//     sticker/video prompt) PHẢI tham chiếu file ở đây trước khi sinh nội dung.
//   - Nếu kết quả sinh ra mâu thuẫn với ảnh canon, ẢNH CANON LUÔN THẮNG.
//
// File path lưu dạng tương đối (từ project root) — mọi consumer (Character
// Agent, Image Agent, provider ảnh thật sau này) tự resolve khi cần đọc bytes.

export const CANON_IMAGE_PATHS: Record<string, string> = {
  cam: "assets/chinchin/characters/cam_canon.png",
  trang: "assets/chinchin/characters/trang_canon.png",
  nau: "assets/chinchin/characters/nau_canon.png",
};

// Height chart — tham chiếu tỉ lệ chiều cao CHUNG cho cả 3 nhân vật (không
// thuộc riêng ai), dùng cho mọi cảnh có từ 2 nhân vật trở lên.
export const HEIGHT_CHART_CANON_PATH = "assets/chinchin/characters/height_chart_canon.png";

export function canonFileExists(relativePath: string): boolean {
  try {
    return fs.existsSync(path.join(process.cwd(), relativePath));
  } catch {
    return false;
  }
}
