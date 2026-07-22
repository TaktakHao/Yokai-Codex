import { _decorator, Component, sys, log } from 'cc';
import { PetCaptureManager, PetElement } from '../Logic/PetCaptureManager';
const { ccclass, property } = _decorator;

/** 洞府家具配置接口 */
export interface IFurnitureConfig {
    /** 家具 ID */
    id: string;
    /** 家具名称 */
    name: string;
    /** 购买消耗灵石 */
    costStones: number;
    /** 购买消耗材料 */
    costMaterials: number;
    /** 挂机收益速率加成 (如 0.15 代表 +15%) */
    spiritRateBonus: number;
    /** 主角初始生命上限加成 (如 50) */
    playerMaxHpBonus: number;
    /** 家具描述 */
    description: string;
}

/** 法宝部位槽位枚举与类型 */
export enum RelicSlotType {
    WEAPON = 'WEAPON',
    ACCESSORY = 'ACCESSORY',
    GOURD = 'GOURD'
}

/** 法宝实体数据结构 */
export interface IRelicData {
    /** 唯一实体 ID (如 "relic_1721500000000_1") */
    id: string;
    /** 引用配置 ID */
    configId: string;
    /** 法宝名称 */
    name: string;
    /** 装备部位 */
    type: RelicSlotType;
    /** 当前星级 (1 ~ 5) */
    star: number;
    /** 当前强化等级 (1 ~ Max) */
    level: number;
    /** 当前属性加成数值 */
    baseBonus: number;
    /** 效果描述 (可选) */
    description?: string;
}

/** 法宝静态配置接口 */
export interface IRelicConfig {
    configId: string;
    name: string;
    type: RelicSlotType;
    description: string;
    baseBonus: number;
}

/** 三大初始法宝规则与配置 */
export const RELIC_CONFIGS: Record<string, IRelicConfig> = {
    'relic_sword_vampire': {
        configId: 'relic_sword_vampire',
        name: '吸血魔剑',
        type: RelicSlotType.WEAPON,
        description: '主武器：降低 50% 基础攻击力；造成伤害时将伤害值的 5% 转化为主角 HP 回复。',
        baseBonus: 0.05
    },
    'relic_treasure_bowl': {
        configId: 'relic_treasure_bowl',
        name: '聚宝盆',
        type: RelicSlotType.ACCESSORY,
        description: '配饰：怪物击杀掉落灵石数量翻倍；怪物基础移动速度提升 20%。',
        baseBonus: 2.0
    },
    'relic_gourd_swallow': {
        configId: 'relic_gourd_swallow',
        name: '吞天葫芦',
        type: RelicSlotType.GOURD,
        description: '祖传葫芦：抓捕失败时增加 5% 抓捕成功率（失败计数可叠加）；抓捕成功后重置。',
        baseBonus: 0.05
    }
};

/** 预设家具配置列表 */
export const FURNITURE_CONFIGS: IFurnitureConfig[] = [
    {
        id: 'bed_hanyu',
        name: '极品寒玉床',
        costStones: 2000,
        costMaterials: 200,
        spiritRateBonus: 0.15,
        playerMaxHpBonus: 0,
        description: '极品万年寒玉雕凿而成，挂机收益速率 +15%'
    },
    {
        id: 'chair_hongmu',
        name: '红木躺椅',
        costStones: 1500,
        costMaterials: 150,
        spiritRateBonus: 0,
        playerMaxHpBonus: 50,
        description: '千年紫檀红木软榻，主角初始生命上限 +50'
    }
];

/** 五行属性共鸣羁绊加成结构接口 */
export interface IResonanceBonus {
    /** 3金: 全员基础攻击 +20% */
    goldAtkBonus: number;
    /** 3木: 主角与宠物每秒恢复 15 HP */
    woodHpRegen: number;
    /** 3水: CDR / 宠物攻速 +15% */
    waterCdrBonus: number;
    /** 3火: 暴击率 +20% */
    fireCritBonus: number;
    /** 3土: 防御力 +20% / 免伤 20% */
    earthDefBonus: number;
    /** 各五行元素当前上阵数量 */
    elementCounts: Record<PetElement, number>;
    /** 当前激活共鸣的元素类型 */
    activeResonances: PetElement[];
}

/** 天赋节点结构接口 */
export interface ITalentNode {
    /** 天赋 ID */
    id: string;
    /** 天赋名称 */
    name: string;
    /** 当前等级 */
    level: number;
    /** 最大等级 */
    maxLevel: number;
    /** 初始升级消耗灵石 */
    cost: number;
    /** 天赋效果描述 */
    effect: string;
}

/** 境界信息结构接口 */
export interface IRealmInfo {
    /** 境界名称（如：练气、筑基、金丹、元婴、化神、渡劫等） */
    name: string;
    /** 境界等级阶数 */
    level: number;
    /** 突破至该境界所需的灵石消耗 */
    cost: number;
    /** 对洞府挂机产率的倍率加成 */
    rateMultiplier: number;
}

/** 预设境界配置数据 */
export const REALM_CONFIGS: IRealmInfo[] = [
    { name: '练气期', level: 1, cost: 0, rateMultiplier: 1.0 },
    { name: '筑基期', level: 2, cost: 200, rateMultiplier: 1.5 },
    { name: '金丹期', level: 3, cost: 1000, rateMultiplier: 2.2 },
    { name: '元婴期', level: 4, cost: 5000, rateMultiplier: 3.5 },
    { name: '化神期', level: 5, cost: 20000, rateMultiplier: 5.5 },
    { name: '渡劫期', level: 6, cost: 100000, rateMultiplier: 10.0 }
];

/** 预设天赋节点配置 */
export const INITIAL_TALENTS: ITalentNode[] = [
    {
        id: 'talent_fish',
        name: '摸鱼心法',
        level: 0,
        maxLevel: 10,
        cost: 50,
        effect: '每级提升灵石产出速率 10%'
    },
    {
        id: 'talent_gather',
        name: '聚灵符阵',
        level: 0,
        maxLevel: 10,
        cost: 50,
        effect: '每级提升修仙材料产出速率 10%'
    },
    {
        id: 'talent_meditation',
        name: '卧榻吐纳',
        level: 0,
        maxLevel: 10,
        cost: 100,
        effect: '每级提升洞府整体挂机效率 15%'
    },
    {
        id: 'talent_luck',
        name: '天命机缘',
        level: 0,
        maxLevel: 5,
        cost: 200,
        effect: '每级减少境界突破消耗 5%'
    }
];

