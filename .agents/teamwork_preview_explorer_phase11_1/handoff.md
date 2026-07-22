# Handoff Report (Phase 11 Explorer)

## 1. Observation (直接观察事实)
- **`UIManager.ts` (第 68-84 行)**：`openUI` 方法中针对未放置 prefab 的回退降级策略目前支持 `BattleUIPanel`、`SkillSelectPanel`、`TribulationPanel`、`AppraisalPanel`、`FurniturePanel`、`EquipmentPanel`，但缺少 `HomePanel`、`VictoryPanel` 以及 `GameOverPanel` 的组件判断与挂载。
- **`GameManager.ts` (第 95-103 行)**：`initSystem()` 目前在 0.5s 后通过 `this.scheduleOnce(() => { this.startGame('Level_1'); }, 0.5)` 自动直接开始关卡 1 战斗，尚未默认打开 `HomePanel`。
- **`GameManager.ts`**：尚未声明实现 `returnToHome()` 方法。
- **UI 脚本文件分布**：`assets/Scripts/UI/` 目录下现有 `AppraisalPanel.ts`, `BattleUIPanel.ts`, `EquipmentPanel.ts`, `FurniturePanel.ts`, `SkillSelectPanel.ts`, `TribulationPanel.ts`，尚不存在 `HomePanel.ts`, `VictoryPanel.ts`, `GameOverPanel.ts`。
- **`LevelManager.ts` (第 187-199 行)**：包含 `startGame()`，但需要专门的 `resetLevel()` 公有方法以便在返回洞府时清空波次和活怪计数。

## 2. Logic Chain (推导逻辑链)
1. **R1 主界面构建逻辑链**：
   - 观察：`UIManager.ts` 负责按名称分配面板组件。
   - 推导：创建 `HomePanel.ts` 后，必须在 `UIManager.ts` 引入 `HomePanel` 并加入 `else if (panelName === 'HomePanel') uiNode.addComponent(HomePanel);`。
   - 观察：`HomeManager.ts` 已具备 `spiritStones`, `materials`, `getCurrentRealmInfo()`, `getEquippedPetIds()`, `calculateElementResonance()`。
   - 推导：`HomePanel.ts` 可以直接通过 `HomeManager.instance` 获取 asset 与 resonance 数据并绑定到顶部 HUD 和中部御兽列表中。

2. **R2 局内外循环与 `returnToHome()` 逻辑链**：
   - 观察：`GameManager.ts` `initSystem()` 启动时直接进入 `Level_1`。
   - 推导：需要将 `scheduleOnce` 的 `startGame` 替换为 `UIManager.instance.openUI('UI/HomePanel')`。
   - 观察：战斗时场上会生成 Enemy 节点、`Follower_xxx` 宠物节点、`PetSpellProjectile` 飞弹节点。
   - 推导：`returnToHome()` 必须依次清理 Enemy（对象池回收）、Follower/Projectile 节点（destroy）、重置 PlayerController 与 LevelManager（`resetLevel()`）、关闭战斗/结算 UI 并打开 `HomePanel`。

3. **R3 国风美工与易上手引导逻辑链**：
   - 观察：现有 `AppraisalPanel`, `EquipmentPanel`, `FurniturePanel` 均统一采用 720x1280 尺寸、`Color(15, 23, 42, 245)` 深色背景、`Color(255, 215, 0)` 金黄标题与 `Color(34, 197, 94)` 绿色状态文本。
   - 推导：新构建的 `HomePanel.ts`、`VictoryPanel.ts` 和 `GameOverPanel.ts` 应完全遵循该 UI 配色规范，并在 `HomePanel` 添加简洁提示语（如：“出战相同五行的宠物触发额外羁绊！”）。

## 3. Caveats (注意事项与假设)
- 本次任务为只读探索，未修改任何源文件。
- 假设在运行 `returnToHome()` 时，场景根节点 `Canvas` 下的怪物节点均位于 `EnemyLayer` 或 `monsterRoot` 中，宠物与飞弹挂载于 `Canvas` 下。

## 4. Conclusion (探索结论)
Phase 11 的需求与技术架构完全明确：
- 需要新建 3 个 UI 组件脚本：`HomePanel.ts`, `VictoryPanel.ts`, `GameOverPanel.ts`。
- 需要修改 2 个核心管理器：`UIManager.ts`（注册新面板组件）, `GameManager.ts`（重构开局流程与实现 `returnToHome()`）。
- 需要修改 1 个关卡管理器：`LevelManager.ts`（补充 `resetLevel()` 关卡数据重置）。

## 5. Verification Method (独立验证方法)
1. **代码检查**：
   - 检查 `HomePanel.ts`, `VictoryPanel.ts`, `GameOverPanel.ts` 是否存在于 `assets/Scripts/UI/`。
   - 检查 `UIManager.ts` 是否成功注册了上述三个面板。
   - 检查 `GameManager.ts` 中 `initSystem()` 是否调起 `HomePanel` 且 `returnToHome()` 方法逻辑完整。
2. **流程逻辑验证**：
   - 游戏启动后停留在 `HomePanel`。
   - 点击【开始降妖】进入 `Level_1`。
   - 在结算界面点击【返回洞府】，检查场上无残留怪物/弹药/宠物节点，UI 正确恢复至 `HomePanel`。
