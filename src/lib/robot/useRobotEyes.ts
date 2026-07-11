"use client";

import { useEffect, useRef } from "react";

// Eye-tracking hook cho RobotFaceKiosk — không setState mỗi frame (tránh
// re-render 60 lần/giây), thay vào đó ghi thẳng CSS custom property lên
// containerRef qua requestAnimationFrame. Component con chỉ cần đọc các biến
// CSS này trong style/transform (xem RobotFaceKiosk.tsx), không cần re-render
// theo gaze.
//
// CSS vars ghi ra containerRef.current:
//   --gaze-x, --gaze-y   : px, đã clamp + lerp mượt — dùng cho transform pupil
//   --blink              : 0..1 (1 = mở to bình thường, 0 = nhắm hoàn toàn) —
//                          dùng làm scaleY cho mí mắt/đồng tử

export type RobotAttention = "idle" | "listening" | "thinking" | "speaking";

export type CameraTarget = { x: number; y: number; detected: boolean } | null;

export type UseRobotEyesOptions = {
  /** Target từ camera face-detection (RobotVision) — ưu tiên hơn con trỏ khi detected=true. */
  cameraTarget?: CameraTarget;
  /** Trạng thái chú ý hiện tại — ảnh hưởng nhẹ tới hướng nhìn (thinking nhìn hơi lên). */
  attention?: RobotAttention;
  /** Tắt hẳn pointer-tracking (vd khi camera đang là nguồn chính) — mặc định bật. */
  enablePointerTracking?: boolean;
  /**
   * Hướng nhìn cố định (-1..1), ưu tiên cao nhất — dùng cho lệnh rời rạc kiểu
   * "nhìn trái/phải/lên/xuống" từ robot-ai action (xem eyes trong RobotChatResult).
   * null/undefined = không override, quay lại camera/pointer/idle như bình thường.
   */
  gazeOverride?: { x: number; y: number } | null;
  /** Presence Engine (Phase 6E mục 3) — người đang nhìn thẳng vào robot: chớp mắt nhanh hơn. */
  attentionActive?: boolean;
  /** Tăng số này để ép chớp mắt ngay lập tức (Phase 6E idle behavior "blink") — giá trị cụ thể không quan trọng, chỉ cần đổi. */
  blinkTrigger?: number;
};

