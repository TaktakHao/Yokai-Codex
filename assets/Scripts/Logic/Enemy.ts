import { _decorator, Component, Node, Vec3, director, log, Size, Layers, Color, Sprite } from 'cc';
import { IEnemy } from '../PlayerController';
import { PoolManager } from '../Manager/PoolManager';
import { EventManager, CombatEvent, IEnemyDamagedPayload, IEnemyDiedPayload } from '../Manager/EventManager';
import { VisualLoader } from '../Utils/VisualLoader';
import { HomeManager } from '../Manager/HomeManager';
import { GameManager } from '../Manager/GameManager';

const { ccclass, property } = _decorator;

/**
 * 敌人逻辑与追击 AI 组件 (Enemy)
 * 实现 IEnemy 接口，具备追击 AI、触碰攻击、受击与自动回收入 PoolManager 机制
 */
@ccclass('Enemy')
export class Enemy extends Component implements IEnemy {

    @property
    public texturePath: string = 'Textures/Enemies/monster_1';

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

    @property
    public isElite: boolean = false;

    public dropConfig: any = null;

    public currentHp: number = 100;
    public targetPlayer: Node | null = null;

    private attackTimer: number = 0;
    private isDead: boolean = false;

    onEnable() {
        this.node.layer = Layers.Enum.UI_2D;
        this.resetState();
        this.setupVisual();
    }

    /**
     * 节点复用与属性重置初始化
     * @param hp 初始血量
     * @param speed 初始移速
     * @param target 目标玩家节点
     * @param texturePath 贴图资源路径
     * @param attackDamage 攻击力
     * @param expValue 经验奖励
     * @param isElite 是否精英怪
     * @param dropConfig 掉落配置
     */
    public init(
        hp?: number,
        speed?: number,
        target?: Node,
        texturePath?: string,
        attackDamage?: number,
        expValue?: number,
        isElite?: boolean,
        dropConfig?: any
    ) {
        this.node.layer = Layers.Enum.UI_2D;
        if (hp !== undefined && hp > 0) {
            this.maxHp = hp;
        }
        if (speed !== undefined && speed > 0) {
            let finalSpeed = speed;
            const homeMgr = HomeManager.instance;
            if (homeMgr && homeMgr.hasEquippedRelic('relic_treasure_bowl')) {
                finalSpeed *= 1.2;
                log(`[聚宝盆] 聚宝盆被动：怪物 [${this.node.name}] 基础移动速度提升 20%: ${speed} -> ${finalSpeed}`);
            }
            this.moveSpeed = finalSpeed;
        }
        if (target) {
            this.targetPlayer = target;
        }
        if (texturePath) {
            this.texturePath = texturePath;
        }
        if (attackDamage !== undefined && attackDamage > 0) {
            this.attackDamage = attackDamage;
        }
        if (expValue !== undefined && expValue > 0) {
            this.expValue = expValue;
        }
        if (isElite !== undefined) {
            this.isElite = isElite;
        }
        if (dropConfig) {
            this.dropConfig = dropConfig;
        }

        this.resetState();
        this.setupVisual();
    }

    /**
     * 获取敌人原本的视觉 Color Tint 配置
     */
    public getOriginalColor(): Color {
        const path = this.texturePath || '';
        if (path.includes('boss')) {
            return new Color(255, 80, 80, 255);   // BOSS：深血红
        }
        if (this.isElite) {
            return new Color(255, 215, 80, 255);  // 精英怪：金黄色
        }
        if (path.includes('grass_sprite')) {
            return new Color(120, 230, 120, 255); // 草精：嫩绿
        } else if (path.includes('wood_spirit')) {
            return new Color(210, 180, 120, 255); // 木灵：金褐
        } else if (path.includes('venom_snake')) {
            return new Color(190, 110, 230, 255); // 毒蛇：毒紫
        } else if (path.includes('gale_wolf')) {
            return new Color(110, 210, 255, 255); // 疾风狼：青蓝
        }
        return new Color(255, 255, 255, 255);
    }

