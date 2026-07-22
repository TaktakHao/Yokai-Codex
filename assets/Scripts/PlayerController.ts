import { _decorator, Component, Node, Vec3, log, director, Size, Layers } from 'cc';
import { EventManager, CombatEvent, UIEvent, IPlayerAttackedPayload } from './Manager/EventManager';
import { VisualLoader } from './Utils/VisualLoader';
import { HomeManager } from './Manager/HomeManager';
import { PetCaptureManager } from './Logic/PetCaptureManager';
import { PetFollower } from './Logic/PetFollower';
import { GameManager } from './Manager/GameManager';

const { ccclass, property } = _decorator;

export interface IEnemy {
    takeDamage(damage: number): void;
}

@ccclass('PlayerController')
export class PlayerController extends Component {

    @property(Node)
    public monsterRoot: Node | null = null;

    @property
    public texturePath: string = 'Textures/Player/player';

    @property
    public maxHp: number = 100;
    
    @property
    public currentHp: number = 100;

    @property
    public maxExp: number = 100;

    @property
    public currentExp: number = 0;

    @property
    public level: number = 1;

    @property
    public attackRange: number = 300; // 自动攻击范围

    @property
    public attackDamage: number = 10;

    @property
    public attackCooldown: number = 1.0; // 每秒攻击一次

    private attackTimer: number = 0;
    private moveDirection: Vec3 = new Vec3(0, 0, 0);
    private moveSpeed: number = 200; // 移动速度

    onEnable() {
        this.initEquippedPets();
    }

    start() {
        this.node.layer = Layers.Enum.UI_2D;
        
        // 洞府家具 (红木躺椅): 主角初始生命上限 +50
        const homeMgr = HomeManager.instance;
        const furnitureHpBonus = homeMgr ? homeMgr.getFurnitureMaxHpBonus() : 0;
        this.maxHp = 100 + furnitureHpBonus;
        this.currentHp = this.maxHp;
        this.currentExp = 0;
        this.setupVisual();
        
        // 战斗开局根据上阵配置自动生成跟随宠物节点
        this.initEquippedPets();
    }

    /**
     * 读取局外已上阵宠物配置并动态生成随行宠物
     */
    public initEquippedPets() {
        const homeMgr = HomeManager.instance;
        const petMgr = PetCaptureManager.instance;
        if (!homeMgr || !petMgr) {
            log('[PlayerController] 缺少 HomeManager 或 PetCaptureManager，无法生成随行宠物。');
            return;
        }

        // 清理已有 Follower_ 随行宠物节点，防止二次进入关卡时重复生成或残存
        if (this.node.parent) {
            const existingFollowers = this.node.parent.children.filter(child => child.name.startsWith('Follower_'));
            for (const follower of existingFollowers) {
                follower.destroy();
            }
        }

        const equippedIds = homeMgr.getEquippedPetIds();
        if (equippedIds.length === 0) {
            log('[PlayerController] 当前没有上阵出战的宠物。');
            return;
        }

        log(`[PlayerController] 开始初始化上阵的 ${equippedIds.length} 只宠物...`);
        for (let i = 0; i < equippedIds.length; i++) {
            const petId = equippedIds[i];
            const petData = petMgr.getPetById(petId);
            if (!petData) continue;

            // 动态创建跟随宠物节点
            const petNode = new Node(`Follower_${petData.name}`);
            petNode.layer = Layers.Enum.UI_2D;
            // 挂载在与主角同级的父节点 (Canvas) 下
            petNode.parent = this.node.parent;
            // 初始坐标与主角重合
            petNode.setPosition(this.node.position.clone());

            // 挂载随行战斗组件并注入依赖
            const followerComp = petNode.addComponent(PetFollower);
            followerComp.petData = petData;
            followerComp.playerNode = this.node;
            followerComp.petIndex = i;
            followerComp.totalPetsCount = equippedIds.length;

            log(`[PlayerController] 成功实例化随行宠物: ${petData.name} (Index: ${i})`);
        }
    }

    /**
     * 自动为主角创建挂载 Sprite 的子节点并加载贴图
     */
    private setupVisual() {
        VisualLoader.loadVisual(this.node, this.texturePath, {
            childName: 'Visual',
            size: new Size(64, 64)
        });
    }

