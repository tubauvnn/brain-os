// Kiểu dữ liệu dùng chung cho Presence Engine (Phase 6E) — tách khỏi
// PresenceDetector (thu thập frame từ camera) và PresenceEngine (chính sách
// chào/attention/idle) để 2 phần này test/thay thế độc lập được.

/** 1 lần đọc camera đã xử lý xong — không phải ảnh thô, không rời khỏi máy client. */
export type PresenceFrame = {
  detected: boolean;
  /** Số khuôn mặt nhìn thấy trong khung — chỉ tin cậy khi source="face_detector" (browser FaceDetector API). motion_fallback không đếm được, luôn trả 1 khi có chuyển động. */
  count: number;
  x: number; // -1 trái .. 1 phải, khuôn mặt LỚN NHẤT trong khung
  y: number; // -1 trên .. 1 dưới
  size: number; // 0-1, kích thước tương đối trong khung — proxy cho khoảng cách
  distance: "near" | "medium" | "far" | "unknown";
  motion: number; // 0-1, mức chuyển động khung hình này so với khung trước
  /** Vector thô ước lượng vùng mặt (KHÔNG phải face recognition thật) — null nếu không có mặt/không tin cậy (vd motion_fallback). Chỉ dùng để so "có phải cùng 1 người vừa gặp không" trong phiên hiện tại. */
  embedding: number[] | null;
  source: "face_detector" | "motion_fallback" | "none";
};

export function sizeToDistance(size: number): PresenceFrame["distance"] {
  if (size >= 0.45) return "near";
  if (size >= 0.2) return "medium";
  return "far";
}

export const NO_PRESENCE_BASE: Omit<PresenceFrame, "motion"> = {
  detected: false,
  count: 0,
  x: 0,
  y: 0,
  size: 0,
  distance: "unknown",
  embedding: null,
  source: "none",
};

export type IdleBehavior = "blink" | "look_left" | "look_right" | "smile" | "breathe";

// Mỗi PresenceEvent là 1 hành động mà /robot (giả lập) thực hiện ngay —
// sau này DeviceManager chỉ cần đọc kind/say/behavior để map sang lệnh phần
// cứng thật (servo/loa/màn hình), KHÔNG cần biết logic bên trong PresenceEngine.
export type PresenceEvent =
  | { kind: "greet"; say: string }
  | { kind: "returning_visitor"; say: string }
  | { kind: "attention"; on: boolean; say?: string }
  | { kind: "idle"; behavior: IdleBehavior }
  | { kind: "person_left" };
