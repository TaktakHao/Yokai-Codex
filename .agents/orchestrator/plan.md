# Orchestration Plan: 《万妖录：躺平修仙》第一关完全闭环开发

## 任务目标
解决《万妖录：躺平修仙》第一关“青云山外围”的全部体验缺陷与报错，实现第一关从开局剧情、战斗追逐、浮动伤害/受击闪红、宠物跟随/葫芦抓捕/剧情冻结，到全链路结算（Victory/GameOver）与防崩溃占位图的完全闭环。

## 编排架构 (Project Pattern)

### 阶段 0: 全局探索与代码基线分析 (Exploration Phase)
- 调度 `teamwork_preview_explorer` 探查项目整体架构、目录结构、Cocos Creator TypeScript 脚本关联关系、当前体验缺陷与报错隐患。

### 阶段 1: 核心 Milestone 划分与并行推进
- **Milestone 1 (M1 - R1 战斗/索敌/打击感闭环)**:
  - 怪物追逐玩家逻辑修复。
  - 自动索敌与最邻近怪物射击机制校验。
  - 受击红色闪烁特效 (`EffectManager.ts`) 与头顶红色浮动伤害数字弹出。
- **Milestone 2 (M2 - R2 宠物/抓捕/剧情冻结联动)**:
  - 宠物弹性平滑插值跟随、多宠物环形偏置算法、投射物飞弹颜色/大小挂钩星级化形。
  - 葫芦抓捕逻辑（10%残血捕捉概率计算、摧毁怪物、同步盲盒蛋道具、触发剧情）。
  - 剧情对话 (`DialoguePanel.ts`) 弹出期间战斗逻辑防御性“冻结”与关闭后完美恢复。
- **Milestone 3 (M3 - R3 结算/防崩溃占位图/资源加载)**:
  - 关卡胜利通关 (`VictoryPanel.ts` 灵石/材料结算) 与失败 (`GameOverPanel.ts`)，点击返回彻底重置与安全切回洞府。
  - 动态资源加载防御性补全（贴图缺失或加载缓慢时采用白色占位图并着色渲染，防卡死）。
- **Milestone 4 (E2E Track - 端到端测试与质量验证)**:
  - 建立 4-Tier 完整 E2E 验证用例与自动化测试基线。

### 阶段 2: 迭代循环 (Explorer -> Worker -> Reviewer -> Challenger -> Auditor)
对每个 Milestone 执行严格质量门禁控制。

### 阶段 3: 最终闭环验收与 Sentinel 汇报
全面验证 Acceptance Criteria 的所有 checklist 条目，无报错无遗漏，最终交付。