/**
 * 局外洞府挂机与养成系统管理器
 */
@ccclass('HomeManager')
export class HomeManager extends Component {

    private static _instance: HomeManager | null = null;

    /** 单例获取接口 */
    public static get instance(): HomeManager | null {
        return HomeManager._instance;
    }

    /** 基础灵石产出速率（个/秒） */
    @property({ tooltip: '基础灵石产出速率（个/秒）' })
    public baseSpiritStoneRate: number = 1.0;

    /** 基础修仙材料产出速率（个/秒） */
    @property({ tooltip: '基础修仙材料产出速率（个/秒）' })
    public baseMaterialRate: number = 0.5;

    /** 当前积累的灵石数量 */
    private _spiritStones: number = 0;

    /** 当前积累的修仙材料数量 */
    private _materials: number = 0;

    /** 最后一次记录离线的时间戳 (毫秒) */
    private _lastOfflineTime: number = 0;

    /** 当前境界索引 */
    private _currentRealmIndex: number = 0;

    /** 天赋树节点字典 (id -> ITalentNode) */
    private _talents: Map<string, ITalentNode> = new Map<string, ITalentNode>();

    /** 当前出战上阵的宠物唯一ID列表 (最多 5 个) */
    private _equippedPetIds: string[] = [];

    /** 当前派遣在灵田打工的宠物唯一ID */
    private _farmingPetId: string | null = null;

    /** 当前派遣在矿脉打工的宠物唯一ID */
    private _miningPetId: string | null = null;

    /** 已购买的洞府家具 ID 列表 */
    private _purchasedFurnitureIds: string[] = [];

    /** 已穿戴的法宝 (部位 -> 法宝实体数据 | null) */
    private _equippedRelics: Record<RelicSlotType, IRelicData | null> = {
        WEAPON: null,
        ACCESSORY: null,
        GOURD: null
    };

    /** 法宝背包实体列表 */
    private _relicInventory: IRelicData[] = [];

    /** 本地持久化存储的 Key 定义 */
    private readonly STORAGE_KEY_LAST_OFFLINE_TIME = 'home_last_offline_time';
    private readonly STORAGE_KEY_SPIRIT_STONES = 'home_spirit_stones';
    private readonly STORAGE_KEY_MATERIALS = 'home_materials';
    private readonly STORAGE_KEY_REALM_INDEX = 'home_realm_index';
    private readonly STORAGE_KEY_TALENTS = 'home_talents_data';
    private readonly STORAGE_KEY_EQUIPPED_PETS = 'home_equipped_pet_ids';
    private readonly STORAGE_KEY_FARMING_PET = 'home_farming_pet_id';
    private readonly STORAGE_KEY_MINING_PET = 'home_mining_pet_id';
    private readonly STORAGE_KEY_FURNITURE = 'home_furniture_data';
    private readonly STORAGE_KEY_EQUIPPED_RELICS = 'home_equipped_relics_data';
    private readonly STORAGE_KEY_RELIC_INVENTORY = 'home_relic_inventory_data';

    /**
     * Cocos Creator 生命周期 - 加载
     */
    onLoad() {
        if (HomeManager._instance === null) {
            HomeManager._instance = this;
        } else if (HomeManager._instance !== this) {
            this.node.destroy();
            return;
        }

        // 初始化天赋配置字典
        this.initDefaultTalents();
        // 从本地存储读取数据
        this.loadData();
    }

    /**
     * Cocos Creator 生命周期 - 启动
     */
    start() {
        // 游戏进入主界面或洞府时自动触发一次离线收益结算
        this.settleOfflineEarnings();
    }

    /**
     * Cocos Creator 生命周期 - 每帧更新
     * @param deltaTime 帧间隔秒数
     */
    update(deltaTime: number) {
        // 游戏在线时定期同步实时时间戳，以便突发退出时能记录最新的离线起始点
        this._lastOfflineTime = Date.now();
    }

    /**
     * Cocos Creator 生命周期 - 销毁
     */
    onDestroy() {
        if (HomeManager._instance === this) {
            HomeManager._instance = null;
        }
        // 销毁时保存最新状态
        this.saveData();
    }

    /**
     * 初始化默认天赋结构
     */
    private initDefaultTalents() {
        this._talents.clear();
        for (const t of INITIAL_TALENTS) {
            this._talents.set(t.id, { ...t });
        }
    }

    /**
     * 计算特定宠物打工加成
     * @param petId 宠物唯一ID
     */
    public getPetWorkBonus(petId: string | null): number {
        if (!petId) return 0;
        const petMgr = PetCaptureManager.instance;
        if (!petMgr) return 0;
        const pet = petMgr.getPetById(petId);
        if (!pet) return 0;

        let baseBonus = 0.05; // 普通
        if (pet.rarity === '稀有') baseBonus = 0.10;
        else if (pet.rarity === '史诗') baseBonus = 0.15;
        else if (pet.rarity === '传说') baseBonus = 0.20;
        else if (pet.rarity === '神话') baseBonus = 0.30;

        if (pet.isMutated) {
            baseBonus *= 2.0; // 变异宠物效果翻倍
        }
        return baseBonus;
    }

    /**
     * 获取家具灵石挂机产率加成
     */
    public getFurnitureSpiritRateBonus(): number {
        let totalBonus = 0;
        for (const id of this._purchasedFurnitureIds) {
            const config = FURNITURE_CONFIGS.find(f => f.id === id);
            if (config) {
                totalBonus += config.spiritRateBonus;
            }
        }
        return totalBonus;
    }

    /**
     * 获取家具主角生命上限加成
     */
    public getFurnitureMaxHpBonus(): number {
        let totalBonus = 0;
        for (const id of this._purchasedFurnitureIds) {
            const config = FURNITURE_CONFIGS.find(f => f.id === id);
            if (config) {
                totalBonus += config.playerMaxHpBonus;
            }
        }
        return totalBonus;
    }

