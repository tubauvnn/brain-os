import { execFile } from "child_process";
import { mkdir } from "fs/promises";
import { FALLBACK_REPLY, parseReplyJson, type NormalizedReply } from "./reply-schema";

export type CliProvider = "codex_cli" | "claude_cli" | "gemini_cli" | "fallback";

export type CliAgentResult = NormalizedReply & {
  provider: CliProvider;
  errors: string[];
};

// Workspace riêng cho CLI agent — không phải repo chính, để Codex/Claude/Gemini
// không thể đọc/sửa code thật của Brain OS dù chạy ở chế độ nào.
const WORKSPACE_DIR = "/home/brainos/agent-workspace";
// Robot demo cần phản hồi nhanh: 25s/provider, tổng cả route không quá 60s dù
// cả 3 CLI đều bị gọi (thời gian còn lại co dần cho provider sau, xem askCliAgents).
const PER_PROVIDER_TIMEOUT_MS = 25_000;
const TOTAL_TIMEOUT_MS = 60_000;
// Dưới ngưỡng này thì thử một CLI mới cũng vô nghĩa (CLI cần vài giây chỉ để khởi
// động), nên bỏ qua thẳng để dành thời gian fallback thay vì chờ rồi vẫn timeout.
const MIN_USEFUL_MS = 3_000;

// Env cố định cho mọi CLI agent — không phụ thuộc vào process.env kế thừa từ
// tiến trình Next.js (có thể khác terminal thủ công: thiếu PATH của nvm, thiếu
// HOME, v.v., khiến execFile báo ENOENT dù gọi tay trên VPS vẫn chạy được).
// /root/.nvm/versions/node/v22.23.0/bin chứa cả `node` lẫn `codex`/`gemini`/`claude`
// (symlink) — xác nhận qua `which` trên VPS này, bắt buộc phải có trong PATH.
const FIXED_ENV: NodeJS.ProcessEnv = {
  // NODE_ENV bắt buộc phải có trong type NodeJS.ProcessEnv (Next.js augment) —
  // không ảnh hưởng gì tới Codex/Gemini/Claude CLI, chỉ pass-through cho đủ type.
  NODE_ENV: process.env.NODE_ENV,
  HOME: "/root",
  PATH: "/root/.nvm/versions/node/v22.23.0/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
  TERM: "dumb",
  NO_COLOR: "1",
};

const FALLBACK_RESULT: CliAgentResult = { ...FALLBACK_REPLY, provider: "fallback", errors: [] };

type ProviderSpec = {
  name: Exclude<CliProvider, "fallback">;
  command: string;
  buildArgs: (prompt: string) => string[];
};

// Codex/Gemini gọi qua wrapper cố định (/usr/local/bin/brainos-codex|brainos-gemini)
// thay vì gọi thẳng `codex`/`gemini` — wrapper tự set HOME/PATH/TERM/NO_COLOR và
// `cd` vào workspace, đồng thời giữ cứng flag `--skip-git-repo-check`/`--skip-trust`
// (bắt buộc phải có, hai CLI này mặc định từ chối chạy headless trong thư mục
// chưa được "trust" tương tác trước đó — xem STATE.md phiên 16/17). Dùng wrapper
// giúp router không phụ thuộc vào process.env kế thừa từ Next.js. Claude CLI
// không cần wrapper vì không có yêu cầu trust-dir và đã chạy ổn định qua PATH.
const PROVIDERS: ProviderSpec[] = [
  { name: "codex_cli", command: "/usr/local/bin/brainos-codex", buildArgs: (prompt) => [prompt] },
  { name: "claude_cli", command: "claude", buildArgs: (prompt) => ["-p", prompt] },
  { name: "gemini_cli", command: "/usr/local/bin/brainos-gemini", buildArgs: (prompt) => [prompt] },
];

async function ensureWorkspace(): Promise<void> {
  await mkdir(WORKSPACE_DIR, { recursive: true });
}

function buildPrompt(message: string, context: string): string {
  return `Bạn là Chuối, robot demo của Brain OS. Trả lời tiếng Việt ngắn gọn, thân thiện, dễ nghe. Ưu tiên câu dưới 2 câu.
Luôn trả JSON hợp lệ, không markdown, không giải thích ngoài JSON.

Schema bắt buộc:
{
  "reply": string,
  "robot_say": string,
  "face": "idle" | "happy" | "thinking" | "sad",
  "action": "none" | "wave" | "nod"
}

Quy tắc:
- Tiếng Việt.
- Ngắn gọn, tự nhiên.
- robot_say tối đa 18 từ.
- Giọng Bắc, thân thiện, dễ nghe.
- Nếu được hỏi "mày là ai"/"bạn là ai"/"cậu là ai": robot_say trả đúng "Mình là Chuối, robot demo của Brain OS."
- Nếu người dùng chào hỏi (xin chào/chào/hi): robot_say trả đúng "Xin chào, mình là Chuối đây."
- Không bịa dữ liệu ngoài context.
- Không nói thông tin riêng tư nếu không có trong context.
- face chỉ được idle/happy/thinking/sad.
- action chỉ được none/wave/nod.

User nói: ${message}
Context: ${context}`;
}

