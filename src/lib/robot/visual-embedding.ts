// "Temporary visual embedding" — KHÔNG phải face recognition thật (mục 4 yêu
// cầu gốc: "No face recognition yet. Use temporary visual embedding only.").
// Đây chỉ là ảnh xám thu nhỏ của vùng mặt (lưới 6x6 = 36 số 0..1), đủ để đoán
// thô "có phải cùng 1 người vừa đứng trước camera không" trong 30 phút gần
// nhất — KHÔNG lưu xuống DB, KHÔNG định danh ai cả, mất hết khi tải lại trang.

const EMBED_GRID = 6;

export function computeEmbedding(
  imageData: ImageData,
  box: { x: number; y: number; width: number; height: number }
): number[] {
  const { data, width: imgW, height: imgH } = imageData;
  const bx = Math.max(0, Math.floor(box.x));
  const by = Math.max(0, Math.floor(box.y));
  const bw = Math.max(1, Math.min(imgW - bx, Math.round(box.width)));
  const bh = Math.max(1, Math.min(imgH - by, Math.round(box.height)));
  const cellW = bw / EMBED_GRID;
  const cellH = bh / EMBED_GRID;

  const embedding: number[] = [];
  for (let gy = 0; gy < EMBED_GRID; gy++) {
    for (let gx = 0; gx < EMBED_GRID; gx++) {
      const startX = bx + Math.floor(gx * cellW);
      const endX = Math.max(startX + 1, bx + Math.floor((gx + 1) * cellW));
      const startY = by + Math.floor(gy * cellH);
      const endY = Math.max(startY + 1, by + Math.floor((gy + 1) * cellH));
      let sum = 0;
      let count = 0;
      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          if (x < 0 || y < 0 || x >= imgW || y >= imgH) continue;
          const i = (y * imgW + x) * 4;
          sum += (data[i] + data[i + 1] + data[i + 2]) / 3;
          count++;
        }
      }
      embedding.push(count > 0 ? sum / count / 255 : 0);
    }
  }
  return embedding;
}

export function embeddingDistance(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return Infinity;
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i]);
  return sum / a.length;
}

// Bảng màu thô để đặt tên cho màu áo ước lượng (Phase 6F Conversation Memory)
// — CHỈ 1 màu đại diện gần đúng lấy từ vùng dưới mặt, không phải nhận diện
// trang phục thật, luôn phải nói kèm giọng phỏng đoán ("hình như"), không
// bao giờ khẳng định chắc chắn.
const COLOR_NAMES: { name: string; r: number; g: number; b: number }[] = [
  { name: "trắng", r: 235, g: 235, b: 235 },
  { name: "đen", r: 20, g: 20, b: 20 },
  { name: "xám", r: 130, g: 130, b: 130 },
  { name: "đỏ", r: 200, g: 40, b: 40 },
  { name: "cam", r: 230, g: 130, b: 40 },
  { name: "vàng", r: 230, g: 210, b: 60 },
  { name: "xanh lá", r: 60, g: 160, b: 80 },
  { name: "xanh dương", r: 50, g: 90, b: 190 },
  { name: "tím", r: 130, g: 70, b: 170 },
  { name: "hồng", r: 220, g: 140, b: 170 },
  { name: "nâu", r: 120, g: 80, b: 50 },
];

function nearestColorName(r: number, g: number, b: number): string {
  let best = COLOR_NAMES[0];
  let bestDist = Infinity;
  for (const c of COLOR_NAMES) {
    const d = (r - c.r) ** 2 + (g - c.g) ** 2 + (b - c.b) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return best.name;
}

// Mẫu màu THÔ vùng "ngay dưới mặt" (ước lượng vùng vai/ngực áo) — chỉ trung
// bình cộng RGB rồi tìm tên màu gần nhất, KHÔNG phải nhận diện trang phục.
// null nếu vùng lấy mẫu nằm ngoài khung hình (mặt quá sát mép dưới).
export function sampleShirtColor(
  imageData: ImageData,
  faceBox: { x: number; y: number; width: number; height: number }
): { r: number; g: number; b: number; name: string } | null {
  const { data, width: imgW, height: imgH } = imageData;
  const sx = Math.max(0, Math.floor(faceBox.x - faceBox.width * 0.15));
  const ex = Math.min(imgW, Math.ceil(faceBox.x + faceBox.width * 1.15));
  const sy = Math.floor(faceBox.y + faceBox.height * 1.1);
  const ey = Math.min(imgH, Math.ceil(faceBox.y + faceBox.height * 2.2));
  if (sy >= imgH || sx >= ex || sy >= ey) return null;

  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let count = 0;
  for (let y = sy; y < ey; y++) {
    for (let x = sx; x < ex; x++) {
      const i = (y * imgW + x) * 4;
      sumR += data[i];
      sumG += data[i + 1];
      sumB += data[i + 2];
      count++;
    }
  }
  if (count === 0) return null;
  const r = Math.round(sumR / count);
  const g = Math.round(sumG / count);
  const b = Math.round(sumB / count);
  return { r, g, b, name: nearestColorName(r, g, b) };
}

export type Visitor = { embedding: number[]; lastSeenAt: number };

// So embedding hiện tại với danh sách "khách vừa gặp" — chỉ xét những người
// còn trong cửa sổ windowMs (mục 4: "within 30 minutes"), lấy khoảng cách nhỏ
// nhất; coi là "gặp lại" nếu khoảng cách đó dưới threshold.
export function matchVisitor(
  embedding: number[],
  visitors: Visitor[],
  now: number,
  windowMs: number,
  threshold: number
): Visitor | null {
  let best: Visitor | null = null;
  let bestDist = Infinity;
  for (const v of visitors) {
    if (now - v.lastSeenAt > windowMs) continue;
    const d = embeddingDistance(embedding, v.embedding);
    if (d < bestDist) {
      bestDist = d;
      best = v;
    }
  }
  return best && bestDist <= threshold ? best : null;
}