    /**
     * 获取当前实际的灵石产出速率（受境界、天赋、打工及家具加成影响）
     * 公式：基础产率 * 境界加成倍率 * (1 + 摸鱼心法加成 + 卧榻吐纳加成 + 矿脉打工宠物加成 + 家具加成)
     */
    public getSpiritStoneRate(): number {
        const realmInfo = REALM_CONFIGS[this._currentRealmIndex] || REALM_CONFIGS[0];
        const fishLevel = this.getTalentLevel('talent_fish');
        const meditationLevel = this.getTalentLevel('talent_meditation');
        const miningBonus = this.getPetWorkBonus(this._miningPetId);
        const furnitureBonus = this.getFurnitureSpiritRateBonus();

        const talentMultiplier = 1.0 + (fishLevel * 0.10) + (meditationLevel * 0.15) + miningBonus + furnitureBonus;
        return this.baseSpiritStoneRate * realmInfo.rateMultiplier * talentMultiplier;
    }

    /**
     * 获取当前实际的修仙材料产出速率（受境界与天赋及打工加成影响）
     * 公式：基础产率 * 境界加成倍率 * (1 + 聚灵符阵加成 + 卧榻吐纳加成 + 灵田打工宠物加成)
     */
    public getMaterialRate(): number {
        const realmInfo = REALM_CONFIGS[this._currentRealmIndex] || REALM_CONFIGS[0];
        const gatherLevel = this.getTalentLevel('talent_gather');
        const meditationLevel = this.getTalentLevel('talent_meditation');
        const farmingBonus = this.getPetWorkBonus(this._farmingPetId);

        const talentMultiplier = 1.0 + (gatherLevel * 0.10) + (meditationLevel * 0.15) + farmingBonus;
        return this.baseMaterialRate * realmInfo.rateMultiplier * talentMultiplier;
    }

    /**
     * 统计已上阵 (最多5只) 宠物五行属性，计算五行共鸣羁绊加成
     * 同系满 3 只激活共鸣：
     * 3金: 全员基础攻击 +20%
     * 3木: 主角与宠物每秒恢复 15 HP
     * 3水: CDR / 宠物攻速 +15%
     * 3火: 暴击率 +20%
     * 3土: 防御力 +20% / 免伤 20%
     */
    public calculateElementResonance(): IResonanceBonus {
        const elementCounts: Record<PetElement, number> = {
            '金': 0,
            '木': 0,
            '水': 0,
            '火': 0,
            '土': 0
        };

        const petMgr = PetCaptureManager.instance;
        if (petMgr) {
            for (const petId of this._equippedPetIds) {
                const pet = petMgr.getPetById(petId);
                if (pet && pet.element && elementCounts[pet.element] !== undefined) {
                    elementCounts[pet.element] += 1;
                }
            }
        }

        const activeResonances: PetElement[] = [];
        let goldAtkBonus = 0;
        let woodHpRegen = 0;
        let waterCdrBonus = 0;
        let fireCritBonus = 0;
        let earthDefBonus = 0;

        if (elementCounts['金'] >= 3) {
            goldAtkBonus = 0.20;
            activeResonances.push('金');
        }
        if (elementCounts['木'] >= 3) {
            woodHpRegen = 15;
            activeResonances.push('木');
        }
        if (elementCounts['水'] >= 3) {
            waterCdrBonus = 0.15;
            activeResonances.push('水');
        }
        if (elementCounts['火'] >= 3) {
            fireCritBonus = 0.20;
            activeResonances.push('火');
        }
        if (elementCounts['土'] >= 3) {
            earthDefBonus = 0.20;
            activeResonances.push('土');
        }

        return {
            goldAtkBonus,
            woodHpRegen,
            waterCdrBonus,
            fireCritBonus,
            earthDefBonus,
            elementCounts,
            activeResonances
        };
    }

    /**
     * 购买洞府家具接口
     * @param furnitureId 家具 ID
     */
    public buyFurniture(furnitureId: string): { success: boolean; message: string } {
        if (this._purchasedFurnitureIds.includes(furnitureId)) {
            return { success: false, message: "该家具已经购买过了！" };
        }

        const config = FURNITURE_CONFIGS.find(f => f.id === furnitureId);
        if (!config) {
            return { success: false, message: "未找到指定的家具配置！" };
        }

        if (this._spiritStones < config.costStones || this._materials < config.costMaterials) {
            return { success: false, message: `资源不足！购买【${config.name}】需要 ${config.costStones} 灵石 与 ${config.costMaterials} 材料。` };
        }

        this._spiritStones -= config.costStones;
        this._materials -= config.costMaterials;
        this._purchasedFurnitureIds.push(furnitureId);
        this.saveData();

        log(`[HomeManager] 成功购买洞府家具【${config.name}】！`);
        return { success: true, message: `成功购买【${config.name}】！效果生效中。` };
    }

    /**
     * 获取已购买的家具 ID 列表
     */
    public getPurchasedFurnitureIds(): string[] {
        return [...this._purchasedFurnitureIds];
    }

    /**
     * 是否已购买指定家具
     */
    public hasFurniture(furnitureId: string): boolean {
        return this._purchasedFurnitureIds.includes(furnitureId);
    }

    /**
     * 离线挂机收益结算接口
     * 依据离线时间戳差异结算灵石与修仙材料
     * 包含 24 小时全额 + 48 小时 20% 软上限衰减与超期封顶算式
     * @returns 包含本次结算新增的灵石数量、修仙材料数量及离线秒数
     */
    public settleOfflineEarnings(): { spiritStones: number, materials: number, offlineSeconds: number } {
        const currentTime = Date.now();
        let offlineMs = 0;

        if (this._lastOfflineTime > 0) {
            // 计算离线毫秒差 Date.now() - _lastOfflineTime
            offlineMs = Math.max(0, currentTime - this._lastOfflineTime);
        } else {
            // 若为首次初始化，设为当前时间
            this._lastOfflineTime = currentTime;
        }

        // 转化为离线秒数
        const offlineSeconds = Math.floor(offlineMs / 1000);

        let stonesEarned = 0;
        let materialsEarned = 0;

        if (offlineSeconds > 0) {
            // 离线挂机收益计算公式：
            // 前 24 小时 (86,400s) 100% 收益
            // 24~48 小时 (86,400s) 20% 软上限衰减收益
            // 超过 48 小时不再增加
            const fullRateTime = Math.min(offlineSeconds, 86400);
            const decayTime = Math.max(0, Math.min(offlineSeconds - 86400, 86400));
            const effectiveSeconds = fullRateTime + decayTime * 0.2;

            const stoneRate = this.getSpiritStoneRate();
            const materialRate = this.getMaterialRate();

            stonesEarned = Math.floor(stoneRate * effectiveSeconds);
            materialsEarned = Math.floor(materialRate * effectiveSeconds);

            // 增加资源积累
            this._spiritStones += stonesEarned;
            this._materials += materialsEarned;

            log(`[HomeManager] 离线挂机结算完成: 离线 ${offlineSeconds} 秒 (${(offlineSeconds / 3600).toFixed(2)} 小时)，有效时长 ${effectiveSeconds.toFixed(0)} 秒，获得灵石 +${stonesEarned}，获得修仙材料 +${materialsEarned}`);
        }

        // 更新并保存最后离线时间戳
        this._lastOfflineTime = currentTime;
        this.saveData();

        return {
            spiritStones: stonesEarned,
            materials: materialsEarned,
            offlineSeconds: offlineSeconds
        };
    }

