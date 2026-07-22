import { _decorator, Component, Node, Vec3, Size, Layers, Color, Sprite, director, log, tween, UITransform } from 'cc';
import { AppraisedPet } from './PetCaptureManager';
import { VisualLoader } from '../Utils/VisualLoader';
import { EventManager } from '../Manager/EventManager';
import { HomeManager } from '../Manager/HomeManager';
import { GameManager } from '../Manager/GameManager';

const { ccclass, property } = _decorator;

/**
 * 宠物跟随出战与自动射击组件 (PetFollower)
 * 挂载于动态生成的宠物节点上，实现围绕主角跟随与自动开火射击飞弹
 */
@ccclass('PetFollower')
export class PetFollower extends Component {

    /** 宠物的已鉴定数据源 */
    public petData: AppraisedPet | null = null;

    /** 追随的目标主角节点 */
    public playerNode: Node | null = null;

    /** 当前宠物在阵容中的索引 */
    public petIndex: number = 0;

    /** 总上阵出战宠物数量 */
    public totalPetsCount: number = 1;

    private attackTimer: number = 0;
    private attackCooldown: number = 1.5; // 发射冷却
    private attackRange: number = 400;     // 索敌攻击射程

    start() {
        this.node.layer = Layers.Enum.UI_2D;
        this.setupVisual();
        if (this.petData) {
            // 根据速度值计算基础开火间隔
            const baseCooldown = Math.max(0.35, 1.8 - (this.petData.speed * 0.05));
            // 3水共鸣羁绊 CDR / 宠物攻速 +15%
            let waterCdrBonus = 0;
            const homeMgr = HomeManager.instance;
            if (homeMgr) {
                const resonance = homeMgr.calculateElementResonance();
                waterCdrBonus = resonance.waterCdrBonus;
            }
            this.attackCooldown = Math.max(0.2, baseCooldown * (1 - waterCdrBonus));
        }
    }

    /**
     * 依据宠物属性配置视觉表现 (染色、变异倍率与大小)
     */
    private setupVisual() {
        if (!this.petData) return;

        let size = new Size(36, 36); // 比主角稍小
        let color = new Color(255, 255, 255, 255);

        // 依据稀有度赋予不同的色彩标识
        switch (this.petData.rarity) {
            case '稀有':
                color = new Color(100, 200, 255, 255); // 青蓝色
                break;
            case '史诗':
                color = new Color(200, 100, 255, 255); // 梦幻紫
                break;
            case '传说':
                color = new Color(255, 180, 50, 255);  // 琥珀橙
                break;
            case '神话':
                color = new Color(255, 60, 60, 255);   // 朱砂红
                break;
            default:
                color = new Color(160, 255, 160, 255); // 普通为淡绿色
                break;
        }

        let scale = new Vec3(1, 1, 1);
        if (this.petData.isMutated) {
            scale = new Vec3(1.25, 1.25, 1.0);
            color = new Color(255, 215, 0, 255); // 变异宠物泛金光
            log(`[PetFollower] 变异宠物 [${this.petData.name}] 加载！应用 1.25x 特色金色效果`);
        }

        // 化形形态尺寸与特效扩展
        if (this.petData.isEvolved) {
            scale = new Vec3(scale.x * 1.3, scale.y * 1.3, 1.0);
            log(`[PetFollower] 化形宠物 [${this.petData.name}] 加载！应用化形强化尺寸`);
        }

        // 动态加载宠物外观贴图 (备用通用贴图，免除缺失美术报错)
        const path = 'Textures/Enemies/monster_1'; // 复用敌人通用贴图即可，通过染色进行强视觉区分

        VisualLoader.loadVisual(this.node, path, {
            childName: 'Visual',
            size: size,
            scale: scale,
            color: color
        });
    }

    update(deltaTime: number) {
        if (GameManager.instance && GameManager.instance.isBattleFrozen) return;

        if (!this.playerNode || !this.playerNode.isValid) {
            this.findPlayer();
            return;
        }

        this.followPlayer();
        this.handleAttack(deltaTime);
    }

    /**
     * 自动寻找主角节点
     */
    private findPlayer() {
        const scene = director.getScene();
        const canvas = scene?.getChildByName('Canvas');
        const player = canvas?.getChildByName('Player') || scene?.getComponentInChildren('PlayerController')?.node;
        if (player) {
            this.playerNode = player;
        }
    }

    /**
     * 实现浮游炮插值跟随主角运动
     */
    private followPlayer() {
        if (!this.playerNode) return;

        const playerPos = this.playerNode.position;
        const currentPos = this.node.position;

        // 计算当前宠物在围绕玩家半径 60 像素圆环中的目标偏置点
        const angleStep = 360 / Math.max(1, this.totalPetsCount);
        const angleRad = ((this.petIndex * angleStep) * Math.PI) / 180;
        const radius = 64;

        const targetX = playerPos.x + Math.cos(angleRad) * radius;
        const targetY = playerPos.y + Math.sin(angleRad) * radius;

        const targetPos = new Vec3(targetX, targetY, playerPos.z);
        const newPos = new Vec3();
        // 缓动插值，实现宠物弹性追随效果
        Vec3.lerp(newPos, currentPos, targetPos, 0.08);
        this.node.setPosition(newPos);
    }