    update(deltaTime: number) {
        if (GameManager.instance && GameManager.instance.isBattleFrozen) return;

        // 获取摇杆输入
        const scene = director.getScene();
        const canvas = scene?.getChildByName('Canvas');
        const uiLayer = canvas?.getChildByName('UILayer') || canvas;
        const battleUINode = uiLayer?.getChildByName('BattleUIPanel');
        if (battleUINode) {
            const battleUIComp = battleUINode.getComponent('BattleUIPanel') as any;
            if (battleUIComp && battleUIComp.currentInputDirection) {
                this.setMoveDirection(battleUIComp.currentInputDirection);
            }
        }

        this.handleMovement(deltaTime);
        this.handleAutoAttack(deltaTime);
        this.handleResonanceHpRegen(deltaTime);
    }

    /**
     * 计算并获取所有已学技能的属性加成
     */
    private getSkillBonus() {
        let bonusAtk = 0;
        let bonusMaxHp = 0;
        let bonusCdr = 0;
        let bonusDef = 0;
        let bonusHpRegen = 0;

        if (GameManager.instance && GameManager.instance.skillPoolManager) {
            const learnedSkills = GameManager.instance.skillPoolManager.getLearnedSkills();
            for (const skill of learnedSkills) {
                if (skill.effectType === 'physicalDamage' || skill.effectType === 'lightningDamage' || skill.effectType === 'fireAoE') {
                    bonusAtk += skill.effectValue * skill.level;
                } else if (skill.effectType === 'maxHp') {
                    bonusMaxHp += skill.effectValue * skill.level;
                } else if (skill.effectType === 'cdReduction') {
                    bonusCdr += (skill.effectValue * skill.level) / 100; // e.g. 15 => 0.15
                } else if (skill.effectType === 'defense' || skill.effectType === 'iceShield') {
                    bonusDef += skill.effectValue * skill.level;
                } else if (skill.effectType === 'hpRegen') {
                    bonusHpRegen += skill.effectValue * skill.level;
                }
            }
        }
        return { bonusAtk, bonusMaxHp, bonusCdr, bonusDef, bonusHpRegen };
    }

    /**
     * 获取玩家实际有效最大生命值 (包含技能加成)
     */
    public getEffectiveMaxHp(): number {
        const bonus = this.getSkillBonus();
        return this.maxHp + bonus.bonusMaxHp;
    }

    /**
     * 处理 3木 共鸣羁绊生命回复及技能回血
     */
    private handleResonanceHpRegen(deltaTime: number) {
        const homeMgr = HomeManager.instance;
        const bonus = this.getSkillBonus();
        const effectiveMaxHp = this.getEffectiveMaxHp();
        
        let totalRegen = bonus.bonusHpRegen;
        if (homeMgr) {
            const resonance = homeMgr.calculateElementResonance();
            totalRegen += resonance.woodHpRegen;
        }

        if (totalRegen > 0 && this.currentHp < effectiveMaxHp) {
            const prevHp = this.currentHp;
            this.currentHp = Math.min(effectiveMaxHp, this.currentHp + totalRegen * deltaTime);
            if (Math.floor(prevHp) !== Math.floor(this.currentHp)) {
                EventManager.emit(UIEvent.UPDATE_HP, { currentHp: this.currentHp, maxHp: effectiveMaxHp });
                director.emit('UI_Event_Update_HP', this.currentHp, effectiveMaxHp);
            }
        }
    }

    /**
     * 设置玩家的移动方向
     * @param dir 移动方向向量（标准化）
     */
    public setMoveDirection(dir: Vec3) {
        this.moveDirection = dir;
    }

    /**
     * 处理玩家移动
     */
    private handleMovement(deltaTime: number) {
        if (this.moveDirection.lengthSqr() > 0) {
            const currentPos = this.node.position;
            const deltaMove = new Vec3();
            Vec3.multiplyScalar(deltaMove, this.moveDirection, this.moveSpeed * deltaTime);
            
            const newPos = new Vec3();
            Vec3.add(newPos, currentPos, deltaMove);
            this.node.setPosition(newPos);
        }
    }

    /**
     * 处理自动攻击逻辑 (包含 3水 CDR 共鸣缩减 与 技能 CDR 加成)
     */
    private handleAutoAttack(deltaTime: number) {
        this.attackTimer += deltaTime;
        
        let cdrBonus = 0;
        const homeMgr = HomeManager.instance;
        if (homeMgr) {
            const resonance = homeMgr.calculateElementResonance();
            cdrBonus = resonance.waterCdrBonus;
        }

        const bonus = this.getSkillBonus();
        const effectiveCooldown = Math.max(0.1, this.attackCooldown * (1 - cdrBonus - bonus.bonusCdr));
        if (this.attackTimer >= effectiveCooldown) {
            this.attackTimer = 0;
            this.executeAutoAttack();
        }
    }

