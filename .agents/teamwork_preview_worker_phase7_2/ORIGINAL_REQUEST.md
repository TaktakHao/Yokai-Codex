## 2026-07-21T03:41:34Z
你被任命为 Phase 7 逻辑缺陷修复与增强 Worker (Worker 2)。
你的工作目录是: /Users/wesson/YokaiCodex/.agents/teamwork_preview_worker_phase7_2

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

请针对 Challenger 1 提出的 5 项边界逻辑缺陷进行精准打补丁修复：

1. **SkillSelectPanel.ts 打开/关闭时的游戏 Pause/Resume 隔离**:
   - 在 `SkillSelectPanel.ts` 弹出三选一技能界面时，调用 Cocos `director.pause()` 暂停游戏主循环，防止怪会在背景继续追击伤害玩家。
   - 在玩家点击技能卡片选择回调后，调用 `director.resume()` 恢复游戏正常运行。

2. **PlayerController.ts 跨级升阶与无双气血满血恢复**:
   - 将 `PlayerController.ts` 中的 `addExp()` 升阶判定由 `if` 改为 `while (this.currentExp >= this.maxExp)` 循环，确保收到高额经验（如 BOSS 1500Exp）时能连续多次升级。
   - 在全满级保底技能“无双气血”的回调中，真正执行 `this.currentHp = this.maxHp` 生命值满血恢复逻辑，并派发 HP 变更事件。

3. **LevelManager.ts 关卡通关胜负判定机制**:
   - 在 `LevelManager.ts` 中维护全局活怪计数，在所有波次已刷完且场上活跃怪物全部清零时，自动调用 `GameManager.instance.endGame(true)` 触发通关胜利结算流程。

4. **精英怪宝箱事件监听注册**:
   - 在 `GameManager.ts` 或 `BattleUIPanel.ts` 中注册对 `Enemy.ts` 派发的 `Event_Chest_Dropped` 宝箱掉落事件监听，给予玩家高额灵石/材料/经验奖励或弹出聚灵宝箱收获提示。

代码修改完成后，请运行类型与编译检查验证无报错，并将交接报告写入你的工作目录 /Users/wesson/YokaiCodex/.agents/teamwork_preview_worker_phase7_2/handoff.md。
注意：请使用中文编写所有代码注释、文档与提交报告。
