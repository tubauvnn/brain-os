"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./RobotFace.module.css";

export type RobotFaceExpr =
  | "idle"
  | "happy"
  | "thinking"
  | "sad"
  | "speaking"
  | "listening"
  | "sleeping"
  | "error";

export type RobotGesture = "none" | "wave" | "nod";

export type RobotFaceProps = {
  face?: RobotFaceExpr;
  action?: RobotGesture;
  isListening?: boolean;
  isThinking?: boolean;
  isSpeaking?: boolean;
  statusText?: string;
  battery?: number;
  className?: string;
  // RobotVision (camera tracking) — -1..1, mắt lệch theo hướng người đứng trước
  // camera. targetDetected=false (khác undefined — xem resolveGaze()) bật hiệu
  // ứng "quét" mắt trái/phải khi chưa thấy ai.
  gazeX?: number;
  gazeY?: number;
  targetDetected?: boolean;
};

const STATUS_LABEL: Record<RobotFaceExpr, string> = {
  idle: "IDLE",
  happy: "HAPPY",
  thinking: "THINKING",
  listening: "LISTENING",
  speaking: "SPEAKING",
  sad: "SAD",
  sleeping: "SLEEP",
  error: "ERROR",
};

// Màu glow/viền theo state — cùng ngôn ngữ màu với phần còn lại của /robot
// (amber=happy, purple=thinking, emerald=speaking, indigo=sleep...), thêm màu
// mới cho listening (teal) và error (đỏ) vì 2 state này chưa có trước đây.
const SCREEN_STYLE: Record<RobotFaceExpr, { border: string; shadow: string }> = {
  idle: { border: "border-zinc-700/80", shadow: "shadow-[0_0_50px_-14px_rgba(161,161,170,0.35)]" },
  happy: { border: "border-amber-600/60", shadow: "shadow-[0_0_60px_-10px_rgba(245,158,11,0.45)]" },
  thinking: { border: "border-purple-600/60", shadow: "shadow-[0_0_60px_-10px_rgba(168,85,247,0.45)]" },
  listening: { border: "border-teal-500/60", shadow: "shadow-[0_0_60px_-10px_rgba(45,212,191,0.5)]" },
  speaking: { border: "border-emerald-600/60", shadow: "shadow-[0_0_60px_-10px_rgba(16,185,129,0.45)]" },
  sad: { border: "border-indigo-700/60", shadow: "shadow-[0_0_50px_-14px_rgba(99,102,241,0.35)]" },
  sleeping: { border: "border-indigo-800/60", shadow: "shadow-[0_0_45px_-16px_rgba(99,102,241,0.3)]" },
  error: { border: "border-red-600/70", shadow: "shadow-[0_0_60px_-8px_rgba(239,68,68,0.55)]" },
};

const FACE_FILL = "#2c2a28"; // nâu-đen mềm cho mắt/miệng trên nền cơm nắm trắng ngà
const RICE_FILL = "#fbf6ec"; // trắng ngà (không dùng trắng thuần để đỡ gắt trên nền tối)
const BLUSH_FILL = "#ff9db0";

// Onigiri (cơm nắm) bo tròn — dùng chung cho mọi state, chỉ đổi mắt/miệng/icon bên trong.
function RiceBody() {
  return (
    <>
      <path
        d="M100,26 C108,26 114,31 118,39 L163,142 C169,154 163,168 150,170
           L50,170 C37,168 31,154 37,142 L82,39 C86,31 92,26 100,26 Z"
        fill={RICE_FILL}
        stroke="rgba(0,0,0,0.06)"
        strokeWidth={1}
      />
      {/* Dải rong biển (nori) — đặc trưng onigiri */}
      <path
        d="M54,128 L146,128 L150,141 C152,150 150,159 143,164
           L57,164 C50,159 48,150 50,141 Z"
        fill="#232323"
      />
    </>
  );
}

