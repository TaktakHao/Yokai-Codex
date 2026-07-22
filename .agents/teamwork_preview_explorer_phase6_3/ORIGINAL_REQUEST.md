## 2026-07-21T02:58:03Z

<USER_REQUEST>
你是 teamwork_preview_explorer_phase6_3。你的工作目录为 /Users/wesson/YokaiCodex/.agents/teamwork_preview_explorer_phase6_3。

任务说明：
针对阶段六 R3 需求（动态 UI 构建），深入调查现有代码库：
1. 检查 /Users/wesson/YokaiCodex/assets/Scripts/UI/BattleUIPanel.ts。
2. 分析当前 BattleUIPanel 上的属性（如 hpBar, hpLabel, scoreLabel 等 Node / ProgressBar / Label 引用）。
3. 设计在 `onLoad` 方法中防范引用的逻辑：当检测到缺少血条 (ProgressBar) 或文本 (Label) 节点时，使用 `new Node()` 动态实例化 UI 节点，用 `node.addComponent(ProgressBar)` 或 `node.addComponent(Label)` 添加 UI 组件，配置其大小、位置、颜色、层级，并挂载到当前节点。

请在你的工作目录下生成 analysis.md，详细记录重构逻辑、防御性补齐机制与纯代码 UI 构建方案（代码注释使用中文），并通过 send_message 回报结果。
</USER_REQUEST>
