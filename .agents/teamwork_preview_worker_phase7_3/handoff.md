# Phase 7 事件监听去重与逻辑修复 Worker (Worker 3) 交接报告

## 1. Observation (直接观察)

在对项目代码库进行排查的过程中，直接观察到以下双通道事件监听与派发缺陷：

1. **`LevelManager.ts` 与 `Enemy.ts` 怪物死亡事件双重订阅与双重派发**:
   - `assets/Scripts/LevelManager.ts` (原 95-103 行):
     ```ts
     onEnable() {
         EventManager.on(CombatEvent.ENEMY_DIED, this.onEnemyDied, this);
         director.on('Event_Enemy_Died', this.onEnemyDied, this);
     }
     onDisable() {
         EventManager.off(CombatEvent.ENEMY_DIED, this.onEnemyDied, this);
         director.off('Event_Enemy_Died', this.onEnemyDied, this);
     }
     ```
   - `assets/Scripts/Logic/Enemy.ts` (原 289-298 行):
     ```ts
     EventManager.emit<IEnemyDiedPayload>(CombatEvent.ENEMY_DIED, { ... });
     director.emit('Event_Enemy_Died', { ... });
     ```

2. **`GameManager.ts` & `BattleUIPanel.ts` 宝箱掉落事件双重订阅与 `Enemy.ts` 双重派发**:
   - `assets/Scripts/Manager/GameManager.ts` (原 114, 119 行以及 131, 136 行):
     ```ts
     EventManager.on('Event_Chest_Dropped', this.onChestDropped, this);
     director.on('Event_Chest_Dropped', this.onChestDropped, this);
     ```
   - `assets/Scripts/UI/BattleUIPanel.ts` (原 64-70 行):
     ```ts
     onEnable() {
         director.on('Event_Chest_Dropped', this.onChestDropped, this);
         EventManager.on('Event_Chest_Dropped', this.onChestDropped, this);
     }
     onDisable() {
         director.off('Event_Chest_Dropped', this.onChestDropped, this);
         EventManager.off('Event_Chest_Dropped', this.onChestDropped, this);
     }
     ```
   - `assets/Scripts/Logic/Enemy.ts` (原 276-282 行):
     ```ts
     director.emit('Event_Chest_Dropped', { enemyNode: this.node });
     EventManager.emit('Event_Chest_Dropped', { enemyNode: this.node });
     ```

## 2. Logic Chain (逻辑链)

1. **怪物死亡计数提前清零与误判通关问题分析**:
   - 当一只怪物死亡时，`Enemy.ts` 同时通过 `EventManager.emit(CombatEvent.ENEMY_DIED)` 与 `director.emit('Event_Enemy_Died')` 广播死亡消息。
   - `LevelManager.ts` 同时在 `EventManager` 与 `director` 上对怪物死亡事件进行了订阅，绑定相同的回调 `onEnemyDied`。
   - 结果导致 `onEnemyDied()` 回调被重复触发 2 次，`activeEnemyCount` 每次击杀都会递减 2。当杀到波次怪物总量的一半时，`activeEnemyCount` 已降为 0，导致 `checkVictory()` 误判场上已无活怪而提前触发通关结算。
   - **修复方案**: 清理 `LevelManager.ts` 中对 `director.on('Event_Enemy_Died')` / `director.off('Event_Enemy_Died')` 的重复订阅，清理 `Enemy.ts` 中的 `director.emit('Event_Enemy_Died')`，统一收拢为单一通道 `EventManager` 订阅与广播。

2. **宝箱掉落多重结算与 UI 对话框重复触发问题分析**:
   - 当精英怪掉落聚灵宝箱时，`Enemy.ts` 既执行 `director.emit('Event_Chest_Dropped')` 又执行 `EventManager.emit('Event_Chest_Dropped')`。
   - `GameManager.ts` 与 `BattleUIPanel.ts` 分别在 `EventManager` 和 `director` 上各自注册了一份 `onChestDropped` 回调。
   - 结果导致单个宝箱掉落时，`GameManager.onChestDropped()` 与 `BattleUIPanel.onChestDropped()` 各被触发 2 次，使得奖励 (+500 灵石 / +50 材料 / +200 经验) 重复发放了 2 次，UI 提示框也被定时计划显示了 2 次。
   - **修复方案**: 在 `GameManager.ts` 和 `BattleUIPanel.ts` 中移除 `director.on('Event_Chest_Dropped')` 与 `director.off('Event_Chest_Dropped')` 的监听，在 `Enemy.ts` 中移除 `director.emit('Event_Chest_Dropped')`，统一使用 `EventManager` 通道。

## 3. Caveats (局限与假设)

- **假设**: 假设所有战斗与 UI 事件在系统架构中均推荐使用全局单例 Pub-Sub `EventManager` 进行分发与解耦。
- **关联组件**: `PlayerController.ts` 中的 `UI_Event_Game_Over` 与 `UI_Event_Level_Up` 保持原有的兼容性，未受到本次修复影响。

## 4. Conclusion (最终结论)

已全面完成对 `LevelManager.ts`、`Enemy.ts`、`GameManager.ts` 与 `BattleUIPanel.ts` 4 个核心脚本中隐蔽双重事件监听与广播缺陷的规范化去重修复：

1. `LevelManager.ts` 仅保留 `EventManager.on(CombatEvent.ENEMY_DIED, ...)`，每击杀 1 只怪物，`activeEnemyCount` 精确递减 1 次，彻底解决波次未杀完误判通关问题。
2. `GameManager.ts` 与 `BattleUIPanel.ts` 仅保留 `EventManager.on('Event_Chest_Dropped', ...)`，`Enemy.ts` 仅保留 `EventManager.emit('Event_Chest_Dropped', ...)`，确保宝箱掉落奖励与 UI 对话框仅触发 1 次。
3. 清理了 `BattleUIPanel.ts` 中未使用的 `director` 导入，代码无 TS 语法/类型报错。

## 5. Verification Method (验证方法)

1. **检查代码变更**:
   - 查看 `assets/Scripts/LevelManager.ts`：确认 `onEnable` 与 `onDisable` 仅包含 `EventManager.on(CombatEvent.ENEMY_DIED)` 与 `EventManager.off(CombatEvent.ENEMY_DIED)`。
   - 查看 `assets/Scripts/Logic/Enemy.ts`：确认 `die()` 中仅包含 `EventManager.emit('Event_Chest_Dropped')` 与 `EventManager.emit(CombatEvent.ENEMY_DIED)`，无 `director.emit`。
   - 查看 `assets/Scripts/Manager/GameManager.ts`：确认 `registerEvents` 与 `unregisterEvents` 中仅保留 `EventManager.on('Event_Chest_Dropped')`。
   - 查看 `assets/Scripts/UI/BattleUIPanel.ts`：确认 `onEnable` 与 `onDisable` 中仅保留 `EventManager.on('Event_Chest_Dropped')`，且头部 `import` 无未使用的 `director`。
2. **逻辑验证**:
   - 击杀 1 只普通怪物，检查日志 `[LevelManager] 捕获敌人死亡，剩余活怪计数: X`，确认 `activeEnemyCount` 从 N 精确减少为 N-1。
   - 击杀 1 只精英怪掉落宝箱，检查日志 `[GameManager] 聚灵宝箱奖励结算生效...` 与 `[BattleUIPanel] 收到聚灵宝箱掉落广播...` 各打印 1 次，确认灵石 +500、材料 +50、经验 +200 仅结算一次。