function BlinkingEyes() {
  return (
    <g>
      <ellipse cx={75} cy={86} rx={12.5} ry={13} fill={FACE_FILL}>
        <animate attributeName="ry" values="13;13;1.5;13;13" keyTimes="0;0.9;0.94;0.97;1" dur="4.4s" repeatCount="indefinite" />
      </ellipse>
      <ellipse cx={125} cy={86} rx={12.5} ry={13} fill={FACE_FILL}>
        <animate attributeName="ry" values="13;13;1.5;13;13" keyTimes="0;0.9;0.94;0.97;1" dur="4.4s" repeatCount="indefinite" />
      </ellipse>
      <circle cx={71} cy={81} r={3} fill="#fff" opacity={0.85} />
      <circle cx={121} cy={81} r={3} fill="#fff" opacity={0.85} />
    </g>
  );
}

function HappyEyes() {
  return (
    <g stroke={FACE_FILL} strokeWidth={6} strokeLinecap="round" fill="none">
      <path d="M62,90 Q75,74 88,90" />
      <path d="M112,90 Q125,74 138,90" />
    </g>
  );
}

function SadEyes() {
  return (
    <g>
      <ellipse cx={75} cy={90} rx={11} ry={11} fill={FACE_FILL} />
      <ellipse cx={125} cy={90} rx={11} ry={11} fill={FACE_FILL} />
      {/* Mí mắt cụp xuống tạo cảm giác buồn */}
      <path d="M60,78 Q75,72 90,80" fill={RICE_FILL} />
      <path d="M110,80 Q125,72 140,78" fill={RICE_FILL} />
    </g>
  );
}

function ThinkingEyes() {
  return (
    <g>
      <ellipse cx={75} cy={84} rx={11} ry={11} fill={FACE_FILL}>
        <animate attributeName="cy" values="84;80;84" dur="2.4s" repeatCount="indefinite" />
      </ellipse>
      <ellipse cx={125} cy={84} rx={11} ry={11} fill={FACE_FILL}>
        <animate attributeName="cy" values="84;80;84" dur="2.4s" repeatCount="indefinite" />
      </ellipse>
      <circle cx={78} cy={79} r={2.4} fill="#fff" opacity={0.8}>
        <animate attributeName="cx" values="78;80;78" dur="2.4s" repeatCount="indefinite" />
      </circle>
      <circle cx={128} cy={79} r={2.4} fill="#fff" opacity={0.8}>
        <animate attributeName="cx" values="128;130;128" dur="2.4s" repeatCount="indefinite" />
      </circle>
    </g>
  );
}

function ListeningEyes() {
  return (
    <g>
      <ellipse cx={75} cy={86} rx={14.5} ry={15} fill={FACE_FILL} />
      <ellipse cx={125} cy={86} rx={14.5} ry={15} fill={FACE_FILL} />
      <circle cx={70} cy={80} r={3.4} fill="#fff" opacity={0.9} />
      <circle cx={120} cy={80} r={3.4} fill="#fff" opacity={0.9} />
    </g>
  );
}

function SleepingEyes() {
  return (
    <g stroke={FACE_FILL} strokeWidth={4} strokeLinecap="round" fill="none">
      <path d="M64,88 Q75,93 86,88" />
      <path d="M114,88 Q125,93 136,88" />
    </g>
  );
}

function ErrorEyes() {
  return (
    <g>
      <ellipse cx={75} cy={88} rx={11} ry={12} fill={FACE_FILL} />
      <ellipse cx={125} cy={88} rx={11} ry={12} fill={FACE_FILL} />
      <path d="M62,72 L88,76" stroke={FACE_FILL} strokeWidth={4} strokeLinecap="round" />
      <path d="M138,72 L112,76" stroke={FACE_FILL} strokeWidth={4} strokeLinecap="round" />
    </g>
  );
}

function Cheeks({ bright = false }: { bright?: boolean }) {
  return (
    <g fill={BLUSH_FILL} opacity={bright ? 0.55 : 0.32}>
      <ellipse cx={56} cy={104} rx={10} ry={6.5} />
      <ellipse cx={144} cy={104} rx={10} ry={6.5} />
    </g>
  );
}

