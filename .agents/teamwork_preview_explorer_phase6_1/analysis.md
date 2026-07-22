# 阶段六 R1 需求（动态加载 JSON 配置）代码调查与重构分析报告

## 一、现阶段代码结构与调查结论

### 1.1 GameManager (`assets/Scripts/Manager/GameManager.ts`)
- **当前职责**：作为全局单例控制器，管理游戏生命周期状态切换 (`INIT`, `HOME`, `PLAYING`, `PAUSED`, `GAME_OVER`, `VICTORY`)、离线收益结算与持久化保存。
- **存在的问题**：
  1. **拖拽属性依赖风险**：使用 `@property(LevelManager)` 编辑器拖拽绑定引用，当场景重建或跨场景运行时容易因节点实例变动而丢失。
  2. **关卡 ID 未传递**：在 `startGame(levelId: string = 'Level_1')` 中，入参 `levelId` 并没有被使用，仅盲目同步调用 `lvlMgr.startGame()`。
  3. **缺少异步控制链**：没有在配置加载完成后再触发系统启动和 UI 打开，导致如果配置尚未准备好，战斗 UI 和游戏逻辑可能提前运行。

### 1.2 LevelManager (`assets/Scripts/LevelManager.ts`)
- **当前职责**：关卡波次刷怪控制器，维护 `gameTime` 计时器并按波次生成怪物。
- **存在的问题**：
  1. **生命周期硬编码**：在组件 `start()` 生命周期中自动硬编码调用 `resources.load('Configs/Level_1_Waves', JsonAsset, ...)`。
  2. **竞态/重复启动问题 (Race Condition)**：配置异步加载成功后回调内部直接调用了 `this.startGame()`；而 `GameManager.startGame()` 又会二次调用 `lvlMgr.startGame()`，引发重复初始化风险。
  3. **缺乏关卡 ID 动态化能力**：无法根据传入的关卡 ID 动态加载 `Configs/${levelId}_Waves` 配置。
  4. **类型防御与数据校验缺失**：若 JSON 内容解析失败或格式不合规，缺乏容错处理。

### 1.3 JSON 配置文件检查 (`assets/resources/Configs/`)
- `Level_1_Waves.json`：
  - 格式为 JSON 数组 `IWaveData[]`；
  - 包含字段：`spawn_time`, `monster_id`, `spawn_count`, `base_hp`；
  - 能够完全匹配 `LevelManager.ts` 中定义的 `IWaveData` 接口。
- `Chapter1_Dialogues.json`：
  - 包含对话字段：`speaker`, `text`, `trigger_condition`。

---

## 二、重构方案与修改点分析

### 2.1 核心重构逻辑
摒弃原有依赖编辑器拖拽和组件 `start()` 内隐式自发加载的方式，建立由 `GameManager` 统一调控的异步加载与依赖注入流程：

```text
[GameManager.startGame(levelId)]
             │
             ▼
[LevelManager.loadLevelConfig(levelId)] ───► [resources.load('Configs/' + levelId + '_Waves', JsonAsset)]
             │                                                          │
             │ ◄───────────────── 异步回调 (onComplete) ─────────────────┘
             ▼
[数据校验与 setWaveData 内存注入]
             │
             ▼
[SkillPoolManager 重置] ───► [LevelManager.startGame()] ───► [打开 UI/BattleUIPanel]
```

### 2.2 具体修改点（Detailed Modifications）

1. **`LevelManager.ts` 修改点**：
   - 移除 `start()` 中隐式自动调用的 `loadWaveConfig()`。
   - 建立单例访问点 `LevelManager.instance`，增强系统解耦。
   - 增加公开方法 `loadLevelConfig(levelId: string, onComplete?: (success: boolean) => void)`，根据 `levelId` 动态异步加载 `resources.load('Configs/' + levelId + '_Waves', JsonAsset, ...)`。
   - 增加公开方法 `setWaveData(waves: IWaveData[])`，实现配置解析与刷怪逻辑注入的彻底分离。
   - 增加防御性校验：解析 `JsonAsset.json` 时兼顾纯数组格式与包含 `{ waves: [...] }` 的对象格式。

