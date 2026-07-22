import { _decorator, Component } from 'cc';
import { HomeManager } from '../Manager/HomeManager';
const { ccclass, property } = _decorator;

/**
 * 妖兽稀有度枚举/类型
 */
export type PetRarity = '普通' | '稀有' | '史诗' | '传说' | '神话';

/**
 * 五行属性类型
 */
export type PetElement = '金' | '木' | '水' | '火' | '土';

/**
 * 抓捕目标怪物输入结构接口
 */
export interface CaptureMonsterInput {
    /** 当前生命值 */
    currentHp: number;
    /** 最大生命值 */
    maxHp: number;
    /** 怪物名称 (可选) */
    name?: string;
    /** 怪物配置ID (可选) */
    id?: string;
    /** 稀有度 (可选) */
    rarity?: PetRarity;
    /** 基础攻击力 (可选) */
    baseAttack?: number;
    /** 基础生命值 (可选) */
    baseHp?: number;
    /** 基础移动速度 (可选) */
    baseSpeed?: number;
}

/**
 * 未鉴定的妖兽蛋数据结构
 */
export interface PetEgg {
    /** 妖兽蛋唯一标识ID */
    eggId: string;
    /** 妖兽种类名称/原怪物名称 */
    monsterType: string;
    /** 原怪物配置ID */
    monsterId: string;
    /** 获得时间戳 (毫秒) */
    obtainTime: number;
    /** 稀有度 */
    rarity: PetRarity;
    /** 五行属性 */
    element: PetElement;
    /** 星级 (默认 1 星) */
    star: number;
    /** 是否已化形 */
    isEvolved: boolean;
    /** 未鉴定前预存的基础攻击力 */
    baseAttack: number;
    /** 未鉴定前预存的基础生命值 */
    baseHp: number;
    /** 未鉴定前预存的基础移动速度 */
    baseSpeed: number;
}

/**
 * 已鉴定的宠物数据结构
 */
export interface AppraisedPet {
    /** 宠物唯一标识ID */
    petId: string;
    /** 原怪物配置ID */
    monsterId: string;
    /** 宠物名称 (变异时带有 "变异·" 前缀，化形后带有 "化形·" 前缀) */
    name: string;
    /** 是否变异 */
    isMutated: boolean;
    /** 五行属性 */
    element: PetElement;
    /** 星级 (1~5 星) */
    star: number;
    /** 是否已突破化形 */
    isEvolved: boolean;
    /** 最终攻击力 */
    attack: number;
    /** 最终生命值 */
    hp: number;
    /** 最终移动速度 */
    speed: number;
    /** 宠物形态/外观标识 (如 "normal_fox", "mutated_fox" 或 "evolved_fox") */
    form: string;
    /** 稀有度 */
    rarity: PetRarity;
    /** 获得妖兽蛋的时间戳 */
    obtainTime: number;
    /** 鉴定时间戳 */
    appraiseTime: number;
}

/**
 * 宠物抓捕与盲盒鉴定管理器
 * 负责局内妖兽抓捕计算、生成妖兽蛋以及局外妖兽蛋盲盒鉴定与背包管理
 */
@ccclass('PetCaptureManager')
export class PetCaptureManager extends Component {

    private static _instance: PetCaptureManager | null = null;

    /** 单例获取接口 */
    public static get instance(): PetCaptureManager | null {
        return PetCaptureManager._instance;
    }

    @property({ tooltip: "基础抓捕成功率 (0 ~ 1)" })
    public baseCaptureRate: number = 0.1;

    @property({ tooltip: "斩杀加成权重，基于血量损耗 (1 - currentHp / maxHp) 的计算权重" })
    public executeBonusWeight: number = 0.5;

    @property({ tooltip: "局外盲盒普通孵化变异率 (0.05 代表 5% 概率触发变异)" })
    public mutationRate: number = 0.05;

    @property({ tooltip: "仙露孵化变异率 (0.15 代表 15% 概率触发变异)" })
    public elixirMutationRate: number = 0.15;

    /** 持有的未鉴定妖兽蛋列表 */
    private _petEggList: PetEgg[] = [];

    /** 持有的已鉴定宠物列表 */
    private _appraisedPetList: AppraisedPet[] = [];

