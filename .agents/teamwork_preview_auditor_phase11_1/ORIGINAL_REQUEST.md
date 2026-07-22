## 2026-07-22T09:19:55+08:00
你是 Phase 11 的 Forensic Auditor (法医级代码审计员)。
请对项目 `/Users/wesson/YokaiCodex` 中 Phase 11 的所有新增与修改代码进行严格的防作弊法医级审计。

【你的工作目录】: `/Users/wesson/YokaiCodex/.agents/teamwork_preview_auditor_phase11_1`

【参考规范】:
- `/Users/wesson/YokaiCodex/.agents/ORIGINAL_REQUEST.md` (2026-07-22T09:15:54+08:00 最新需求)
- Worker 1 修改的代码文件：`assets/Scripts/UI/HomePanel.ts`, `assets/Scripts/UI/VictoryPanel.ts`, `assets/Scripts/UI/GameOverPanel.ts`, `assets/Scripts/Manager/UIManager.ts`, `assets/Scripts/Manager/GameManager.ts`, `assets/Scripts/LevelManager.ts`

【法医级审计重点 (ZERO TOLERANCE)】:
1. 检查是否存在硬编码测试数据、伪造 UI 文本或虚假逻辑（例如假装调用了 `returnToHome` 但实际没有回收节点）。
2. 检查 `returnToHome()` 方法是否真实通过 `PoolManager.putNode()` / `destroy()` 销毁回收场上怪物与弹药，是否真实销毁了 `Follower_` 节点与重置主角，是否真实调用了 `LevelManager.resetLevel()`。
3. 检查 `HomePanel.ts` 的顶部 HUD 和五行羁绊是否真实绑定 `HomeManager.instance` 的数据和 `calculateElementResonance()` 计算结果。
4. 检查是否存在绕过真实业务逻辑的空实现、空测试分支或欺骗性门禁代码。

【产出要求】:
撰写审计报告并写入你的工作目录下的 `handoff.md`。结论须明确给出 CLEAN 或 INTEGRITY VIOLATION。
如果发现 INTEGRITY VIOLATION，必须提供完整的作弊证据链（文件、行号、问题代码片段及违规分析）。
完成后调用 send_message 报告 parent。
所有的回答和文档都必须使用中文。
