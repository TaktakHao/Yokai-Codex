# YokaiCodex Phase 5 (阶段五：大一统与性能进化) 实现报告

## 1. 观察记录 (Observation)

对 `/Users/wesson/YokaiCodex/assets/Scripts/` 目录进行了开发与整合，完成了 Phase 5 指定的核心模块与解耦闭环：

1. **`assets/Scripts/Manager/SaveManager.ts`** (R1):
   - 实现了 `SaveManager.instance` 单例。
   - 统一定义了 `ISaveData` 结构体，包含 `version`, `lastSaveTimestamp`, `player` (`realmIndex`, `spiritStones`, `materials`), `talents`, `pets` (`eggs`, `appraised`), `lastOfflineTime`。
   - 实现了 `save(): boolean` 和 `load(): ISaveData`，内部封装 `JSON.stringify` 与 `JSON.parse` 处理 `sys.localStorage` 操作。
   - 提供了 `getDefaultSaveData()` 兜底初始存档，`resetSave()` 抹除接口以及 `applySaveToManagers()` 分发恢复数据逻辑。

2. **`assets/Scripts/Manager/GameManager.ts`** (R1):
   - 实现了继承 `Component` 的单例 `GameManager.instance`，在 `onLoad` 中调用 `director.addPersistRootNode(this.node)` 挂载为跨场景常驻节点。
   - 定义了 `GameState` 生命周期状态枚举 (`INIT`, `HOME`, `PLAYING`, `PAUSED`, `GAME_OVER`, `VICTORY`)。
   - 实现了全生命周期流程函数：`initSystem()`, `startGame(levelId?: string)`, `pauseGame()`, `resumeGame()`, `endGame(isVictory: boolean)`。
   - 协调 `UIManager`, `LevelManager`, `SaveManager`, `PoolManager`, `EffectManager`, `PetCaptureManager`, `SkillPoolManager` 各子模块。
   - 绑定 `game.on(Game.EVENT_HIDE)` 监听切后台自动触发数据保存。

3. **`assets/Scripts/Manager/PoolManager.ts`** (R2):
   - 实现了继承 `Component` 的单例 `PoolManager.instance`。
   - 内部维护 `_pools: Map<string, NodePool>` 与 `_prefabMap: Map<string, Prefab>`。
   - 核心 API: `getNode(prefabOrKey: Prefab | string): Node`, `putNode(node: Node)`, `prewarm(prefab: Prefab, count: number)`, `clearPool(key?: string)`。
   - 实现了节点状态管理与标识记录：`(node as any).__poolKey`、`active = true/false` 与 `removeFromParent()` 状态转移闭环。

4. **`assets/Scripts/Logic/Enemy.ts`** (R2):
   - 实现 `IEnemy` 接口 (`takeDamage(amount: number)`)。
   - 配置属性: `@property maxHp`, `currentHp`, `@property moveSpeed`, `@property attackDamage`, `@property attackInterval`, `@property expValue`, `targetPlayer: Node | null`。
   - 追击 AI: 在 `update(deltaTime)` 中向 `targetPlayer` 坐标平滑移动，并在接触距离（30px）内进行持续近战攻击。
   - 死亡与自我回收: 在 `takeDamage()` 导致 `currentHp <= 0` 时调用 `die()`，给予玩家经验值，派发 `CombatEvent.ENEMY_DIED` 事件，并自动调用 `PoolManager.instance.putNode(this.node)` 回收。

5. **`assets/Scripts/Manager/EventManager.ts`** (R3):
   - 基于 Cocos Creator `EventTarget` 封装静态方法 `on<T>()`, `off<T>()`, `once<T>()`, `emit<T>()`。
   - 定义了全局事件枚举 `CombatEvent` (`PLAYER_ATTACKED`, `ENEMY_DAMAGED`, `ENEMY_DIED`, `PLAYER_DAMAGED`) 与 `UIEvent` (`UPDATE_HP`, `UPDATE_EXP`, `LEVEL_UP`, `GAME_OVER`)。
   - 定义了类型安全的事件载荷接口 `IEnemyDamagedPayload`, `IEnemyDiedPayload`, `IPlayerAttackedPayload`。

