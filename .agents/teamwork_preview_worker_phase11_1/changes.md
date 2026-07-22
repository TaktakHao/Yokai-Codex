# Phase 11 代码变更记录 (Changes Log)

## 修改与新建文件列表

### 1. 新建 `assets/Scripts/UI/HomePanel.ts`
- **主要功能**：简约国风主界面 UI 组件（纯代码防御性构建）。
- **具体实现**：
  - **顶部 HUD**：实时显示灵石数量、修仙材料数量、当前境界名称（调用 `HomeManager.instance`）。
  - **中部御兽信息**：列表展示当前 5 个上阵宠物卡片（包含五行属性、星级、稀有度）；动态计算并高亮显示激活的五行羁绊共鸣（如 `3金: +20%攻击` 等），无激活时提供上手引导提示（`出战 3 只同五行属性宠物可触发额外羁绊！`）。
  - **四大功能子界面入口**：
    - `【境界突破】` -> 校验后触发渡劫或打开 `TribulationPanel`；
    - `【御兽盲盒】` -> 打开 `AppraisalPanel`；
    - `【仙器法宝】` -> 打开 `EquipmentPanel`；
    - `【洞府装修】` -> 打开 `FurniturePanel`。
  - **底部核心按钮**：`【开始降妖】` -> 隐藏 `HomePanel`，调用 `GameManager.instance.startGame('Level_1')` 进入关卡。

### 2. 新建 `assets/Scripts/UI/VictoryPanel.ts`
- **主要功能**：局内关卡胜利结算 UI 面板（纯代码防御性构建）。
- **具体实现**：
  - 展示 `🎉 历练大捷` 通关标题与评级。
  - 汇总展示获得的灵石（+200）与修仙材料（+20）战利品。
  - 提供醒目的翡翠绿 `【返回洞府】` 按钮，绑定触发 `GameManager.instance.returnToHome()`。

### 3. 新建 `assets/Scripts/UI/GameOverPanel.ts`
- **主要功能**：局内关卡失败结算 UI 面板（纯代码防御性构建）。
- **具体实现**：
  - 展示 `💀 劫数难逃` 失败抚慰标题。
  - 汇总展示获得的抚慰灵石（+50）与修仙材料（+5）。
  - 提供醒目的朱红 `【返回洞府】` 按钮，绑定触发 `GameManager.instance.returnToHome()`。

### 4. 重构 `assets/Scripts/Manager/UIManager.ts`
- **修改点**：
  - 导入 `HomePanel`, `VictoryPanel`, `GameOverPanel` 组件。
  - 在 `openUI()` 的 Prefab 资源回退构建分支中，完成 `HomePanel`, `VictoryPanel`, `GameOverPanel` 的挂载与注册，支持全系统在无 `.prefab` 资产时纯代码防御性运行。

### 5. 重构 `assets/Scripts/Manager/GameManager.ts`
- **修改点**：
  - **初始化流程**：在 `initSystem()` 中，默认切换至 `GameState.HOME` 状态并自动拉起 `HomePanel`，移除旧版 0.5s 后直接 `startGame('Level_1')` 的硬编码测试逻辑。
  - **关卡启动**：在 `startGame()` 中，确保关闭 `HomePanel` 并拉起 `BattleUIPanel`。
  - **关卡结算**：在 `endGame()` 中，关闭 `BattleUIPanel` 并拉起 `VictoryPanel` 或 `GameOverPanel`。
  - **局内外循环重置 (`returnToHome()`)**：
    1. 通过 `PoolManager` 回收或销毁场景中存活的所有怪物节点与飞弹投射物节点；
    2. 销毁主角随行宠物节点（`Follower_` 节点）并重置主角位置 (0, 0, 0) 与生命值；
    3. 停止关卡计时与刷怪逻辑，调用 `LevelManager.instance.resetLevel()`；
    4. 关闭局内战斗与结算 UI 面板，重新拉起 `HomePanel` 主界面并结算离线/在线收益与存档。

### 6. 更新 `assets/Scripts/LevelManager.ts`
- **修改点**：
  - 新增 `resetLevel()` 公有 API 方法，重置 `isPlaying = false`、`gameTime = 0`、`spawnedWaves.clear()` 与 `activeEnemyCount = 0`，确保返回洞府时关卡刷怪逻辑彻底停止。

### 7. 统一面板国风 UI 调色 (R3 Polishing)
- **修改点**：
  - 统一 `HomePanel.ts`, `VictoryPanel.ts`, `GameOverPanel.ts`, `AppraisalPanel.ts`, `EquipmentPanel.ts`, `FurniturePanel.ts`, `TribulationPanel.ts` 等面板背景底色为国风深色半透明主题色 `Color(15, 23, 42, 245)`。
  - 统一金色烫金标题 `Color(255, 215, 0)`、翡翠绿 `Color(34, 197, 94)` 状态高亮与卡片布局，通俗引导文案提升游戏易上手体验。
