# YokaiCodex Phase 5 R1 分析报告：全局中枢 (GameManager) 与持久化存档 (SaveManager) 架构设计

## 1. 现状观察与现存组件分析 (Observation)

通过对 `/Users/wesson/YokaiCodex/assets/Scripts/` 目录下现有代码库的全面审查，提取到以下关键组件的现状与实现细节：

| 组件名称 | 文件路径 | 架构模式 | 核心功能与当前依赖关系 |
| :--- | :--- | :--- | :--- |
| **UIManager** | `Manager/UIManager.ts` | 继承 `Component` 的单例 (L14-28) | 通过 `resources.load` 动态加载/管理 UI 预制体，挂载于 UIRoot 节点下。目前提供 `openUI`, `closeUI`, `closeAllUI` 接口。 |
| **HomeManager** | `Manager/HomeManager.ts` | 继承 `Component` 的单例 (L84-130) | 负责局外洞府挂机、灵石 (`_spiritStones`) 与修仙材料 (`_materials`) 产出、境界升级 (`upgradeRealm`, L256)、天赋树 (`upgradeTalent`, L310) 及离线收益结算 (`settleOfflineEarnings`, L207)。自行实现了基于 `sys.localStorage` 的分散存档存储 (L455-530)。 |
| **LevelManager** | `LevelManager.ts` | 继承 `Component` 的非单例 (L12-36) | 加载波次配置 `resources/Configs/Level_1_Waves.json` (L41)，拥有 `startGame()` (L58) 及 `update` 刷怪逻辑 (`spawnMonster`, L93)。怪物节点动态实例化至 `monsterRoot`。 |
| **IdleSystem** | `Logic/IdleSystem.ts` | 继承 `Component` 的非单例 (L4-20) | 局外资源自动增长系统，同样独立使用了 `sys.localStorage` 读写 `"idle_game_save_resource"` 和 `"idle_game_save_last_time"` (L82-100)。 |
| **PetCaptureManager** | `Logic/PetCaptureManager.ts` | 继承 `Component` 的非单例 (L83-99) | 局内抓捕计算 (`calculateCaptureRate` 采用 `1 - currentHp / maxHp` 算式, L112)、生成未鉴定妖兽蛋 (`PetEgg`) 与局外盲盒孵化 (`appraisePetEgg` 变异率 5%, L160)。内存中维护了 `_petEggList` 和 `_appraisedPetList` (L96-99)，但**目前尚未实现持久化本地存储**。 |
| **PlayerController** | `PlayerController.ts` | 继承 `Component` 的非单例 (L8-40) | 玩家移动与自动攻击控制器。使用 `director.emit` 发送全局 UI 事件：`UI_Event_Update_HP` (L133), `UI_Event_Update_EXP` (L148), `UI_Event_Level_Up` (L168), `UI_Event_Game_Over` (L176)。 |
| **SkillPoolManager** | `Logic/SkillPoolManager.ts` | 继承 `Component` 的非单例 (L50-108) | 局内 Roguelike 三选一技能抽取 (`getRandomSkills`, L269)、学习技能 (`selectSkill`, L297) 及流派共鸣检测 (`checkResonance`, L344)。提供 `resetSkillPool()` (L447) 重置接口。 |
| **DialogueSystem** | `DialogueSystem.ts` | 继承 `Component` 的非单例 (L11-23) | 加载对话 JSON 配置并根据触发条件触发对话流程。 |
| **BattleUIPanel** | `UI/BattleUIPanel.ts` | 继承 `Component` 的 UI 组件 (L4-48) | 战斗界面组件，负责血条/经验条渲染、摇杆输入以及对话文本显示。 |

### 现存关键问题（痛点分析）：
1. **持久化存档碎片化与数据丢失风险**：`HomeManager` 与 `IdleSystem` 分别使用各自的字符串 key 读写 `sys.localStorage`；而 `PetCaptureManager` 捕获的妖兽蛋及已鉴定宠物数据目前完全保存在内存中，重启后丢失。
2. **缺乏全局统一中枢驱动**：关卡启动 (`LevelManager.startGame`)、局内升级 (`PlayerController.levelUp`)、游戏结束 (`die`) 目前通过散乱的 `director.emit` 或直接方法调用，缺乏统一的全局状态机控制（如暂停、恢复、胜利结算、失败结算、局内外场景切换等）。
3. **资源与管理器缺乏标准化调度**：如 `PoolManager`（对象池）与 `EffectManager`（特效音效）尚未整合，导致实例化怪物与技能特效开销较大。