    private _tribulationCost: number = 0; // 本次渡劫实际应消耗的灵石暂存

    /**
     * 境界系统升级接口 (配合雷劫渡劫前置校验)
     * @returns 校验结果 (是否校验通过、当前境界、剩余灵石、是否需要触发雷劫挑战)
     */
    public upgradeRealm(): { success: boolean, currentRealm: string, remainingStones: number, needChallenge?: boolean } {
        const currentRealmInfo = REALM_CONFIGS[this._currentRealmIndex];

        // 检查是否已达到最高境界
        if (this._currentRealmIndex >= REALM_CONFIGS.length - 1) {
            log(`[HomeManager] 境界升级失败: 已达到最高境界 [${currentRealmInfo.name}]`);
            return {
                success: false,
                currentRealm: currentRealmInfo.name,
                remainingStones: this._spiritStones
            };
        }

        // 下一境界信息
        const nextRealmInfo = REALM_CONFIGS[this._currentRealmIndex + 1];

        // 计算天赋折扣后的消耗
        const luckLevel = this.getTalentLevel('talent_luck');
        const discountRatio = Math.max(0.5, 1.0 - luckLevel * 0.05);
        const actualCost = Math.floor(nextRealmInfo.cost * discountRatio);

        // 余额校验：消耗灵石时严格校验余额，不足时返回失败
        if (this._spiritStones < actualCost) {
            log(`[HomeManager] 境界突破失败: 灵石不足！需要 ${actualCost} 灵石，当前拥有 ${this._spiritStones} 灵石`);
            return {
                success: false,
                currentRealm: currentRealmInfo.name,
                remainingStones: this._spiritStones
            };
        }

        // 暂存本次渡劫扣减额，等待雷劫挑战结果
        this._tribulationCost = actualCost;

        log(`[HomeManager] 境界突破前置校验通过！即将开始渡劫，需要挑战雷劫，预估消耗: ${actualCost}`);
        return {
            success: true,
            currentRealm: currentRealmInfo.name,
            remainingStones: this._spiritStones,
            needChallenge: true
        };
    }

    /**
     * 天劫雷劫挑战结果结算接口
     * @param success 是否挑战成功度过雷劫
     */
    public completeTribulation(success: boolean): { currentRealm: string, remainingStones: number } {
        const currentRealmInfo = REALM_CONFIGS[this._currentRealmIndex];

        if (success) {
            // 挑战成功：正式扣除全额灵石并提升境界
            this._spiritStones -= this._tribulationCost;
            this._currentRealmIndex += 1;
            const newRealmInfo = REALM_CONFIGS[this._currentRealmIndex];
            log(`[HomeManager] 渡劫功成！天道垂青，正式晋升为 [${newRealmInfo.name}]，扣除灵石 ${this._tribulationCost}`);
        } else {
            // 挑战失败：遭受反噬，扣除折后价 20% 的灵石作为修补内伤的代价，不升级
            const penaltyCost = Math.floor(this._tribulationCost * 0.20);
            this._spiritStones = Math.max(0, this._spiritStones - penaltyCost);
            log(`[HomeManager] 渡劫失败！天劫降罚，反噬损失灵石 ${penaltyCost}，境界维持在 [${currentRealmInfo.name}]`);
        }

        this._tribulationCost = 0;
        this.saveData();

        return {
            currentRealm: REALM_CONFIGS[this._currentRealmIndex].name,
            remainingStones: this._spiritStones
        };
    }

    /**
     * 天赋树系统升级接口
     * 消耗灵石升级指定的天赋节点，严格校验灵石余额
     * @param talentId 天赋节点 ID
     * @returns 升级结果 (是否成功、升级后的天赋等级)
     */
    public upgradeTalent(talentId: string): { success: boolean, talentLevel: number } {
        const talent = this._talents.get(talentId);

        if (!talent) {
            log(`[HomeManager] 天赋升级失败: 未找到 ID 为 [${talentId}] 的天赋节点`);
            return { success: false, talentLevel: 0 };
        }

        // 校验等级上限
        if (talent.level >= talent.maxLevel) {
            log(`[HomeManager] 天赋升级失败: 天赋 [${talent.name}] 已达最大等级 ${talent.maxLevel}`);
            return { success: false, talentLevel: talent.level };
        }

        // 计算当前升下一级所需的消耗灵石公式 (每级消耗按 1.4 倍递增)
        const cost = this.getTalentUpgradeCost(talentId);

        // 余额校验：不足时返回失败
        if (this._spiritStones < cost) {
            log(`[HomeManager] 天赋 [${talent.name}] 升级失败: 灵石不足！需要 ${cost} 灵石，当前拥有 ${this._spiritStones} 灵石`);
            return { success: false, talentLevel: talent.level };
        }

        // 扣除灵石并提升等级
        this._spiritStones -= cost;
        talent.level += 1;

        log(`[HomeManager] 天赋 [${talent.name}] 升级成功！当前等级: ${talent.level}/${talent.maxLevel}, 消耗灵石: ${cost}, 剩余灵石: ${this._spiritStones}`);

        // 保存状态
        this.saveData();

        return {
            success: true,
            talentLevel: talent.level
        };
    }

