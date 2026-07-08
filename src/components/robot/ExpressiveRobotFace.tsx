"use client";

import styles from "./ExpressiveRobotFace.module.css";

export type RobotState =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking"
  | "happy"
  | "sad"
  | "surprised"
  | "confused"
  | "sleeping"
  | "error";

export type RobotEmotion = "neutral" | "joy" | "curious" | "shy" | "excited" | "sad" | "confused";

export type ExpressiveRobotFaceProps = {
  state?: RobotState;
  emotion?: RobotEmotion;
  gazeX?: number;
  gazeY?: number;
  targetDetected?: boolean;
  speakingLevel?: number;
  statusText?: string;
  className?: string;
};

const STATUS_LABEL: Record<RobotState, string> = {
  idle: "IDLE",
  listening: "LISTENING",
  thinking: "THINKING",
  speaking: "SPEAKING",
  happy: "HAPPY",
  sad: "SAD",
  surprised: "SURPRISED",
  confused: "CONFUSED",
  sleeping: "SLEEP",
  error: "ERROR",
};

// Màu viền/glow theo state — cùng ngôn ngữ màu với /robot (RobotFace.tsx):
// amber=happy, purple=thinking, emerald=speaking, indigo=sleep/sad, teal=listening,
// đỏ=error. Thêm vàng cho surprised, tím nhạt cho confused.
const SCREEN_STYLE: Record<RobotState, { border: string; shadow: string }> = {
  idle: { border: "border-zinc-700/80", shadow: "shadow-[0_0_50px_-14px_rgba(161,161,170,0.35)]" },
  listening: { border: "border-teal-500/60", shadow: "shadow-[0_0_60px_-10px_rgba(45,212,191,0.5)]" },
  thinking: { border: "border-purple-600/60", shadow: "shadow-[0_0_60px_-10px_rgba(168,85,247,0.45)]" },
  speaking: { border: "border-emerald-600/60", shadow: "shadow-[0_0_60px_-10px_rgba(16,185,129,0.45)]" },
  happy: { border: "border-amber-600/60", shadow: "shadow-[0_0_60px_-10px_rgba(245,158,11,0.45)]" },
  sad: { border: "border-indigo-700/60", shadow: "shadow-[0_0_50px_-14px_rgba(99,102,241,0.35)]" },
  surprised: { border: "border-yellow-400/60", shadow: "shadow-[0_0_60px_-10px_rgba(250,204,21,0.5)]" },
  confused: { border: "border-violet-500/50", shadow: "shadow-[0_0_50px_-14px_rgba(167,139,250,0.4)]" },
  sleeping: { border: "border-indigo-800/60", shadow: "shadow-[0_0_45px_-16px_rgba(99,102,241,0.3)]" },
  error: { border: "border-red-600/70", shadow: "shadow-[0_0_60px_-8px_rgba(239,68,68,0.55)]" },
};

const FACE_FILL = "#2c2a28"; // nâu-đen mềm cho mắt/miệng trên nền cơm nắm trắng ngà
const RICE_FILL = "#fbf6ec"; // trắng ngà (không dùng trắng thuần để đỡ gắt trên nền tối)
const BLUSH_FILL = "#ff9db0";

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

// Onigiri (cơm nắm) bo tròn tam giác — thân dùng chung cho mọi state, chỉ đổi
// mắt/miệng/icon phụ bên trong theo state + emotion.
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

// ── Eyes theo state (10 state) ──────────────────────────────────────────────