---

## 2. 架构设计与推演逻辑链 (Logic Chain)

```
[现存散乱状态] --------------------------------------------------------+
- HomeManager 独立读写 sys.localStorage                                |
- IdleSystem 独立读写 sys.localStorage                                 |
- PetCaptureManager 无持久化                                           |
- PlayerController 发送解耦事件无中枢接收                                  |
                                                                       v
[架构设计推演] --------------------------------------------------------+
1. SaveManager 单例化：作为唯一持久化接口                              |
   - 统一定义完整 JSON 数据结构 ISaveData                                |
   - 整合 Player 境界、Coins/材料、Pets (蛋+宠物)、Talents、离线时间戳    |
   - 充当数据中心 (Data Center)，彻底替换各模块碎片化的 storage 逻辑      |
                                                                       v
2. GameManager 单例化：作为全局业务逻辑中枢 (Control Hub)               |
   - 维护全局游戏状态枚举 GameState (INIT/HOME/PLAYING/PAUSED/...)      |
   - 挂载为跨场景常驻节点 (director.addPersistRootNode)                |
   - 协调 UIManager, LevelManager, SaveManager, HomeManager,          |
     PetCaptureManager, SkillPoolManager, PoolManager, EffectManager   |
                                                                       v
[最终目标] ------------------------------------------------------------+
高内聚、低耦合、生命周期明确、存档原子安全、易于扩展与维护
```

---

## 3. GameManager.ts 详细设计方案

### 3.1 核心设计要点
- **单例模式 (`GameManager.instance`)**：采用标准 Cocos Creator `Component` 单例范式。在 `onLoad` 时进行重复节点校验，并通过 `director.addPersistRootNode(this.node)` 提升为常驻节点。
- **状态机管理 (`GameState`)**：定义清晰的状态枚举：
  - `INIT`: 系统初始化状态
  - `HOME`: 局外主界面/洞府挂机状态
  - `PLAYING`: 局内战斗进行中状态
  - `PAUSED`: 局内暂停状态
  - `GAME_OVER`: 结算失败状态
  - `VICTORY`: 结算胜利状态
- **完整生命周期与协调工作流**：
  1. `init()`: 在 `onLoad` 或引擎启动时执行。调用 `SaveManager.instance.load()` 加载完整存档，触发 `HomeManager` 离线收益计算，初始化全局事件监听 (`director.on`)。
  2. `startGame(levelId?: string)`: 状态切换为 `PLAYING`。重置 SkillPoolManager 与 Player 状态，通知 LevelManager 刷怪，并通过 UIManager 打开 `BattleUIPanel`。
  3. `pauseGame()` / `resumeGame()`: 控制 `director.pause()` / `director.resume()`，切换 UI 面板层级。
  4. `endGame(isVictory: boolean)`: 结算战斗。从战斗中获取灵石/材料/妖兽蛋奖励，同步至 `HomeManager` 与 `PetCaptureManager`，随后调用 `SaveManager.instance.save()` 进行原子保存，并打开结算 UI 面板。
  5. `game.on(Game.EVENT_HIDE)`: 监听应用切后台事件，自动触发数据存档与游戏暂停。

### 3.2 GameManager 代码骨架规范

