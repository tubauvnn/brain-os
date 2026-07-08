import { NextResponse } from "next/server";

// Server-side only — tạo "ephemeral client secret" cho OpenAI Realtime API để
// frontend dùng WebRTC nói chuyện trực tiếp với OpenAI mà KHÔNG bao giờ nhìn
// thấy OPENAI_API_KEY thật. Đây đúng theo khuyến nghị của OpenAI cho voice
// agent chạy trên trình duyệt/mobile: client chỉ được cầm 1 token ngắn hạn.
//
// Endpoint + request/response shape đã verify THẬT qua curl trực tiếp tới
// OpenAI (không đoán) — xem docs/ROBOT_ONLY_STATUS.md. `/v1/realtime/sessions`
// (dạng cũ, flat body {model, voice, ...}) trả 404 "Invalid URL" tại thời
// điểm viết code này — API đã đổi sang `/v1/realtime/client_secrets` với body
// lồng trong `session{}` và response trả `value` (không phải `client_secret.value`).
// Model cũng đổi tên: không còn `gpt-4o-realtime-preview`, danh sách hiện tại
// (curl /v1/models) là gpt-realtime, gpt-realtime-mini, gpt-realtime-2, v.v.
//
// CHƯA test round-trip audio thật qua WebRTC (môi trường này không có
// mic/loa thật) — chỉ đã verify request tạo ephemeral token thành công thật
// (HTTP 200, nhận được `value` hợp lệ). Nếu OpenAI đổi schema lần nữa, lỗi sẽ
// hiện rõ trong response {ok:false, error} thay vì fail âm thầm.

export const dynamic = "force-dynamic";

const DEFAULT_REALTIME_MODEL = "gpt-realtime-mini";
const DEFAULT_VOICE = "coral";
const DEFAULT_INSTRUCTIONS =
  "Bạn là robot demo của ChinChin/Brain OS. Trả lời tiếng Việt ngắn gọn, thân thiện, dễ nghe. Không nói dài.";

type OpenAiClientSecretResponse = {
  value?: string;
  expires_at?: number;
  session?: { id?: string; model?: string };
  [key: string]: unknown;
};

export async function POST() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey || apiKey.trim().length === 0) {
    return NextResponse.json(
      { ok: false, error: "OPENAI_API_KEY missing" },
      { status: 400 }
    );
  }

  const model = process.env.OPENAI_REALTIME_MODEL?.trim() || DEFAULT_REALTIME_MODEL;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const upstream = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        session: {
          type: "realtime",
          model,
          instructions: DEFAULT_INSTRUCTIONS,
          audio: {
            output: { voice: DEFAULT_VOICE },
            input: { turn_detection: { type: "server_vad" } },
          },
        },
      }),
      signal: controller.signal,
    });

    const data = (await upstream.json().catch(() => null)) as OpenAiClientSecretResponse | null;

    if (!upstream.ok || !data) {
      // Relay lỗi ở mức gọn, không kèm header/API key, không leak stack trace.
      const message =
        (data && typeof (data as { error?: { message?: string } }).error?.message === "string"
          ? (data as { error?: { message?: string } }).error?.message
          : null) ?? `OpenAI Realtime request failed (HTTP ${upstream.status})`;
      return NextResponse.json({ ok: false, error: message }, { status: 502 });
    }

    if (!data.value) {
      return NextResponse.json(
        { ok: false, error: "OpenAI response missing ephemeral value — schema có thể đã đổi, xem comment trong route.ts" },
        { status: 502 }
      );
    }

    // Chỉ trả về đúng những gì frontend cần để mở WebRTC — không có gì trong
    // đây là API key thật.
    return NextResponse.json({
      ok: true,
      session_id: data.session?.id ?? null,
      model: data.session?.model ?? model,
      voice: DEFAULT_VOICE,
      client_secret: data.value,
      expires_at: data.expires_at ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { ok: false, error: `Không gọi được OpenAI Realtime API: ${message}` },
      { status: 502 }
    );
  } finally {
    clearTimeout(timeout);
  }
}
