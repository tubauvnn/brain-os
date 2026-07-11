"use client";

import { useEffect, useRef } from "react";
import { computeEmbedding, sampleShirtColor } from "@/lib/robot/visual-embedding";
import { NO_PRESENCE_BASE, sizeToDistance, type PresenceFrame } from "@/lib/robot/presence-types";

// PresenceDetector — Phase 6E mục 1. Camera RIÊNG cho presence (tách khỏi
// camera chụp ảnh gửi Vision ở page.tsx) — xử lý hoàn toàn phía client, không
// gửi frame lên server, không lưu ảnh. Cùng cơ chế FaceDetector/motion-fallback
// như WebFaceTracker.tsx/RobotVision.tsx, nhưng bung thêm: đếm số mặt, ước
// lượng khoảng cách, mức chuyển động, và 1 "temporary visual embedding" cho
// PresenceEngine so khớp khách quen (KHÔNG phải face recognition thật).
//
// Phase 6F — thêm shirtColor (mẫu màu thô vùng dưới mặt, chỉ khi source=
// face_detector có bounding box thật) cho ConversationMemory
// (src/lib/robot/social/conversation-state.ts) mô tả khách vãng lai.

type FaceDetectorLike = {
  detect(source: CanvasImageSource): Promise<{ boundingBox: { x: number; y: number; width: number; height: number } }[]>;
};
type FaceDetectorConstructor = new (options?: { fastMode?: boolean; maxDetectedFaces?: number }) => FaceDetectorLike;

const PROCESS_INTERVAL_MS = 350;
const SAMPLE_SIZE = 64;
const MOTION_DIFF_THRESHOLD = 25;
const MOTION_MIN_WEIGHT = MOTION_DIFF_THRESHOLD * 40;
// Chuẩn hoá thô tổng chênh lệch khung hình về 0..1 — chỉ để làm tín hiệu
// tương đối (mạnh/yếu), không phải đơn vị vật lý gì cả.
const MOTION_NORMALIZER = SAMPLE_SIZE * SAMPLE_SIZE * 3 * 80;
const MAX_DETECTED_FACES = 6;

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export type PresenceDetectorProps = {
  enabled: boolean;
  onFrame: (frame: PresenceFrame) => void;
};

export function PresenceDetector({ enabled, onFrame }: PresenceDetectorProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const faceDetectorRef = useRef<FaceDetectorLike | null>(null);
  const prevFrameRef = useRef<Uint8ClampedArray | null>(null);
  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;

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
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      // Không xin được quyền camera — báo "không có ai" thay vì im lặng,
      // idle behaviors ở PresenceEngine vẫn chạy bình thường (frame=null phía
      // page.tsx khi presence tắt hẳn; ở đây coi như không detect được gì).
      onFrameRef.current({ ...NO_PRESENCE_BASE, motion: 0 });
      return;
    }

    const w = window as unknown as { FaceDetector?: FaceDetectorConstructor };
    if (w.FaceDetector) {
      try {
        faceDetectorRef.current = new w.FaceDetector({ fastMode: true, maxDetectedFaces: MAX_DETECTED_FACES });
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
  }

  function diffAgainstPrevious(frame: Uint8ClampedArray, prev: Uint8ClampedArray | null) {
    if (!prev) return { motion: 0, weight: 0, cx: SAMPLE_SIZE / 2, cy: SAMPLE_SIZE / 2 };
    let sumX = 0;
    let sumY = 0;
    let sumWeight = 0;
    let totalDiff = 0;
    for (let y = 0; y < SAMPLE_SIZE; y++) {
      for (let x = 0; x < SAMPLE_SIZE; x++) {
        const i = (y * SAMPLE_SIZE + x) * 4;
        const diff = Math.abs(frame[i] - prev[i]) + Math.abs(frame[i + 1] - prev[i + 1]) + Math.abs(frame[i + 2] - prev[i + 2]);
        totalDiff += diff;
        if (diff > MOTION_DIFF_THRESHOLD) {
          sumX += x * diff;
          sumY += y * diff;
          sumWeight += diff;
        }
      }
    }
    return {
      motion: clamp(totalDiff / MOTION_NORMALIZER, 0, 1),
      weight: sumWeight,
      cx: sumWeight > 0 ? sumX / sumWeight : SAMPLE_SIZE / 2,
      cy: sumWeight > 0 ? sumY / sumWeight : SAMPLE_SIZE / 2,
    };
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
    const imageData = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);

    const diff = diffAgainstPrevious(imageData.data, prevFrameRef.current);
    prevFrameRef.current = new Uint8ClampedArray(imageData.data);

    if (faceDetectorRef.current) {
      try {
        const faces = await faceDetectorRef.current.detect(canvas);
        if (faces.length > 0) {
          const largest = faces.reduce((a, b) =>
            a.boundingBox.width * a.boundingBox.height >= b.boundingBox.width * b.boundingBox.height ? a : b
          );
          const f = largest.boundingBox;
          const size = clamp(Math.max(f.width, f.height) / SAMPLE_SIZE, 0, 1);
          onFrameRef.current({
            detected: true,
            count: faces.length,
            x: clamp(((f.x + f.width / 2) / SAMPLE_SIZE) * 2 - 1, -1, 1),
            y: clamp(((f.y + f.height / 2) / SAMPLE_SIZE) * 2 - 1, -1, 1),
            size,
            distance: sizeToDistance(size),
            motion: diff.motion,
            embedding: computeEmbedding(imageData, f),
            shirtColor: sampleShirtColor(imageData, f),
            source: "face_detector",
          });
          return;
        }
        onFrameRef.current({ ...NO_PRESENCE_BASE, motion: diff.motion });
        return;
      } catch {
        // FaceDetector lỗi runtime hiếm gặp — rơi xuống fallback cho frame này.
      }
    }

    // Không có FaceDetector API (đa số trình duyệt hiện tại) — chỉ biết CÓ
    // chuyển động + ước lượng vị trí trọng tâm. KHÔNG đếm được số người,
    // KHÔNG có embedding tin cậy nên không bật nhận diện "khách quen" ở nhánh này.
    if (diff.weight < MOTION_MIN_WEIGHT) {
      onFrameRef.current({ ...NO_PRESENCE_BASE, motion: diff.motion });
      return;
    }
    onFrameRef.current({
      detected: true,
      count: 1,
      x: clamp((diff.cx / SAMPLE_SIZE) * 2 - 1, -1, 1),
      y: clamp((diff.cy / SAMPLE_SIZE) * 2 - 1, -1, 1),
      size: 0.3,
      distance: "unknown",
      motion: diff.motion,
      embedding: null,
      shirtColor: null,
      source: "motion_fallback",
    });
  }

  // Camera presence luôn ẩn — không phải tính năng debug/preview, xử lý ngầm
  // phía sau mặt robot.
  return (
    <div className="hidden">
      <video ref={videoRef} muted playsInline />
      <canvas ref={canvasRef} />
    </div>
  );
}
