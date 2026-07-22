## 2026-07-21T03:35:01Z
<USER_REQUEST>
你被任命为 Phase 7 核心功能与表现重构 Implementation Worker (Worker 1)。
你的工作目录是: /Users/wesson/YokaiCodex/.agents/teamwork_preview_worker_phase7_1

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

请仔细阅读以下三份 Explorer 交付的 Handoff 与 Analysis 报告：
1. /Users/wesson/YokaiCodex/.agents/teamwork_preview_explorer_phase7_1/handoff.md (R1 黑屏与层级修复，R3 UI Tween 动画与贴图映射)
2. /Users/wesson/YokaiCodex/.agents/teamwork_preview_explorer_phase7_2/handoff.md (R2 三选一技能 SkillPoolManager / SkillSelectPanel 与局外挂机资源闭环)
3. /Users/wesson/YokaiCodex/.agents/teamwork_preview_explorer_phase7_3/handoff.md (R4 Level_1_Waves.json 数据重构、难度曲线与精英怪)

你需要逐一落地以下 4 大需求的编码与配置修改：
【R1 彻底解决黑屏】
- 修复 UIManager.ts 缺失 director 模块导入问题。
- 在 VisualLoader.ts, BattleUIPanel.ts, LevelManager.ts, PlayerController.ts, Enemy.ts 中纯代码创建 2D/UI 节点时，显式赋予 `node.layer = Layers.Enum.UI_2D` (33554432)，确保 Camera 正常渲染不被 2D 批次管线剔除。

【R2 玩法与数值系统】
- 跑通 击杀怪物 -> 经验增加 -> 主角升级 -> 触发三选一技能 (SkillPoolManager 抽选，弹出 SkillSelectPanel 或 BattleUIPanel 3选1动态界面与控制台日志)。
- 在 SaveManager.ts / HomeManager.ts 中实现局外挂机资源（灵石、修仙材料）获取与离线结算闭环，包含境界倍率与软上限。

【R3 视觉管线与 UI 动效】
- 在 BattleUIPanel.ts 中使用 Cocos Creator `tween()` 为血条和经验条添加数值变动时的平滑过渡插值动画。
- 扩展 VisualLoader.ts 与 Enemy.ts / PlayerController.ts，使用 assets/resources/Textures/ 下的纹理图集为主角和不同敌人自动绑定贴图，结合 Color Tint 染色与 Scale 缩放，彻底摆脱纯色黑白方块原型。

【R4 关卡波次与刷怪节奏】
- 重构 assets/resources/Configs/Level_1_Waves.json，满足 Meta -> Waves -> MonsterGroups 规范，设置前三波怪物数量、HP、攻击力、移速阶梯递增，并在 180s 配置精英怪标识 (`is_elite: true`) 及掉落宝箱配置。
- 重构 LevelManager.ts 的 TS 接口定义与分批刷怪逻辑，并将怪物属性完整传递给 Enemy.ts 进行初始化。

代码实现完成后，请运行编译/类型检查命令验证无报错，并在你的工作目录输出 /Users/wesson/YokaiCodex/.agents/teamwork_preview_worker_phase7_1/handoff.md。
注意：请使用中文编写所有代码注释、文档与提交报告。
</USER_REQUEST>