// Chỉ lấy phần lỗi ngắn gọn, một dòng — error.message của execFile khi lệnh
// thoát khác 0 chứa lại toàn bộ command + prompt (rất dài), không hữu ích để
// log/hiển thị. Ưu tiên stderr (thường có dòng lỗi thật) trước message.
function describeError(command: string, e: unknown, timeoutMs: number): string {
  if (e && typeof e === "object") {
    const err = e as NodeJS.ErrnoException & { killed?: boolean; stderr?: string };
    if (err.code === "ENOENT") return `${command}: lệnh không tồn tại`;
    if (err.killed) return `${command}: timeout sau ${Math.round(timeoutMs / 1000)}s`;
    const oneLine = (s: string) => s.replace(/\s+/g, " ").trim().slice(0, 200);
    if (typeof err.stderr === "string" && err.stderr.trim()) return `${command}: ${oneLine(err.stderr)}`;
    return `${command}: ${err.message ? oneLine(err.message) : "lỗi không xác định"}`;
  }
  return `${command}: lỗi không xác định`;
}

function runCli(spec: ProviderSpec, prompt: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = execFile(
      spec.command,
      spec.buildArgs(prompt),
      {
        cwd: WORKSPACE_DIR,
        env: FIXED_ENV,
        timeout: timeoutMs,
        killSignal: "SIGKILL",
        maxBuffer: 10 * 1024 * 1024,
      },
      (error, stdout, stderr) => {
        if (error) {
          Object.assign(error, { stderr });
          reject(error);
          return;
        }
        resolve(stdout);
      }
    );
    // Đóng stdin ngay (EOF) — Codex CLI đọc thêm từ stdin kể cả khi đã có prompt
    // dạng argument; để pipe mở sẽ khiến nó treo tới hết timeout thay vì tự
    // thoát lỗi trong vài giây.
    child.stdin?.end();
  });
}

// Chạy tuần tự Codex → Claude → Gemini, nhưng luôn tự canh tổng thời gian:
// mỗi provider tối đa PER_PROVIDER_TIMEOUT_MS, và không bao giờ để tổng vượt
// quá TOTAL_TIMEOUT_MS dù cả 3 provider đều bị gọi (thời gian còn lại co dần
// cho provider sau — provider cuối có thể nhận ít hơn 25s nếu provider trước
// đã dùng gần hết ngân sách).
async function runProviderChain(prompt: string, errors: string[]): Promise<CliAgentResult | null> {
  const startedAt = Date.now();

  for (const spec of PROVIDERS) {
    const remaining = TOTAL_TIMEOUT_MS - (Date.now() - startedAt);
    if (remaining < MIN_USEFUL_MS) {
      errors.push(`${spec.name}: bỏ qua — đã hết ngân sách tổng ${TOTAL_TIMEOUT_MS / 1000}s của route`);
      continue;
    }
    const timeoutMs = Math.min(PER_PROVIDER_TIMEOUT_MS, remaining);
    try {
      const raw = await runCli(spec, prompt, timeoutMs);
      const normalized = parseReplyJson(raw);
      if (!normalized) {
        errors.push(`${spec.name}: JSON không hợp lệ (thiếu "reply" hoặc sai schema)`);
        continue;
      }
      return { ...normalized, provider: spec.name, errors };
    } catch (e) {
      errors.push(describeError(spec.name, e, timeoutMs));
    }
  }

  return null;
}

// Provider chính: Codex CLI → Claude CLI → Gemini CLI → fallback local. Lỗi ở
// bước nào (không tồn tại, timeout, lỗi auth, JSON không hợp lệ...) đều được
// ghi lại rồi thử provider tiếp theo — không bao giờ throw ra ngoài. Bọc thêm
// một deadline tổng ở tầng ngoài cùng làm lưới an toàn: dù runCli's timeout có
// vì lý do gì đó không kích hoạt kịp, request vẫn trả lời trong TOTAL_TIMEOUT_MS.
export async function askCliAgents(message: string, context: string = ""): Promise<CliAgentResult> {
  await ensureWorkspace();
  const prompt = buildPrompt(message, context);
  const errors: string[] = [];

  const chain = runProviderChain(prompt, errors);
  const deadline = new Promise<null>((resolve) => {
    setTimeout(() => resolve(null), TOTAL_TIMEOUT_MS + 500);
  });

  const result = await Promise.race([chain, deadline]);
  if (result) return result;

  errors.push(`route: vượt tổng timeout ${TOTAL_TIMEOUT_MS / 1000}s, trả fallback ngay`);
  return { ...FALLBACK_RESULT, errors };
}
