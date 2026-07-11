"use client";

import { useEffect, useRef } from "react";
import { VadEngine } from "@/lib/robot/voice/vad-engine";

// VoiceCapture — Phase 6I. "Cảm biến" mic thuần, cùng vai trò
// PresenceDetector.tsx cho camera: chỉ thu thập + báo sự kiện qua callback,
// KHÔNG tự quyết định turn-taking/barge-in/gửi đi đâu — page.tsx (qua
// TurnStateMachine, src/lib/robot/voice/turn-state.ts) mới là nơi quyết
// định. Không render gì (không cần <video>/<canvas> như camera — âm thanh
// không cần phần tử DOM để phân tích/ghi).
//
// mục 7 "Echo prevention": echoCancellation/noiseSuppression/autoGainControl
// bật ở getUserMedia constraints — lớp phòng vệ CHÍNH (trình duyệt tự lọc
// hầu hết tiếng loa lẫn vào mic thật). "speaking-state gating" là
// `vadThreshold` prop — page.tsx truyền ngưỡng CAO HƠN lúc robot đang nói
// (khó kích hoạt hơn, không phải tắt hẳn mic — mục "Do not permanently
// disable the microphone during hands-free mode").

export type VoiceCaptureProps = {
  /** Có mở mic (getUserMedia) hay không. */
  enabled: boolean;
  /** true = VAD tự quyết định start/stop ghi âm (hands-free). false = ghi âm theo pushToTalkActive (nhấn giữ). */
  handsFree: boolean;
  /** Chỉ dùng khi handsFree=false — true trong lúc đang giữ nút mic. */
  pushToTalkActive: boolean;
  /** RMS 0..1 — ghi đè ngưỡng VAD mặc định (mục 7, "gating" lúc robot đang nói). undefined = dùng mặc định VadEngine. */
  vadThreshold?: number;
  onSpeechStart: () => void;
  onSpeechEnd: (blob: Blob, durationMs: number, reason: "vad" | "push_to_talk_release" | "max_utterance") => void;
  /** 0..100, gọi ~10 lần/giây khi mic đang mở — mục 13 "small input level indicator". */
  onVolumeLevel: (level: number) => void;
  onMicError: (message: string) => void;
};

const SAMPLE_INTERVAL_MS = 100; // ~10 mẫu RMS/giây — đủ mượt cho VAD + level indicator, không tốn CPU

function pickSupportedMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  return candidates.find((c) => MediaRecorder.isTypeSupported?.(c));
}

export function VoiceCapture({
  enabled,
  handsFree,
  pushToTalkActive,
  vadThreshold,
  onSpeechStart,
  onSpeechEnd,
  onVolumeLevel,
  onMicError,
}: VoiceCaptureProps) {
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sampleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const vadRef = useRef<VadEngine | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingStartedAtRef = useRef<number>(0);

  // Props đọc trong interval/callback qua ref "luôn mới nhất" — cùng pattern
  // đã dùng xuyên suốt Phase 6E-6H (interval tạo 1 lần lúc mount, không được
  // đóng băng closure ở giá trị render đầu).
  const latestRef = useRef({ handsFree, pushToTalkActive, vadThreshold, onSpeechStart, onSpeechEnd, onVolumeLevel, onMicError });
  latestRef.current = { handsFree, pushToTalkActive, vadThreshold, onSpeechStart, onSpeechEnd, onVolumeLevel, onMicError };

  useEffect(() => {
    if (!enabled) {
      stop();
      return;
    }
    start();
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // push-to-talk: ghi âm bắt đầu/kết thúc theo đúng lúc prop đổi, KHÔNG qua VAD.
  useEffect(() => {
    if (handsFree || !enabled) return;
    if (pushToTalkActive) startRecording();
    else stopRecordingAndEmit("push_to_talk_release");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pushToTalkActive, handsFree, enabled]);

  async function start() {
    if (!vadRef.current) vadRef.current = new VadEngine();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) throw new Error("Trình duyệt không hỗ trợ Web Audio API.");
      const audioContext = new AudioCtx();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      analyserRef.current = analyser;

      sampleTimerRef.current = setInterval(sampleVolume, SAMPLE_INTERVAL_MS);
    } catch {
      latestRef.current.onMicError("Không xin được quyền micro — kiểm tra lại quyền trình duyệt.");
    }
  }

  function stop() {
    if (sampleTimerRef.current) {
      clearInterval(sampleTimerRef.current);
      sampleTimerRef.current = null;
    }
    stopRecordingAndEmit(null); // huỷ ghi âm dở nếu có, KHÔNG emit (mic đang tắt hẳn, không phải hết câu)
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    audioContextRef.current?.close().catch(() => {});
    audioContextRef.current = null;
    analyserRef.current = null;
    vadRef.current?.reset();
  }

  function sampleVolume() {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const data = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(data);
    let sumSquares = 0;
    for (let i = 0; i < data.length; i++) {
      const normalized = (data[i] - 128) / 128; // -1..1
      sumSquares += normalized * normalized;
    }
    const rms = Math.sqrt(sumSquares / data.length); // 0..~1
    latestRef.current.onVolumeLevel(Math.min(100, Math.round(rms * 100 * 3))); // *3 — RMS giọng nói bình thường hiếm khi vượt ~0.3, nhân lên cho thanh mức nhìn có phản ứng rõ

    if (!latestRef.current.handsFree) return; // push-to-talk không cần VAD quyết định start/stop
    const vad = vadRef.current;
    if (!vad) return;
    vad.setThreshold(latestRef.current.vadThreshold);
    const event = vad.feed(Date.now(), rms);
    if (!event) return;

    if (event.kind === "speech_start") {
      latestRef.current.onSpeechStart();
      startRecording();
    } else if (event.kind === "speech_end") {
      if (event.tooShort) return; // VAD tự lọc phần lớn rồi, đây là lưới an toàn cuối
      stopRecordingAndEmit("vad");
    } else if (event.kind === "max_utterance") {
      stopRecordingAndEmit("max_utterance");
    }
  }

  function startRecording() {
    const stream = streamRef.current;
    if (!stream || recorderRef.current) return;
    try {
      const mimeType = pickSupportedMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      chunksRef.current = [];
      recordingStartedAtRef.current = Date.now();
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.start();
      recorderRef.current = recorder;
    } catch {
      latestRef.current.onMicError("Không ghi âm được — trình duyệt có thể chưa hỗ trợ MediaRecorder.");
    }
  }

  function stopRecordingAndEmit(reason: "vad" | "push_to_talk_release" | "max_utterance" | null) {
    const recorder = recorderRef.current;
    if (!recorder) return;
    recorderRef.current = null;
    const durationMs = Date.now() - recordingStartedAtRef.current;
    recorder.onstop = () => {
      if (!reason) return; // huỷ (mic tắt hẳn giữa chừng) — không emit
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
      chunksRef.current = [];
      if (blob.size > 0) latestRef.current.onSpeechEnd(blob, durationMs, reason);
    };
    try {
      recorder.stop();
    } catch {
      // recorder đã ở trạng thái "inactive" — bỏ qua, không có gì để dừng.
    }
  }

  return null;
}