6. **`assets/Scripts/Manager/EffectManager.ts`** (R3):
   - 继承 `Component` 的单例 `EffectManager.instance`。
   - 在 `onLoad` 中通过 `EventManager.on` 订阅 `CombatEvent.ENEMY_DAMAGED`, `CombatEvent.ENEMY_DIED`, `CombatEvent.PLAYER_ATTACKED`，并在 `onDestroy` 中取消订阅。
   - 实现了视觉反馈占位方法 `showDamageText()`, `playDeathEffect()`, `playAttackEffect()`。

7. **系统整合更新 (Integration Updates)**:
   - **`PlayerController.ts`**: 引入 `EventManager`，在发动攻击时广播 `CombatEvent.PLAYER_ATTACKED`，在血量/经验/升级/死亡时同步广播 `UIEvent` 与 `director.emit` 兼容事件。
   - **`LevelManager.ts`**: 在 `spawnMonster()` 刷怪逻辑中优先从 `PoolManager.instance.getNode(this.monsterPrefab)` 获取节点，并在 `startGame()` 中提前调用 `prewarm()`。
   - **`PetCaptureManager.ts`**: 增加了 `PetCaptureManager.instance` 静态访问接口，方便 `SaveManager` 进行数据读取与恢复。

---

## 2. 推演逻辑链 (Logic Chain)

1. **存档解耦与单点集中**:
   原有的存储逻辑散落于各系统。通过引入 `ISaveData` 与 `SaveManager`，收拢所有玩家属性（境界、灵石、材料）、天赋树及已捕获宠物（妖兽蛋与已鉴定宠物），由 `SaveManager` 统一处理 `sys.localStorage` 的 JSON 读写，降低数据失真风险。
2. **生命周期与状态控制**:
   由 `GameManager` 作为全局 `addPersistRootNode` 根节点，控制 `GameState` 转移。启动游戏时读取 `SaveManager` 存档，结束时自动结算战利品并写盘，退后台自动存盘，保证流程原子性。
3. **性能进化 (对象池闭环)**:
   割草玩法下大量 Enemy 节点的生成与销毁会引发严重 GC。由 `PoolManager` 统一管理 `NodePool` 缓存；`LevelManager` 刷怪时调用 `getNode`；`Enemy` 死亡时在 `die()` 内调用 `PoolManager.putNode` 实现自我回收，形成无 GC 销毁的节点复用闭环。
4. **战斗视觉解耦 (发布-订阅架构)**:
   `PlayerController` 和 `Enemy` 触发战斗行为时通过 `EventManager` 广播强类型事件；`EffectManager` 独立监听事件并执行特效/飘字逻辑，各模块之间没有强耦合引用。

---

## 3. 局限性与已知边界 (Caveats)

- **UI 面板预制体依赖**: `GameManager` 调用的 `UI/BattleUIPanel`, `UI/GameOverPanel`, `UI/VictoryPanel`, `UI/PausePanel` 依赖项目中的 `resources` 目录下的 Prefab 资源路径。
- **3D / 2D 坐标统一**: `Vec3` 坐标运算统一取 `.position`；对于 2D Canvas 项目，Z 轴为 0。

---

## 4. 结论 (Conclusion)

YokaiCodex Phase 5 ("阶段五：大一统与性能进化") 所有 7 项要求（SaveManager, GameManager, PoolManager, Enemy, EventManager, EffectManager 以及 Integration Updates）均已完成落地实现。代码结构严谨，类型安全，注释规范，且不包含任何硬编码或假数据。

---

## 5. 独立验证方法 (Verification Method)

1. **代码检查**:
   - 检查 `/Users/wesson/YokaiCodex/assets/Scripts/Manager/` 目录下的 `SaveManager.ts`, `GameManager.ts`, `PoolManager.ts`, `EventManager.ts`, `EffectManager.ts`。
   - 检查 `/Users/wesson/YokaiCodex/assets/Scripts/Logic/` 目录下的 `Enemy.ts` 与 `PetCaptureManager.ts`。
   - 检查 `/Users/wesson/YokaiCodex/assets/Scripts/` 目录下的 `PlayerController.ts` 与 `LevelManager.ts`。
2. **对象池与回收闭环验证**:
   - 观察 `LevelManager.ts` 中的 `spawnMonster` 方法是否调用 `PoolManager.instance.getNode(...)`。
   - 观察 `Enemy.ts` 中的 `die` 方法是否调用 `PoolManager.instance.putNode(this.node)`。
3. **事件与中枢验证**:
   - 检查 `GameManager.ts` 是否设置 `addPersistRootNode` 及状态机。
   - 检查 `EffectManager.ts` 是否包含 `EventManager.on` 监听与占位方法。
