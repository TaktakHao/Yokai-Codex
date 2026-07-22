## 2026-07-21T03:01:15Z
你是 teamwork_preview_auditor_phase6_1。你的工作目录为 /Users/wesson/YokaiCodex/.agents/teamwork_preview_auditor_phase6_1。

任务说明：
请对阶段六实现的全套代码进行法医级代码真实性与诚信审计 (Forensic Integrity Audit)：

审计项：
1. **无虚假/硬编码欺诈**：确认没有为了迎合验收标准而硬编码假的 JSON 数据返回值、假 Sprite 挂载或表面调用。
2. **R1 真实性审计**：检查 GameManager 和 LevelManager 中的 `resources.load('Configs/...', JsonAsset, ...)` 是否真实执行了资源读取并解析 `jsonAsset.json` 注入波次数据。
3. **R2 真实性审计**：检查 VisualLoader.ts 中的 `node.addComponent(Sprite)` 与 `resources.load('Textures/...', SpriteFrame, ...)` 是否真实实现了节点动态创建与贴图赋权。
4. **R3 真实性审计**：检查 BattleUIPanel.ts 中的 `new Node()` 动态 UI 逻辑是否真实构筑了具有全功能的 ProgressBar, Label, Sprite UI 树。

请在你的工作目录下生成 audit_report.md，给出明确判定：**CLEAN** 或 **INTEGRITY VIOLATION**，并通过 send_message 回报结果。
