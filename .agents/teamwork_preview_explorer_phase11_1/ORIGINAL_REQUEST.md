## 2026-07-22T09:16:29Z

你是 Phase 11 的 Explorer (探索者)。
请对项目 `/Users/wesson/YokaiCodex` 执行 Phase 11 需求的代码库全面探索。

【你的工作目录】: `/Users/wesson/YokaiCodex/.agents/teamwork_preview_explorer_phase11_1`

【核心需求参考】:
阅读 `/Users/wesson/YokaiCodex/.agents/ORIGINAL_REQUEST.md` 中最新 2026-07-22T09:15:54+08:00 用户请求。
阅读 `/Users/wesson/YokaiCodex/.agents/orchestrator/PROJECT.md`。

【探索目标】:
1. 分析 R1 (HomePanel UI Hub):
   - 查看 `UIManager.ts`, `HomeManager.ts`, 以及既有面板 `AppraisalPanel.ts`, `EquipmentPanel.ts`, `FurniturePanel.ts`, `TribulationPanel.ts` 的实现模式与纯代码降级构建方式。
   - 分析如何创建 `HomePanel.ts` 并注册至 `UIManager.ts`（支持无 prefab 时的防御性纯代码生成）。
   - 确定顶部 HUD（灵石、材料、当前境界）、中部御兽列表（名字、星级、五行属性、五行羁绊共鸣显示，如 3金: +20%攻击）、四大功能按钮、底部【开始降妖】按钮的节点结构与数据绑定来源。
2. 分析 R2 (Outer Gameplay Loop Integration):
   - 查看 `GameManager.ts` 现有初始化流程与 `startGame('Level_1')` 实现。如何改为开局默认打开 `HomePanel`？
   - 查看 `BattleUIPanel.ts`, `VictoryPanel.ts`, `GameOverPanel.ts`。分析如何在 `VictoryPanel` 和 `GameOverPanel` 添加【返回洞府】按钮。
   - 详细分析 `GameManager.ts` 中 `returnToHome()` 方法的具体步骤：
     * 销毁/回收场上所有怪物节点（通过 `PoolManager.ts`）与飞弹投射物节点。
     * 销毁主角随行宠物节点及主角局内渲染节点。
     * 停止关卡计时与波次刷怪逻辑，重置 `LevelManager.ts` 关卡状态数据。
     * 关闭局内 UI (`BattleUIPanel`) 与结算面板，显示 `HomePanel`。
3. 分析 R3 (Usability & Simplicity UI Polishing):
   - 分析现有 UI 的配色方案与国风主题适配，确认深色/半透明背景、金黄/绿色文字、清晰边框与返回按钮的统一样式。

【产出要求】:
将分析结果整理并写入 `/Users/wesson/YokaiCodex/.agents/teamwork_preview_explorer_phase11_1/analysis.md` 和 `handoff.md`。
分析完成后，调用 send_message 报告 parent。
记住：所有的回答和文档都必须使用中文。你只需要探索代码并给出实现方案，不要修改源代码或运行构建/测试。
