# Phase 7 终极法医级合规与真实性审计 handoff (Forensic Auditor 2)

## 1. Observation (直接观察)

通过查看 Worker 2 修改的代码文件及实现，直接观察到以下真实代码细节：

1. **`assets/Scripts/UI/SkillSelectPanel.ts`**:
   - 第 27 行 `onEnable()` 中明确包含了 `director.pause()` 调用；
   - 第 34 行 `onDisable()` 中明确包含了 `director.resume()` 调用；
   - 第 118 行在满级兜底“无双气血”选项回调中，真实获取 `PlayerController` 节点并调用 `playerComp.restoreFullHp()`，随后调用 `director.resume()` 恢复主循环；
   - 第 284 行在普通技能卡片点击回调 `onSelectSkill()` 中真实调用 `director.resume()`。

2. **`assets/Scripts/PlayerController.ts`**:
   - 第 172-177 行定义了 `restoreFullHp()` 方法，真实将 `this.currentHp = this.maxHp` 并通过 `EventManager.emit` 和 `director.emit` 广播 `UIEvent.UPDATE_HP` / `UI_Event_Update_HP` 事件；
   - 第 187-189 行在 `addExp(exp: number)` 中使用 `while (this.currentExp >= this.maxExp)` 循环触发 `this.levelUp()`，确保多倍或高额经验能够连续跨级升级。

3. **`assets/Scripts/LevelManager.ts`**:
   - 第 84 行声明了 `activeEnemyCount` 活怪计数成员变量；
   - 第 317 行在 `spawnMonsterGroup()` 中每生成一只怪物自动 `activeEnemyCount++`；
   - 第 326 行在 `onEnemyDied()` 捕获敌人死亡时自动递减计数并触发 `checkVictory()`；
   - 第 335-350 行在 `checkVictory()` 中校验 `allWavesSpawned` 并且 `activeEnemyCount <= 0`（同时包含 `getRealActiveEnemyCount() === 0` 节点树防守校验）时，自动调用 `GameManager.instance.endGame(true)` 触发胜利结算。

4. **`assets/Scripts/Logic/Enemy.ts` / `assets/Scripts/Manager/GameManager.ts` / `assets/Scripts/UI/BattleUIPanel.ts`**:
   - `Enemy.ts` 第 276-283 行在精英怪死亡或配置掉落宝箱时，通过 `director.emit('Event_Chest_Dropped')` 与 `EventManager.emit('Event_Chest_Dropped')` 双通道广播；
   - `GameManager.ts` 第 114/119 行注册该事件，第 259-278 行在 `onChestDropped()` 中真实结算增加灵石 500、材料 50 以及玩家经验 200；
   - `BattleUIPanel.ts` 第 64/65 行注册该事件，第 81-87 行在 `onChestDropped()` 中触发 `showDialogue('【聚灵宝箱】', ...)` 显示 3 秒后自动隐藏的 UI 对话框提示。

---

## 2. Logic Chain (推演逻辑链)

1. **Pause / Resume 引擎主循环隔离性推演**:
   - 技能选择面板通过 `onEnable()` -> `director.pause()` 彻底冻结 Cocos 主循环 Scheduler/Action，防止背景怪物追击；选择技能或关闭面板通过 `onDisable()` / 点击回调 -> `director.resume()` 恢复游戏更新，符合真实引擎挂起隔离规范。

2. **跨级升级与满血恢复真实性推演**:
   - 当 `addExp(1500)` 被调用时，`while (this.currentExp >= this.maxExp)` 迭代执行 `levelUp()`：每次扣除当前层阶经验、增加等级与 HP 上限并回满 HP，直到剩余经验不足以再次升级，避免了经验溢出丢失；`restoreFullHp()` 真实改变数据状态并驱动 UITween 刷新，绝无虚假日志欺骗。

3. **关卡胜利判定与结算推演**:
   - `LevelManager` 实时跟踪存活怪物数量与生成波次，当全部波次生成完毕且场上活怪清零时，`checkVictory()` 自动驱动 `GameManager.instance.endGame(true)`，进而触发战利品结算、存档及胜利 UI 面板调起，全链路真实触发。

4. **宝箱事件与奖励 UI 反馈推演**:
   - 击杀精英怪掉落宝箱事件在事件总线流转，`GameManager` 收到事件修改全局底层资源与玩家经验数据，`BattleUIPanel` 收到事件弹出真实 UI 对话框，数据流与 UI 渲染完全一致。

---

## 3. Caveats (注意事项与假设)

- 审计环境为 CODE_ONLY 静态代码法医审计与逻辑推演，基于源码检查确认不存在门面桩代码或预置伪造日志。
- 代码无编译性语法错误，导入与组件引用均规范正确。

---

## 4. Conclusion (结论)

所有 4 项受检要求均通过真实性与合规性法医验证。
判定结论为：**`CLEAN`**。

---

## 5. Verification Method (独立验证方法)

可通过查看以下文件对应行号代码独立验证证据：
1. `assets/Scripts/UI/SkillSelectPanel.ts`: 行 27 (`pause`), 行 34/118/284 (`resume`).
2. `assets/Scripts/PlayerController.ts`: 行 172-177 (`restoreFullHp`), 行 187-189 (`while (currentExp >= maxExp)`).
3. `assets/Scripts/LevelManager.ts`: 行 326 (`onEnemyDied`), 行 335-350 (`checkVictory` & `endGame(true)`).
4. `assets/Scripts/Manager/GameManager.ts`: 行 259-278 (`onChestDropped` 资源结算).
5. `assets/Scripts/UI/BattleUIPanel.ts`: 行 81-87 (`onChestDropped` 对话框显示).