2. **`GameManager.ts` 修改点**：
   - 重构 `startGame(levelId: string = 'Level_1')` 为异步回调链路。
   - 使用 `LevelManager.instance` 或组件查找获取控制器。
   - 调用 `lvlMgr.loadLevelConfig(levelId, (success) => { ... })`。
   - 在加载成功的回调中：将 `_currentState` 切换为 `GameState.PLAYING`，重置 `SkillPoolManager`，调用 `lvlMgr.startGame()`，并调用 `UIManager.instance.openUI('UI/BattleUIPanel')`。

3. **数据结构与依赖项调整**：
   - 导出 `IWaveData` 接口，以便其他模块消费或进行单元/集成验证。
   - 保证 JSON 加载失败时有日志拦截与兜底，避免崩溃。

---

## 三、建议的代码实现范式

### 3.1 `LevelManager.ts` 推荐范式

```typescript
import { _decorator, Component, JsonAsset, resources, error, log, Prefab, instantiate, Node } from 'cc';
import { PoolManager } from './Manager/PoolManager';

const { ccclass, property } = _decorator;

/** 波次数据接口 */
export interface IWaveData {
    /** 触发生成的时间（秒） */
    spawn_time: number;
    /** 怪物配置 ID */
    monster_id: string;
    /** 本波次生成怪物数量 */
    spawn_count: number;
    /** 怪物基础生命值 */
    base_hp: number;
}

/** 关卡配置完整接口定义 */
export interface ILevelConfig {
    /** 关卡标识 */
    levelId?: string;
    /** 关卡名称 */
    levelName?: string;
    /** 波次列表 */
    waves: IWaveData[];
}

@ccclass('LevelManager')
export class LevelManager extends Component {

    private static _instance: LevelManager | null = null;

    /** 单例访问接口 */
    public static get instance(): LevelManager | null {
        return LevelManager._instance;
    }

    @property({ type: Prefab })
    public monsterPrefab: Prefab | null = null;
    
    @property({ type: Node })
    public monsterRoot: Node | null = null;

    /** 记录当前游戏经过的时间（秒） */
    private gameTime: number = 0;
    
    /** 所有波次数据 */
    private wavesData: IWaveData[] = [];
    
    /** 已经生成过的波次索引，避免重复生成 */
    private spawnedWaves: Set<number> = new Set();

    /** 游戏是否开始 */
    private isPlaying: boolean = false;

    /** 当前关卡 ID */
    private currentLevelId: string = '';

    onLoad() {
        if (LevelManager._instance === null) {
            LevelManager._instance = this;
        } else if (LevelManager._instance !== this) {
            this.node.destroy();
            return;
        }
    }

    onDestroy() {
        if (LevelManager._instance === this) {
            LevelManager._instance = null;
        }
    }

    start() {
        // 摒弃 start 内隐式自动加载，等待 GameManager 显式调用 loadLevelConfig
    }

    /**
     * 动态异步加载关卡配置文件
     * @param levelId 关卡ID (如 'Level_1')
     * @param onComplete 加载完成回调
     */
    public loadLevelConfig(levelId: string, onComplete?: (success: boolean) => void) {
        this.currentLevelId = levelId;
        const configPath = `Configs/${levelId}_Waves`;
        log(`[LevelManager] 开始动态加载关卡配置: ${configPath}`);

        resources.load(configPath, JsonAsset, (err, jsonAsset: JsonAsset) => {
            if (err) {
                error(`[LevelManager] 加载关卡配置失败 [${configPath}]: `, err);
                if (onComplete) onComplete(false);
                return;
            }

            if (!jsonAsset || !jsonAsset.json) {
                error(`[LevelManager] 关卡配置文件内容为空 [${configPath}]`);
                if (onComplete) onComplete(false);
                return;
            }

            // 校验与解析
            const rawJson = jsonAsset.json;
            let loadedWaves: IWaveData[] = [];

            if (Array.isArray(rawJson)) {
                loadedWaves = rawJson as IWaveData[];
            } else if (typeof rawJson === 'object' && Array.isArray((rawJson as any).waves)) {
                loadedWaves = (rawJson as any).waves as IWaveData[];
            } else {
                error(`[LevelManager] 关卡配置 JSON 格式非法: ${configPath}`);
                if (onComplete) onComplete(false);
                return;
            }

            // 注入内存
            this.setWaveData(loadedWaves);
            log(`[LevelManager] 关卡配置 [${levelId}] 加载成功，共 ${this.wavesData.length} 波数据。`);

            if (onComplete) {
                onComplete(true);
            }
        });
    }

    /**
     * 注入波次配置数据
     * @param waves 波次数据数组
     */
    public setWaveData(waves: IWaveData[]) {
        this.wavesData = waves || [];
    }

    /**
     * 开始游戏/启动波次刷怪计时
     */
    public startGame() {
        this.gameTime = 0;
        this.spawnedWaves.clear();
        this.isPlaying = true;

        // 预热对象池
        if (this.monsterPrefab && PoolManager.instance) {
            PoolManager.instance.prewarm(this.monsterPrefab, 10);
        }

        log(`[LevelManager] 关卡 [${this.currentLevelId}] 刷怪逻辑启动，计时开始。`);
    }

    update(deltaTime: number) {
        if (!this.isPlaying) return;

        // 累加游戏时间
        this.gameTime += deltaTime;

        this.checkSpawns();
    }

    /**
     * 检查并执行刷怪逻辑
     */
    private checkSpawns() {
        for (let i = 0; i < this.wavesData.length; i++) {
            const wave = this.wavesData[i];
            
            if (this.gameTime >= wave.spawn_time && !this.spawnedWaves.has(i)) {
                this.spawnMonster(wave);
                this.spawnedWaves.add(i);
            }
        }
    }

    /**
     * 生成怪物的具体逻辑 (优先从 PoolManager 对象池获取)
     * @param wave 波次数据
     */
    private spawnMonster(wave: IWaveData) {
        log(`[刷怪] 时间: ${wave.spawn_time}s | 怪物ID: ${wave.monster_id} | 数量: ${wave.spawn_count} | 基础血量: ${wave.base_hp}`);
        
        if (!this.monsterPrefab) {
            error("没有绑定怪物预制体!");
            return;
        }
        
        const parentNode = this.monsterRoot || this.node;
        
        for (let i = 0; i < wave.spawn_count; i++) {
            let monster: Node;
            if (PoolManager.instance) {
                monster = PoolManager.instance.getNode(this.monsterPrefab);
            } else {
                monster = instantiate(this.monsterPrefab);
            }

            monster.setParent(parentNode);
            monster.name = `${wave.monster_id}_${i}`;
            
            const randomX = (Math.random() - 0.5) * 500;
            const randomY = (Math.random() - 0.5) * 500;
            monster.setPosition(randomX, randomY, 0);
            
            const enemyComp = monster.getComponent('Enemy');
            if (enemyComp && typeof (enemyComp as any).init === 'function') {
                (enemyComp as any).init(wave.base_hp);
            }
        }
    }
}
```