    /**
     * 自动开火触发控制
     */
    private handleAttack(deltaTime: number) {
        this.attackTimer += deltaTime;
        if (this.attackTimer >= this.attackCooldown) {
            this.attackTimer = 0;
            this.shootAtNearestEnemy();
        }
    }

    /**
     * 寻找射程内最近的敌人并开火
     */
    private shootAtNearestEnemy() {
        const scene = director.getScene();
        const canvas = scene?.getChildByName('Canvas');
        const monsterRoot = canvas?.getChildByName('EnemyLayer') || null;
        if (!monsterRoot || monsterRoot.children.length === 0) return;

        const enemies = monsterRoot.children;
        let targetEnemy: Node | null = null;
        let minDistance = this.attackRange;

        for (let i = 0; i < enemies.length; i++) {
            const enemyNode = enemies[i];
            const enemyComp = enemyNode.getComponent('Enemy') as any;
            if (enemyComp && enemyComp.isDead) continue;

            const dist = Vec3.distance(this.node.position, enemyNode.position);
            if (dist <= minDistance) {
                minDistance = dist;
                targetEnemy = enemyNode;
            }
        }

        if (targetEnemy && this.petData) {
            this.fireProjectile(targetEnemy);
        }
    }

    /**
     * 动态生成一个飞弹法术投射物，通过 tween 平滑移向目标，命中判定伤害
     */
    private fireProjectile(target: Node) {
        if (!target || !target.isValid || !this.petData) return;

        // 1. 创建飞弹节点并赋予 2D 层级
        const projNode = new Node('PetSpellProjectile');
        projNode.layer = Layers.Enum.UI_2D;
        projNode.parent = this.node.parent; // 同挂在 Canvas 节点下
        projNode.setPosition(this.node.position.clone());

        const transform = projNode.addComponent(UITransform);

        // R1 需求：飞弹投射物尺寸在星级扩展及化形后额外 +50%
        const starBonus = 1 + ((this.petData.star || 1) - 1) * 0.1;
        const isEvolved = this.petData.isEvolved || false;
        const evolvedScale = isEvolved ? 1.5 : 1.0;
        const projSize = Math.floor(14 * starBonus * evolvedScale);

        transform.setContentSize(projSize, projSize);

        // 2. 依据五行属性/稀有度赋予飞弹相应的视觉颜色
        const sprite = projNode.addComponent(Sprite);
        let projColor = new Color(255, 255, 255, 255);

        if (this.petData.element) {
            switch (this.petData.element) {
                case '金': projColor = new Color(255, 215, 0, 255); break; // 璀璨金
                case '木': projColor = new Color(60, 220, 100, 255); break; // 翡翠绿
                case '水': projColor = new Color(80, 180, 255, 255); break; // 寒冰蓝
                case '火': projColor = new Color(255, 70, 70, 255); break;  // 烈焰红
                case '土': projColor = new Color(210, 160, 60, 255); break; // 大地黄
            }
        } else {
            switch (this.petData.rarity) {
                case '传说': projColor = new Color(255, 200, 50, 255); break;
                case '神话': projColor = new Color(255, 50, 50, 255); break;
                case '史诗': projColor = new Color(200, 100, 255, 255); break;
                default: projColor = new Color(120, 255, 120, 255); break;
            }
        }
        
        sprite.color = projColor;
        void VisualLoader.applySolidSprite(sprite, sprite.color);

        // 3. 计算最终飞弹伤害 (考虑 3金 共鸣攻击加成 +20%，化形加成已在 petData.attack 中生效)
        let goldAtkBonus = 0;
        const homeMgr = HomeManager.instance;
        if (homeMgr) {
            const resonance = homeMgr.calculateElementResonance();
            goldAtkBonus = resonance.goldAtkBonus;
        }

        const damageVal = Math.floor(this.petData.attack * (1 + goldAtkBonus));
        const targetPos = target.position.clone();

        tween(projNode)
            .to(0.3, { position: targetPos }, {
                onComplete: () => {
                    if (target && target.isValid) {
                        const enemyComp = target.getComponent('Enemy') as any;
                        if (enemyComp && typeof enemyComp.takeDamage === 'function') {
                            enemyComp.takeDamage(damageVal);
                        }
                    }
                    // 飞弹命中敌人造成伤害，联动触发吸血魔剑 (PlayerController.triggerVampireLifesteal)
                    if (this.playerNode && this.playerNode.isValid) {
                        const playerComp = this.playerNode.getComponent('PlayerController') as any;
                        if (playerComp && typeof playerComp.triggerVampireLifesteal === 'function') {
                            playerComp.triggerVampireLifesteal(damageVal);
                        }
                    }
                    projNode.destroy();
                }
            })
            .start();
    }
}
