import { NextResponse } from "next/server";
import net from "node:net";

export const dynamic = "force-dynamic";

const BRAINOS_DOMAIN = "https://os.irec.vn";
const XIAOZHI_HTTP_HOST = "127.0.0.1";
const XIAOZHI_HTTP_PORT = 8003;
const XIAOZHI_WS_HOST = "127.0.0.1";
const XIAOZHI_WS_PORT = 8000;
const CHECK_TIMEOUT_MS = 800;

// Xiaozhi HTTP/OTA server không bắt buộc có route "/" — chỉ cần server
// phản hồi (bất kỳ status code nào) nghĩa là đang online. Không throw nếu offline.
async function checkHttpOnline(host: string, port: number): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
  try {
    await fetch(`http://${host}:${port}/`, { signal: controller.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function checkTcpOnline(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;

    const finish = (online: boolean) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(online);
    };

    socket.setTimeout(CHECK_TIMEOUT_MS);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
    socket.connect(port, host);
  });
}

export async function GET() {
  const [httpOtaOnline, websocketOnline] = await Promise.all([
    checkHttpOnline(XIAOZHI_HTTP_HOST, XIAOZHI_HTTP_PORT),
    checkTcpOnline(XIAOZHI_WS_HOST, XIAOZHI_WS_PORT),
  ]);

  return NextResponse.json(
    {
      ok: true,
      brainos: { online: true, domain: BRAINOS_DOMAIN },
      xiaozhi: {
        httpOta: { host: XIAOZHI_HTTP_HOST, port: XIAOZHI_HTTP_PORT, online: httpOtaOnline },
        websocket: { host: XIAOZHI_WS_HOST, port: XIAOZHI_WS_PORT, online: websocketOnline },
        public: false,
      },
      bridge: {
        openaiCompatibleBaseUrl: `${BRAINOS_DOMAIN}/v1`,
        model: "brainos-local",
        xiaoziWebhook: `${BRAINOS_DOMAIN}/api/xiaozi/chat`,
      },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
