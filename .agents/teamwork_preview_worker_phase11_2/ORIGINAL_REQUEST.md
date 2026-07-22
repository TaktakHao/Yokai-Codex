## 2026-07-22T01:23:33Z

你是 Phase 11 Round 2 的代码修补工人 Worker 2 (`teamwork_preview_worker`)。
你的 Agent 工作目录: `/Users/wesson/YokaiCodex/.agents/teamwork_preview_worker_phase11_2`
项目根目录: `/Users/wesson/YokaiCodex`

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

【任务说明】
针对 Reviewer 1 提出的 3 项 Finding，对 TypeScript 代码进行精准修复与自测试：

1. **[Major] Finding 1: 局内外循环二次进入关卡时随行宠物 (`Follower_`) 丢失**
   - 背景与逻辑：在 `GameManager.returnToHome()` 或关卡重置/返回主界面时，场上的 `Follower_` 节点被回收/销毁。当玩家再次从主界面点击【开始降妖】进入关卡 (`GameManager.startGame()`) 时，`PlayerController` 的 `start()` 不会二次执行，导致 `Follower_` 随行宠物丢失。
   - 修复要求：在 `PlayerController` (`assets/Scripts/PlayerController.ts`) 中，将 `initEquippedPets()` 接口公开 (`public initEquippedPets()`)，并在 `GameManager.startGame()` 或 `PlayerController` 每次重置/再次开启关卡时（如 `onEnable` / 关卡重新开始流程中）显示或重新调用 `initEquippedPets()`，确保第二次及后续进入关卡时，随行宠物节点能正确根据 `HomeManager` 装备列表重新实例化生成。

2. **[Minor] Finding 2: `HomePanel.ts` 节点内存释放彻底化**
   - 背景与逻辑：`HomePanel.ts` 中的 `renderPetListCards()` 当前使用 `removeAllChildren()` 清空列表容器。
   - 修复要求：改为 `destroyAllChildren()` 替代 `removeAllChildren()`，确保卡片 Node 节点本身被 Cocos Creator 引擎彻底销毁释放，防止重复渲染时的 Node 节点内存泄漏。

3. **[Minor] Finding 3: `GameManager.returnToHome()` 敌人节点清理路径优化**
   - 背景与逻辑：`GameManager.returnToHome()` 清空残留怪物时，需要优先、精准清理 `LevelManager.instance.monsterRoot` 节点下的所有怪物。
   - 修复要求：检查 `GameManager.returnToHome()`，确保优先读取并遍历 `LevelManager.instance.monsterRoot` 节点下的所有子节点，通过 `PoolManager.putNode()` 回收或销毁，确保清场干净。
