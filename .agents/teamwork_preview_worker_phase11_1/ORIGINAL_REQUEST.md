## 2026-07-22T01:17:30Z
你是 Phase 11 的 Worker (代码实现者)。
请根据 Phase 11 需求规范以及 Explorer 的探索报告，在项目 `/Users/wesson/YokaiCodex` 中完成 Phase 11 的完整代码开发与自测。

【你的工作目录】: `/Users/wesson/YokaiCodex/.agents/teamwork_preview_worker_phase11_1`

【核心需求与要点】:
R1: 简约国风主界面 UI 搭建 (HomePanel UI Hub)
- 新建 `assets/Scripts/UI/HomePanel.ts`：纯代码防御性构建主界面 UI。
  - 顶部 HUD：显示灵石数量、修仙材料数量、当前境界名称（调用 `HomeManager.instance`）。
  - 中部御兽信息：展示当前上阵宠物列表（名字、星级、五行属性），列出激活的五行羁绊共鸣（如 `3金: +20%攻击` 激活状态）。
  - 四大功能按钮：
    * `【境界突破】` -> 校验后拉起 `TribulationPanel`
    * `【御兽盲盒】` -> 打开 `AppraisalPanel`
    * `【仙器法宝】` -> 打开 `EquipmentPanel`
    * `【洞府装修】` -> 打开 `FurniturePanel`
  - 底部核心按钮：`【开始降妖】` -> 隐藏 HomePanel，开启 Level_1 关卡。
- 在 `assets/Scripts/Manager/UIManager.ts` 中注册 `HomePanel`（以及 `VictoryPanel`、`GameOverPanel`），支持无 prefab 纯代码防御性构建。

R2: 局内外关卡切换与结算闭环 (Outer Gameplay Loop Integration)
- 重构 `assets/Scripts/Manager/GameManager.ts` 初始化逻辑：开局默认打开 `HomePanel`，不再直接调起 `startGame('Level_1')`。
- 点击 `【开始降妖】` 时，调用 `GameManager.instance.startGame('Level_1')`，隐藏 `HomePanel`，拉起 `BattleUIPanel`，开启刷怪。
- 新建/完善局内结算面板：`assets/Scripts/UI/VictoryPanel.ts` 与 `assets/Scripts/UI/GameOverPanel.ts`，均提供大大的 `【返回洞府】` 按钮。当游戏胜利或失败触发结算时弹出。
- 在 `GameManager.ts` 中实现 `returnToHome()` 方法：
  - 通过 `PoolManager` 销毁/回收场上所有怪物节点及飞弹投射物节点。
  - 销毁主角随行宠物节点（`Follower_` 节点）及主角局内渲染。
  - 停止关卡计时与波次刷怪逻辑，重置 `LevelManager.ts` 数据（实现/调用 `LevelManager.resetLevel()`）。
  - 关闭局内战斗 UI (`BattleUIPanel`) 与结算面板，重新加载并显示主界面 `HomePanel`。

R3: 极简美工与易上手引导 (Usability & Simplicity UI Polishing)
- 所有面板（包含 `HomePanel`, `AppraisalPanel`, `EquipmentPanel`, `FurniturePanel`, `TribulationPanel`, `VictoryPanel`, `GameOverPanel`）统一采用简约、素雅的国风主题配色（深色/半透明背景 `Color(15, 23, 42, 245)`，金黄 `Color(255, 215, 0)` / 翡翠绿 `Color(34, 197, 94)` 醒目文字，清晰面板边界与返回按钮）。
- 按钮文字通俗易懂，界面提供简易提示性文本（例如“出战相同五行的宠物触发额外羁绊！”）。

【MANDATORY INTEGRITY WARNING】:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

【验证要求】:
- 完成代码编写后，请编译/检查 TypeScript 类型，运行测试/构建脚本（若有）。
- 撰写详细的 `changes.md` 与 `handoff.md`（包含 Observation, Logic Chain, Caveats, Conclusion, Verification Method 和构建/测试结果）。
- 完成后调用 send_message 报告 parent。
- 所有的回答和文档都必须使用中文，代码中的注释也使用中文。在实现需求的时候不需要先写 test。