    /** 用于生成唯一ID的自增计数器 */
    private _eggIdCounter: number = 0;
    private _petIdCounter: number = 0;

    /** 吞天葫芦 (relic_gourd_swallow) 抓捕失败计数器 */
    private _gourdFailCount: number = 0;

    /** 获取当前吞天葫芦抓捕失败次数 */
    public get gourdFailCount(): number {
        return this._gourdFailCount;
    }

    /** 重置吞天葫芦抓捕失败计数器 */
    public resetGourdFailCount(): void {
        this._gourdFailCount = 0;
        HomeManager.instance?.saveData();
    }

    /** 设置吞天葫芦抓捕失败次数 (用于存档恢复) */
    public setGourdFailCount(count: number): void {
        this._gourdFailCount = Math.max(0, count || 0);
    }

    onLoad() {
        if (PetCaptureManager._instance === null) {
            PetCaptureManager._instance = this;
        } else if (PetCaptureManager._instance !== this) {
            this.node.destroy();
            return;
        }
    }

    onDestroy() {
        if (PetCaptureManager._instance === this) {
            PetCaptureManager._instance = null;
        }
    }

    /**
     * 计算抓捕成功率
     * 核心算式：必须明确包含 (1 - 当前血量 / 最大血量)
     * @param monster 目标怪物结构
     * @param itemBonus 道具/法宝等提供的额外抓捕率加成 (如 0.15 表示 +15%)
     * @returns 抓捕成功率 (范围 0.0 ~ 1.0)
     */
    public calculateCaptureRate(monster: CaptureMonsterInput, itemBonus: number = 0): number {
        if (!monster || monster.maxHp <= 0) {
            return 0;
        }

        // 规范当前血量与最大血量，防止异常数据
        const maxHp = monster.maxHp;
        const currentHp = Math.max(0, Math.min(monster.currentHp, maxHp));

        // 核心计算式：(1 - 当前血量 / 最大血量)
        const hpLossRatio = 1 - (currentHp / maxHp);

        // 吞天葫芦 (relic_gourd_swallow) 规则特质：每次失败增加 5% 成功率加成
        let extraGourdRate = 0;
        const homeMgr = HomeManager.instance;
        if (homeMgr && homeMgr.hasEquippedRelic('relic_gourd_swallow')) {
            extraGourdRate = this._gourdFailCount * 0.05;
        }

        // 最终成功率 = 基础抓捕率 + (1 - 当前血量 / 最大血量) * 斩杀加成权重 + 道具加成 + 吞天葫芦失败加成
        const totalRate = this.baseCaptureRate + (hpLossRatio * this.executeBonusWeight) + itemBonus + extraGourdRate;

        // 截断在 [0, 1] 范围内
        return Math.min(1.0, Math.max(0.0, totalRate));
    }

    /**
     * 抓捕尝试接口
     * 计算抓捕成功率，使用 Math.random() 判定是否成功。成功时生成并返回未鉴定的“妖兽蛋 (PetEgg)”。
     * @param monster 目标怪物数据 (包含 currentHp, maxHp, name?, id? 等)
     * @param itemBonus 道具/法宝加成
     * @returns 抓捕成功返回 PetEgg，抓捕失败返回 null
     */
    public attemptCapture(
        monster: { currentHp: number; maxHp: number; name?: string; id?: string },
        itemBonus: number = 0
    ): PetEgg | null {
        const successRate = this.calculateCaptureRate(monster, itemBonus);
        const roll = Math.random();
        const isGourdEquipped = HomeManager.instance?.hasEquippedRelic('relic_gourd_swallow');

        // 判定是否抓捕成功
        if (roll < successRate) {
            if (isGourdEquipped) {
                console.log(`[吞天葫芦] 抓捕判定成功！重置失败计数器 (原累计失败次数: ${this._gourdFailCount})`);
                this._gourdFailCount = 0;
                HomeManager.instance?.saveData();
            }
            const egg = this.createPetEggFromMonster(monster);
            this.addPetEgg(egg);
            return egg;
        } else {
            if (isGourdEquipped) {
                this._gourdFailCount++;
                console.log(`[吞天葫芦] 抓捕判定失败！失败计数器 +1 (当前累计: ${this._gourdFailCount}, 下次额外加成: ${(this._gourdFailCount * 5)}%)`);
                HomeManager.instance?.saveData();
            }
            return null;
        }
    }