```typescript
import { _decorator, Component, Node, director, game, Game, log, warn, error } from 'cc';
import { UIManager } from './UIManager';
import { SaveManager } from './SaveManager';
import { HomeManager } from './HomeManager';
import { LevelManager } from '../LevelManager';
import { PetCaptureManager } from '../Logic/PetCaptureManager';
import { SkillPoolManager } from '../Logic/SkillPoolManager';

const { ccclass, property } = _decorator;

/** 游戏全局状态枚举 */
export enum GameState {
    INIT = 'INIT',
    HOME = 'HOME',
    PLAYING = 'PLAYING',
    PAUSED = 'PAUSED',
    GAME_OVER = 'GAME_OVER',
    VICTORY = 'VICTORY'
}

/**
 * 全局业务逻辑中枢管理器 (GameManager)
 */
@ccclass('GameManager')
export class GameManager extends Component {

    private static _instance: GameManager | null = null;

    /** 单例访问接口 */
    public static get instance(): GameManager {
        if (!this._instance) {
            error("GameManager 未初始化！请确保已挂载到初始场景节点中。");
        }
        return this._instance!;
    }

    /** 当前游戏状态 */
    private _currentState: GameState = GameState.INIT;

    /** 关联的关卡管理器引用 (可手填或动态查找) */
    @property(LevelManager)
    public levelManager: LevelManager | null = null;

    /** 关联的抓捕管理器引用 */
    @property(PetCaptureManager)
    public petCaptureManager: PetCaptureManager | null = null;

    /** 关联的技能池管理器引用 */
    @property(SkillPoolManager)
    public skillPoolManager: SkillPoolManager | null = null;

    onLoad() {
        if (GameManager._instance === null) {
            GameManager._instance = this;
            // 设置为跨场景常驻节点
            director.addPersistRootNode(this.node);
            this.initSystem();
        } else {
            this.node.destroy();
            return;
        }
    }

    onDestroy() {
        if (GameManager._instance === this) {
            GameManager._instance = null;
        }
        this.unregisterEvents();
    }

    /**
     * 系统全局初始化
     */
    public initSystem() {
        log('[GameManager] 正在初始化全局系统...');
        this._currentState = GameState.INIT;

        // 1. 初始化持久化存档管理器并加载存档
        SaveManager.instance.load();

        // 2. 结算离线收益 (HomeManager)
        if (HomeManager.instance) {
            HomeManager.instance.settleOfflineEarnings();
        }

        // 3. 注册全局事件监听 (如玩家死亡、升级、切后台等)
        this.registerEvents();

        // 4. 切换状态至主界面 HOME
        this._currentState = GameState.HOME;
        log('[GameManager] 系统初始化完成，当前状态: HOME');
    }

    /**
     * 注册全局事件
     */
    private registerEvents() {
        director.on('UI_Event_Game_Over', this.onPlayerDead, this);
        director.on('UI_Event_Level_Up', this.onPlayerLevelUp, this);
        game.on(Game.EVENT_HIDE, this.onAppHide, this);
        game.on(Game.EVENT_SHOW, this.onAppShow, this);
    }

    /**
     * 注销全局事件
     */
    private unregisterEvents() {
        director.off('UI_Event_Game_Over', this.onPlayerDead, this);
        director.off('UI_Event_Level_Up', this.onPlayerLevelUp, this);
        game.off(Game.EVENT_HIDE, this.onAppHide, this);
        game.off(Game.EVENT_SHOW, this.onAppShow, this);
    }

    /**
     * 开始游戏/进入关卡
     * @param levelId 关卡ID
     */
    public startGame(levelId: string = 'Level_1') {
        log(`[GameManager] 开始游戏，关卡 ID: ${levelId}`);
        this._currentState = GameState.PLAYING;

        // 重置技能池
        if (this.skillPoolManager) {
            this.skillPoolManager.resetSkillPool();
        }

        // 启动关卡生成逻辑
        if (this.levelManager) {
            this.levelManager.startGame();
        }

        // 打开局内战斗UI
        UIManager.instance.openUI('UI/BattleUIPanel');
    }

    /**
     * 暂停游戏
     */
    public pauseGame() {
        if (this._currentState !== GameState.PLAYING) return;
        
        this._currentState = GameState.PAUSED;
        director.pause();
        UIManager.instance.openUI('UI/PausePanel');
        log('[GameManager] 游戏已暂停');
    }

    /**
     * 恢复游戏
     */
    public resumeGame() {
        if (this._currentState !== GameState.PAUSED) return;

        director.resume();
        UIManager.instance.closeUI('UI/PausePanel');
        this._currentState = GameState.PLAYING;
        log('[GameManager] 游戏已恢复');
    }

    /**
     * 结束游戏 (胜利或失败结算)
     * @param isVictory 是否通关成功
     */
    public endGame(isVictory: boolean) {
        if (this._currentState === GameState.GAME_OVER || this._currentState === GameState.VICTORY) return;

        this._currentState = isVictory ? GameState.VICTORY : GameState.GAME_OVER;
        log(`[GameManager] 游戏结束，结算结果: ${isVictory ? '胜利' : '失败'}`);

        // 结算奖励与数据持久化
        this.settleBattleRewards(isVictory);
        SaveManager.instance.save();

        // 弹出相应结算面板
        const resultPanel = isVictory ? 'UI/VictoryPanel' : 'UI/GameOverPanel';
        UIManager.instance.openUI(resultPanel);
    }

    /**
     * 结算局内战利品（灵石、材料、妖兽蛋等）
     */
    private settleBattleRewards(isVictory: boolean) {
        if (HomeManager.instance) {
            const rewardStones = isVictory ? 200 : 50;
            const rewardMaterials = isVictory ? 20 : 5;
            HomeManager.instance.addSpiritStones(rewardStones);
            HomeManager.instance.addMaterials(rewardMaterials);
            log(`[GameManager] 局内结算获得灵石 +${rewardStones}, 材料 +${rewardMaterials}`);
        }
    }

    private onPlayerDead() {
        log('[GameManager] 监听到玩家死亡事件');
        this.endGame(false);
    }

    private onPlayerLevelUp(newLevel: number) {
        log(`[GameManager] 监听到玩家升级事件: Lv.${newLevel}`);
        // 挂起战斗时间，弹出 Roguelike 3选1技能界面
        UIManager.instance.openUI('UI/SkillSelectPanel');
    }

    private onAppHide() {
        log('[GameManager] 应用切入后台，触发数据保存');
        if (this._currentState === GameState.PLAYING) {
            this.pauseGame();
        }
        SaveManager.instance.save();
    }

    private onAppShow() {
        log('[GameManager] 应用切回前台');
    }

    public get currentState(): GameState {
        return this._currentState;
    }
}
```