### 3.2 `GameManager.ts` 推荐范式

```typescript
    /**
     * 开始游戏/进入指定关卡
     * @param levelId 关卡ID (如 'Level_1')
     */
    public startGame(levelId: string = 'Level_1') {
        log(`[GameManager] 开始游戏流程，准备加载关卡: ${levelId}`);

        const lvlMgr = LevelManager.instance || this.levelManager || this.getComponentInChildren(LevelManager);
        if (!lvlMgr) {
            error('[GameManager] 无法获取 LevelManager 实例！');
            return;
        }

        // 异步加载 JSON 配置文件并在回调中启动各系统
        lvlMgr.loadLevelConfig(levelId, (success: boolean) => {
            if (!success) {
                error(`[GameManager] 关卡配置 [${levelId}] 加载失败，无法启动游戏。`);
                return;
            }

            // 状态切换为 PLAYING
            this._currentState = GameState.PLAYING;

            // 重置技能池
            const skillMgr = this.skillPoolManager || this.getComponentInChildren(SkillPoolManager);
            if (skillMgr) {
                skillMgr.resetSkillPool();
            }

            // 启动关卡刷怪逻辑
            lvlMgr.startGame();

            // 打开战斗 UI
            if (UIManager.instance) {
                UIManager.instance.openUI('UI/BattleUIPanel');
            }

            log(`[GameManager] 关卡 [${levelId}] 加载并启动成功！`);
        });
    }
```
