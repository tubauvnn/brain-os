// Safe arithmetic evaluator — KHÔNG dùng eval()/Function() (không chạy mã tuỳ
// ý người dùng nhập). Hỗ trợ + - * / ( ) và số thập phân, qua recursive-descent
// parser tối giản.

export class CalculatorError extends Error {}

function tokenize(expr: string): string[] {
  const tokens = expr.match(/\d+(\.\d+)?|[+\-*/()]/g);
  if (!tokens || !tokens.length) throw new CalculatorError("Không tìm thấy biểu thức số học hợp lệ.");
  return tokens;
}

type Pos = { i: number };

function parseExpression(tokens: string[], pos: Pos): number {
  let value = parseTerm(tokens, pos);
  while (tokens[pos.i] === "+" || tokens[pos.i] === "-") {
    const op = tokens[pos.i++];
    const rhs = parseTerm(tokens, pos);
    value = op === "+" ? value + rhs : value - rhs;
  }
  return value;
}

function parseTerm(tokens: string[], pos: Pos): number {
  let value = parseFactor(tokens, pos);
  while (tokens[pos.i] === "*" || tokens[pos.i] === "/") {
    const op = tokens[pos.i++];
    const rhs = parseFactor(tokens, pos);
    if (op === "/" && rhs === 0) throw new CalculatorError("Không thể chia cho 0.");
    value = op === "*" ? value * rhs : value / rhs;
  }
  return value;
}

function parseFactor(tokens: string[], pos: Pos): number {
  const token = tokens[pos.i];
  if (token === undefined) throw new CalculatorError("Biểu thức thiếu toán hạng.");
  if (token === "(") {
    pos.i++;
    const value = parseExpression(tokens, pos);
    if (tokens[pos.i] !== ")") throw new CalculatorError("Thiếu dấu ')'.");
    pos.i++;
    return value;
  }
  if (token === "-") {
    pos.i++;
    return -parseFactor(tokens, pos);
  }
  const num = Number(token);
  if (Number.isNaN(num)) throw new CalculatorError(`Token không hợp lệ: "${token}".`);
  pos.i++;
  return num;
}

export function evaluateExpression(expr: string): number {
  const tokens = tokenize(expr);
  const pos: Pos = { i: 0 };
  const value = parseExpression(tokens, pos);
  if (pos.i !== tokens.length) throw new CalculatorError("Biểu thức dư ký tự sau khi tính.");
  return value;
}