---

## 4. SaveManager.ts 详细设计方案

### 4.1 核心设计要点
- **单例模式 (`SaveManager.instance`)**：作为唯一的存档读写管道，封装 Cocos Creator 的 `sys.localStorage` 操作，杜绝业务模块分散写入。
- **数据结构定义 (`ISaveData`)**：
  使用结构化 TypeScript 接口管理玩家所有持久化状态：
  ```typescript
  export interface ISaveData {
      version: number;             // 存档版本号 (用于未来版本兼容与迁移)
      lastSaveTimestamp: number;   // 最后保存毫秒时间戳
      player: {
          realmIndex: number;      // 当前境界索引 (HomeManager)
          spiritStones: number;    // 当前灵石储备 (HomeManager)
          materials: number;       // 当前材料储备 (HomeManager)
      };
      talents: Array<{ id: string; level: number }>; // 天赋树各节点等级 (HomeManager)
      pets: {
          eggs: PetEgg[];          // 持有的未鉴定妖兽蛋列表 (PetCaptureManager)
          appraised: AppraisedPet[]; // 持有的已鉴定宠物列表 (PetCaptureManager)
      };
      lastOfflineTime: number;     // 离线起始时间戳 (挂机收益计算依据)
  }
  ```
- **原子序列化与反序列化 (`save()` / `load()`)**：
  - `save()`: 收集来自 `HomeManager` 和 `PetCaptureManager` 的最新内存状态，构建完整的 `ISaveData` 对象，通过 `JSON.stringify` 转化为 JSON 字符串，写入 `sys.localStorage.setItem('yokai_codex_save_v1', stringData)`。
  - `load()`: 从 `sys.localStorage.getItem('yokai_codex_save_v1')` 读取，通过 `JSON.parse` 校验与解析。如果不存在或解析异常，则通过 `getDefaultSaveData()` 生成干净的初始存档。
  - `resetSave()`: 提供抹除本地存档的测试与重置接口。

### 4.2 现有分散存储的重构路径 (Refactoring Path)
1. **废弃原散乱存储 Key**：
   - 废弃 `HomeManager.ts` 中的 `home_spirit_stones`, `home_materials`, `home_realm_index`, `home_talents_data`, `home_last_offline_time`。
   - 废弃 `IdleSystem.ts` 中的 `idle_game_save_resource`, `idle_game_save_last_time`。
2. **统一托管流程**：
   - `HomeManager.ts` 和 `PetCaptureManager.ts` 在 `onLoad()` 时不再直接读写 `sys.localStorage`，而是提供 `exportSaveData()` 与 `importSaveData(data)` 接口，交由 `SaveManager` 在统一时机调用。