    /**
     * 局外鉴定妖兽蛋机制接口
     * @param egg 待鉴定的妖兽蛋
     * @param useElixir 是否使用仙露孵化 (默认 false: 普通孵化 100 灵石，5% 变异率; true: 仙露孵化 300 灵石 + 30 材料，15% 变异率, 紫色史诗保底)
     * @returns 鉴定后的宠物 AppraisedPet
     */
    public appraisePetEgg(egg: PetEgg, useElixir: boolean = false): AppraisedPet {
        if (!egg) {
            throw new Error("鉴定失败：传入的妖兽蛋无效");
        }

        const homeMgr = HomeManager.instance;
        if (homeMgr) {
            if (useElixir) {
                // 仙露孵化：消耗 300 灵石 + 30 材料
                if (homeMgr.spiritStones < 300 || homeMgr.materials < 30) {
                    throw new Error("鉴定失败：灵石或材料不足 (需要 300 灵石 + 30 材料)");
                }
                homeMgr.addSpiritStones(-300);
                homeMgr.addMaterials(-30);
            } else {
                // 普通孵化：消耗 100 灵石
                if (homeMgr.spiritStones < 100) {
                    throw new Error("鉴定失败：灵石不足 (需要 100 灵石)");
                }
                homeMgr.addSpiritStones(-100);
            }
        }

        // 1. 判定变异率
        const currentMutationRate = useElixir ? this.elixirMutationRate : this.mutationRate;
        const roll = Math.random();
        const isMutated = roll < currentMutationRate;

        this._petIdCounter++;
        const timestamp = Date.now();

        // 2. 仙露孵化保底：紫色史诗或以上保底
        let finalRarity: PetRarity = egg.rarity || '普通';
        if (useElixir) {
            if (finalRarity === '普通' || finalRarity === '稀有') {
                finalRarity = '史诗';
            }
        }

        // 3. 变异成功时：属性翻倍
        const statMultiplier = isMutated ? 2 : 1;
        const finalAttack = egg.baseAttack * statMultiplier;
        const finalHp = egg.baseHp * statMultiplier;
        const finalSpeed = egg.baseSpeed * statMultiplier;

        // 4. 形态与名称发生变化
        const petName = isMutated ? `变异·${egg.monsterType}` : egg.monsterType;
        const visualForm = isMutated ? `mutated_${egg.monsterId}` : `normal_${egg.monsterId}`;

        const appraisedPet: AppraisedPet = {
            petId: `pet_${timestamp}_${this._petIdCounter}`,
            monsterId: egg.monsterId,
            name: petName,
            isMutated: isMutated,
            element: egg.element || '金',
            star: egg.star || 1,
            isEvolved: egg.isEvolved || false,
            attack: finalAttack,
            hp: finalHp,
            speed: finalSpeed,
            form: visualForm,
            rarity: finalRarity,
            obtainTime: egg.obtainTime,
            appraiseTime: timestamp
        };

        // 5. 从背包/存储中扣除该蛋，并将已鉴定宠物存入已鉴定宠物列表
        this.removePetEgg(egg.eggId);
        this.addAppraisedPet(appraisedPet);

        return appraisedPet;
    }

    /**
     * 根据抓捕到的怪物数据构建妖兽蛋对象
     */
    private createPetEggFromMonster(monster: { currentHp: number; maxHp: number; name?: string; id?: string }): PetEgg {
        this._eggIdCounter++;
        const timestamp = Date.now();
        const monsterName = monster.name || '未知妖兽';
        const monsterId = monster.id || `monster_${this._eggIdCounter}`;

        // 提取或判定稀有度与基础数值
        const inputMonster = monster as CaptureMonsterInput;
        const rarity: PetRarity = inputMonster.rarity || '普通';
        const baseAttack = inputMonster.baseAttack ?? this.getDefaultStatByRarity(rarity, 'attack');
        const baseHp = inputMonster.baseHp ?? this.getDefaultStatByRarity(rarity, 'hp');
        const baseSpeed = inputMonster.baseSpeed ?? this.getDefaultStatByRarity(rarity, 'speed');

        // 随机赋予五行属性
        const elements: PetElement[] = ['金', '木', '水', '火', '土'];
        const randomElement = elements[Math.floor(Math.random() * elements.length)];

        const egg: PetEgg = {
            eggId: `egg_${timestamp}_${this._eggIdCounter}`,
            monsterType: monsterName,
            monsterId: monsterId,
            obtainTime: timestamp,
            rarity: rarity,
            element: randomElement,
            star: 1,
            isEvolved: false,
            baseAttack: baseAttack,
            baseHp: baseHp,
            baseSpeed: baseSpeed
        };

        return egg;
    }