function IdleMouth() {
  return <path d="M88,116 Q100,120 112,116" stroke={FACE_FILL} strokeWidth={4} strokeLinecap="round" fill="none" />;
}
function HappyMouth() {
  return <path d="M78,110 Q100,130 122,110" stroke={FACE_FILL} strokeWidth={6} strokeLinecap="round" fill="none" />;
}
function SadMouth() {
  return <path d="M86,124 Q100,114 114,124" stroke={FACE_FILL} strokeWidth={4} strokeLinecap="round" fill="none" />;
}
function ThinkingMouth() {
  return <path d="M92,118 Q100,115 108,118" stroke={FACE_FILL} strokeWidth={4} strokeLinecap="round" fill="none" />;
}
function SleepingMouth() {
  return <line x1={94} y1={118} x2={106} y2={118} stroke={FACE_FILL} strokeWidth={4} strokeLinecap="round" />;
}
function ErrorMouth() {
  return (
    <path
      d="M85,118 L92,112 L100,122 L108,112 L115,118"
      stroke={FACE_FILL}
      strokeWidth={3.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  );
}
// Miệng nói — animate liên tục bằng SVG <animate> gốc, chỉ render khi đang speaking.
function SpeakingMouth() {
  return (
    <ellipse cx={100} cy={119} rx={15} ry={6} fill={FACE_FILL}>
      <animate attributeName="ry" values="4;13;4;9;4" dur="0.85s" repeatCount="indefinite" />
    </ellipse>
  );
}

function ThinkingDots() {
  return (
    <g>
      {[0, 1, 2].map((i) => (
        <circle
          key={i}
          cx={122 + i * 12}
          cy={40}
          r={3.2}
          fill="#c084fc"
          className={styles.dot}
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </g>
  );
}

function ListeningPing() {
  return (
    <g>
      <circle cx={100} cy={30} r={4} fill="#2dd4bf" opacity={0.9} />
      {[0, 1].map((i) => (
        <circle key={i} cx={100} cy={30} r={4} fill="none" stroke="#2dd4bf" strokeWidth={2}>
          <animate attributeName="r" values="4;16" dur="1.6s" begin={`${i * 0.8}s`} repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.7;0" dur="1.6s" begin={`${i * 0.8}s`} repeatCount="indefinite" />
        </circle>
      ))}
    </g>
  );
}

function HappySparkle() {
  return (
    <g className={styles.sparkle}>
      <path d="M150,34 L152.5,40 L159,42.5 L152.5,45 L150,51 L147.5,45 L141,42.5 L147.5,40 Z" fill="#fbbf24" />
    </g>
  );
}

function SleepZ() {
  return (
    <g fontFamily="ui-monospace, monospace" fontWeight={700} fill="#818cf8">
      <text x={140} y={44} fontSize={14} className={styles.zFloat} style={{ animationDelay: "0s" }}>
        Z
      </text>
      <text x={150} y={32} fontSize={10} className={styles.zFloat} style={{ animationDelay: "0.9s" }}>
        z
      </text>
    </g>
  );
}

// Ưu tiên state theo yêu cầu: isSpeaking > isListening > isThinking > face (prop).
function resolveExpr(props: RobotFaceProps): RobotFaceExpr {
  if (props.isSpeaking) return "speaking";
  if (props.isListening) return "listening";
  if (props.isThinking) return "thinking";
  return props.face ?? "idle";
}

// Biên độ lệch mắt tối đa theo trục X/Y, tính bằng đơn vị toạ độ SVG (viewBox
// 0-200) — dùng thuộc tính `transform` gốc của SVG (không phải CSS transform)
// để lệch đúng tỉ lệ dù RobotFace được render lớn/nhỏ khác nhau (card thường vs
// kiosk fullscreen).
const GAZE_SHIFT_X = 8;
const GAZE_SHIFT_Y = 5;

export function RobotFace({
  face = "idle",
  action = "none",
  isListening = false,
  isThinking = false,
  isSpeaking = false,
  statusText,
  battery,
  className = "",
  gazeX,
  gazeY,
  targetDetected,
}: RobotFaceProps) {
  const expr = resolveExpr({ face, isListening, isThinking, isSpeaking });
  const screenStyle = SCREEN_STYLE[expr];
  const label = statusText ?? STATUS_LABEL[expr];

  // Cử chỉ "wave"/"nod" là hiệu ứng nhất thời chồng lên biểu cảm nền — phát 1 lần
  // rồi tự tắt, không ảnh hưởng animation liên tục (thở/chớp mắt/nói...).
  const [gesture, setGesture] = useState<RobotGesture>("none");
  const gestureTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (action === "none") return;
    setGesture(action);
    if (gestureTimerRef.current) clearTimeout(gestureTimerRef.current);
    gestureTimerRef.current = setTimeout(() => setGesture("none"), 900);
    return () => {
      if (gestureTimerRef.current) clearTimeout(gestureTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action]);

  let Eyes = BlinkingEyes;
  let Mouth = IdleMouth;
  if (expr === "happy") {
    Eyes = HappyEyes;
    Mouth = HappyMouth;
  } else if (expr === "sad") {
    Eyes = SadEyes;
    Mouth = SadMouth;
  } else if (expr === "thinking") {
    Eyes = ThinkingEyes;
    Mouth = ThinkingMouth;
  } else if (expr === "listening") {
    Eyes = ListeningEyes;
    Mouth = IdleMouth;
  } else if (expr === "sleeping") {
    Eyes = SleepingEyes;
    Mouth = SleepingMouth;
  } else if (expr === "error") {
    Eyes = ErrorEyes;
    Mouth = ErrorMouth;
  } else if (expr === "speaking") {
    Eyes = BlinkingEyes;
    Mouth = SpeakingMouth;
  }

  const gestureClass = gesture === "wave" ? styles.gestureWave : gesture === "nod" ? styles.gestureNod : "";

  // targetDetected === false (không phải "chưa truyền prop") mới bật hiệu ứng
  // quét mắt — trang không dùng RobotVision thì không truyền prop này, mắt vẫn
  // tĩnh như trước (không đổi hành vi mặc định của phiên 20).
  const isScanning = targetDetected === false;
  const gazeTransform =
    !isScanning && (typeof gazeX === "number" || typeof gazeY === "number")
      ? `translate(${(gazeX ?? 0) * GAZE_SHIFT_X} ${(gazeY ?? 0) * GAZE_SHIFT_Y})`
      : undefined;

  return (
    <div
      className={`relative aspect-square rounded-[2rem] border bg-gradient-to-b from-[#0b0b0f] to-[#151519] ${screenStyle.border} ${screenStyle.shadow} ${
        expr === "error" ? styles.errorRing : ""
      } ${className}`}
    >
      <div className={`h-full w-full flex items-center justify-center ${styles.screen} ${gestureClass}`}>
        <svg viewBox="0 0 200 200" className="w-[78%] h-[78%]" role="img" aria-label={`Robot đang ${label.toLowerCase()}`}>
          <RiceBody />
          <Cheeks bright={expr === "happy"} />
          <g transform={gazeTransform}>
            {isScanning && (
              <animateTransform
                attributeName="transform"
                type="translate"
                values={`-${GAZE_SHIFT_X} 0; ${GAZE_SHIFT_X} 0; -${GAZE_SHIFT_X} 0`}
                dur="4s"
                repeatCount="indefinite"
              />
            )}
            <Eyes />
          </g>
          <Mouth />
          {expr === "thinking" && <ThinkingDots />}
          {expr === "listening" && <ListeningPing />}
          {expr === "happy" && <HappySparkle />}
          {expr === "sleeping" && <SleepZ />}
        </svg>
      </div>

      <div className="absolute bottom-2 left-0 right-0 flex items-center justify-center px-3">
        <span className="text-[10px] tracking-widest font-mono text-zinc-400/80 select-none">{label}</span>
      </div>
      {typeof battery === "number" && (
        <span className="absolute top-2 right-3 text-[10px] font-mono text-zinc-500/70 select-none">
          {Math.round(battery)}%
        </span>
      )}
    </div>
  );
}