### 4.3 SaveManager 代码骨架规范

```typescript
import { _decorator, sys, log, warn, error } from 'cc';
import { PetEgg, AppraisedPet, PetCaptureManager } from '../Logic/PetCaptureManager';
import { HomeManager } from './HomeManager';

/** 完整持久化存档数据结构 */
export interface ISaveData {
    /** 存档格式版本号 */
    version: number;
    /** 存盘时间戳 (ms) */
    lastSaveTimestamp: number;
    /** 玩家基础与货币属性 */
    player: {
        realmIndex: number;
        spiritStones: number;
        materials: number;
    };
    /** 天赋节点等级记录 */
    talents: Array<{ id: string; level: number }>;
    /** 持有妖兽与妖兽蛋数据 */
    pets: {
        eggs: PetEgg[];
        appraised: AppraisedPet[];
    };
    /** 挂机离线起始时间戳 (ms) */
    lastOfflineTime: number;
}

/**
 * 统一存档与数据持久化管理器 (SaveManager)
 */
export class SaveManager {

    private static _instance: SaveManager | null = null;
    private readonly STORAGE_KEY = 'yokai_codex_save_v1';
    private readonly CURRENT_VERSION = 1;

    /** 内存中的当前存档缓存 */
    private _saveData: ISaveData | null = null;

    /** 单例获取接口 */
    public static get instance(): SaveManager {
        if (!this._instance) {
            this._instance = new SaveManager();
        }
        return this._instance;
    }

    private constructor() {}

    /**
     * 生成默认初始存档
     */
    public getDefaultSaveData(): ISaveData {
        return {
            version: this.CURRENT_VERSION,
            lastSaveTimestamp: Date.now(),
            player: {
                realmIndex: 0,
                spiritStones: 0,
                materials: 0
            },
            talents: [],
            pets: {
                eggs: [],
                appraised: []
            },
            lastOfflineTime: Date.now()
        };
    }

    /**
     * 执行全量数据存档 (Memory -> sys.localStorage)
     */
    public save(): boolean {
        try {
            const dataToSave: ISaveData = {
                version: this.CURRENT_VERSION,
                lastSaveTimestamp: Date.now(),
                player: {
                    realmIndex: HomeManager.instance ? HomeManager.instance.getCurrentRealmInfo().level - 1 : 0,
                    spiritStones: HomeManager.instance ? HomeManager.instance.spiritStones : 0,
                    materials: HomeManager.instance ? HomeManager.instance.materials : 0
                },
                talents: HomeManager.instance ? HomeManager.instance.getAllTalents().map(t => ({ id: t.id, level: t.level })) : [],
                pets: {
                    eggs: PetCaptureManager.prototype.getPetEggs ? (this.getPetCaptureManager()?.getPetEggs() || []) : [],
                    appraised: PetCaptureManager.prototype.getAppraisedPets ? (this.getPetCaptureManager()?.getAppraisedPets() || []) : []
                },
                lastOfflineTime: HomeManager.instance ? HomeManager.instance.lastOfflineTime : Date.now()
            };

            const jsonString = JSON.stringify(dataToSave);
            sys.localStorage.setItem(this.STORAGE_KEY, jsonString);
            this._saveData = dataToSave;
            log('[SaveManager] 存档保存成功！时间戳:', dataToSave.lastSaveTimestamp);
            return true;
        } catch (e) {
            error('[SaveManager] 存档保存异常:', e);
            return false;
        }
    }

    /**
     * 执行全量数据加载 (sys.localStorage -> Memory -> 游戏各管理器)
     */
    public load(): ISaveData {
        try {
            const rawData = sys.localStorage.getItem(this.STORAGE_KEY);
            if (!rawData) {
                log('[SaveManager] 未发现本地存档，生成初始存档。');
                this._saveData = this.getDefaultSaveData();
            } else {
                const parsed = JSON.parse(rawData) as ISaveData;
                // 版本号校验与兼容扩展位置
                if (parsed && typeof parsed.version === 'number') {
                    this._saveData = parsed;
                    log('[SaveManager] 成功加载本地存档，版本:', parsed.version);
                } else {
                    warn('[SaveManager] 存档数据格式损坏，降级使用默认存档。');
                    this._saveData = this.getDefaultSaveData();
                }
            }
        } catch (e) {
            error('[SaveManager] 读取本地存档失败:', e);
            this._saveData = this.getDefaultSaveData();
        }

        // 将读取到的数据恢复分配至各业务管理器
        this.applySaveToManagers(this._saveData);
        return this._saveData;
    }

    /**
     * 将存档数据分发恢复至具体管理器内存
     */
    private applySaveToManagers(data: ISaveData) {
        if (!data) return;

        // 恢复 HomeManager 数据 (可通过扩展 HomeManager 增加 setSaveData 接口)
        // 恢复 PetCaptureManager 数据 (恢复妖兽蛋列表与宠物列表)
        const petManager = this.getPetCaptureManager();
        if (petManager) {
            petManager.clearAllData();
            if (data.pets && data.pets.eggs) {
                data.pets.eggs.forEach(egg => petManager.addPetEgg(egg));
            }
            if (data.pets && data.pets.appraised) {
                data.pets.appraised.forEach(pet => petManager.addAppraisedPet(pet));
            }
        }
    }

    /**
     * 清除本地存档
     */
    public resetSave() {
        sys.localStorage.removeItem(this.STORAGE_KEY);
        this._saveData = this.getDefaultSaveData();
        log('[SaveManager] 本地存档已重置。');
    }

    /**
     * 判断是否存在本地存档
     */
    public hasSaveData(): boolean {
        return sys.localStorage.getItem(this.STORAGE_KEY) !== null;
    }

    public get saveData(): ISaveData | null {
        return this._saveData;
    }

    private getPetCaptureManager(): PetCaptureManager | null {
        // 可由 GameManager 统一提供或在场景中获取引用
        return null; 
    }
}
```