    /**
     * 根据稀有度获取默认属性
     */
    private getDefaultStatByRarity(rarity: PetRarity, statType: 'attack' | 'hp' | 'speed'): number {
        const rarityMultipliers: Record<PetRarity, number> = {
            '普通': 1.0,
            '稀有': 1.5,
            '史诗': 2.2,
            '传说': 3.2,
            '神话': 5.0
        };

        const baseValues = {
            attack: 20,
            hp: 100,
            speed: 5
        };

        const mult = rarityMultipliers[rarity] || 1.0;
        return Math.floor(baseValues[statType] * mult);
    }

    // ==========================================
    // 公共查询与背包管理接口
    // ==========================================

    /**
     * 获取存储的妖兽蛋列表 (未鉴定)
     * @returns 妖兽蛋数组的深拷贝
     */
    public getPetEggs(): PetEgg[] {
        return [...this._petEggList];
    }

    /**
     * 获取已鉴定的宠物列表
     * @returns 已鉴定宠物数组的深拷贝
     */
    public getAppraisedPets(): AppraisedPet[] {
        return [...this._appraisedPetList];
    }

    /**
     * 向背包添加未鉴定妖兽蛋
     * @param egg 妖兽蛋对象
     */
    public addPetEgg(egg: PetEgg): void {
        if (egg) {
            this._petEggList.push(egg);
        }
    }

    /**
     * 从背包移除指定 ID 的妖兽蛋
     * @param eggId 妖兽蛋唯一ID
     * @returns 是否成功移除
     */
    public removePetEgg(eggId: string): boolean {
        const index = this._petEggList.findIndex(e => e.eggId === eggId);
        if (index >= 0) {
            this._petEggList.splice(index, 1);
            return true;
        }
        return false;
    }

    /**
     * 向宠物库添加已鉴定的宠物
     * @param pet 宠物对象
     */
    public addAppraisedPet(pet: AppraisedPet): void {
        if (pet) {
            this._appraisedPetList.push(pet);
        }
    }

    /**
     * 从宠物库移除指定 ID 的已鉴定宠物
     * @param petId 宠物唯一ID
     * @returns 是否成功移除
     */
    public removeAppraisedPet(petId: string): boolean {
        const index = this._appraisedPetList.findIndex(p => p.petId === petId);
        if (index >= 0) {
            this._appraisedPetList.splice(index, 1);
            return true;
        }
        return false;
    }

    /**
     * 根据 eggId 查询妖兽蛋
     * @param eggId 妖兽蛋唯一ID
     */
    public getEggById(eggId: string): PetEgg | null {
        return this._petEggList.find(e => e.eggId === eggId) || null;
    }

    /**
     * 根据 petId 查询已鉴定宠物
     * @param petId 宠物唯一ID
     */
    public getPetById(petId: string): AppraisedPet | null {
        return this._appraisedPetList.find(p => p.petId === petId) || null;
    }

    /**
     * 获取未鉴定妖兽蛋总数量
     */
    public getEggCount(): number {
        return this._petEggList.length;
    }

    /**
     * 获取已鉴定宠物总数量
     */
    public getAppraisedPetCount(): number {
        return this._appraisedPetList.length;
    }