    /**
     * 计算特定天赋升级到下一级所需的灵石消耗
     * @param talentId 天赋 ID
     */
    public getTalentUpgradeCost(talentId: string): number {
        const talent = this._talents.get(talentId);
        if (!talent) return 0;

        // 初始消耗 * (1.4 ^ 当前等级)
        return Math.floor(talent.cost * Math.pow(1.4, talent.level));
    }

    /**
     * 获取指定天赋节点的当前等级
     * @param talentId 天赋 ID
     */
    public getTalentLevel(talentId: string): number {
        const talent = this._talents.get(talentId);
        return talent ? talent.level : 0;
    }

    /**
     * 获取天赋节点完整数据
     * @param talentId 天赋 ID
     */
    public getTalentNode(talentId: string): ITalentNode | null {
        const talent = this._talents.get(talentId);
        return talent ? { ...talent } : null;
    }

    /**
     * 获取所有天赋节点列表
     */
    public getAllTalents(): ITalentNode[] {
        const list: ITalentNode[] = [];
        this._talents.forEach((node) => {
            list.push({ ...node });
        });
        return list;
    }

    /**
     * 获取当前拥有灵石总数
     */
    public get spiritStones(): number {
        return this._spiritStones;
    }

    /**
     * 获取当前拥有修仙材料总数
     */
    public get materials(): number {
        return this._materials;
    }

    /**
     * 获取最后一次记录离线的时间戳 (毫秒)
     */
    public get lastOfflineTime(): number {
        return this._lastOfflineTime;
    }

    /**
     * 获取当前境界信息
     */
    public getCurrentRealmInfo(): IRealmInfo {
        return REALM_CONFIGS[this._currentRealmIndex] || REALM_CONFIGS[0];
    }

    /**
     * 获取下一境界升级消耗灵石 (考虑天命机缘折扣)
     */
    public getNextRealmUpgradeCost(): number {
        if (this._currentRealmIndex >= REALM_CONFIGS.length - 1) {
            return 0; // 已封顶
        }
        const nextRealmInfo = REALM_CONFIGS[this._currentRealmIndex + 1];
        const luckLevel = this.getTalentLevel('talent_luck');
        const discountRatio = Math.max(0.5, 1.0 - luckLevel * 0.05);
        return Math.floor(nextRealmInfo.cost * discountRatio);
    }

    /**
     * 增加或扣除灵石数量（供游戏通关、奖励、化形孵化扣除等系统调用）
     * @param amount 变动额度（可正可负）
     */
    public addSpiritStones(amount: number) {
        if (amount !== 0) {
            this._spiritStones = Math.max(0, this._spiritStones + amount);
            this.saveData();
        }
    }

    /**
     * 扣除灵石数量（限制下限为 0）
     * @param amount 扣除额度（正数）
     */
    public deductSpiritStones(amount: number) {
        if (amount > 0) {
            this.addSpiritStones(-amount);
        }
    }

    /**
     * 增加或扣除修仙材料数量（供游戏通关、副本、化形孵化扣除等系统调用）
     * @param amount 变动额度（可正可负）
     */
    public addMaterials(amount: number) {
        if (amount !== 0) {
            this._materials = Math.max(0, this._materials + amount);
            this.saveData();
        }
    }

    /**
     * 扣除修仙材料数量（限制下限为 0）
     * @param amount 扣除额度（正数）
     */
    public deductMaterials(amount: number) {
        if (amount > 0) {
            this.addMaterials(-amount);
        }
    }

    /**
     * 将挂机收益、境界、天赋及时间戳保存至本地持久化存储 (sys.localStorage)
     */
    /**
     * 将挂机收益、境界、天赋及时间戳保存至本地持久化存储 (sys.localStorage)
     */
    public saveData() {
        try {
            sys.localStorage.setItem(this.STORAGE_KEY_LAST_OFFLINE_TIME, this._lastOfflineTime.toString());
            sys.localStorage.setItem(this.STORAGE_KEY_SPIRIT_STONES, this._spiritStones.toString());
            sys.localStorage.setItem(this.STORAGE_KEY_MATERIALS, this._materials.toString());
            sys.localStorage.setItem(this.STORAGE_KEY_REALM_INDEX, this._currentRealmIndex.toString());

            // 将天赋字典转化为 JSON 字符串进行保存
            const talentsArray: { id: string, level: number }[] = [];
            this._talents.forEach((talent, id) => {
                talentsArray.push({ id, level: talent.level });
            });
            sys.localStorage.setItem(this.STORAGE_KEY_TALENTS, JSON.stringify(talentsArray));

            // 保存上阵与打工宠物数据
            sys.localStorage.setItem(this.STORAGE_KEY_EQUIPPED_PETS, JSON.stringify(this._equippedPetIds));
            if (this._farmingPetId) {
                sys.localStorage.setItem(this.STORAGE_KEY_FARMING_PET, this._farmingPetId);
            } else {
                sys.localStorage.removeItem(this.STORAGE_KEY_FARMING_PET);
            }
            if (this._miningPetId) {
                sys.localStorage.setItem(this.STORAGE_KEY_MINING_PET, this._miningPetId);
            } else {
                sys.localStorage.removeItem(this.STORAGE_KEY_MINING_PET);
            }

            // 保存已购买家具列表
            sys.localStorage.setItem(this.STORAGE_KEY_FURNITURE, JSON.stringify(this._purchasedFurnitureIds));

            // 保存法宝装备与背包数据
            sys.localStorage.setItem(this.STORAGE_KEY_EQUIPPED_RELICS, JSON.stringify(this._equippedRelics));
            sys.localStorage.setItem(this.STORAGE_KEY_RELIC_INVENTORY, JSON.stringify(this._relicInventory));
        } catch (e) {
            log('[HomeManager] 保存数据到 sys.localStorage 异常: ', e);
        }
    }