    /**
     * 自动为怪物创建挂载 Sprite 的子节点并加载贴图
     * 结合 Color Tint 染色与 Scale 缩放，彻底摆脱单调无识别度视觉
     */
    private setupVisual() {
        let size = new Size(48, 48);
        let scale = new Vec3(1, 1, 1);
        let color = this.getOriginalColor();

        const path = this.texturePath || '';
        if (path.includes('boss')) {
            size = new Size(96, 96);
            scale = new Vec3(2.2, 2.2, 1);
        } else if (this.isElite) {
            // 精英怪特定强化（Scale 放大 1.5x、金色/亮红光泽）
            size = new Size(64, 64);
            scale = new Vec3(1.5, 1.5, 1);
            log(`[Enemy ${this.node.name}] 精英怪生成！应用 1.5x 视觉放大与金色染色`);
        }

        VisualLoader.loadVisual(this.node, this.texturePath, {
            childName: 'Visual',
            size: size,
            scale: scale,
            color: color
        });
    }

    /**
     * 重置状态
     */
    private resetState() {
        this.currentHp = this.maxHp;
        this.isDead = false;
        this.attackTimer = 0;
        this.unschedule(this.restoreOriginalColor);
    }

    update(deltaTime: number) {
        if (this.isDead) return;
        if (GameManager.instance && GameManager.instance.isBattleFrozen) return;

        this.findPlayerIfMissing();
        this.handleChase(deltaTime);
        this.handleContactAttack(deltaTime);
    }

    /**
     * 若未绑定玩家节点，自动在场景中寻找 Player 节点
     */
    private findPlayerIfMissing() {
        if (!this.targetPlayer || !this.targetPlayer.isValid) {
            const scene = director.getScene();
            const canvas = scene?.getChildByName('Canvas');
            const playerNode = canvas?.getChildByName('Player') || scene?.getComponentInChildren('PlayerController')?.node;
            if (playerNode) {
                this.targetPlayer = playerNode;
            }
        }
    }

    /**
     * 追击 AI 逻辑：向玩家 World/Local Vec3 坐标平滑移动
     */
    private handleChase(deltaTime: number) {
        if (!this.targetPlayer || !this.targetPlayer.isValid) return;

        const currentPos = this.node.worldPosition;
        const targetPos = this.targetPlayer.worldPosition;

        const dir = new Vec3();
        Vec3.subtract(dir, targetPos, currentPos);
        const distance = dir.length();

        // 维持最小停止距离，避免贴体震荡
        if (distance > 5.0) {
            dir.normalize();
            const moveStep = new Vec3();
            Vec3.multiplyScalar(moveStep, dir, this.moveSpeed * deltaTime);

            const nextPos = new Vec3();
            Vec3.add(nextPos, currentPos, moveStep);
            this.node.setWorldPosition(nextPos);
        }
    }

    /**
     * 触碰近战攻击判定
     */
    private handleContactAttack(deltaTime: number) {
        if (!this.targetPlayer || !this.targetPlayer.isValid) return;

        this.attackTimer += deltaTime;
        if (this.attackTimer >= this.attackInterval) {
            const distance = Vec3.distance(this.node.worldPosition, this.targetPlayer.worldPosition);
            if (distance <= 30.0) { // 触碰攻击判定半径
                this.attackTimer = 0;
                const playerComp = this.targetPlayer.getComponent('PlayerController') as any;
                if (playerComp && typeof playerComp.takeDamage === 'function') {
                    playerComp.takeDamage(this.attackDamage);
                }
            }
        }
    }

    /**
     * 播放受击红闪视觉反馈 (临时变为红色，0.1秒后恢复原有Tint)
     */
    private playHitFlash() {
        const visualNode = this.node.getChildByName('Visual');
        const sprite = visualNode?.getComponent(Sprite);
        if (!sprite) return;

        // 临时设为红色受击效果
        sprite.color = new Color(255, 60, 60, 255);

        // 重设 0.1 秒恢复定时器
        this.unschedule(this.restoreOriginalColor);
        this.scheduleOnce(this.restoreOriginalColor, 0.1);
    }

