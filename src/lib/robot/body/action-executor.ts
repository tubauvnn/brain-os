import type { ActionType, PlannedAction } from "../brain/types";
import { checkCapability } from "./capability-check";
import type { ActionOutcome, BodyExecutor, BodyState } from "./types";

// ActionExecutor — Phase 6H mục "Action Executor". Đúng pipeline yêu cầu:
// ActionRequest (PlannedAction từ BrainLoop, Phase 6G) → Capability Check →
// Body Executor → Result → (Brain Feedback là việc của caller, gọi
// BrainLoop.reportOutcome() với ActionOutcome trả về ở đây, xem brain-loop.ts).
//
// "Never fail silently" + "Never get stuck" (mục "Recovery"): execute() LUÔN
// resolve về 1 ActionOutcome cụ thể, không bao giờ throw/treo — thiếu
// capability và KHÔNG có fallback thì rơi về StaySilent kèm lý do rõ ràng
// (hiện trên debug overlay "Reason"), không phải im lặng vô cớ.

export class ActionExecutor {
  async execute(action: PlannedAction, body: BodyState, executor: BodyExecutor): Promise<ActionOutcome> {
    const check = checkCapability(action, body);

    if (!check.allowed && !check.fallbackAvailable) {
      return { requestedAction: action.type, executedAction: "StaySilent", succeeded: false, degraded: true, reason: check.reason };
    }

    let ok: boolean;
    try {
      ok = await this.dispatch(action, executor);
    } catch {
      // Body executor tự nó lỗi (vd audio API từ chối) — vẫn KHÔNG throw ra
      // ngoài, quy về outcome thất bại có lý do, để BrainLoop/executor cấp
      // trên tự chọn hành động khác ở cycle sau (mục "otherwise choose
      // another action").
      ok = false;
    }

    const degraded = !check.allowed || !ok;
    return {
      requestedAction: action.type,
      executedAction: action.type,
      succeeded: ok,
      degraded,
      reason: !check.allowed ? check.reason : ok ? check.reason : "body executor báo lỗi khi thực thi",
      say: ok ? action.say : undefined,
    };
  }

  private dispatch(action: PlannedAction, executor: BodyExecutor): Promise<boolean> {
    const type: ActionType = action.type;
    switch (type) {
      case "LookLeft":
        return executor.moveHead("left");
      case "LookRight":
        return executor.moveHead("right");
      case "LookAtPerson":
        return executor.lookAtPerson();
      case "Blink":
        return executor.blink();
      case "Smile":
        return executor.setExpression("smile");
      case "Wave":
        return executor.gesture("wave");
      case "Sleep":
        return executor.setScreenState("sleeping");
      case "Wait":
      case "StaySilent":
      case "ReturnIdle":
        return executor.silence();
      case "Speak":
      case "StartConversation":
      case "ContinueConversation":
      case "Invite":
      case "EndConversation":
        return action.say ? executor.speak(action.say) : executor.silence();
    }
  }
}
