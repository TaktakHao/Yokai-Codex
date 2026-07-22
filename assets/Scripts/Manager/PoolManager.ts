import { _decorator, Component, Node, Prefab, NodePool, instantiate, log, warn, error } from 'cc';
const { ccclass, property } = _decorator;

/**
 * 高性能 Cocos Creator Node 对象池管理器 (PoolManager)
 * 基于 CC NodePool，实现节点的 Unparent -> Pool -> Reuse -> Reparent 闭环
 */
@ccclass('PoolManager')
export class PoolManager extends Component {

    private static _instance: PoolManager | null = null;

    /** 单例访问接口 */
    public static get instance(): PoolManager {
        if (!this._instance) {
            warn('[PoolManager] 单例尚未初始化，请确保已挂载至初始场景中。');
        }
        return this._instance!;
    }

    /** 对象池字典，Key 为预制体名称或自定义标识 */
    private _pools: Map<string, NodePool> = new Map<string, NodePool>();

    /** 预制体注册表，用于根据 Key 动态实例化 */
    private _prefabMap: Map<string, Prefab> = new Map<string, Prefab>();

    private get pools(): Map<string, NodePool> {
        if (!this._pools) {
            this._pools = new Map<string, NodePool>();
        }
        return this._pools;
    }

    private get prefabMap(): Map<string, Prefab> {
        if (!this._prefabMap) {
            this._prefabMap = new Map<string, Prefab>();
        }
        return this._prefabMap;
    }

    onLoad() {
        if (!this._pools) {
            this._pools = new Map<string, NodePool>();
        }
        if (!this._prefabMap) {
            this._prefabMap = new Map<string, Prefab>();
        }
        if (PoolManager._instance === null) {
            PoolManager._instance = this;
        } else if (PoolManager._instance !== this) {
            this.node.destroy();
            return;
        }
    }

    onDestroy() {
        if (PoolManager._instance === this) {
            this.clearPool();
            PoolManager._instance = null;
        }
    }

    /**
     * 注册预制体与 Key 的映射关系
     * @param key 标识 Key
     * @param prefab 预制体资源
     */
    public registerPrefab(key: string, prefab: Prefab) {
        if (key && prefab) {
            this.prefabMap.set(key, prefab);
        }
    }

    /**
     * 从对象池中提取节点 (若池为空则自动实例化 Prefab)
     * @param prefabOrKey Prefab 资源实例 或 已注册的字符串 Key
     * @returns 可用的 Node 节点
     */
    public getNode(prefabOrKey: Prefab | string): Node {
        let poolKey: string = '';
        let targetPrefab: Prefab | null = null;

        if (typeof prefabOrKey === 'string') {
            poolKey = prefabOrKey;
            targetPrefab = this.prefabMap.get(poolKey) || null;
        } else if (prefabOrKey instanceof Prefab) {
            poolKey = (prefabOrKey.data && prefabOrKey.data.name) ? prefabOrKey.data.name : prefabOrKey.name;
            targetPrefab = prefabOrKey;
            if (poolKey && !this.prefabMap.has(poolKey)) {
                this.prefabMap.set(poolKey, prefabOrKey);
            }
        }

        if (!poolKey) {
            error('[PoolManager] getNode 失败：无法提取有效的 poolKey。');
            throw new Error('[PoolManager] Invalid pool key');
        }

        let pool = this.pools.get(poolKey);
        if (!pool) {
            pool = new NodePool();
            this.pools.set(poolKey, pool);
        }

        let node: Node;
        if (pool.size() > 0) {
            node = pool.get()!;
        } else {
            if (!targetPrefab) {
                error(`[PoolManager] 无法实例化节点，未找到 Key 为 [${poolKey}] 的 Prefab 资源。`);
                throw new Error(`[PoolManager] Prefab not found for key: ${poolKey}`);
            }
            node = instantiate(targetPrefab);
        }

        // 在节点上记录其归属的对象池 Key 属性，便于 putNode 时自动归类
        (node as any).__poolKey = poolKey;
        (node as any).__inPool = false;
        node.active = true;

        return node;
    }

    /**
     * 回收节点入对象池
     * @param node 需要回收的 Node 节点
     */
    public putNode(node: Node) {
        if (!node || !node.isValid) return;

        if ((node as any).__inPool) {
            warn(`[PoolManager] 节点 ${node.name} 已在对象池中，避免重复回收。`);
            return;
        }

        const poolKey = (node as any).__poolKey || node.name;
        let pool = this.pools.get(poolKey);
        if (!pool) {
            pool = new NodePool();
            this.pools.set(poolKey, pool);
        }

        (node as any).__inPool = true;
        node.active = false;
        node.removeFromParent();
        pool.put(node);
    }

    /**
     * 预热对象池，提前生成指定数量的节点缓存在池中
     * @param prefab 预制体资源
     * @param count 预热生成数量
     */
    public prewarm(prefab: Prefab, count: number) {
        if (!prefab || count <= 0) return;

        const poolKey = (prefab.data && prefab.data.name) ? prefab.data.name : prefab.name;
        this.registerPrefab(poolKey, prefab);

        for (let i = 0; i < count; i++) {
            const node = instantiate(prefab);
            (node as any).__poolKey = poolKey;
            this.putNode(node);
        }
        log(`[PoolManager] 成功预热对象池 [${poolKey}]，生成缓存节点: ${count} 个`);
    }

    /**
     * 清理对象池中的缓存节点
     * @param key 可选。如果不传则清空全部对象池，如果传入 Key 则只清理对应对象池
     */
    public clearPool(key?: string) {
        if (key) {
            const pool = this.pools.get(key);
            if (pool) {
                pool.clear();
                this.pools.delete(key);
            }
        } else {
            this.pools.forEach((pool) => pool.clear());
            this.pools.clear();
        }
    }
}
