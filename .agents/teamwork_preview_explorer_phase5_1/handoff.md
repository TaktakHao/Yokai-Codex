# Handoff Report - Phase 5 R1 (全局中枢与持久化存档)

## 1. Observation (观察)
- **目标组件路径**:
  - `Manager/UIManager.ts`: 继承 Component 的单例模式 (L14-28)，提供 `openUI`, `closeUI`, `closeAllUI` 接口。
  - `Manager/HomeManager.ts`: 继承 Component 的单例模式 (L84-130)，包含境界 (`REALM_CONFIGS`, L33)、灵石/材料挂机产出、离线结算 (`settleOfflineEarnings`, L207) 和旧的分碎化 localStorage 保存机制 (L455-530)。
  - `LevelManager.ts`: 负责加载关卡波次 JSON 配置与刷怪 (`spawnMonster`, L93)。
  - `Logic/IdleSystem.ts`: 局外自动积累资源，拥有独立的 `sys.localStorage` 读写 (L82-100)。
  - `Logic/PetCaptureManager.ts`: 局内妖兽抓捕计算 (基于 `1 - currentHp/maxHp`, L112)、盲盒孵化/变异 (`appraisePetEgg`, L160)，内存中维护 `_petEggList` 和 `_appraisedPetList`，但**缺乏持久化机制**。
  - `PlayerController.ts`: 发送全局事件 `UI_Event_Update_HP`, `UI_Event_Update_EXP`, `UI_Event_Level_Up`, `UI_Event_Game_Over` (L133, 148, 168, 176)。
  - `Logic/SkillPoolManager.ts`: 局内 Roguelike 3选1技能抽取 (L269) 与重置 (L447)。

## 2. Logic Chain (推演逻辑链)
- 现存组件缺乏统一中枢，各模块自行读写 LocalStorage (HomeManager, IdleSystem) 或缺乏存档 (PetCaptureManager)。
- 建立 `SaveManager` 单例，统一定义 `ISaveData` 结构，将玩家境界、金币/材料、持有妖兽 (蛋+已鉴定宠物)、天赋等级表、离线时间戳集中使用 `JSON.stringify` 和 `JSON.parse` 进行原子化读写。
- 建立 `GameManager` 单例，作为全局业务逻辑中枢。维护 `GameState` 状态机 (INIT, HOME, PLAYING, PAUSED, GAME_OVER, VICTORY)，通过 `director.addPersistRootNode` 跨场景常驻，统一调度 UIManager, LevelManager, SaveManager, HomeManager, PetCaptureManager, SkillPoolManager 等模块。

## 3. Caveats (注意事项/局限)
- 本次任务为纯 Read-only 调查与架构分析，未修改 `/Users/wesson/YokaiCodex/assets/Scripts/` 下的项目源码。
- GameManager 节点需放置在初始 Scene 中以保证 `onLoad` 时能够被常驻注册。
- `PoolManager` 与 `EffectManager` 在项目中尚未有具体实现文件，已在架构图中预留协调接口规范。

## 4. Conclusion (结论)
- 详细设计与 complete TypeScript 代码实现方案已撰写至 `/Users/wesson/YokaiCodex/.agents/teamwork_preview_explorer_phase5_1/analysis_r1.md`。
- `GameManager.ts` 与 `SaveManager.ts` 的结构规范、协同流程与重构路径已经完整就绪，可无缝移交 Implementer 进行落地开发。

## 5. Verification Method (独立验证方法)
1. **单例与跨场景常驻验证**：在 Cocos 场景中检查 `GameManager.instance` 和 `SaveManager.instance` 的可访问性与持久性。
2. **生命周期流转验证**：测试 `startGame`, `pauseGame`, `resumeGame`, `endGame` 接口及 `UI_Event_Game_Over` 事件监听响应。
3. **存档数据原子性验证**：触发 `SaveManager.instance.save()`，检查 `sys.localStorage` 中的 `'yokai_codex_save_v1'` JSON 串，重启游戏调用 `load()` 验证数据恢复。
