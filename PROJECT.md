# Project: 万妖录：躺平修仙 (Phase 8: 降妖渡劫与洞府放置)

## Architecture
基于 Cocos Creator 的组件化、动态加载与放置玩法架构。
- **配置与数据**: `GameManager.ts` & `LevelManager.ts` 动态加载 JSON 关卡波次，`SaveManager.ts` 实现本地数据原子性存盘。
- **宠物系统**: `PetCaptureManager.ts` 处理捕获率与盲盒变异孵化；`PetFollower.ts` 实现局内随行浮游炮插值跟随与自动飞弹射击。
- **挂机洞府**: `HomeManager.ts` 结算 24h/48h 离线挂机收益，处理上阵与派遣打工（灵田/矿脉）互斥逻辑并叠加上阵宠物的生产率加成。
- **渡劫与UI**: `BattleUIPanel.ts` 提供局内战斗和抛葫芦捕获交互；`TribulationPanel.ts` 纯代码防御性构建避雷劫 10s 走位躲闪倒计时挑战。

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | M1: 局内葫芦抓捕 UI 与宠物跟随战斗 | `BattleUIPanel.ts`, `PlayerController.ts`, `PetFollower.ts` | none | DONE |
| 2 | M2: 境界突破“雷劫挑战”小游戏 | `HomeManager.ts`, `TribulationPanel.ts`, `UIManager.ts` | M1 | DONE |
| 3 | M3: 洞府“打黑工”放置系统与存盘 | `HomeManager.ts`, `SaveManager.ts` | M2 | DONE |
| 4 | M4: 全链路系统整合与防作弊测试 | 静态代码编译校验与功能单元整合 | M3 | DONE |
| 5 | M5: 剧情对话与局内暂停系统 | `DialoguePanel.ts`, `PausePanel.ts`, `DialogueSystem.ts` | M4 | DONE |
| 6 | M6: 多关卡进度与剧情对话波次扩展 | `LevelManager.ts`, `Chapter1_Dialogues.json` 等 | M5 | DONE |
| 7 | M7: 核心视觉风格“国风水墨”重构 | `VisualLoader.ts` 等全局 UI 及渲染层 | M6 | DONE |
| 8 | M8: 割草手感打磨与阻尼摄像机跟随 | `PlayerController.ts` 等操作模块 | M6 | DONE |
| 9 | M9: 战斗反馈（震屏/顿帧/闪白） | `Enemy.ts`, `GameManager.ts` 等机制层 | M7, M8 | DONE |

## Code Layout
- `assets/`
  - `resources/`
    - `Configs/` (`Level_1_Waves.json`, `Chapter1_Dialogues.json`)
    - `Textures/` (`main_hero_xxx`, `enemy_xxx`)
  - `Scripts/`
    - `Manager/` (`GameManager.ts`, `LevelManager.ts`, `UIManager.ts`, `SaveManager.ts`, `PoolManager.ts`, `EffectManager.ts`, `EventManager.ts`, `HomeManager.ts`)
    - `Utils/` (`VisualLoader.ts`)
    - `Logic/` (`Enemy.ts`, `IdleSystem.ts`, `PetCaptureManager.ts`, `SkillPoolManager.ts`, `PetFollower.ts`)
    - `UI/` (`BattleUIPanel.ts`, `SkillSelectPanel.ts`, `TribulationPanel.ts`)
    - `PlayerController.ts`