    /**
     * 从本地持久化存储 (sys.localStorage) 中读取数据
     */
    private loadData() {
        try {
            const savedTime = sys.localStorage.getItem(this.STORAGE_KEY_LAST_OFFLINE_TIME);
            const savedStones = sys.localStorage.getItem(this.STORAGE_KEY_SPIRIT_STONES);
            const savedMaterials = sys.localStorage.getItem(this.STORAGE_KEY_MATERIALS);
            const savedRealmIndex = sys.localStorage.getItem(this.STORAGE_KEY_REALM_INDEX);
            const savedTalents = sys.localStorage.getItem(this.STORAGE_KEY_TALENTS);

            if (savedTime !== null) {
                const parsedTime = parseInt(savedTime, 10);
                if (!isNaN(parsedTime) && parsedTime > 0) {
                    this._lastOfflineTime = parsedTime;
                } else {
                    this._lastOfflineTime = Date.now();
                }
            } else {
                this._lastOfflineTime = Date.now();
            }

            if (savedStones !== null) {
                const parsedStones = parseFloat(savedStones);
                if (!isNaN(parsedStones)) {
                    this._spiritStones = parsedStones;
                }
            }

            if (savedMaterials !== null) {
                const parsedMaterials = parseFloat(savedMaterials);
                if (!isNaN(parsedMaterials)) {
                    this._materials = parsedMaterials;
                }
            }

            if (savedRealmIndex !== null) {
                const parsedRealm = parseInt(savedRealmIndex, 10);
                if (!isNaN(parsedRealm) && parsedRealm >= 0 && parsedRealm < REALM_CONFIGS.length) {
                    this._currentRealmIndex = parsedRealm;
                }
            }

            if (savedTalents !== null) {
                const talentsArray = JSON.parse(savedTalents) as { id: string, level: number }[];
                if (Array.isArray(talentsArray)) {
                    for (const item of talentsArray) {
                        const node = this._talents.get(item.id);
                        if (node && typeof item.level === 'number') {
                            node.level = Math.min(node.maxLevel, Math.max(0, item.level));
                        }
                    }
                }
            }

            const savedEquipped = sys.localStorage.getItem(this.STORAGE_KEY_EQUIPPED_PETS);
            if (savedEquipped !== null) {
                const equippedArray = JSON.parse(savedEquipped);
                if (Array.isArray(equippedArray)) {
                    this._equippedPetIds = equippedArray.filter(item => typeof item === 'string');
                }
            }

            this._farmingPetId = sys.localStorage.getItem(this.STORAGE_KEY_FARMING_PET);
            this._miningPetId = sys.localStorage.getItem(this.STORAGE_KEY_MINING_PET);

            const savedFurniture = sys.localStorage.getItem(this.STORAGE_KEY_FURNITURE);
            if (savedFurniture !== null) {
                const furnitureArray = JSON.parse(savedFurniture);
                if (Array.isArray(furnitureArray)) {
                    this._purchasedFurnitureIds = furnitureArray.filter(item => typeof item === 'string');
                }
            }

            // 加载法宝装备与背包数据
            const savedEquippedRelics = sys.localStorage.getItem(this.STORAGE_KEY_EQUIPPED_RELICS);
            if (savedEquippedRelics !== null) {
                const parsedRelics = JSON.parse(savedEquippedRelics);
                if (parsedRelics && typeof parsedRelics === 'object') {
                    this._equippedRelics = {
                        WEAPON: parsedRelics.WEAPON || null,
                        ACCESSORY: parsedRelics.ACCESSORY || null,
                        GOURD: parsedRelics.GOURD || null
                    };
                }
            }

            const savedRelicInv = sys.localStorage.getItem(this.STORAGE_KEY_RELIC_INVENTORY);
            if (savedRelicInv !== null) {
                const parsedInv = JSON.parse(savedRelicInv);
                if (Array.isArray(parsedInv)) {
                    this._relicInventory = parsedInv;
                }
            }

            // 若背包为空，初始化默认法宝与合成胚子种子
            if (this._relicInventory.length === 0 && !this._equippedRelics.WEAPON && !this._equippedRelics.ACCESSORY && !this._equippedRelics.GOURD) {
                const initSword: IRelicData = {
                    id: 'relic_sword_init',
                    configId: 'relic_sword_vampire',
                    name: '吸血魔剑',
                    type: RelicSlotType.WEAPON,
                    star: 1,
                    level: 1,
                    baseBonus: 0.05,
                    description: RELIC_CONFIGS['relic_sword_vampire'].description
                };
                const initBowl: IRelicData = {
                    id: 'relic_bowl_init',
                    configId: 'relic_treasure_bowl',
                    name: '聚宝盆',
                    type: RelicSlotType.ACCESSORY,
                    star: 1,
                    level: 1,
                    baseBonus: 2.0,
                    description: RELIC_CONFIGS['relic_treasure_bowl'].description
                };
                const initGourd: IRelicData = {
                    id: 'relic_gourd_init',
                    configId: 'relic_gourd_swallow',
                    name: '吞天葫芦',
                    type: RelicSlotType.GOURD,
                    star: 1,
                    level: 1,
                    baseBonus: 0.05,
                    description: RELIC_CONFIGS['relic_gourd_swallow'].description
                };
                const extraSword1: IRelicData = { ...initSword, id: 'relic_sword_food1' };
                const extraSword2: IRelicData = { ...initSword, id: 'relic_sword_food2' };
                this._relicInventory.push(initSword, initBowl, initGourd, extraSword1, extraSword2);
            }

            // 建立对象引用关联：确保 _equippedRelics 指向 _relicInventory 中的相同实例
            this.linkRelicReferences();
        } catch (e) {
            log('[HomeManager] 从 sys.localStorage 加载数据异常: ', e);
        }
    }

    // ==========================================
    // 宠物出战与打工派遣接口
    // ==========================================

    /**
     * 获取当前已上阵出战的宠物 ID 列表
     */
    public getEquippedPetIds(): string[] {
        return [...this._equippedPetIds];
    }

    /**
     * 获取当前灵田打工的宠物 ID
     */
    public getFarmingPetId(): string | null {
        return this._farmingPetId;
    }

    /**
     * 获取当前矿脉打工的宠物 ID
     */
    public getMiningPetId(): string | null {
        return this._miningPetId;
    }

