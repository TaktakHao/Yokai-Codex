# Phase 7 代码与架构审查报告 (Reviewer 2)

## Review Summary

**Verdict**: REQUEST_CHANGES

Worker 2 针对 Phase 7 的补丁修复工作完成了 SkillSelectPanel 暂停/恢复隔离与 PlayerController 跨级升级/满血恢复等功能。但是在 LevelManager 活怪计数与 GameManager/BattleUIPanel 宝箱事件监听处理中，存在由于双通道（EventManager 与 director）重复订阅导致的严重缺陷：
1. **LevelManager 提前通关判定 (Critical)**: `Enemy.ts` 死亡时同时向 `EventManager` 和 `director` 发送事件，而 `LevelManager` 同时监听了两个通道，导致每击杀 1 只怪物 `activeEnemyCount` 被重复扣减 2 次。当怪物杀到一半时活怪计数便清零，若所有波次已刷完，`checkVictory()` 会因 `activeEnemyCount <= 0` 满足而误判定胜利并强制通关，此时场上尚有活着并攻击玩家的怪物。
2. **宝箱重复结算与翻倍奖励 (Major)**: `Enemy.ts` 掉落宝箱时同时向 `director` 和 `EventManager` 广播 `'Event_Chest_Dropped'`。`GameManager` 与 `BattleUIPanel` 均双向订阅了该同名事件，导致每掉落一个宝箱，`onChestDropped` 被触发 2 次，给予玩家双倍灵石 (+1000)、双倍材料 (+100) 及双倍经验 (+400)。

---

## Findings

### [Critical] Finding 1: LevelManager 双通道重复监听导致活怪计数提前归零与误触发通关胜利

- **What**: `LevelManager.ts` 在 `onEnable()` 中同时向 `EventManager` 订阅了 `CombatEvent.ENEMY_DIED` 并在 `director` 上订阅了 `'Event_Enemy_Died'`。
- **Where**: `assets/Scripts/LevelManager.ts` (第 96-97 行) 与 `assets/Scripts/Logic/Enemy.ts` (第 289, 294 行)。
- **Why**: `Enemy.die()` 会在敌人死亡时同时调用 `EventManager.emit(CombatEvent.ENEMY_DIED)` 和 `director.emit('Event_Enemy_Died')`。因此，一只敌人死亡会触发 `LevelManager.onEnemyDied()` 运行 2 次，`activeEnemyCount` 每次减 2。导致刷怪 10 只仅杀 5 只时活怪计数就降为 0。在 `checkVictory()` 中：
  `if (allWavesSpawned && (this.activeEnemyCount <= 0 || realEnemyCount === 0))`
  因逻辑或 (`||`) 成立，直接触发 `GameManager.instance.endGame(true)` 通关胜利，导致剩余 5 只怪物仍在场上攻击玩家时游戏已提前胜利结束。
- **Suggestion**: 在 `LevelManager.ts` 中仅保留单通道事件监听（推荐保留 `EventManager`），或使用单通道判断逻辑，避免重复计数；同时在 `checkVictory()` 中建议优先以 `realEnemyCount === 0` 或两项兼备 (`activeEnemyCount <= 0 && realEnemyCount === 0`) 为准，消除并发与计数不同步风险。

### [Major] Finding 2: GameManager 与 BattleUIPanel 双通道重复监听 Event_Chest_Dropped 导致宝箱奖励双倍结算

- **What**: `Enemy.ts` 掉落宝箱时同时发射 `director.emit('Event_Chest_Dropped')` 与 `EventManager.emit('Event_Chest_Dropped')`。`GameManager.ts` 与 `BattleUIPanel.ts` 均对两个通道同时监听了完全同名的 `'Event_Chest_Dropped'` 事件。
- **Where**:
  - `assets/Scripts/Manager/GameManager.ts` (第 114, 119 行)
  - `assets/Scripts/UI/BattleUIPanel.ts` (第 64-65 行)
  - `assets/Scripts/Logic/Enemy.ts` (第 276-277 行)
- **Why**: 单次宝箱掉落会导致 `GameManager.onChestDropped()` 被连续回调 2 次，给玩家注入灵石 +1000 (预期 500)、材料 +100 (预期 50) 以及经验 +400 (预期 200)；`BattleUIPanel` 也会触发两次 UI 显示和定时器。
- **Suggestion**: 统一宝箱事件广播与监听通道，仅在 `EventManager` 或 `director` 选其一进行注册与派发，防止结算函数被重复触发。

### [Minor/Pass] Item 1 & 2: SkillSelectPanel 与 PlayerController 机制验证通过

- `SkillSelectPanel.ts`:
  - `onEnable()` 中正确调用 `director.pause()` 挂起游戏主循环。
  - `onDisable()`、`onSelectSkill` 以及全满级兜底选项“无双气血”中均正确调用 `director.resume()` 恢复游戏。
  - 兜底选项正确查找到 `PlayerController` 节点并调用 `restoreFullHp()`。
- `PlayerController.ts`:
  - `addExp()` 采用 `while (this.currentExp >= this.maxExp)` 循环，在获取高额经验时可连续跨级升级。
  - `restoreFullHp()` 满血恢复及双通道 `UPDATE_HP` 事件派发逻辑完整无误。

---

## Verified Claims

- [SkillSelectPanel pause/resume 隔离] → 验证 `SkillSelectPanel.ts` 27、34、118、284 行 → PASS
- [PlayerController while 跨级升级与 restoreFullHp] → 验证 `PlayerController.ts` 172-196 行 → PASS
- [LevelManager 活怪计数与通关判定] → 验证 `LevelManager.ts` 96-97、324-349 行 → FAIL (存在重复扣减提前通关 BUG)
- [Event_Chest_Dropped 宝箱监听与结算] → 验证 `GameManager.ts` 114, 119, 259 行 及 `BattleUIPanel.ts` 64-65 行 → FAIL (存在双重触发双倍结算 BUG)

---

## Coverage Gaps

- 无。针对 4 项审查目标均已进行逐行代码审查与逻辑推演。