const MAX_PUPIL_X_PX = 15; // 12–18px theo yêu cầu
const MAX_PUPIL_Y_PX = 10; // 8–12px theo yêu cầu
const LERP_FACTOR = 0.12;
const IDLE_TIMEOUT_MS = 5000;
const BLINK_MIN_MS = 3000;
const BLINK_MAX_MS = 7000;
// Presence Engine mục 3 "blink faster" khi có người đang chú ý nhìn robot.
const BLINK_FAST_MIN_MS = 1200;
const BLINK_FAST_MAX_MS = 2500;
const BLINK_DURATION_MS = 150; // 120–180ms theo yêu cầu

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function useRobotEyes(
  containerRef: React.RefObject<HTMLElement | null>,
  opts: UseRobotEyesOptions = {}
) {
  const optsRef = useRef(opts);
  optsRef.current = opts;

  // Target "thô" (-1..1) trước khi lerp — cập nhật bởi pointer/camera/idle.
  const rawTargetRef = useRef({ x: 0, y: 0 });
  // Giá trị đã lerp mượt (-1..1) — đây mới là cái thực sự vẽ ra.
  const smoothRef = useRef({ x: 0, y: 0 });
  const lastRealInputRef = useRef(0);
  const idleWanderPhaseRef = useRef(0);
  const blinkValueRef = useRef(1); // 1 = mắt mở
  const blinkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blinkUntilRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  // Pointer/touch trên toàn màn hình — mắt nhìn theo vị trí con trỏ bất kể ở
  // đâu trên trang (không chỉ trong bounding box của mặt), cảm giác tự nhiên
  // hơn cho demo kiosk.
  useEffect(() => {
    function handlePointer(clientX: number, clientY: number) {
      if (optsRef.current.enablePointerTracking === false) return;
      // Nếu camera đang thật sự detect được thì để camera ưu tiên, bỏ qua pointer.
      if (optsRef.current.cameraTarget?.detected) return;
      const nx = clamp((clientX / window.innerWidth) * 2 - 1, -1, 1);
      const ny = clamp((clientY / window.innerHeight) * 2 - 1, -1, 1);
      rawTargetRef.current = { x: nx, y: ny };
      lastRealInputRef.current = performance.now();
    }
    function onMouseMove(e: MouseEvent) {
      handlePointer(e.clientX, e.clientY);
    }
    function onTouchMove(e: TouchEvent) {
      const t = e.touches[0];
      if (t) handlePointer(t.clientX, t.clientY);
    }
    window.addEventListener("mousemove", onMouseMove, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("touchmove", onTouchMove);
    };
  }, []);

  // Blink tự nhiên — random mỗi 3-7s (1.2-2.5s nếu attentionActive, mục 3 "blink
  // faster"), kéo dài 120-180ms. Chạy độc lập, không phụ thuộc rAF loop chính
  // (chỉ setTimeout, rẻ). Đọc attentionActive tại THỜI ĐIỂM lên lịch (không
  // phải lúc effect mount) nên đổi ngay từ lần chớp mắt kế tiếp.
  useEffect(() => {
    function scheduleNext() {
      const fast = optsRef.current.attentionActive === true;
      const delay = fast ? randomBetween(BLINK_FAST_MIN_MS, BLINK_FAST_MAX_MS) : randomBetween(BLINK_MIN_MS, BLINK_MAX_MS);
      blinkTimerRef.current = setTimeout(() => {
        blinkUntilRef.current = performance.now() + BLINK_DURATION_MS;
        scheduleNext();
      }, delay);
    }
    scheduleNext();
    return () => {
      if (blinkTimerRef.current) clearTimeout(blinkTimerRef.current);
    };
  }, []);

  // Ép chớp mắt ngay lập tức khi blinkTrigger đổi giá trị — Presence Engine
  // idle behavior "blink" (mục 5), tách khỏi lịch tự nhiên ở trên.
  useEffect(() => {
    if (opts.blinkTrigger === undefined) return;
    blinkUntilRef.current = performance.now() + BLINK_DURATION_MS;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.blinkTrigger]);

  // Vòng lặp chính — rAF, ghi thẳng CSS var lên container ref (không setState).
  useEffect(() => {
    function tick() {
      const now = performance.now();
      const cameraTarget = optsRef.current.cameraTarget;
      const attention = optsRef.current.attention ?? "idle";

      // 1) Xác định target thô: gazeOverride (lệnh rời rạc) > camera (nếu detected)
      //    > pointer (đã ghi ở rawTargetRef qua listener) > idle wander (nếu quá
      //    lâu không có input thật).
      const gazeOverride = optsRef.current.gazeOverride;
      if (gazeOverride) {
        rawTargetRef.current = { x: gazeOverride.x, y: gazeOverride.y };
        lastRealInputRef.current = now;
      } else if (cameraTarget?.detected) {
        rawTargetRef.current = { x: cameraTarget.x, y: cameraTarget.y };
        lastRealInputRef.current = now;
      } else if (now - lastRealInputRef.current > IDLE_TIMEOUT_MS) {
        // Idle micro-movement: lượn nhẹ trái/phải bằng sóng sin chậm, biên độ nhỏ.
        idleWanderPhaseRef.current += 0.006;
        rawTargetRef.current = {
          x: Math.sin(idleWanderPhaseRef.current) * 0.35,
          y: Math.sin(idleWanderPhaseRef.current * 0.6) * 0.12,
        };
      }

      // 2) Attention state bias — nhẹ, cộng thêm vào target thô. Bỏ qua khi có
      //    gazeOverride, để lệnh nhìn rời rạc không bị kéo lệch.
      let biasX = 0;
      let biasY = 0;
      if (gazeOverride) {
        // no bias — giữ nguyên hướng nhìn được yêu cầu
      } else if (attention === "thinking") biasY = -0.35; // nhìn lên nhẹ
      else if (attention === "listening" || attention === "speaking") {
        // Nhìn thẳng hơn — kéo target về gần giữa (giảm biên độ thay vì ép cứng 0).
        rawTargetRef.current = {
          x: rawTargetRef.current.x * 0.4,
          y: rawTargetRef.current.y * 0.4,
        };
      }

      const targetX = clamp(rawTargetRef.current.x + biasX, -1, 1);
      const targetY = clamp(rawTargetRef.current.y + biasY, -1, 1);

      // 3) Lerp mượt.
      smoothRef.current.x += (targetX - smoothRef.current.x) * LERP_FACTOR;
      smoothRef.current.y += (targetY - smoothRef.current.y) * LERP_FACTOR;

      // 4) Blink value — 0 trong lúc blinkUntil còn hiệu lực, ngược lại 1.
      const blinking = now < blinkUntilRef.current;
      blinkValueRef.current = blinking ? 0 : 1;

      // 5) Ghi CSS vars.
      const el = containerRef.current;
      if (el) {
        el.style.setProperty("--gaze-x", `${(smoothRef.current.x * MAX_PUPIL_X_PX).toFixed(2)}px`);
        el.style.setProperty("--gaze-y", `${(smoothRef.current.y * MAX_PUPIL_Y_PX).toFixed(2)}px`);
        el.style.setProperty("--blink", `${blinkValueRef.current}`);
      }

      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
