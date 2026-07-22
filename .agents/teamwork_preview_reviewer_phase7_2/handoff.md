# Phase 7 审查员 (Reviewer 2) 交付与交接报告

## 1. Observation (直接观察)

通过对 Worker 2 交付代码及相关源文件的深度检查，直接观察到以下事实：

1. **`assets/Scripts/UI/SkillSelectPanel.ts`**:
   - 第 27 行 `onEnable()` 中包含 `director.pause()`；第 34 行 `onDisable()` 中包含 `director.resume()`。
   - 第 105-116 行兜底选项“无双气血”回调中成功查找到 `PlayerController` 节点并调用了 `playerComp.restoreFullHp()`，随后第 118 行调用 `director.resume()`。
   - 第 284 行 `onSelectSkill` 中包含 `director.resume()`。

2. **`assets/Scripts/PlayerController.ts`**:
   - 第 187-189 行 `addExp()` 采用 `while (this.currentExp >= this.maxExp) { this.levelUp(); }` 循环判定。
   - 第 172-177 行定义了 `restoreFullHp()`，将 `this.currentHp = this.maxHp` 并分别向 `EventManager` 派发 `UIEvent.UPDATE_HP` 及向 `director` 广播 `UI_Event_Update_HP`。

3. **`assets/Scripts/LevelManager.ts` & `assets/Scripts/Logic/Enemy.ts`**:
   - 在 `LevelManager.ts` 第 96-97 行：
     ```ts
     EventManager.on(CombatEvent.ENEMY_DIED, this.onEnemyDied, this);
     director.on('Event_Enemy_Died', this.onEnemyDied, this);
     ```
   - 在 `Enemy.ts` 第 289 行和第 294 行：
     ```ts
     EventManager.emit<IEnemyDiedPayload>(CombatEvent.ENEMY_DIED, ...);
     director.emit('Event_Enemy_Died', ...);
     ```
   - 在 `LevelManager.ts` 第 326 行 `onEnemyDied()` 执行 `this.activeEnemyCount = Math.max(0, this.activeEnemyCount - 1)`。
   - 在 `LevelManager.ts` 第 342 行 `checkVictory()` 执行：
     ```ts
     if (allWavesSpawned && (this.activeEnemyCount <= 0 || realEnemyCount === 0))
     ```

4. **`assets/Scripts/Manager/GameManager.ts` & `assets/Scripts/UI/BattleUIPanel.ts`**:
   - 在 `Enemy.ts` 第 276-277 行：
     ```ts
     director.emit('Event_Chest_Dropped', { enemyNode: this.node });
     EventManager.emit('Event_Chest_Dropped', { enemyNode: this.node });
     ```
   - 在 `GameManager.ts` 第 114 行与第 119 行：
     ```ts
     EventManager.on('Event_Chest_Dropped', this.onChestDropped, this);
     director.on('Event_Chest_Dropped', this.onChestDropped, this);
     ```
   - 在 `BattleUIPanel.ts` 第 64 行与第 65 行：
     ```ts
     director.on('Event_Chest_Dropped', this.onChestDropped, this);
     EventManager.on('Event_Chest_Dropped', this.onChestDropped, this);
     ```
   - 在 `GameManager.ts` 第 259-278 行 `onChestDropped()` 中执行灵石 +500、材料 +50 及玩家经验 +200。

---

## 2. Logic Chain (推演逻辑链)

1. **技能面板与玩家经验控制链条 (Pass)**:
   - 观察 1 显示 `SkillSelectPanel` 打开时 pause、关闭时 resume，且兜底选项正确调用 `restoreFullHp()`，逻辑完整闭环。
   - 观察 2 显示 `PlayerController.addExp()` 改为 while 循环后，当单次吸入高额经验（如 BOSS 1500Exp）时，单帧可连续多轮扣减 `maxExp` 并触发 `levelUp()`，解决了跨级升级失效问题。

2. **活怪计数与提前通关连锁缺陷 (Fail - Critical)**:
   - 由观察 3，每当 1 只敌人死亡，`Enemy.die()` 会在 `EventManager` 和 `director` 上各 emit 一次死亡事件。
   - 由于 `LevelManager` 同时监听了两个通道的死亡事件，1 只敌人死亡将触发 `onEnemyDied()` 运行 **2 次**，`activeEnemyCount` 被重复递减 2。
   - 当关卡刷出 10 只怪物、仅被杀死 5 只时，`activeEnemyCount` 就会从 10 降为 0。
   - 此时若所有波次已刷完，`checkVictory()` 判定 `allWavesSpawned && (this.activeEnemyCount <= 0 || realEnemyCount === 0)`。由于 `this.activeEnemyCount <= 0` 成立（0 <= 0），`checkVictory()` 立即触发 `GameManager.instance.endGame(true)`，导致游戏在场上还有 5 只怪物正攻击玩家时误判定为通关胜利！

3. **宝箱奖励重复结算连锁缺陷 (Fail - Major)**:
   - 由观察 4，`Enemy.ts` 掉落宝箱时向 `director` 与 `EventManager` 各 emit 一次 `'Event_Chest_Dropped'`。
   - `GameManager` 与 `BattleUIPanel` 均在两个通道上监听了完全同名的 `'Event_Chest_Dropped'`。
   - 单个宝箱掉落会导致 `GameManager.onChestDropped()` 被回调 **2 次**（或者广播 2 次导致触发多次），给玩家发放灵石 +1000（预期 500）、材料 +100（预期 50）、经验 +400（预期 200），产生严重的数值溢出与重复结算漏洞。

---

## 3. Caveats (注意事项与假设)

- 假定游戏运行时使用标准的 `EventManager` 事件总线模式，推荐将广播与监听统一清理为单通道模式，避免 `director` 全局广播与 `EventManager` 总线混用导致的叠加回调。
- 无其他遗留假设。

---

## 4. Conclusion (结论)

审查结论为 **REQUEST_CHANGES**。

Worker 2 在 `SkillSelectPanel.ts` 和 `PlayerController.ts` 的修复符合预期，但在 `LevelManager.ts` 和 `GameManager.ts` / `BattleUIPanel.ts` 中引入了严重的双通道重复监听缺陷，导致：
1. 关卡怪物杀到一半即可提前触发通关胜利（Critical 级别逻辑漏洞）。
2. 击杀精英怪掉落宝箱触发双倍奖励结算（Major 级别数值漏洞）。

必须退回修改，取消重复的双通道监听，确保事件监听的单一性与计数的准确性。

---

## 5. Verification Method (独立验证方法)

1. **检查 LevelManager 事件监听与计数逻辑**:
   - 检查 `assets/Scripts/LevelManager.ts` 第 96-97 行与第 324-349 行。
   - 验证移除 `director.on('Event_Enemy_Died')` 仅保留 `EventManager.on(CombatEvent.ENEMY_DIED)`，或确认每次死亡回调仅扣减 1 次 `activeEnemyCount`。
   - 验证 `checkVictory()` 条件是否确保 `realEnemyCount === 0` 或 `activeEnemyCount <= 0` 不受重复事件干扰。
2. **检查 GameManager 与 BattleUIPanel 宝箱事件监听**:
   - 检查 `assets/Scripts/Manager/GameManager.ts` 第 114, 119 行。
   - 检查 `assets/Scripts/UI/BattleUIPanel.ts` 第 64-65 行。
   - 验证移除重复的 `director.on('Event_Chest_Dropped')` / `EventManager.on('Event_Chest_Dropped')` 注册，确保每次掉落仅触发 1 次 `onChestDropped`。
