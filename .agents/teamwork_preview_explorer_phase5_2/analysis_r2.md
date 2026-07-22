# YokaiCodex Phase 5 - R2 (实体行为与对象池引擎) 深度分析报告

## 摘要 (Summary)
本报告是对 YokaiCodex Phase 5 R2 模块（实体行为与对象池引擎）的深度调研与系统设计规划。通过探查现有代码库（`PlayerController.ts`、`LevelManager.ts` 等），确立了基于 Cocos Creator `NodePool` 的高性能全局对象池 `PoolManager` 设计方案以及具备追击 AI 与自我回收机制的 `Enemy` 逻辑架构。

---

## 1. 现有代码库与节点/预制体使用调研 (Codebase & Node Usage Analysis)

### 1.1 `PlayerController.ts` 机制分析
- **接口约定**: 定义了 `IEnemy` 接口：
  ```typescript
  export interface IEnemy {
      takeDamage(damage: number): void;
  }
  ```
- **敌人寻敌与攻击**:
  - 依赖 `monsterRoot: Node` 节点的 `children` 数组遍历所有怪物。
  - 通过 `Vec3.distance(this.node.position, enemyNode.position)` 计算最近距离敌人。
  - 获取 Enemy 组件并调用 `enemyComp.takeDamage(this.attackDamage)` 实施打击。
- **玩家自身状态**:
  - 拥有 `maxHp`, `currentHp`, `level`, `maxExp`, `currentExp`, `moveSpeed` 等字段。
  - 暴露 `takeDamage(damage: number)` 与 `addExp(exp: number)` 接口，并通过 `director.emit` 广播 UI 更新事件。

### 1.2 `LevelManager.ts` 刷怪机制分析
- **现有刷怪实现**:
  - 读取 `Level_1_Waves.json` 波次配置。
  - 目前采用直接 `instantiate(this.monsterPrefab)` 实例化，并挂载到 `monsterRoot`。
  - 每次刷怪均触发 CPU 物理分配与节点构建开销，未引入回收复用机制。
- **与 R2 对象的整合点**:
  - 应将 `instantiate(this.monsterPrefab)` 重构替换为 `PoolManager.instance.getNode(this.monsterPrefab)`。
  - 在获取节点后调用 `enemyComp.init(...)` 重置血量与目标状态。

### 1.3 项目中 Prefab / Node 的高频使用场景
- **怪物实体 (Enemy)**: 割草玩法下同屏可达数百只小怪，频繁生成与销毁将引发严重的垃圾回收 (GC) 停顿与帧率骤降。
- **法术与弹幕 (Projectiles)**: 法修/御兽技能发射的子弹与掉落物。
- **UI与飘字 (Damage Floating Text)**: 高频受击产生的伤害文字浮窗。
- **结论**: 必须引入统一的全局高可靠性对象池 `PoolManager`，实现节点的 `Unparent -> Pool -> Reuse -> Reparent` 闭环。

---

## 2. 对象池引擎 `PoolManager.ts` 架构设计 (PoolManager Design)

### 2.1 设计目标
1. **零冗余开销**: 基于 Cocos Creator 官方 `NodePool` 管理，或维护按 Key 划分的自定义 `NodePool` 字典。
2. **灵活的 API 重载**: 支持通过 `Prefab` 引用或 `string` 标识符提取/回收节点。
3. **安全的状态重置**: 保证回收节点时从父节点断开 (`removeFromParent`)，禁用激活状态 (`active = false`)，再次取出时自动重置。

### 2.2 类结构与核心 API 定义

