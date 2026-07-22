# Phase 11 法医级代码防作弊审计报告

## 1. Observation (客观观察事实)

针对 Worker 1 在 Phase 11 修改与新增的核心文件进行了全面源码检索与逐行校验，以下为直接观察到的代码片段与事实：

### 1.1 界面逻辑与主流程控制
* **`assets/Scripts/Manager/GameManager.ts`**:
  * 行 80-101: `initSystem()` 初始化系统时设置状态为 `GameState.HOME`，并自动调用 `UIManager.instance.openUI('UI/HomePanel')`，游戏启动默认进入主界面。
  * 行 140-177: `startGame('Level_1')` 异步加载 `Configs/Level_1_Waves.json`，成功后切换状态为 `GameState.PLAYING`，重置技能池，启动 `LevelManager.startGame()`，关闭 `HomePanel` 并打开 `BattleUIPanel`。
  * 行 211-229: `endGame(isVictory)` 根据胜负结算奖赏 (`settleBattleRewards`)，自动保存存档 (`SaveManager.instance.save()`)，关闭 `BattleUIPanel` 并拉起 `VictoryPanel` 或 `GameOverPanel`。

### 1.2 资源回收与局内外循环闭环 (`returnToHome`)
* **`assets/Scripts/Manager/GameManager.ts` 行 251-323 (`returnToHome`)**:
  * **怪物节点回收**: 行 258-272 检索 `EnemyLayer` 与 `Canvas` 下的活怪节点，判断 `isEnemy` 后通过 `PoolManager.instance.putNode(childNode)` 回收入对象池（若无对象池则执行 `childNode.destroy()`）。
  * **随行宠物与弹药销毁**: 行 275-281 检索 `Canvas` 子节点，凡以 `Follower_` 开头的宠物节点及名为 `PetSpellProjectile` 或包含 `Projectile` 的弹药投射物节点均被 `childNode.destroy()` 销毁。
  * **主角状态复位**: 行 283-294 查找主角节点，调用 `playerComp.restoreFullHp()` 或将 `currentHp` 重置为 `maxHp`，并执行 `playerNode.setPosition(0, 0, 0)` 复位。
  * **关卡数据重置**: 行 298-301 调用 `LevelManager.instance.resetLevel()`，重置关卡时间 `gameTime = 0`、波次标记 `spawnedWaves.clear()` 与活怪计数 `activeEnemyCount = 0`。
  * **UI 面板切换与收益结算**: 行 304-320 关闭 `BattleUIPanel` / `VictoryPanel` / `GameOverPanel` / `SkillSelectPanel` / `PausePanel`，重新拉起 `HomePanel`，结算离线收益并自动持久化存档。

### 1.3 `HomePanel.ts` 数据绑定与五行共鸣计算
* **`assets/Scripts/UI/HomePanel.ts`**:
  * 行 197-210: `refreshDisplay()` 将顶部 HUD 的灵石 `spiritStoneLabel`、修仙材料 `materialLabel` 与境界 `realmLabel` 真实绑定 `HomeManager.instance.spiritStones`、`materials` 与 `getCurrentRealmInfo()`。
  * 行 213-228: 真实调用 `HomeManager.instance.calculateElementResonance()`，根据激活的 3金/3木/3水/3火/3土 组合动态渲染羁绊说明文本 `resonanceLabel.string` 与字体颜色。
  * 行 237-287: `renderPetListCards()` 从 `HomeManager.instance.getEquippedPetIds()` 读取已上阵宠物 ID，通过 `PetCaptureManager.instance.getPetById(petId)` 动态生成最多 5 个出战宠物卡片，展示五行属性配色、名字、星级与稀有度。
  * 行 297-339: 按钮事件回调真实触发业务逻辑：
    * `onStartBattleClick()` 隐藏 `HomePanel` 并调用 `GameManager.instance.startGame('Level_1')`。
    * `onRealmClick()` 调用 `HomeManager.instance.upgradeRealm()`，满足前置条件时拉起 `TribulationPanel`。
    * `onEggClick()` / `onRelicClick()` / `onFurnitureClick()` 分别通过 `UIManager.instance.openUI` 打开对应的二级功能面板。

