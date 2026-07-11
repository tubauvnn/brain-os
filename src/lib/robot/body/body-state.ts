import { targetToPanTilt } from "../tracking";
import type { RobotFaceState } from "@/components/robot/RobotFaceKiosk";
import type { BodyState } from "./types";

// observeBody — Phase 6H, phần "Observe" tương ứng của body (song song
// observeWorld() ở Phase 6G). Thuần hàm — nhận tín hiệu thô page.tsx đã có
// sẵn (KHÔNG tính lại gaze/robotState/mic/camera ở đây) + BodyState lần
// trước (để suy motionState), trả về ĐÚNG 1 bản BodyState mới nhất.

export type BodyObserveInputs = {
  eyeDirection: { x: number; y: number };
  screenState: RobotFaceState;
  speakerBusy: boolean;
  micBusy: boolean;
  cameraBusy: boolean;
  /** % pin thật lấy từ RobotState.battery (Postgres) — null nếu poll chưa xong lần nào. */
  battery: number | null;
  cameraAvailable: boolean;
};

// Đổi hướng nhìn dưới ngưỡng này coi là rung số/không đáng kể — tránh
// motionState nhấp nháy "moving" liên tục do sai số làm tròn/lerp.
const MOTION_EPSILON = 0.03;

// capabilities thiết bị THẬT (prisma/seed.ts, dev-robot-simulator): chỉ có
// "face"/"speak"/"turn" — KHÔNG có servo/motor thật, "turn" là robot_command
// phần mềm (Phase 6A: "chưa kết nối phần cứng ESP32 thật"). displayAvailable
// (mặt) và voiceAvailable (giọng) vì vậy = true, servoAvailable = false.
const SERVO_AVAILABLE = false;
const DISPLAY_AVAILABLE = true;
const VOICE_AVAILABLE = true;

export function observeBody(inputs: BodyObserveInputs, previous: BodyState | null): BodyState {
  const headAngle = targetToPanTilt(inputs.eyeDirection);
  const moved =
    !previous ||
    Math.abs(previous.eyeDirection.x - inputs.eyeDirection.x) > MOTION_EPSILON ||
    Math.abs(previous.eyeDirection.y - inputs.eyeDirection.y) > MOTION_EPSILON;

  return {
    headAngle: { pan: headAngle.pan, tilt: headAngle.tilt },
    eyeDirection: inputs.eyeDirection,
    screenState: inputs.screenState,
    speakerBusy: inputs.speakerBusy,
    micBusy: inputs.micBusy,
    cameraBusy: inputs.cameraBusy,
    battery: inputs.battery,
    charging: null, // không có cảm biến sạc thật — không bịa
    wifi: typeof navigator !== "undefined" && "onLine" in navigator ? (navigator.onLine ? "online" : "offline") : "online",
    temperature: null, // không có cảm biến nhiệt thật — không bịa
    motionState: moved ? "moving" : "still",
    servoAvailable: SERVO_AVAILABLE,
    displayAvailable: DISPLAY_AVAILABLE,
    voiceAvailable: VOICE_AVAILABLE,
    cameraAvailable: inputs.cameraAvailable,
  };
}