```typescript
import { _decorator, Component, Node, Prefab, NodePool, instantiate, log, warn } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('PoolManager')
export class PoolManager extends Component {
    private static _instance: PoolManager | null = null;

    public static get instance(): PoolManager {
        if (!this._instance) {
            warn('[PoolManager] 单例未初始化！');
        }
        return this._instance!;
    }

    /** 对象池字典，Key 为预制体名称或自定义标识 */
    private _pools: Map<string, NodePool> = new Map<string, NodePool>();

    /** 预制体注册表，用于根据 Key 动态实例化 */
    private _prefabMap: Map<string, Prefab> = new Map<string, Prefab>();

    onLoad() {
        if (PoolManager._instance === null) {
            PoolManager._instance = this;
        } else {
            this.node.destroy();
        }
    }

    /**
     * 注册预制体与 Key 的映射关系
     */
    public registerPrefab(key: string, prefab: Prefab) {
        this._prefabMap.set(key, prefab);
    }

    /**
     * 从对象池获取节点 (如果池为空则自动实例化)
     * @param prefabOrKey Prefab 实例或注册的字符串 Key
     */
    public getNode(prefabOrKey: Prefab | string): Node {
        let poolKey: string = '';
        let targetPrefab: Prefab | null = null;

        if (typeof prefabOrKey === 'string') {
            poolKey = prefabOrKey;
            targetPrefab = this._prefabMap.get(poolKey) || null;
        } else if (prefabOrKey instanceof Prefab) {
            poolKey = prefabOrKey.data.name || prefabOrKey.name;
            targetPrefab = prefabOrKey;
            if (!this._prefabMap.has(poolKey)) {
                this._prefabMap.set(poolKey, prefabOrKey);
            }
        }

        let pool = this._pools.get(poolKey);
        if (!pool) {
            pool = new NodePool();
            this._pools.set(poolKey, pool);
        }

        let node: Node;
        if (pool.size() > 0) {
            node = pool.get()!;
        } else {
            if (!targetPrefab) {
                throw new Error(`[PoolManager] 无法实例化节点，未找到 Key 为 [${poolKey}] 的 Prefab 资源`);
            }
            node = instantiate(targetPrefab);
        }

        // 在节点上记录其归属的对象池 Key 属性，便于 putNode 时自动归类
        (node as any).__poolKey = poolKey;
        node.active = true;

        return node;
    }

    /**
     * 回收节点入对象池
     * @param node 需要回收的 Node 节点
     */
    public putNode(node: Node) {
        if (!node || !node.isValid) return;

        const poolKey = (node as any).__poolKey || node.name;
        let pool = this._pools.get(poolKey);
        if (!pool) {
            pool = new NodePool();
            this._pools.set(poolKey, pool);
        }

        node.active = false;
        node.removeFromParent();
        pool.put(node);
    }

    /**
     * 预热对象池，提前生成指定数量的节点
     */
    public prewarm(prefab: Prefab, count: number) {
        const poolKey = prefab.data.name || prefab.name;
        this.registerPrefab(poolKey, prefab);

        for (let i = 0; i < count; i++) {
            const node = instantiate(prefab);
            (node as any).__poolKey = poolKey;
            this.putNode(node);
        }
        log(`[PoolManager] 预热对象池 [${poolKey}] 成功，预存节点数量: ${count}`);
    }

    /**
     * 清理对象池
     * @param key 可选，如果不传则清空全部对象池
     */
    public clearPool(key?: string) {
        if (key) {
            const pool = this._pools.get(key);
            if (pool) {
                pool.clear();
                this._pools.delete(key);
            }
        } else {
            this._pools.forEach((pool) => pool.clear());
            this._pools.clear();
        }
    }
}
```

### 2.3 状态管理与节点重新挂载流程
1. **取出阶段 (`getNode`)**:
   - 从 `NodePool` 弹出一个节点，如池空则调用 `instantiate`。
   - 标注 `(node as any).__poolKey` 便于后期自动回收归类。
   - 设置 `node.active = true`。
   - 调用者负责将其挂载至场景 root 节点 (如 `setParent(monsterRoot)`) 并设置位置与初始化组件属性 (`enemy.init(...)`)。
2. **回收阶段 (`putNode`)**:
   - 设置 `node.active = false`。
   - 断开父子节点关系 `node.removeFromParent()`。
   - 放入对应的 `NodePool` 中（Cocos Creator `NodePool` 会自动触发挂载组件上的 `unuse()` 周期，如果实现了 `IPoolHandler` 接口）。

---

## 3. 敌人 AI 与实体组件 `Enemy.ts` 架构设计 (Enemy Design)

### 3.1 继承结构与组件定义
- 挂载于怪物 Prefab 上，继承自 Cocos Creator `Component`。
- 实现 `IEnemy` 接口，满足 `PlayerController` 攻击判定。

### 3.2 属性配置
- `@property` `maxHp: number = 100` (最大生命值)
- `currentHp: number = 100` (当前生命值)
- `@property` `moveSpeed: number = 100` (移动速度 px/s)
- `@property` `attackDamage: number = 10` (碰撞/近战伤害)
- `@property` `attackInterval: number = 1.0` (攻击间隔时间/秒)
- `@property` `expValue: number = 10` (击杀提供经验值)
- `targetPlayer: Node | null = null` (追击目标节点)

### 3.3 核心方法与逻辑实现规范

