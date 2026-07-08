"use client";

import { useEffect, useRef } from "react";
import styles from "./RobotFaceKiosk.module.css";
import { useRobotEyes, type CameraTarget, type RobotAttention } from "@/lib/robot/useRobotEyes";

// Robot face kiểu màn hình/kiosk — KHÔNG dùng hình cơm nắm/mascot. Đầu robot
// là 1 khung bo góc kiểu màn hình thiết bị thật (TFT sau này), mắt là 2 khối
// bo tròn sáng màu di chuyển theo useRobotEyes (pointer/camera/idle + blink),
// miệng đổi hình theo state. Toàn bộ vẽ bằng div/CSS, không ảnh/SVG bên ngoài.

export type RobotFaceState =
  | "idle"
  | "happy"
  | "thinking"
  | "sad"
  | "speaking"
  | "listening"
  | "sleeping"
  | "error";

export type RobotGesture = "none" | "wave" | "nod";

const STATE_LABEL: Record<RobotFaceState, string> = {
  idle: "IDLE",
  happy: "HAPPY",
  thinking: "THINKING",
  sad: "SAD",
  speaking: "SPEAKING",
  listening: "LISTENING",
  sleeping: "SLEEP",
  error: "ERROR",
};

// Cùng ngôn ngữ màu với phần còn lại của /robot (badge trạng thái...).
const STATE_RING: Record<RobotFaceState, { border: string; shadow: string; eye: string }> = {
  idle: { border: "border-zinc-700/80", shadow: "shadow-[0_0_50px_-14px_rgba(161,161,170,0.35)]", eye: "#a5b4fc" },
  happy: { border: "border-amber-600/60", shadow: "shadow-[0_0_60px_-10px_rgba(245,158,11,0.45)]", eye: "#fcd34d" },
  thinking: { border: "border-purple-600/60", shadow: "shadow-[0_0_60px_-10px_rgba(168,85,247,0.45)]", eye: "#c4b5fd" },
  sad: { border: "border-indigo-700/60", shadow: "shadow-[0_0_50px_-14px_rgba(99,102,241,0.35)]", eye: "#818cf8" },
  speaking: { border: "border-emerald-600/60", shadow: "shadow-[0_0_60px_-10px_rgba(16,185,129,0.45)]", eye: "#6ee7b7" },
  listening: { border: "border-teal-500/60", shadow: "shadow-[0_0_60px_-10px_rgba(45,212,191,0.5)]", eye: "#5eead4" },
  sleeping: { border: "border-indigo-800/60", shadow: "shadow-[0_0_45px_-16px_rgba(99,102,241,0.3)]", eye: "#6366f1" },
  error: { border: "border-red-600/70", shadow: "shadow-[0_0_60px_-8px_rgba(239,68,68,0.55)]", eye: "#fca5a5" },
};

function attentionFromState(state: RobotFaceState): RobotAttention {
  if (state === "listening") return "listening";
  if (state === "thinking") return "thinking";
  if (state === "speaking") return "speaking";
  return "idle";
}

