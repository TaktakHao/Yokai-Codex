# Project Index: 《万妖录：躺平修仙》

## Architecture
- Engine: Cocos Creator 3.8.8 (TypeScript)
- Paradigm: Singleton / Component Managers / Event-driven / Data-driven Roguelite
- Core Modules:
  - Battle & Spawning (`BattleManager.ts`, `Enemy.ts`, `PlayerController.ts`, `EffectManager.ts`)
  - Pet & Capture (`PetFollower.ts`, `PetCaptureManager.ts`, `BattleUIPanel.ts`, `ItemEgg.ts`)
  - Dialogue & Story (`DialogueSystem.ts`, `DialoguePanel.ts`, `StoryManager.ts`)
  - UI & Flow (`VictoryPanel.ts`, `GameOverPanel.ts`, `GameManager.ts`, `VisualLoader.ts`)

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M0 | Exploration & Analysis | 全局代码探查、Cocos Creator 资源架构分析 | None | DONE |
| M1 | Battle & Strike Feeling | R1: 受击红闪闪烁、头顶红色浮动伤害数字弹出 (BUG-01)、索敌射击与追击校验、BOSS Tint/Scale 修正 | M0 | DONE |
| M2 | Pet, Gourd & Freeze Linkage | R2: 剧情对话防打扰“战斗冻结”（BUG-02）、宠物环形偏置、葫芦抓捕及蛋道具 | M0, M1 | DONE |
| M3 | Settlement & Asset Fallback | R3: Victory/GameOver 结算、重置切回洞府、防卡死白色占位图着色兜底 | M0, M1, M2 | DONE |
| M4 | E2E & Integrity Verification | 4-Tier 测试链路、防作弊与合规性取证审计 (CLEAN) | M1, M2, M3 | DONE |

## Acceptance Criteria Completion
- [x] 首次启动游戏自动开启 8 段剧情顺序播放，可正常通过点击屏幕推进，或一键“跳过”并流畅进入主界面。
- [x] 在关卡中，首次移动、首次击杀、遭遇精英怪、首次抛出葫芦及首次抓捕成功，剧情对话面板能正确弹出，在此期间战斗更新冻结，对话关闭后战斗完美恢复。
- [x] 战斗开打后，怪物能正常朝着玩家位置行进；玩家每隔一定时间自动攻击最近怪物，命中时有明显的红色飘字数字显示。
- [x] 精英怪血量低于 10% 后，点击“抛葫芦”可高概率将其降伏并摧毁怪物，提示抓捕成功并在局外获得该妖兽蛋。
- [x] 关卡正常通关后，弹出 VictoryPanel 且玩家灵石与材料数据增加，点击“返回洞府”能安全切回主界面。
- [x] 游戏在运行期间，控制台不得出现任何未捕获的 NullPointerError、TypeError 或渲染中断报错。

## Interface Contracts
### Battle ↔ UI/Story
- `DialoguePanel`: 触发弹出时派发 `freezeBattle()`，关闭/跳过时调用 `resumeBattle()`。
- `Enemy`: 受击时播放 0.1s 红色 Flash Tween，优先匹配 Tint 色彩与尺寸，坐标点触发 `EffectManager.showDamageText()`。

### Pet & Capture ↔ Inventory
- `GourdCapture`: 校验 HP < 10%，斩杀加成概率抓捕成功后销毁怪物并归还对象池，生成盲盒蛋 `PetEgg`。

### Settlement ↔ Game Lifecycle
- `VictoryPanel` / `GameOverPanel`: 胜利 +200 灵石/+20 材料，失败 +50 灵石/+5 材料，`returnToHome` 安全清理并切回 `HomePanel`。

## Code Layout
- `assets/Scripts/Logic/`: 核心逻辑组件 (`Enemy.ts`, `PetFollower.ts`, `PetCaptureManager.ts`)
- `assets/Scripts/Manager/`: 全局管理器 (`GameManager.ts`, `EffectManager.ts`, `BattleManager.ts`, `LevelManager.ts`)
- `assets/Scripts/UI/`: UI 视图控制 (`DialoguePanel.ts`, `VictoryPanel.ts`, `GameOverPanel.ts`, `BattleUIPanel.ts`)
- `assets/Scripts/Utils/`: 工具集 (`VisualLoader.ts`)
