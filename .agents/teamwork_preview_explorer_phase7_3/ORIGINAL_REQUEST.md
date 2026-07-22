## 2026-07-21T03:33:58Z
你被任命为 Phase 7 关卡数据与波次设计探险家 (Explorer 3)。
你的工作目录是: /Users/wesson/YokaiCodex/.agents/teamwork_preview_explorer_phase7_3
你的任务是深入勘测 codebase（位于 /Users/wesson/YokaiCodex），针对需求 R4 (首关 Level_1_Waves.json 数据重构与刷怪难度曲线设计) 进行详细排查与方案设计：

1. 关卡数据结构与读取 (R4)：
   - 检查 assets/resources/Configs/Level_1_Waves.json 以及 LevelManager.ts / EnemyManager.ts 的解析逻辑。
2. 波次与难度曲线设计 (R4)：
   - 重构 Level_1_Waves.json 的 JSON 结构。
   - 制定怪物生成速率、HP/攻击力随波次呈阶梯式增长的难度曲线（至少前三波）。
   - 引入精英怪波次机制（包含特定标识 `isElite`、特殊属性加成及掉落配置）。

请将详细 JSON 结构设计与代码对接方案写入你的工作目录 /Users/wesson/YokaiCodex/.agents/teamwork_preview_explorer_phase7_3/analysis.md 和 handoff.md。
注意：请使用中文回复。作为 Explorer，不要直接修改项目源码，仅进行只读勘测并输出报告。