function Eyes({ eyeColor, closed }: { eyeColor: string; closed: boolean }) {
  if (closed) {
    // sad/sleeping/error dùng nét cong tĩnh, không tracking (không hợp lý để
    // "mắt nhắm" vẫn đảo qua lại theo con trỏ).
    return (
      <div className="flex items-center justify-center gap-7">
        <div className="w-11 h-1.5 rounded-full bg-zinc-500/70" />
        <div className="w-11 h-1.5 rounded-full bg-zinc-500/70" />
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center gap-6">
      <div
        className={`w-11 h-14 sm:w-12 sm:h-16 rounded-[40%] ${styles.eyePod}`}
        style={{ backgroundColor: eyeColor }}
      />
      <div
        className={`w-11 h-14 sm:w-12 sm:h-16 rounded-[40%] ${styles.eyePod}`}
        style={{ backgroundColor: eyeColor }}
      />
    </div>
  );
}

function Mouth({ state, speakingLevel }: { state: RobotFaceState; speakingLevel?: number }) {
  switch (state) {
    case "happy":
      return <div className="w-16 h-6 border-b-4 border-amber-300 rounded-b-full mx-auto" />;
    case "sad":
      return <div className="w-14 h-5 border-t-4 border-indigo-400 rounded-t-full mx-auto" />;
    case "thinking":
      return (
        <div className="flex items-center justify-center gap-1.5 h-4">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={`w-1.5 h-1.5 rounded-full bg-purple-300 ${styles.dot}`}
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      );
    case "listening":
      return (
        <div className="flex items-center justify-center gap-1 h-5">
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className={`w-1 rounded-full bg-teal-300 ${styles.wave}`}
              style={{ height: "16px", animationDelay: `${i * 0.09}s` }}
            />
          ))}
        </div>
      );
    case "speaking": {
      if (typeof speakingLevel === "number") {
        const h = 4 + Math.max(0, Math.min(1, speakingLevel)) * 16;
        return <div className="w-9 rounded-full bg-emerald-300 mx-auto" style={{ height: `${h}px` }} />;
      }
      return <div className={`w-9 h-4 rounded-full bg-emerald-300 mx-auto ${styles.mouthSpeak}`} />;
    }
    case "sleeping":
      return <div className="w-6 h-1 rounded-full bg-indigo-400/80 mx-auto" />;
    case "error":
      return (
        <div className="flex items-center justify-center gap-1 h-4">
          <span className="w-6 h-1 rounded-full bg-red-400 rotate-12" />
          <span className="w-6 h-1 rounded-full bg-red-400 -rotate-12" />
        </div>
      );
    default:
      return <div className="w-8 h-1 rounded-full bg-zinc-500 mx-auto" />;
  }
}

export type RobotFaceKioskProps = {
  state: RobotFaceState;
  gesture?: RobotGesture;
  speakingLevel?: number;
  cameraTarget?: CameraTarget;
  enablePointerTracking?: boolean;
  batteryPercent?: number;
  statusLabel?: string;
  className?: string;
};

export function RobotFaceKiosk({
  state,
  gesture = "none",
  speakingLevel,
  cameraTarget,
  enablePointerTracking = true,
  batteryPercent,
  statusLabel,
  className = "",
}: RobotFaceKioskProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  useRobotEyes(containerRef, {
    cameraTarget,
    attention: attentionFromState(state),
    enablePointerTracking,
  });

  // Gesture (wave/nod) — hiệu ứng nhất thời, tự clear qua class CSS animation
  // (không lặp), giống cơ chế cũ của RobotFace.tsx.
  const gestureClass = gesture === "wave" ? styles.gestureWave : gesture === "nod" ? styles.gestureNod : "";

  const ring = STATE_RING[state];
  const closedEyes = state === "sad" || state === "sleeping" || state === "error";
  const label = statusLabel ?? STATE_LABEL[state];

  return (
    <div
      ref={containerRef}
      className={`relative aspect-square rounded-[2rem] border bg-gradient-to-b from-[#0b0b0f] to-[#151519] ${ring.border} ${ring.shadow} ${
        state === "error" ? styles.errorRing : ""
      } ${className}`}
      role="img"
      aria-label={`Robot đang ${label.toLowerCase()}`}
    >
      <div className={`h-full w-full flex flex-col items-center justify-center gap-5 ${styles.screen} ${gestureClass}`}>
        <Eyes eyeColor={ring.eye} closed={closedEyes} />
        <Mouth state={state} speakingLevel={speakingLevel} />
        {state === "sleeping" && (
          <div className="absolute top-6 right-8 flex flex-col items-end gap-0.5 font-mono text-indigo-300 text-xs">
            <span className={styles.zFloat} style={{ animationDelay: "0s" }}>Z</span>
            <span className={styles.zFloat} style={{ animationDelay: "0.8s" }}>z</span>
          </div>
        )}
      </div>

      {typeof batteryPercent === "number" && (
        <div className="absolute top-3 left-3 text-[10px] font-mono text-zinc-500">{batteryPercent}%</div>
      )}
      <div className="absolute bottom-2 left-0 right-0 flex items-center justify-center px-3">
        <span className="text-[10px] tracking-widest font-mono text-zinc-400/80 select-none">{label}</span>
      </div>
    </div>
  );
}
