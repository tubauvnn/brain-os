// Servo-ready: chuyển toạ độ tracking (-1..1) từ RobotVision thành góc pan/tilt
// giả định — CHƯA gọi phần cứng thật, chỉ để /robot hiển thị debug và làm sẵn
// interface cho lúc nối servo pan/tilt thật sau này.
export type PanTilt = {
  pan: number;
  tilt: number;
  centered: boolean;
};

const MAX_PAN_DEG = 45;
const MAX_TILT_DEG = 25;
const CENTER_THRESHOLD = 0.18;

export function targetToPanTilt(target: { x: number; y: number }): PanTilt {
  return {
    pan: Math.round(target.x * MAX_PAN_DEG),
    tilt: Math.round(target.y * MAX_TILT_DEG),
    centered: Math.abs(target.x) < CENTER_THRESHOLD && Math.abs(target.y) < CENTER_THRESHOLD,
  };
}

// Lerp nhẹ giữa gaze cũ/mới — mắt di chuyển mượt thay vì snap thẳng theo từng
// frame tracking (camera báo target ~mỗi 250-400ms, snap thẳng bị giật).
export function smoothGaze(
  prev: { x: number; y: number },
  next: { x: number; y: number }
): { x: number; y: number } {
  return {
    x: prev.x * 0.75 + next.x * 0.25,
    y: prev.y * 0.75 + next.y * 0.25,
  };
}