    /**
     * 上阵出战宠物
     * @param petId 宠物 ID
     */
    public equipPet(petId: string): boolean {
        const petMgr = PetCaptureManager.instance;
        if (!petMgr) return false;
        const pet = petMgr.getPetById(petId);
        if (!pet) {
            log(`[HomeManager] 上阵失败：未找到 ID 为 [${petId}] 的宠物`);
            return false;
        }

        // 检查是否已经在上阵中
        if (this._equippedPetIds.includes(petId)) {
            log(`[HomeManager] 宠物 [${pet.name}] 已经处于上阵状态`);
            return true;
        }

        // 境界限制上阵数量上限 Math.min(5, _currentRealmIndex + 1)
        const maxEquipCount = Math.min(5, this._currentRealmIndex + 1);
        if (this._equippedPetIds.length >= maxEquipCount) {
            log(`[HomeManager] 上阵失败：当前境界最多上阵 ${maxEquipCount} 只宠物`);
            return false;
        }

        // 不能把正在打工的宠物上阵（除非先解雇）
        if (petId === this._farmingPetId || petId === this._miningPetId) {
            log(`[HomeManager] 宠物 [${pet.name}] 正在洞府打工中，请先解除派遣`);
            return false;
        }

        this._equippedPetIds.push(petId);
        log(`[HomeManager] 宠物 [${pet.name}] 成功上阵！当前阵容数量: ${this._equippedPetIds.length}/${maxEquipCount}`);
        this.saveData();
        return true;
    }

    /**
     * 下阵出战宠物
     * @param petId 宠物 ID
     */
    public unequipPet(petId: string): boolean {
        const index = this._equippedPetIds.indexOf(petId);
        if (index >= 0) {
            this._equippedPetIds.splice(index, 1);
            log(`[HomeManager] 宠物 [${petId}] 成功下阵。`);
            this.saveData();
            return true;
        }
        return false;
    }

    /**
     * 派遣宠物去灵田打工
     * @param petId 宠物 ID (传 null 表示收回/解雇)
     */
    public dispatchFarming(petId: string | null): boolean {
        if (petId === null) {
            this._farmingPetId = null;
            log(`[HomeManager] 解除了灵田的宠物打工派遣`);
            this.saveData();
            return true;
        }

        const petMgr = PetCaptureManager.instance;
        if (!petMgr) return false;
        const pet = petMgr.getPetById(petId);
        if (!pet) return false;

        // 已经在灵田打工
        if (this._farmingPetId === petId) return true;

        // 检查是否在出战中
        if (this._equippedPetIds.includes(petId)) {
            log(`[HomeManager] 宠物 [${pet.name}] 正在出战阵容中，无法派遣去打工`);
            return false;
        }

        // 检查是否在矿脉打工
        if (this._miningPetId === petId) {
            this._miningPetId = null; // 从矿脉撤出
        }

        this._farmingPetId = petId;
        log(`[HomeManager] 宠物 [${pet.name}] 已成功派遣至【灵田】打工，材料产出加成 +${(this.getPetWorkBonus(petId) * 100).toFixed(0)}%`);
        this.saveData();
        return true;
    }

    /**
     * 派遣宠物去矿脉打工
     * @param petId 宠物 ID (传 null 表示收回/解雇)
     */
    public dispatchMining(petId: string | null): boolean {
        if (petId === null) {
            this._miningPetId = null;
            log(`[HomeManager] 解除了矿脉的宠物打工派遣`);
            this.saveData();
            return true;
        }

        const petMgr = PetCaptureManager.instance;
        if (!petMgr) return false;
        const pet = petMgr.getPetById(petId);
        if (!pet) return false;

        // 已经在矿脉打工
        if (this._miningPetId === petId) return true;

        // 检查是否在出战中
        if (this._equippedPetIds.includes(petId)) {
            log(`[HomeManager] 宠物 [${pet.name}] 正在出战阵容中，无法派遣去打工`);
            return false;
        }

        // 检查是否在灵田打工
        if (this._farmingPetId === petId) {
            this._farmingPetId = null; // 从灵田撤出
        }

        this._miningPetId = petId;
        log(`[HomeManager] 宠物 [${pet.name}] 已成功派遣至【矿脉】打工，灵石产出加成 +${(this.getPetWorkBonus(petId) * 100).toFixed(0)}%`);
        this.saveData();
        return true;
    }

    // ==========================================
    // 仙器法宝系统公有 API 接口 (Phase 10)
    // ==========================================

    /**
     * 获取指定部位已穿戴的法宝
     * @param slot 部位 (WEAPON | ACCESSORY | GOURD)
     */
    public getEquippedRelic(slot: RelicSlotType): IRelicData | null {
        return this._equippedRelics[slot] || null;
    }

    /**
     * 获取指定部位已穿戴的法宝 (别名接口)
     */
    public getEquippedRelicByType(slot: RelicSlotType): IRelicData | null {
        return this.getEquippedRelic(slot);
    }

    /**
     * 获取所有部位已穿戴的法宝字典
     */
    public getEquippedRelics(): Record<RelicSlotType, IRelicData | null> {
        return { ...this._equippedRelics };
    }

    /**
     * 设置法宝背包数据并重新关联对象引用
     */
    public setRelicInventory(inventory: IRelicData[]): void {
        this._relicInventory = inventory || [];
        this.linkRelicReferences();
        this.saveData();
    }

    /**
     * 设置已穿戴法宝映射并重新关联对象引用
     */
    public setEquippedRelics(equipped: Record<RelicSlotType, IRelicData | null>): void {
        this._equippedRelics = equipped || { WEAPON: null, ACCESSORY: null, GOURD: null };
        this.linkRelicReferences();
        this.saveData();
    }

    /**
     * 关联已装备法宝与背包法宝的对象引用，确保两处指向同一个 JS 对象实例
     */
    public linkRelicReferences(): void {
        for (const slot of [RelicSlotType.WEAPON, RelicSlotType.ACCESSORY, RelicSlotType.GOURD] as RelicSlotType[]) {
            const eq = this._equippedRelics[slot];
            if (eq) {
                const invItem = this._relicInventory.find(r => r.id === eq.id);
                if (invItem) {
                    this._equippedRelics[slot] = invItem;
                } else {
                    this._relicInventory.push(eq);
                }
            }
        }
    }

    /**
     * 根据 ID 在背包或已装备中查找法宝 (优先返回 _relicInventory 中的唯一实例)
     */
    public getRelicById(relicId: string): IRelicData | null {
        const invItem = this._relicInventory.find(r => r.id === relicId);
        if (invItem) return invItem;

        for (const slot of [RelicSlotType.WEAPON, RelicSlotType.ACCESSORY, RelicSlotType.GOURD] as RelicSlotType[]) {
            const eq = this._equippedRelics[slot];
            if (eq && eq.id === relicId) return eq;
        }
        return null;
    }

