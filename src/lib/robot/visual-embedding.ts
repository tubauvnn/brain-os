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

function embeddingDistance(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return Infinity;
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i]);
  return sum / a.length;
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