function IdleEyes() {
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

function ThinkingEyes() {
  // Mắt nhìn lên — dịch tâm mắt + đồng tử lên trên so với idle.
  return (
    <g>
      <ellipse cx={75} cy={82} rx={11} ry={11} fill={FACE_FILL} />
      <ellipse cx={125} cy={82} rx={11} ry={11} fill={FACE_FILL} />
      <circle cx={78} cy={76} r={2.6} fill="#fff" opacity={0.85}>
        <animate attributeName="cx" values="78;80;78" dur="2.4s" repeatCount="indefinite" />
      </circle>
      <circle cx={128} cy={76} r={2.6} fill="#fff" opacity={0.85}>
        <animate attributeName="cx" values="128;130;128" dur="2.4s" repeatCount="indefinite" />
      </circle>
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
      <path d="M60,78 Q75,72 90,80" fill={RICE_FILL} />
      <path d="M110,80 Q125,72 140,78" fill={RICE_FILL} />
    </g>
  );
}

function SurprisedEyes() {
  return (
    <g>
      <circle cx={75} cy={86} r={15} fill={FACE_FILL} />
      <circle cx={125} cy={86} r={15} fill={FACE_FILL} />
      <circle cx={70} cy={80} r={3.6} fill="#fff" opacity={0.9} />
      <circle cx={120} cy={80} r={3.6} fill="#fff" opacity={0.9} />
    </g>
  );
}

function ConfusedEyes() {
  // Mắt lệch nhẹ — một bên cao, một bên thấp hơn.
  return (
    <g>
      <ellipse cx={75} cy={82} rx={11} ry={11} fill={FACE_FILL} />
      <ellipse cx={125} cy={90} rx={11} ry={11} fill={FACE_FILL} />
      <circle cx={71} cy={78} r={2.8} fill="#fff" opacity={0.85} />
      <circle cx={121} cy={86} r={2.8} fill="#fff" opacity={0.85} />
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

const EYES_BY_STATE: Record<RobotState, () => React.ReactElement> = {
  idle: IdleEyes,
  listening: ListeningEyes,
  thinking: ThinkingEyes,
  speaking: IdleEyes,
  happy: HappyEyes,
  sad: SadEyes,
  surprised: SurprisedEyes,
  confused: ConfusedEyes,
  sleeping: SleepingEyes,
  error: ErrorEyes,
};

// ── Mouth theo state ────────────────────────────────────────────────────────

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
function SurprisedMouth() {
  return <ellipse cx={100} cy={119} rx={9} ry={11} fill={FACE_FILL} />;
}
function ConfusedMouth() {
  return <path d="M88,118 Q96,122 104,116 Q108,113 114,117" stroke={FACE_FILL} strokeWidth={4} strokeLinecap="round" fill="none" />;
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
// Miệng nói — nếu có speakingLevel (0..1) thì mở/đóng theo giá trị đó (khớp
// audio thật), không có thì tự loop bằng SVG <animate>.
function SpeakingMouth({ level }: { level?: number }) {
  if (typeof level === "number") {
    const ry = 4 + clamp01(level) * 11;
    return <ellipse cx={100} cy={119} rx={15} ry={ry} fill={FACE_FILL} />;
  }
  return (
    <ellipse cx={100} cy={119} rx={15} ry={6} fill={FACE_FILL}>
      <animate attributeName="ry" values="4;13;4;9;4" dur="0.85s" repeatCount="indefinite" />
    </ellipse>
  );
}

// ── Icon phụ theo state ─────────────────────────────────────────────────────

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

function QuestionMark() {
  return (
    <g className={styles.questionWiggle}>
      <text x={140} y={44} fontSize={20} fontFamily="ui-monospace, monospace" fontWeight={700} fill="#a78bfa">
        ?
      </text>
    </g>
  );
}

function Cheeks({ bright, emotion }: { bright: boolean; emotion: RobotEmotion }) {
  const opacity = bright || emotion === "joy" || emotion === "excited" || emotion === "shy" ? 0.55 : emotion === "sad" ? 0.16 : 0.32;
  return (
    <g fill={BLUSH_FILL} opacity={opacity}>
      <ellipse cx={56} cy={104} rx={10} ry={6.5} />
      <ellipse cx={144} cy={104} rx={10} ry={6.5} />
    </g>
  );
}

const GAZE_SHIFT_X = 8;
const GAZE_SHIFT_Y = 5;

export function ExpressiveRobotFace({
  state = "idle",
  emotion = "neutral",
  gazeX,
  gazeY,
  targetDetected,
  speakingLevel,
  statusText,
  className = "",
}: ExpressiveRobotFaceProps) {
  const screenStyle = SCREEN_STYLE[state];
  const label = statusText ?? STATUS_LABEL[state];

  // Chớp mắt tự nhiên độc lập với state — chỉ áp dụng khi Eyes hiện tại là
  // IdleEyes (đã có <animate> nội tại), các state khác (happy/thinking/...) có
  // hình mắt cố định không chớp để giữ đúng biểu cảm.
  const Eyes = EYES_BY_STATE[state];

  let Mouth: React.ReactElement;
  switch (state) {
    case "happy":
      Mouth = <HappyMouth />;
      break;
    case "sad":
      Mouth = <SadMouth />;
      break;
    case "thinking":
      Mouth = <ThinkingMouth />;
      break;
    case "surprised":
      Mouth = <SurprisedMouth />;
      break;
    case "confused":
      Mouth = <ConfusedMouth />;
      break;
    case "sleeping":
      Mouth = <SleepingMouth />;
      break;
    case "error":
      Mouth = <ErrorMouth />;
      break;
    case "speaking":
      Mouth = <SpeakingMouth level={speakingLevel} />;
      break;
    default:
      Mouth = <IdleMouth />;
  }

  // targetDetected === false (không phải "chưa truyền prop") mới bật hiệu ứng
  // quét mắt trái/phải; targetDetected === true thì mắt lệch theo gazeX/gazeY.
  const isScanning = targetDetected === false;
  const gazeTransform =
    !isScanning && (typeof gazeX === "number" || typeof gazeY === "number")
      ? `translate(${(gazeX ?? 0) * GAZE_SHIFT_X} ${(gazeY ?? 0) * GAZE_SHIFT_Y})`
      : undefined;

  const tiltClass = emotion === "curious" ? styles.curiousTilt : emotion === "shy" ? styles.shyTilt : "";
  const bounceClass = emotion === "excited" ? styles.excitedBounce : "";
  const showSparkle = state === "happy" || emotion === "joy" || emotion === "excited";

  return (
    <div
      className={`relative aspect-square rounded-[2rem] border bg-gradient-to-b from-[#0b0b0f] to-[#151519] ${screenStyle.border} ${screenStyle.shadow} ${
        state === "error" ? styles.errorRing : ""
      } ${className}`}
    >
      <div className={`h-full w-full flex items-center justify-center ${styles.screen} ${bounceClass}`}>
        <svg
          viewBox="0 0 200 200"
          className={`w-[78%] h-[78%] ${tiltClass}`}
          role="img"
          aria-label={`Robot đang ${label.toLowerCase()}`}
        >
          <RiceBody />
          <Cheeks bright={state === "happy"} emotion={emotion} />
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
          {Mouth}
          {state === "thinking" && <ThinkingDots />}
          {state === "listening" && <ListeningPing />}
          {showSparkle && <HappySparkle />}
          {state === "sleeping" && <SleepZ />}
          {(state === "confused" || emotion === "confused") && <QuestionMark />}
        </svg>
      </div>

      <div className="absolute bottom-2 left-0 right-0 flex items-center justify-center px-3">
        <span className="text-[10px] tracking-widest font-mono text-zinc-400/80 select-none">{label}</span>
      </div>
    </div>
  );
}