### 1.4 `UIManager.ts` 纯代码防御性构建
* **`assets/Scripts/Manager/UIManager.ts`**:
  * 行 46-108: `openUI(panelPath)` 在预制体不存在时具备完善的防御性降级机制，自动 `new Node()` 并追加 `HomePanel`、`VictoryPanel`、`GameOverPanel` 等组件，支持无预制体纯代码完整呈现 UI 面板。
  * 行 115-147: `closeUI()` 与 `findMatchingKey()` 规范支持模糊路径匹配与节点显隐/销毁管理。

---

## 2. Logic Chain (推导逻辑链)

1. **零硬编码/伪造校验**: 观察到 `HomePanel` 的 HUD 数据和五行羁绊说明均通过 API 实时查询 `HomeManager.instance` 内存状态及 `calculateElementResonance()` 的结果；`VictoryPanel` 和 `GameOverPanel` 显示的战利品数值（+200/+20、+50/+5）与 `GameManager.settleBattleRewards` 的真实结算发放数值完全一致，不存在虚假硬编码字符串欺骗用户或门禁代码。
2. **节点回收与垃圾清理校验**: 观察到 `GameManager.returnToHome()` 遍历了场景树上的怪物节点，优先通过对象池 `PoolManager.putNode()` 回收；针对主角随行宠物 `Follower_` 及法术/弹药投射物 `PetSpellProjectile`，执行了显式 `destroy()` 销毁；同时将主角 HP 填满并归位 `(0,0,0)`；关卡刷怪引擎 `LevelManager.resetLevel()` 停止了计时与波次产生，确保场景绝无残留垃圾节点或隐式逻辑泄露。
3. **空实现与作弊规避校验**: 检查了 `HomePanel.ts`, `VictoryPanel.ts`, `GameOverPanel.ts`, `UIManager.ts`, `GameManager.ts`, `LevelManager.ts` 中所有的函数与事件响应，所有方法均包含完整的实质逻辑（场景节点查找、状态更新、数据计算、事件广播与 SaveManager 持久化），未发现任何 `return true` 假实现、空测试分支或遮罩型假 UI 逻辑。

---

## 3. Caveats (审计保留事项与局限)

* **No caveats.** 本次法医级代码审计覆盖 Phase 11 指定的全部 6 个核心代码文件，检查项包含全部 4 项零容忍重点，证据链健全完备。

---

## 4. Conclusion (审计结论)

**Verdict: CLEAN**

Phase 11 的所有新增与修改代码表现出极高标准的真实性与完整性。五行羁绊共鸣与主界面 HUD 数据绑定真实，局内外循环 (`startGame` -> 战斗 -> 结算 -> `returnToHome`) 闭环完备且节点回收销毁无遗漏，未发现任何硬编码测试数据、伪造逻辑或作弊性门禁代码。

---

## 5. Verification Method (独立验证方法)

1. **代码审计复核文件与行号**:
   * 查看 `assets/Scripts/Manager/GameManager.ts` 行 251-323 (`returnToHome`) 确认回收与重置逻辑。
   * 查看 `assets/Scripts/UI/HomePanel.ts` 行 197-287 (`refreshDisplay`, `renderPetListCards`) 确认 HUD 与羁绊数据绑定。
   * 查看 `assets/Scripts/UI/VictoryPanel.ts` 与 `GameOverPanel.ts` 行 98-104 确认【返回洞府】响应。
   * 查看 `assets/Scripts/Manager/UIManager.ts` 行 72-92 确认 UI 动态挂载机制。
2. **失效判定条件 (Invalidation Conditions)**:
   * 若 `returnToHome()` 未回收怪物节点或保留了 `Follower_` 节点，导致返回主界面后场景残留怪物/宠物。
   * 若 `HomePanel` 的灵石或五行羁绊展示为固定写死的文本而非读取 `HomeManager.instance`。