    /**
     * 吞噬同名宠物(同 monsterId)升星接口
     * @param targetPetId 主目标宠物唯一ID
     * @param foodPetId 被吞噬消耗的同名宠物唯一ID
     */
    public swallowPet(targetPetId: string, foodPetId: string): { success: boolean; message: string; pet?: AppraisedPet } {
        if (targetPetId === foodPetId) {
            return { success: false, message: "无法吞噬宠物自身！" };
        }

        const targetPet = this.getPetById(targetPetId);
        const foodPet = this.getPetById(foodPetId);

        if (!targetPet || !foodPet) {
            return { success: false, message: "找不到指定的目标宠物或消耗宠物！" };
        }

        // 校验同名/同种属 monsterId
        if (targetPet.monsterId !== foodPet.monsterId) {
            return { success: false, message: "吞噬失败：只有同种属(同 monsterId)的宠物才能吞噬升星！" };
        }

        // 校验上限 5 星
        if (targetPet.star >= 5) {
            return { success: false, message: "宠物已达最高 5 星，无需继续吞噬升星！" };
        }

        // 检查被吞噬宠物是否在 HomeManager 出战或打工中，自动下阵
        const homeMgr = HomeManager.instance;
        if (homeMgr) {
            if (homeMgr.getEquippedPetIds().includes(foodPetId)) {
                homeMgr.unequipPet(foodPetId);
            }
            if (homeMgr.getFarmingPetId() === foodPetId) {
                homeMgr.dispatchFarming(null);
            }
            if (homeMgr.getMiningPetId() === foodPetId) {
                homeMgr.dispatchMining(null);
            }
        }

        // 从列表中移除被吞噬材料宠物
        this.removeAppraisedPet(foodPetId);

        // 目标宠物升 1 星
        targetPet.star += 1;

        // 每升 1 星基础属性 (攻击、生命、速度) +20%
        targetPet.attack = Math.floor(targetPet.attack * 1.20);
        targetPet.hp = Math.floor(targetPet.hp * 1.20);
        targetPet.speed = Math.floor(targetPet.speed * 1.20);

        return {
            success: true,
            message: `吞噬同名宠物成功！[${targetPet.name}] 升至 ${targetPet.star} 星，基础属性提升 20%！`,
            pet: targetPet
        };
    }

    /**
     * 吞噬升星别名接口
     */
    public devourPet(targetPetId: string, foodPetId: string): { success: boolean; message: string; pet?: AppraisedPet } {
        return this.swallowPet(targetPetId, foodPetId);
    }

    /**
     * 满星 5 星触发“化形 (Evolve)”接口
     * 校验并消耗 HomeManager.ts 中的挂机灵石 (2000) 与材料 (200)
     * 化形后属性额外 +50%，名称加前缀 "化形·"，外观标识 form 变更为 evolved_xxx
     * @param petId 待化形的宠物唯一ID
     */
    public evolvePet(petId: string): { success: boolean; message: string; pet?: AppraisedPet } {
        const pet = this.getPetById(petId);
        if (!pet) {
            return { success: false, message: "找不到指定的宠物！" };
        }

        if (pet.star < 5) {
            return { success: false, message: "宠物必须达到最高 5 星才能触发化形！" };
        }

        if (pet.isEvolved) {
            return { success: false, message: "该宠物已经完成过化形，不可重复化形！" };
        }

        const homeMgr = HomeManager.instance;
        if (!homeMgr) {
            return { success: false, message: "化形失败：未找到 HomeManager 洞府组件！" };
        }

        // 校验并消耗灵石 (2000) 与材料 (200)
        if (homeMgr.spiritStones < 2000 || homeMgr.materials < 200) {
            return { success: false, message: "化形灵材不足！需要 2000 灵石 与 200 灵材。" };
        }

        // 扣除资源
        homeMgr.addSpiritStones(-2000);
        homeMgr.addMaterials(-200);

        // 标记化形
        pet.isEvolved = true;

        // 化形后属性额外 +50%
        pet.attack = Math.floor(pet.attack * 1.50);
        pet.hp = Math.floor(pet.hp * 1.50);
        pet.speed = Math.floor(pet.speed * 1.50);

        // 名称加前缀 "化形·"
        if (!pet.name.startsWith("化形·")) {
            pet.name = `化形·${pet.name}`;
        }

        // 外观标识 form 变更为 evolved_xxx
        pet.form = `evolved_${pet.monsterId}`;

        return {
            success: true,
            message: `【化形突破】恭喜！[${pet.name}] 成功突破至化形形态！属性提升 50%！`,
            pet: pet
        };
    }

    /**
     * 清空所有背包与宠物数据 (通常用于测试或数据重置)
     */
    public clearAllData(): void {
        this._petEggList = [];
        this._appraisedPetList = [];
    }
}