    /**
     * 判定当前是否穿戴了指定配置 ID 的法宝
     * @param configId 法宝配置 ID (如 'relic_sword_vampire', 'relic_treasure_bowl', 'relic_gourd_swallow')
     */
    public hasEquippedRelic(configId: string): boolean {
        for (const slot of [RelicSlotType.WEAPON, RelicSlotType.ACCESSORY, RelicSlotType.GOURD]) {
            const relic = this._equippedRelics[slot];
            if (relic && relic.configId === configId) {
                return true;
            }
        }
        return false;
    }

    /**
     * 穿戴法宝到指定部位 (从 _relicInventory 中获取唯一实例引用)
     * @param relicId 法宝实体 ID
     * @param slot 部位 (可选，默认使用法宝本身的 type)
     */
    public equipRelic(relicId: string, slot?: RelicSlotType): boolean {
        let relic = this._relicInventory.find(r => r.id === relicId);
        if (!relic) {
            relic = this.getRelicById(relicId);
            if (relic && !this._relicInventory.includes(relic)) {
                this._relicInventory.push(relic);
            }
        }

        if (!relic) {
            log(`[HomeManager] 穿戴法宝失败：未找到 ID 为 [${relicId}] 的法宝`);
            return false;
        }

        const targetSlot = slot || relic.type;
        this._equippedRelics[targetSlot] = relic;
        log(`[HomeManager] 成功穿戴法宝 [${relic.name}] 到部位 [${targetSlot}]`);
        this.saveData();
        return true;
    }

    /**
     * 卸下指定部位的法宝
     * @param slot 部位
     */
    public unequipRelic(slot: RelicSlotType): boolean {
        if (this._equippedRelics[slot]) {
            log(`[HomeManager] 成功卸下部位 [${slot}] 的法宝 [${this._equippedRelics[slot]!.name}]`);
            this._equippedRelics[slot] = null;
            this.saveData();
            return true;
        }
        return false;
    }

    /**
     * 升级法宝：消耗灵石与修仙材料
     * @param relicId 目标法宝 ID
     */
    public upgradeRelic(relicId: string): { success: boolean; message: string } {
        const relic = this.getRelicById(relicId);
        if (!relic) return { success: false, message: '未找到指定法宝' };

        const costStones = relic.level * 100;
        const costMaterials = relic.level * 10;

        if (this._spiritStones < costStones || this._materials < costMaterials) {
            return { success: false, message: `资源不足！升级需要 ${costStones} 灵石 与 ${costMaterials} 材料` };
        }

        this._spiritStones -= costStones;
        this._materials -= costMaterials;
        relic.level += 1;
        relic.baseBonus = parseFloat((relic.baseBonus * 1.1).toFixed(2));
        this.saveData();

        log(`[HomeManager] 法宝 [${relic.name}] 强化成功！当前等级: Lv.${relic.level}`);
        return { success: true, message: `法宝 [${relic.name}] 强化成功！当前等级: Lv.${relic.level}` };
    }

    /**
     * 合成升星法宝：校验并消耗 2 个同配置同星级胚子，星级 +1 (上限 5 星)
     * @param targetId 升星目标法宝 ID
     * @param material1Id 胚子材料 1 ID
     * @param material2Id 胚子材料 2 ID
     */
    public synthesizeRelic(targetId: string, material1Id: string, material2Id: string): { success: boolean; message: string } {
        if (targetId === material1Id || targetId === material2Id || material1Id === material2Id) {
            return { success: false, message: '不能使用相同法宝或目标法宝自身作为合成材料！' };
        }
        const target = this.getRelicById(targetId);
        const mat1 = this.getRelicById(material1Id);
        const mat2 = this.getRelicById(material2Id);

        if (!target || !mat1 || !mat2) {
            return { success: false, message: '找不到目标法宝或所需的 2 个合成胚子！' };
        }
        if (target.configId !== mat1.configId || target.configId !== mat2.configId) {
            return { success: false, message: '合成失败：必须使用相同配置的法宝胚子！' };
        }
        if (target.star !== mat1.star || target.star !== mat2.star) {
            return { success: false, message: '合成失败：必须使用相同星级的法宝胚子！' };
        }
        if (target.star >= 5) {
            return { success: false, message: '该法宝已达最高 5 星，无法继续合成！' };
        }

        // 若胚子在装备槽中，解除装备
        for (const slot of [RelicSlotType.WEAPON, RelicSlotType.ACCESSORY, RelicSlotType.GOURD] as RelicSlotType[]) {
            const eq = this._equippedRelics[slot];
            if (eq && (eq.id === material1Id || eq.id === material2Id)) {
                this._equippedRelics[slot] = null;
            }
        }

        // 移除 2 个材料胚子
        this.removeRelic(material1Id);
        this.removeRelic(material2Id);

        // 目标提升 1 星
        target.star += 1;
        target.baseBonus = parseFloat((target.baseBonus * 1.25).toFixed(2));
        this.saveData();

        log(`[HomeManager] 法宝 [${target.name}] 合成成功！升至 ${target.star} 星！`);
        return { success: true, message: `法宝 [${target.name}] 合成升星成功！当前升至 ${target.star} 星！` };
    }

    /**
     * 添加法宝到背包
     */
    public addRelic(relic: IRelicData): void {
        if (relic) {
            this._relicInventory.push(relic);
            this.saveData();
        }
    }

    /**
     * 从背包移除指定 ID 的法宝
     */
    public removeRelic(relicId: string): boolean {
        const idx = this._relicInventory.findIndex(r => r.id === relicId);
        if (idx >= 0) {
            this._relicInventory.splice(idx, 1);
            for (const slot of [RelicSlotType.WEAPON, RelicSlotType.ACCESSORY, RelicSlotType.GOURD] as RelicSlotType[]) {
                if (this._equippedRelics[slot] && this._equippedRelics[slot]!.id === relicId) {
                    this._equippedRelics[slot] = null;
                }
            }
            this.saveData();
            return true;
        }
        return false;
    }
}
