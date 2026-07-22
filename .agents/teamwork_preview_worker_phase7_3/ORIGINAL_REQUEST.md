## 2026-07-21T11:47:47+08:00

你被任命为 Phase 7 事件监听去重与逻辑修复 Worker (Worker 3)。
你的工作目录是: /Users/wesson/YokaiCodex/.agents/teamwork_preview_worker_phase7_3

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

请针对 Reviewer 2 发现的 2 项隐蔽双重事件监听缺陷进行规范化去重修复：

1. **LevelManager.ts 怪物死亡事件监听去重与活怪计数修正**:
   - 检查 `Enemy.ts` 与 `LevelManager.ts`。清理 `LevelManager.ts` 中对 `EventManager` 和 `director` 双重通道的重复订阅，统一收拢为单一通道 (建议统一使用 `EventManager`)。
   - 确保每击杀 1 只怪物，`activeEnemyCount` 仅仅递减 1 次。彻底解决活怪双倍扣减导致的波次尚未杀完即提前误判胜利的问题。

2. **GameManager.ts & BattleUIPanel.ts 宝箱掉落事件监听去重**:
   - 清理 `GameManager.ts` 与 `BattleUIPanel.ts` 中对 `'Event_Chest_Dropped'` 事件在 `EventManager` 和 `director` 上的重复订阅，统一通过 `EventManager` 订阅。
   - 确保单个宝箱掉落时，`onChestDropped()` 回调仅被调用 1 次，奖励（+500 灵石 / +50 材料 / +200 经验）与 UI 对话框仅触发 1 次。

修改完成后，请运行 TS 类型检查验证无报错，并将交接报告写入你的工作目录 /Users/wesson/YokaiCodex/.agents/teamwork_preview_worker_phase7_3/handoff.md。
注意：请使用中文编写所有代码注释、文档与提交报告。
