import { _decorator, Component, Node, Vec3, Vec2, Label, Color, UITransform, Layers, tween, UIOpacity, director, log, warn } from 'cc';
import { EventManager, CombatEvent, IEnemyDamagedPayload, IEnemyDiedPayload, IPlayerAttackedPayload } from './EventManager';
import { PoolManager } from './PoolManager';

const { ccclass, property } = _decorator;

/**
 * 战斗特效与视觉反馈管理器 (EffectManager)
 * 继承 Component 的单例，通过 EventManager 订阅 CombatEvent 解耦战斗逻辑
 */
@ccclass('EffectManager')
export class EffectManager extends Component {

    private static _instance: EffectManager | null = null;

    /** 获取 EffectManager 单例 */
    public static get instance(): EffectManager | null {
        return EffectManager._instance;
    }

    onLoad() {
        if (EffectManager._instance === null) {
            EffectManager._instance = this;
        } else if (EffectManager._instance !== this) {
            this.node.destroy();
            return;
        }

        // 注册战斗事件监听
        this.registerEvents();
    }

    onDestroy() {
        if (EffectManager._instance === this) {
            EffectManager._instance = null;
        }
        // 注销战斗事件监听
        this.unregisterEvents();
    }

    /**
     * 订阅战斗事件总线
     */
    private registerEvents() {
        EventManager.on<IEnemyDamagedPayload>(CombatEvent.ENEMY_DAMAGED, this.onEnemyDamaged, this);
        EventManager.on<IEnemyDiedPayload>(CombatEvent.ENEMY_DIED, this.onEnemyDied, this);
        EventManager.on<IPlayerAttackedPayload>(CombatEvent.PLAYER_ATTACKED, this.onPlayerAttacked, this);
    }

    /**
     * 取消订阅战斗事件总线
     */
    private unregisterEvents() {
        EventManager.off<IEnemyDamagedPayload>(CombatEvent.ENEMY_DAMAGED, this.onEnemyDamaged, this);
        EventManager.off<IEnemyDiedPayload>(CombatEvent.ENEMY_DIED, this.onEnemyDied, this);
        EventManager.off<IPlayerAttackedPayload>(CombatEvent.PLAYER_ATTACKED, this.onPlayerAttacked, this);
    }

    // ==================== 事件响应回调 ====================

    private onEnemyDamaged(payload: IEnemyDamagedPayload) {
        if (!payload) return;
        this.showDamageText(payload.position, payload.damage, payload.isCritical);
    }

    private onEnemyDied(payload: IEnemyDiedPayload) {
        if (!payload) return;
        this.playDeathEffect(payload.position);
    }

    private onPlayerAttacked(payload: IPlayerAttackedPayload) {
        if (!payload) return;
        this.playAttackEffect(payload.attackerPos, payload.targetPos);
    }

    // ==================== 战斗反馈方法实现 ====================

    /**
     * 显示受击伤害飘字
     * @param pos 飘字坐标 (Vec3 或 Vec2)
     * @param damage 伤害数值
     * @param isCritical 是否暴击
     */
    public showDamageText(pos: Vec3 | Vec2, damage: number, isCritical: boolean = false) {
        if (!pos || typeof pos.x !== 'number' || typeof pos.y !== 'number') return;
        const typeStr = isCritical ? '【暴击】' : '';
        log(`[EffectManager] 伤害飘字 ${typeStr} -> 位置: (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}), 伤害: -${damage}`);

        const scene = director.getScene();
        const canvas = scene?.getChildByName('Canvas');
        const parentNode = canvas || this.node;

        let spawnPos = new Vec3(pos.x, pos.y, 0);
        if (canvas) {
            const canvasTransform = canvas.getComponent(UITransform);
            if (canvasTransform) {
                spawnPos = canvasTransform.convertToNodeSpaceAR(new Vec3(pos.x, pos.y + 40, 0));
            } else {
                spawnPos.y += 40;
            }
        }

        let damageNode: Node | null = null;
        const poolKey = 'DamageText';

        if (PoolManager.instance && (PoolManager.instance as any)._pools?.has(poolKey)) {
            const pool = (PoolManager.instance as any)._pools.get(poolKey);
            if (pool && pool.size() > 0) {
                damageNode = pool.get();
                (damageNode as any).__inPool = false;
                damageNode.active = true;
            }
        }

        if (!damageNode) {
            damageNode = new Node('DamageText');
            (damageNode as any).__poolKey = poolKey;
        }

        damageNode.layer = Layers.Enum.UI_2D;
        damageNode.setParent(parentNode);
        damageNode.setPosition(spawnPos);

        let label = damageNode.getComponent(Label);
        if (!label) {
            label = damageNode.addComponent(Label);
        }
        let transform = damageNode.getComponent(UITransform);
        if (!transform) {
            transform = damageNode.addComponent(UITransform);
        }
        transform.setContentSize(220, 50);

        const fontSize = isCritical ? 28 : 20;
        label.fontSize = fontSize;
        label.lineHeight = fontSize + 4;
        label.string = isCritical ? `【暴击】-${damage}` : `-${damage}`;
        label.color = isCritical ? new Color(255, 30, 30, 255) : new Color(255, 60, 60, 255);

        let uiOpacity = damageNode.getComponent(UIOpacity);
        if (!uiOpacity) {
            uiOpacity = damageNode.addComponent(UIOpacity);
        }
        uiOpacity.opacity = 255;

        damageNode.setScale(isCritical ? new Vec3(1.3, 1.3, 1) : new Vec3(1, 1, 1));

        // 0.6 秒向上平移并逐渐透明淡出动画
        const targetY = spawnPos.y + 60;
        tween(damageNode)
            .to(0.6, { position: new Vec3(spawnPos.x, targetY, spawnPos.z) })
            .start();

        tween(uiOpacity)
            .to(0.6, { opacity: 0 }, { easing: 'sineOut' })
            .call(() => {
                if (damageNode && damageNode.isValid) {
                    if (PoolManager.instance) {
                        PoolManager.instance.putNode(damageNode);
                    } else {
                        damageNode.destroy();
                    }
                }
            })
            .start();
    }

    /**
     * 播放敌人死亡消散/粒子特效
     * @param pos 特效播放坐标
     */
    public playDeathEffect(pos: Vec3 | Vec2) {
        if (!pos || typeof pos.x !== 'number' || typeof pos.y !== 'number') return;
        log(`[EffectManager] 播放死亡特效 -> 位置: (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)})`);
        // 扩展接口: 可配合 PoolManager 取出 DeathParticles Prefab，播放 ParticleSystem 并在播放结束归还对象池
    }

    /**
     * 播放攻击/刀光/弹道特效
     * @param pos 发起攻击坐标
     * @param targetPos 目标坐标
     */
    public playAttackEffect(pos: Vec3 | Vec2, targetPos?: Vec3 | Vec2) {
        if (!pos || typeof pos.x !== 'number' || typeof pos.y !== 'number') return;
        log(`[EffectManager] 播放攻击特效 -> 位置: (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)})`);
        // 扩展接口: 播放挥砍或飞行弹道特效
    }
}