    /**
     * 执行攻击寻找范围内的敌人并进行攻击
     * 包含 3金 攻击加成与 3火 暴击率加成
     */
    private executeAutoAttack() {
        if (!this.monsterRoot) {
            const scene = director.getScene();
            const canvas = scene?.getChildByName('Canvas');
            this.monsterRoot = canvas?.getChildByName('EnemyLayer') || null;
            if (!this.monsterRoot) {
                log('[玩家] 未找到怪物根节点 (EnemyLayer)，无法寻找敌人。');
                return;
            }
        }

        const enemies = this.monsterRoot.children;
        if (enemies.length === 0) return;

        let targetEnemy: Node | null = null;
        let minDistance = this.attackRange;

        // 寻找距离最近且在攻击范围内的敌人
        for (let i = 0; i < enemies.length; i++) {
            const enemyNode = enemies[i];
            const dist = Vec3.distance(this.node.position, enemyNode.position);
            
            if (dist <= minDistance) {
                minDistance = dist;
                targetEnemy = enemyNode;
            }
        }

        if (targetEnemy) {
            // 计算共鸣加成 (3金 +20% 攻击, 3火 +20% 暴击率)
            let goldAtkBonus = 0;
            let fireCritBonus = 0;
            const homeMgr = HomeManager.instance;
            if (homeMgr) {
                const resonance = homeMgr.calculateElementResonance();
                goldAtkBonus = resonance.goldAtkBonus;
                fireCritBonus = resonance.fireCritBonus;
            }

            // 计算主角实际基础攻击力 (判定穿戴吸血魔剑 relic_sword_vampire 削减 50% 基础攻击力)
            const effectiveBaseAtk = this.getEffectiveAttackDamage();
            let finalDamage = Math.floor(effectiveBaseAtk * (1 + goldAtkBonus));
            const critRate = 0.05 + fireCritBonus;
            const isCrit = Math.random() < critRate;
            if (isCrit) {
                finalDamage = Math.floor(finalDamage * 1.5);
                log(`[玩家] 触发暴击！造成 ${finalDamage} 点重创伤害！`);
            } else {
                log(`[玩家] 发动攻击！造成 ${finalDamage} 点伤害 (距离 ${minDistance.toFixed(2)})`);
            }

            // 派发玩家攻击事件
            EventManager.emit<IPlayerAttackedPayload>(CombatEvent.PLAYER_ATTACKED, {
                attackerPos: this.node.position.clone(),
                targetPos: targetEnemy.position.clone(),
                damage: finalDamage
            });
            
            const enemyComp = targetEnemy.getComponent('Enemy') as unknown as IEnemy;
            if (enemyComp && typeof enemyComp.takeDamage === 'function') {
                enemyComp.takeDamage(finalDamage);
            } else {
                log(`[玩家] 对目标 ${targetEnemy.name} 造成 ${finalDamage} 伤害 (目标未实现 takeDamage)`);
            }

            // 吸血魔剑被动：造成伤害时恢复 5% HP
            this.triggerVampireLifesteal(finalDamage);
        }
    }

    /**
     * 获取玩家实际有效基础攻击力 (包含技能加成，穿戴吸血魔剑时削减 50%)
     */
    public getEffectiveAttackDamage(): number {
        const bonus = this.getSkillBonus();
        let baseAtk = this.attackDamage + bonus.bonusAtk;
        const homeMgr = HomeManager.instance;
        if (homeMgr && homeMgr.hasEquippedRelic('relic_sword_vampire')) {
            baseAtk *= 0.5;
        }
        return baseAtk;
    }

    /**
     * 触发吸血魔剑生命恢复判定
     * @param damage 造成的实际伤害数值
     */
    public triggerVampireLifesteal(damage: number) {
        if (damage <= 0) return;
        const homeMgr = HomeManager.instance;
        if (homeMgr && homeMgr.hasEquippedRelic('relic_sword_vampire')) {
            const healVal = Math.max(1, Math.floor(damage * 0.05));
            const effectiveMaxHp = this.getEffectiveMaxHp();
            const prevHp = this.currentHp;
            this.currentHp = Math.min(effectiveMaxHp, this.currentHp + healVal);
            console.log(`[吸血魔剑] 造成 ${damage} 伤害，为主角恢复 ${healVal} HP`);
            log(`[吸血魔剑] 造成 ${damage} 伤害，为主角恢复 ${healVal} HP`);
            EventManager.emit(UIEvent.UPDATE_HP, { currentHp: this.currentHp, maxHp: effectiveMaxHp });
            director.emit('UI_Event_Update_HP', this.currentHp, effectiveMaxHp);
        }
    }

