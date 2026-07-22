## 2026-07-21T02:58:54Z
你是 teamwork_preview_worker_phase6_1。你的工作目录为 /Users/wesson/YokaiCodex/.agents/teamwork_preview_worker_phase6_1。

任务说明：
请根据 3 位 Explorer 交付的分析报告（路径见下方），完成阶段六（R1 动态 JSON 配置、R2 动态节点贴图绑定、R3 pure-code 动态 UI）的全套代码开发与重构。

Explorer 报告参考路径：
- R1: /Users/wesson/YokaiCodex/.agents/teamwork_preview_explorer_phase6_1/analysis.md
- R2: /Users/wesson/YokaiCodex/.agents/teamwork_preview_explorer_phase6_2/analysis.md
- R3: /Users/wesson/YokaiCodex/.agents/teamwork_preview_explorer_phase6_3/analysis.md

具体落地任务：
1. **R1 动态 JSON 配置 (GameManager.ts 与 LevelManager.ts)**
   - 重构 `assets/Scripts/LevelManager.ts`：移除 `start()` 中隐式自动调用的加载，增加 `LevelManager.instance` 单例访问点；新增 `loadLevelConfig(levelId: string, onComplete?: (success: boolean) => void)` 异步方法，使用 `resources.load('Configs/' + levelId + '_Waves', JsonAsset, ...)` 读取并注入波次数据；新增 `setWaveData(waves: IWaveData[])`。
   - 重构 `assets/Scripts/Manager/GameManager.ts`：重构 `startGame(levelId: string = 'Level_1')` 为异步回调链路，在 `lvlMgr.loadLevelConfig` 成功后才将状态切为 PLAYING、重置技能池、启动关卡并打开 `UI/BattleUIPanel`。

2. **R2 动态生成节点与贴图绑定 (VisualLoader.ts, PlayerController.ts, Enemy.ts)**
   - 编写 `assets/Scripts/Utils/VisualLoader.ts`：实现通用 `VisualLoader` 类，提供 `loadVisual(targetNode, texturePath, options)` 方法。检查/创建名为 `Visual` 的子节点，调用 `node.addComponent(Sprite)` 和 `node.addComponent(UITransform)`，并使用 `resources.load(texturePath, SpriteFrame, ...)` 异步加载贴图并赋予给 Sprite，包含异步安全判空校验。
   - 重构 `assets/Scripts/PlayerController.ts`：在 `start()` 中调用 `VisualLoader.loadVisual(this.node, 'Textures/Player/player', ...)`。
   - 重构 `assets/Scripts/Logic/Enemy.ts`：在 `init(hp, speed, target, texturePath)` 中调用 `VisualLoader.loadVisual(this.node, this.texturePath, ...)`。
   - 重构 `assets/Scripts/LevelManager.ts` 刷怪逻辑：传入对应的 `texturePath`（如 `Textures/Enemies/${wave.monster_id}`）。
   - 检查并确保 `assets/resources/Textures/` 目录结构建立。

3. **R3 动态 UI 构建 (BattleUIPanel.ts)**
   - 重构 `assets/Scripts/UI/BattleUIPanel.ts`：在 `onLoad()` 中调用 `ensureUIElements()` 防御性补齐机制。
   - 当 `hpBar`, `hpLabel`, `expBar`, `expLabel`, `timerLabel`, `scoreLabel`, `dialoguePanel`, `speakerLabel`, `dialogueTextLabel`, `joystickBg`, `joystickKnob` 为 null 时，使用 `new Node()` 动态创建节点并添加 `ProgressBar`, `Label`, `Sprite`, `UITransform` 等组件，配置尺寸、坐标、颜色与层级，确保纯代码生成 UI。

约束要求：
- 代码中所有注释使用中文。
- 不需要先写 test。
- 完成修改后，请编写你的 handoff.md 并在其中记录你所执行的编译/运行或语法检查验证结果，并使用 `send_message` 通知编排器。