    private restoreOriginalColor() {
        if (this.isDead || !this.node || !this.node.isValid) return;
        const visualNode = this.node.getChildByName('Visual');
        const sprite = visualNode?.getComponent(Sprite);
        if (sprite) {
            sprite.color = this.getOriginalColor();
        }
    }

    /**
     * 受到伤害处理 (实现 IEnemy 接口)
     * @param amount 伤害数值
     */
    public takeDamage(amount: number) {
        if (amount <= 0 || this.isDead) return;

        this.currentHp = Math.max(0, Math.min(this.maxHp, this.currentHp - amount));
        log(`[Enemy ${this.node.name}] 受到伤害: ${amount}, 剩余生命值: ${this.currentHp}/${this.maxHp}`);

        // 触发受击红闪视觉效果
        this.playHitFlash();

        // 派发受击事件（供 EffectManager 等特效系统联动，统一通过 EventManager 派发）
        const pos = this.node.worldPosition.clone();
        EventManager.emit<IEnemyDamagedPayload>(CombatEvent.ENEMY_DAMAGED, {
            enemyNode: this.node,
            damage: amount,
            position: pos
        });

        if (this.currentHp <= 0) {
            this.die();
        }
    }

    /**
     * 敌人死亡逻辑与自动回收入对象池
     */
    private die() {
        if (this.isDead) return;
        this.isDead = true;

        log(`[Enemy ${this.node.name}] 死亡，向玩家提供经验值 +${this.expValue}`);

        // 给予玩家经验值
        if (this.targetPlayer && this.targetPlayer.isValid) {
            const playerComp = this.targetPlayer.getComponent('PlayerController') as any;
            if (playerComp && typeof playerComp.addExp === 'function') {
                playerComp.addExp(this.expValue);
            }
        }

        // 处理精英怪宝箱与局外资源掉落
        if (this.dropConfig || this.isElite) {
            if (this.dropConfig) {
                if (this.dropConfig.spirit_stones && HomeManager.instance) {
                    let dropAmount = this.dropConfig.spirit_stones;
                    if (HomeManager.instance.hasEquippedRelic('relic_treasure_bowl')) {
                        dropAmount *= 2;
                        log(`[聚宝盆] 聚宝盆被动生效！掉落灵石数量翻倍: ${this.dropConfig.spirit_stones} -> ${dropAmount}`);
                    }
                    HomeManager.instance.addSpiritStones(dropAmount);
                    log(`[Enemy ${this.node.name}] 精英怪掉落灵石 +${dropAmount}`);
                }
                if (this.dropConfig.materials && HomeManager.instance) {
                    HomeManager.instance.addMaterials(this.dropConfig.materials);
                    log(`[Enemy ${this.node.name}] 精英怪掉落修仙材料 +${this.dropConfig.materials}`);
                }
                if (this.dropConfig.drop_chest) {
                    log(`[Enemy ${this.node.name}] 击杀精英怪，掉落【聚灵宝箱】！触发全局宝箱掉落广播`);
                    EventManager.emit('Event_Chest_Dropped', { enemyNode: this.node });
                }
            } else if (this.isElite) {
                log(`[Enemy ${this.node.name}] 击杀精英怪，触发默认【聚灵宝箱】掉落广播`);
                EventManager.emit('Event_Chest_Dropped', { enemyNode: this.node });
            }
        }

        const pos = this.node.worldPosition.clone();

        // 广播敌人死亡事件 (与 EffectManager 特效/音效联动，统一收拢为 EventManager)
        EventManager.emit<IEnemyDiedPayload>(CombatEvent.ENEMY_DIED, {
            enemyNode: this.node,
            position: pos,
            expReward: this.expValue
        });

        // 自动回收入 PoolManager 对象池
        if (PoolManager.instance) {
            PoolManager.instance.putNode(this.node);
        } else {
            this.node.destroy();
        }
    }
}