---

## 5. 局限性与已知边界 (Caveats)

1. **未在本项目实际编译运行代码**：本次报告为 Read-Only 深入分析与架构设计。具体代码落地需要 Implementer 配合修改及在 Cocos Creator 环境中测试。
2. **场景节点依赖性**：`GameManager` 与 `UIManager` 依赖场景挂载节点或 `director.addPersistRootNode`，需确保项目首个加载场景 (Entry Scene) 包含带有 `GameManager` 的节点。
3. **对象的循环引用与 JSON 序列化限制**：`ISaveData` 中的数据必须是可被 JSON 序列化的纯数据结构，不能包含 Cocos `Node` 或 `Component` 等复杂引用。
4. **PoolManager 与 EffectManager 尚未建档**：建议在 Phase 5 后续开发中由实现者创建通用 `PoolManager`（基于 Cocos `NodePool`）与 `EffectManager`。

---

## 6. 独立验证方法 (Verification Method)

在 Implementer 落地代码后，可通过以下步骤逐项验证 R1 需求的正确性：

1. **单例与跨场景常驻验证**：
   - 启动游戏，在控制台运行 `GameManager.instance` 与 `SaveManager.instance`，确认均能正确返回非空实例对象。
   - 切换场景，确认 GameManager 节点在 `DontDestroyOnLoad` 根节点下依然生效且 `_instance` 保持单一。
2. **生命周期流程验证**：
   - 调用 `GameManager.instance.startGame('Level_1')`，观察日志，确认 `LevelManager` 刷怪启动、`SkillPoolManager` 重置且 `BattleUIPanel` 打开。
   - 调用 `GameManager.instance.pauseGame()` / `resumeGame()`，确认引擎 `director.isPaused()` 状态与 UI 响应符合预期。
   - 触发 `director.emit('UI_Event_Game_Over')`，验证 GameManager 自动捕获事件、停止游戏并调起结算界面。
3. **SaveManager 读写与 JSON 校验**：
   - 在控制台或模拟器中通过 `PetCaptureManager` 添加测试妖兽蛋，调用 `SaveManager.instance.save()`。
   - 打开浏览器 / Cocos 模拟器 Application LocalStorage 检查，找到 Key `'yokai_codex_save_v1'`，验证保存的字符串为包含 `player`, `talents`, `pets` 的标准 JSON 格式。
   - 刷新/重启游戏，验证 `SaveManager.instance.load()` 能否正确还原境界、货币及 `PetCaptureManager` 背包中的妖兽蛋列表。