    /**
     * 玩家受到伤害 (包含 3土 20% 免伤共鸣加成 及 技能免伤)
     */
    public takeDamage(damage: number) {
        if (GameManager.instance && GameManager.instance.isBattleFrozen) return;

        let earthDefBonus = 0;
        const homeMgr = HomeManager.instance;
        if (homeMgr) {
            const resonance = homeMgr.calculateElementResonance();
            earthDefBonus = resonance.earthDefBonus;
        }

        const bonus = this.getSkillBonus();
        const effectiveMaxHp = this.getEffectiveMaxHp();
        
        // 减伤计算：先乘算比例减伤，再减去固定减伤
        let actualDamage = Math.floor(damage * (1 - earthDefBonus));
        actualDamage = Math.max(1, actualDamage - bonus.bonusDef);

        this.currentHp -= actualDamage;
        log(`[玩家] 受到伤害 ${actualDamage} (原伤害 ${damage}, 免伤 ${(earthDefBonus * 100).toFixed(0)}%, 固定减伤 ${bonus.bonusDef}), 剩余血量: ${this.currentHp}/${effectiveMaxHp}`);
        
        // 通知 UI 更新血条
        EventManager.emit(UIEvent.UPDATE_HP, { currentHp: this.currentHp, maxHp: effectiveMaxHp });
        director.emit('UI_Event_Update_HP', this.currentHp, effectiveMaxHp);

        if (this.currentHp <= 0) {
            this.die();
        }
    }

    /**
     * 满血恢复生命值 (无双气血等全满级保底逻辑)
     */
    public restoreFullHp() {
        const effectiveMaxHp = this.getEffectiveMaxHp();
        this.currentHp = effectiveMaxHp;
        log(`[玩家] 执行满血恢复: ${this.currentHp}/${effectiveMaxHp}`);
        EventManager.emit(UIEvent.UPDATE_HP, { currentHp: this.currentHp, maxHp: effectiveMaxHp });
        director.emit('UI_Event_Update_HP', this.currentHp, effectiveMaxHp);
    }

    /**
     * 获得经验值
     */
    public addExp(exp: number) {
        this.currentExp += exp;
        log(`[玩家] 获得经验 ${exp}, 当前经验: ${this.currentExp}/${this.maxExp}`);
        
        // 循环判定升级，支持收到高额经验（如 BOSS 1500Exp）时连续多次跨级升级
        while (this.currentExp >= this.maxExp) {
            this.levelUp();
        }

        const effectiveMaxHp = this.getEffectiveMaxHp();
        // 通知 UI 更新经验条与血条
        EventManager.emit(UIEvent.UPDATE_EXP, { currentExp: this.currentExp, maxExp: this.maxExp });
        director.emit('UI_Event_Update_EXP', this.currentExp, this.maxExp);
        EventManager.emit(UIEvent.UPDATE_HP, { currentHp: this.currentHp, maxHp: effectiveMaxHp });
        director.emit('UI_Event_Update_HP', this.currentHp, effectiveMaxHp);
    }

    /**
     * 玩家升级逻辑
     */
    private levelUp() {
        this.level++;
        this.currentExp -= this.maxExp;
        this.maxExp = Math.floor(this.maxExp * 1.5); // 升级后所需经验增加
        
        this.maxHp += 20; // 升级增加基础血量上限
        
        const effectiveMaxHp = this.getEffectiveMaxHp();
        this.currentHp = effectiveMaxHp; // 升级回满血

        log(`[玩家] 升级！当前等级: ${this.level}, 基础最大生命值: ${this.maxHp}, 有效最大生命值: ${effectiveMaxHp}`);
        // 触发三选一技能 UI 面板
        EventManager.emit(UIEvent.LEVEL_UP, this.level);
        director.emit('UI_Event_Level_Up', this.level);
    }

    /**
     * 玩家死亡
     */
    private die() {
        log('[玩家] 死亡，游戏结束！');
        EventManager.emit(UIEvent.GAME_OVER);
        director.emit('UI_Event_Game_Over');
    }
}
