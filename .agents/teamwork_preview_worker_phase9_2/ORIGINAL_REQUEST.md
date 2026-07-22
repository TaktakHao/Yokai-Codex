## 2026-07-21T08:10:50Z

请作为 Phase 9 缺陷修复 Worker (teamwork_preview_worker)，针对 Reviewer 1 与 Challenger 1 提出的 2 项核心缺陷进行代码修复：

1. 工作目录：`/Users/wesson/YokaiCodex/.agents/teamwork_preview_worker_phase9_2`
2. 修复问题与具体说明：
   - **问题 1 [Critical] 资源扣减失效**：
     - 原因：`HomeManager.ts` 中的 `addSpiritStones` 和 `addMaterials` 方法中写死了 `if (amount > 0)` 校验，导致 `PetCaptureManager.ts` 传入负数 (如 `-100`, `-300`, `-2000` 灵石及 `-30`, `-200` 材料) 扣费时被静默忽略。
     - 修复方案：修改 `HomeManager.ts` 的 `addSpiritStones` 与 `addMaterials`，允许负数扣减并限制下限为 0 (`Math.max(0, ...)`），或新增显式的 `deductSpiritStones(amount)` / `deductMaterials(amount)` 方法，确保孵化 (100/300 灵石, 30 材料) 与 5 星化形 (2000 灵石, 200 材料) 能够真实准确从 `HomeManager` 中扣除！
   - **问题 2 [Major] 化形飞弹伤害二次乘算**：
     - 原因：`PetCaptureManager.ts` 的 `evolvePet` 方法已将化形宠物的基础攻击力提升 50% (`pet.attack *= 1.50`)，但 `PetFollower.ts` 的 `fireProjectile` 又二次乘上了 `evolveDamageMult = 1.5`，导致实际伤害变为 2.25 倍。
     - 修复方案：修正 `PetFollower.ts` 中的飞弹伤害计算，移除重复的 `evolveDamageMult` 二次乘法运算，保证化形属性加成为精确的额外 +50%。

3. **MANDATORY INTEGRITY WARNING**:
   DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

4. **汇报要求**:
   修复完成后，请运行语法/编译检查，将修改记录写入 `/Users/wesson/YokaiCodex/.agents/teamwork_preview_worker_phase9_2/changes.md`，交接报告写入 `/Users/wesson/YokaiCodex/.agents/teamwork_preview_worker_phase9_2/handoff.md`，并通过 `send_message` 向 Orchestrator 汇报。
