"use client";

import { useEffect, useRef, useState } from "react";

export type FaceTarget = {
  detected: boolean;
  x: number; // -1 trái .. 1 phải
  y: number; // -1 trên .. 1 dưới
  size: number; // 0-1, kích thước tương đối trong khung hình
  confidence?: number;
  source: "face_detector" | "motion_fallback" | "none";
};

export type WebFaceTrackerProps = {
  enabled: boolean;
  debug?: boolean;
  onTargetUpdate: (target: FaceTarget) => void;
};

// FaceDetector là API thử nghiệm của trình duyệt (chủ yếu Chrome/Android
// WebView), chưa có trong lib.dom.d.ts — khai báo tối thiểu, fallback sang
// motion detection nếu trình duyệt không hỗ trợ.
type FaceDetectorLike = {
  detect(source: CanvasImageSource): Promise<{ boundingBox: { x: number; y: number; width: number; height: number } }[]>;
};
type FaceDetectorConstructor = new (options?: { fastMode?: boolean; maxDetectedFaces?: number }) => FaceDetectorLike;

const PROCESS_INTERVAL_MS = 300;
const SAMPLE_SIZE = 64; // canvas nhỏ — đủ ước lượng vị trí, không cần độ phân giải cao
const MOTION_DIFF_THRESHOLD = 25;
const MOTION_MIN_WEIGHT = MOTION_DIFF_THRESHOLD * 40;

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

const NO_TARGET: FaceTarget = { detected: false, x: 0, y: 0, size: 0, source: "none" };

type DebugBox = { x: number; y: number; width: number; height: number } | null;

// Camera + phát hiện mặt nhẹ, xử lý hoàn toàn phía client — không gửi frame
// lên server. Ưu tiên FaceDetector của trình duyệt; fallback motion/center
// detection bằng canvas nếu không có. Preview ẩn mặc định, chỉ hiện khi debug.
export function WebFaceTracker({ enabled, debug = false, onTargetUpdate }: WebFaceTrackerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const faceDetectorRef = useRef<FaceDetectorLike | null>(null);
  const prevFrameRef = useRef<Uint8ClampedArray | null>(null);
  const onTargetUpdateRef = useRef(onTargetUpdate);
  onTargetUpdateRef.current = onTargetUpdate;

  const [debugBox, setDebugBox] = useState<DebugBox>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      stop();
      return;
    }
    start();
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  async function start() {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      setCameraError("Không xin được quyền camera.");
      onTargetUpdateRef.current(NO_TARGET);
      return;
    }

    const w = window as unknown as { FaceDetector?: FaceDetectorConstructor };
    if (w.FaceDetector) {
      try {
        faceDetectorRef.current = new w.FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
      } catch {
        faceDetectorRef.current = null;
      }
    }

    prevFrameRef.current = null;
    intervalRef.current = setInterval(processFrame, PROCESS_INTERVAL_MS);
  }

  function stop() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    faceDetectorRef.current = null;
    prevFrameRef.current = null;
    setDebugBox(null);
  }

  async function processFrame() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;

    canvas.width = SAMPLE_SIZE;
    canvas.height = SAMPLE_SIZE;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);

    if (faceDetectorRef.current) {
      try {
        const faces = await faceDetectorRef.current.detect(canvas);
        if (faces.length > 0) {
          // Mặt lớn nhất trong khung hình nếu detect() trả về nhiều mặt.
          const largest = faces.reduce((a, b) =>
            a.boundingBox.width * a.boundingBox.height >= b.boundingBox.width * b.boundingBox.height ? a : b
          );
          const f = largest.boundingBox;
          const cx = (f.x + f.width / 2) / SAMPLE_SIZE;
          const cy = (f.y + f.height / 2) / SAMPLE_SIZE;
          const size = Math.max(f.width, f.height) / SAMPLE_SIZE;
          setDebugBox({ x: f.x / SAMPLE_SIZE, y: f.y / SAMPLE_SIZE, width: f.width / SAMPLE_SIZE, height: f.height / SAMPLE_SIZE });
          onTargetUpdateRef.current({
            detected: true,
            x: clamp(cx * 2 - 1, -1, 1),
            y: clamp(cy * 2 - 1, -1, 1),
            size: clamp(size, 0, 1),
            confidence: 1,
            source: "face_detector",
          });
          return;
        }
        setDebugBox(null);
        onTargetUpdateRef.current(NO_TARGET);
        return;
      } catch {
        // FaceDetector tồn tại nhưng detect() lỗi runtime (hiếm) — rơi xuống
        // fallback motion detection cho lần xử lý này thay vì bỏ cuộc hẳn.
      }
    }

    const frame = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data;
    const prev = prevFrameRef.current;
    prevFrameRef.current = new Uint8ClampedArray(frame);
    if (!prev) return; // cần tối thiểu 2 khung để so sánh chuyển động

    let sumX = 0;
    let sumY = 0;
    let sumWeight = 0;
    for (let y = 0; y < SAMPLE_SIZE; y++) {
      for (let x = 0; x < SAMPLE_SIZE; x++) {
        const i = (y * SAMPLE_SIZE + x) * 4;
        const diff = Math.abs(frame[i] - prev[i]) + Math.abs(frame[i + 1] - prev[i + 1]) + Math.abs(frame[i + 2] - prev[i + 2]);
        if (diff > MOTION_DIFF_THRESHOLD) {
          sumX += x * diff;
          sumY += y * diff;
          sumWeight += diff;
        }
      }
    }

    if (sumWeight < MOTION_MIN_WEIGHT) {
      setDebugBox(null);
      onTargetUpdateRef.current(NO_TARGET);
      return;
    }

    const cx = sumX / sumWeight / SAMPLE_SIZE;
    const cy = sumY / sumWeight / SAMPLE_SIZE;
    setDebugBox({ x: clamp(cx - 0.15, 0, 1), y: clamp(cy - 0.15, 0, 1), width: 0.3, height: 0.3 });
    onTargetUpdateRef.current({
      detected: true,
      x: clamp(cx * 2 - 1, -1, 1),
      y: clamp(cy * 2 - 1, -1, 1),
      size: 0.3,
      confidence: 0.4,
      source: "motion_fallback",
    });
  }

  if (!debug) {
    return (
      <div className="hidden">
        <video ref={videoRef} muted playsInline />
        <canvas ref={canvasRef} />
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-[60] w-36 sm:w-44 rounded-lg overflow-hidden border border-zinc-700 shadow-xl bg-black">
      <div className="relative">
        <video ref={videoRef} muted playsInline className="w-full h-full object-cover" />
        <canvas ref={canvasRef} className="hidden" />
        {debugBox && (
          <div
            className="absolute border-2 border-emerald-400"
            style={{
              left: `${debugBox.x * 100}%`,
              top: `${debugBox.y * 100}%`,
              width: `${debugBox.width * 100}%`,
              height: `${debugBox.height * 100}%`,
            }}
          />
        )}
        {cameraError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-[10px] text-red-300 text-center p-1">
            {cameraError}
          </div>
        )}
      </div>
    </div>
  );
}
