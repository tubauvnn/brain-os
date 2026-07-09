// Generic Tool Agent contracts — chứng minh TaskAgent (src/lib/orchestrator/)
// tổng quát hoá ra ngoài agent sáng tạo (Video/Image/Character), phục vụ được
// cả tool tiện ích đơn giản. KHÔNG gọi API ngoài — mọi tool đều tính toán cục
// bộ, xác định (deterministic).

export type ToolName = "calculator" | "datetime" | "unknown";

export type ToolResult = {
  tool: ToolName;
  success: boolean;
  result?: string;
  error?: string;
};