```typescript
import { _decorator, Component, Node, Vec3, director, log } from 'cc';
import { IEnemy } from '../PlayerController';
import { PoolManager } from '../Manager/PoolManager';
const { ccclass, property } = _decorator;

@ccclass('Enemy')
export class Enemy extends Component implements IEnemy {

    @property
    public maxHp: number = 100;

    @property
    public moveSpeed: number = 100;

    @property
    public attackDamage: number = 10;

    @property
    public attackInterval: number = 1.0;

    @property
    public expValue: number = 10;

    public currentHp: number = 100;
    public targetPlayer: Node | null = null;

    private attackTimer: number = 0;
    private isDead: boolean = false;

    onEnable() {
        this.resetState();
    }

    /**
     * 节点复用与属性初始化
     */
    public init(hp?: number, speed?: number, target?: Node) {
        this.maxHp = hp || this.maxHp;
        this.currentHp = this.maxHp;
        if (speed) this.moveSpeed = speed;
        if (target) this.targetPlayer = target;
        this.resetState();
    }

    private resetState() {
        this.currentHp = this.maxHp;
        this.isDead = false;
        this.attackTimer = 0;
    }

    update(deltaTime: number) {
        if (this.isDead) return;

        this.findPlayerIfMissing();
        this.handleChase(deltaTime);
        this.handleContactAttack(deltaTime);
    }

    /**
     * 自动寻找玩家节点（若未绑定）
     */
    private findPlayerIfMissing() {
        if (!this.targetPlayer || !this.targetPlayer.isValid) {
            const scene = director.getScene();
            const playerNode = scene?.getChildByName('Player') || scene?.getComponentInChildren('PlayerController')?.node;
            if (playerNode) {
                this.targetPlayer = playerNode;
            }
        }
    }

    /**
     * 追击 AI 逻辑：向玩家坐标平滑移动
     */
    private handleChase(deltaTime: number) {
        if (!this.targetPlayer) return;

        const currentPos = this.node.position;
        const targetPos = this.targetPlayer.position;

        const dir = new Vec3();
        Vec3.subtract(dir, targetPos, currentPos);
        const distance = dir.length();

        // 保持一定停止距离防止重叠跳动
        if (distance > 5.0) {
            dir.normalize();
            const moveStep = new Vec3();
            Vec3.multiplyScalar(moveStep, dir, this.moveSpeed * deltaTime);

            const nextPos = new Vec3();
            Vec3.add(nextPos, currentPos, moveStep);
            this.node.setPosition(nextPos);
        }
    }

    /**
     * 触碰攻击判定
     */
    private handleContactAttack(deltaTime: number) {
        if (!this.targetPlayer) return;

        this.attackTimer += deltaTime;
        if (this.attackTimer >= this.attackInterval) {
            const distance = Vec3.distance(this.node.position, this.targetPlayer.position);
            if (distance <= 30.0) { // 触碰判定半径
                this.attackTimer = 0;
                const playerComp = this.targetPlayer.getComponent('PlayerController') as any;
                if (playerComp && typeof playerComp.takeDamage === 'function') {
                    playerComp.takeDamage(this.attackDamage);
                }
            }
        }
    }

    /**
     * 受击伤害处理
     */
    public takeDamage(amount: number) {
        if (this.isDead) return;

        this.currentHp -= amount;
        log(`[Enemy ${this.node.name}] 受到 ${amount} 伤害, 剩余血量: ${this.currentHp}/${this.maxHp}`);

        // 派发受击事件（与 R3 飘字系统联动）
        director.emit('Event_Enemy_Damaged', {
            enemy: this,
            damage: amount,
            position: this.node.position
        });

        if (this.currentHp <= 0) {
            this.die();
        }
    }

    /**
     * 死亡处理与自我回收
     */
    private die() {
        if (this.isDead) return;
        this.isDead = true;

        log(`[Enemy ${this.node.name}] 死亡，提供经验值 +${this.expValue}`);

        // 给予玩家经验
        if (this.targetPlayer) {
            const playerComp = this.targetPlayer.getComponent('PlayerController') as any;
            if (playerComp && typeof playerComp.addExp === 'function') {
                playerComp.addExp(this.expValue);
            }
        }

        // 广播死亡事件（与 R3 特效/音效系统联动）
        director.emit('Event_Enemy_Died', {
            node: this.node,
            position: this.node.position,
            exp: this.expValue
        });

        // 自动回收至对象池
        if (PoolManager.instance) {
            PoolManager.instance.putNode(this.node);
        } else {
            this.node.destroy();
        }
    }
}
```

---

## 4. 模块整合与架构联动图 (Architecture Integration)

```
                       +----------------------+
                       |    LevelManager      |
                       +----------+-----------+
                                  |
               1. getNode(prefab) | 2. monster.setParent(monsterRoot)
                                  v
                       +----------------------+
                       |     PoolManager      |
                       +----------+-----------+
                                  |
                                  | 返还复用 Node / instantiate
                                  v
                       +----------------------+
                       |        Enemy         |
                       +----+------------+----+
                            |            |
         3. update追击      |            | 4. takeDamage() 结算
                            v            v
               +----------------+    +-------------------+
               | PlayerController|    |   Event System    | (R3 EffectManager)
               +----------------+    +-------------------+
                            ^            |
                            | 5. addExp  | 广播受击飘字与死亡特效
                            +------------+
                                  |
                                  | 6. die() 自我回收
                                  v
                       +----------------------+
                       | PoolManager.putNode()|
                       +----------------------+
```

---

## 5. 结论与后续实现建议 (Conclusion & Implementation Recommendations)

1. **`PoolManager`**:
   - 应该放在 `/Users/wesson/YokaiCodex/assets/Scripts/Manager/PoolManager.ts`。
   - 建议增加 `prewarm` 方法，在游戏启动加载界面进行预热，消除局内卡顿。
2. **`Enemy`**:
   - 应该放在 `/Users/wesson/YokaiCodex/assets/Scripts/Logic/Enemy.ts`。
   - 严格继承 `Component` 并实现 `IEnemy` 接口，在死亡时直接调用 `PoolManager.instance.putNode(this.node)` 完成自我回收。
3. **`LevelManager` 重构**:
   - 修改 `spawnMonster()` 逻辑，将 `instantiate(this.monsterPrefab)` 改为 `PoolManager.instance.getNode(this.monsterPrefab)`。
