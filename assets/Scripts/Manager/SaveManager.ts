import { sys, log, warn, error } from 'cc';
import { HomeManager, RelicSlotType, IRelicData } from './HomeManager';
import { PetCaptureManager, PetEgg, AppraisedPet } from '../Logic/PetCaptureManager';

/** 完整持久化存档数据结构 */
export interface ISaveData {
    /** 存档格式版本号 */
    version: number;
    /** 存盘时间戳 (ms) */
    lastSaveTimestamp: number;
    /** 玩家基础与货币属性 */
    player: {
        realmIndex: number;
        spiritStones: number;
        materials: number;
    };
    /** 天赋节点等级记录 */
    talents: Array<{ id: string; level: number }>;
    /** 持有妖兽与妖兽蛋数据 */
    pets: {
        eggs: PetEgg[];
        appraised: AppraisedPet[];
    };
    /** 当前出战上阵的宠物唯一ID列表 */
    equippedPetIds?: string[];
    /** 当前派遣在灵田打工的宠物唯一ID */
    farmingPetId?: string | null;
    /** 当前派遣在矿脉打工的宠物唯一ID */
    miningPetId?: string | null;
    /** 已购买洞府家具 ID 列表 */
    furniture?: string[];
    /** 已穿戴法宝部位映射 */
    equippedRelics?: Record<RelicSlotType, IRelicData | null>;
    /** 法宝背包实体数据列表 */
    relicInventory?: IRelicData[];
    /** 吞天葫芦抓捕失败次数 */
    gourdFailCount?: number;
    /** 挂机离线起始时间戳 (ms) */
    lastOfflineTime: number;
}

/**
 * 统一存档与数据持久化管理器 (SaveManager)
 * 封装 Cocos Creator sys.localStorage 操作
 */
export class SaveManager {

    private static _instance: SaveManager | null = null;
    private readonly STORAGE_KEY = 'yokai_codex_save_v1';
    private readonly CURRENT_VERSION = 1;

    /** 内存中的当前存档缓存 */
    private _saveData: ISaveData | null = null;

    /**
     * 单例获取接口
     */
    public static get instance(): SaveManager {
        if (!this._instance) {
            this._instance = new SaveManager();
        }
        return this._instance;
    }

    private constructor() {}

    /**
     * 生成默认初始存档 (用于新玩家或存档损坏时的降级兜底)
     */
    public getDefaultSaveData(): ISaveData {
        return {
            version: this.CURRENT_VERSION,
            lastSaveTimestamp: Date.now(),
            player: {
                realmIndex: 0,
                spiritStones: 0,
                materials: 0
            },
            talents: [],
            pets: {
                eggs: [],
                appraised: []
            },
            furniture: [],
            equippedRelics: { WEAPON: null, ACCESSORY: null, GOURD: null },
            relicInventory: [],
            gourdFailCount: 0,
            lastOfflineTime: Date.now()
        };
    }

    /**
     * 执行全量数据存档 (Memory -> sys.localStorage)
     * @returns 是否成功保存
     */
    public save(): boolean {
        try {
            const homeMgr = HomeManager.instance;
            const petMgr = this.getPetCaptureManager();

            let realmIdx = 0;
            let stones = 0;
            let mats = 0;
            let offlineTime = Date.now();
            let talentsList: Array<{ id: string; level: number }> = [];
            let equippedIds: string[] = [];
            let farmId: string | null = null;
            let mineId: string | null = null;
            let furnitureList: string[] = [];
            let equippedRelicsMap: Record<RelicSlotType, IRelicData | null> = { WEAPON: null, ACCESSORY: null, GOURD: null };
            let relicInvList: IRelicData[] = [];

            if (homeMgr) {
                const realmInfo = homeMgr.getCurrentRealmInfo();
                realmIdx = Math.max(0, realmInfo.level - 1);
                stones = homeMgr.spiritStones;
                mats = homeMgr.materials;
                offlineTime = homeMgr.lastOfflineTime;
                talentsList = homeMgr.getAllTalents().map(t => ({ id: t.id, level: t.level }));
                equippedIds = homeMgr.getEquippedPetIds();
                farmId = homeMgr.getFarmingPetId();
                mineId = homeMgr.getMiningPetId();
                furnitureList = homeMgr.getPurchasedFurnitureIds();
                equippedRelicsMap = homeMgr.getEquippedRelics();
                relicInvList = homeMgr.getRelicInventory();
            } else if (this._saveData) {
                realmIdx = this._saveData.player.realmIndex;
                stones = this._saveData.player.spiritStones;
                mats = this._saveData.player.materials;
                offlineTime = this._saveData.lastOfflineTime;
                talentsList = this._saveData.talents;
                equippedIds = this._saveData.equippedPetIds || [];
                farmId = this._saveData.farmingPetId || null;
                mineId = this._saveData.miningPetId || null;
                furnitureList = this._saveData.furniture || [];
                equippedRelicsMap = this._saveData.equippedRelics || { WEAPON: null, ACCESSORY: null, GOURD: null };
                relicInvList = this._saveData.relicInventory || [];
            }

            let eggsList: PetEgg[] = [];
            let appraisedList: AppraisedPet[] = [];
            let gourdFails = 0;

            if (petMgr) {
                eggsList = petMgr.getPetEggs();
                appraisedList = petMgr.getAppraisedPets();
                gourdFails = petMgr.gourdFailCount;
            } else if (this._saveData) {
                if (this._saveData.pets) {
                    eggsList = this._saveData.pets.eggs || [];
                    appraisedList = this._saveData.pets.appraised || [];
                }
                gourdFails = this._saveData.gourdFailCount || 0;
            }

            const dataToSave: ISaveData = {
                version: this.CURRENT_VERSION,
                lastSaveTimestamp: Date.now(),
                player: {
                    realmIndex: realmIdx,
                    spiritStones: stones,
                    materials: mats
                },
                talents: talentsList,
                pets: {
                    eggs: eggsList,
                    appraised: appraisedList
                },
                equippedPetIds: equippedIds,
                farmingPetId: farmId,
                miningPetId: mineId,
                furniture: furnitureList,
                equippedRelics: equippedRelicsMap,
                relicInventory: relicInvList,
                gourdFailCount: gourdFails,
                lastOfflineTime: offlineTime
            };

            const jsonString = JSON.stringify(dataToSave);
            sys.localStorage.setItem(this.STORAGE_KEY, jsonString);
            this._saveData = dataToSave;
            log('[SaveManager] 数据持久化成功！时间戳:', dataToSave.lastSaveTimestamp);
            return true;
        } catch (e) {
            error('[SaveManager] 数据持久化保存异常:', e);
            return false;
        }
    }

    /**
     * 执行全量数据加载 (sys.localStorage -> Memory -> 各业务管理器)
     * @returns 读取到的 ISaveData 数据结构
     */
    public load(): ISaveData {
        try {
            const rawData = sys.localStorage.getItem(this.STORAGE_KEY);
            if (!rawData) {
                log('[SaveManager] 未发现本地存档，初始化默认存档。');
                this._saveData = this.getDefaultSaveData();
            } else {
                const parsed = JSON.parse(rawData) as ISaveData;
                if (parsed && typeof parsed.version === 'number') {
                    const defaultData = this.getDefaultSaveData();

                    // 校验 player, pets, talents 等核心字段，深层合并缺失/非法部分
                    const validPlayer = (parsed.player && typeof parsed.player === 'object') ? {
                        realmIndex: typeof parsed.player.realmIndex === 'number' ? parsed.player.realmIndex : defaultData.player.realmIndex,
                        spiritStones: typeof parsed.player.spiritStones === 'number' ? parsed.player.spiritStones : defaultData.player.spiritStones,
                        materials: typeof parsed.player.materials === 'number' ? parsed.player.materials : defaultData.player.materials
                    } : defaultData.player;

                    const validTalents = Array.isArray(parsed.talents) ? parsed.talents : defaultData.talents;

                    const rawEggs = parsed.pets && Array.isArray(parsed.pets.eggs) ? parsed.pets.eggs : defaultData.pets.eggs;
                    const rawAppraised = parsed.pets && Array.isArray(parsed.pets.appraised) ? parsed.pets.appraised : defaultData.pets.appraised;

                    // 兼容补全旧存档数据
                    const validEggs: PetEgg[] = rawEggs.map(egg => ({
                        ...egg,
                        element: egg.element || '金',
                        star: typeof egg.star === 'number' ? egg.star : 1,
                        isEvolved: typeof egg.isEvolved === 'boolean' ? egg.isEvolved : false
                    }));

                    const validAppraised: AppraisedPet[] = rawAppraised.map(pet => ({
                        ...pet,
                        monsterId: pet.monsterId || (pet.form ? pet.form.replace(/^(normal_|mutated_|evolved_)/, '') : 'monster_fox'),
                        element: pet.element || '金',
                        star: typeof pet.star === 'number' ? pet.star : 1,
                        isEvolved: typeof pet.isEvolved === 'boolean' ? pet.isEvolved : false
                    }));

                    const validPets = {
                        eggs: validEggs,
                        appraised: validAppraised
                    };

                    const validEquipped = Array.isArray(parsed.equippedPetIds) ? parsed.equippedPetIds : [];
                    const validFarming = typeof parsed.farmingPetId === 'string' ? parsed.farmingPetId : null;
                    const validMining = typeof parsed.miningPetId === 'string' ? parsed.miningPetId : null;
                    const validFurniture = Array.isArray(parsed.furniture) ? parsed.furniture : [];

                    // 兼容补全旧存档法宝数据
                    const defaultEquippedRelics: Record<RelicSlotType, IRelicData | null> = { WEAPON: null, ACCESSORY: null, GOURD: null };
                    const validEquippedRelics = (parsed.equippedRelics && typeof parsed.equippedRelics === 'object') ? {
                        WEAPON: parsed.equippedRelics.WEAPON || null,
                        ACCESSORY: parsed.equippedRelics.ACCESSORY || null,
                        GOURD: parsed.equippedRelics.GOURD || null
                    } : defaultEquippedRelics;

                    const rawRelicInv = Array.isArray(parsed.relicInventory) ? parsed.relicInventory : [];
                    const validRelicInventory: IRelicData[] = rawRelicInv.map(r => ({
                        id: r.id || `relic_${Date.now()}_${Math.random()}`,
                        configId: r.configId || 'relic_sword_vampire',
                        name: r.name || '法宝',
                        type: r.type || RelicSlotType.WEAPON,
                        star: typeof r.star === 'number' ? Math.min(5, Math.max(1, r.star)) : 1,
                        level: typeof r.level === 'number' ? Math.max(1, r.level) : 1,
                        baseBonus: typeof r.baseBonus === 'number' ? r.baseBonus : 0.05
                    }));

                    // 反序列化 equippedRelics 时建立相同的对象实例引用指向
                    for (const slot of [RelicSlotType.WEAPON, RelicSlotType.ACCESSORY, RelicSlotType.GOURD] as RelicSlotType[]) {
                        const eq = validEquippedRelics[slot];
                        if (eq) {
                            const invItem = validRelicInventory.find(r => r.id === eq.id);
                            if (invItem) {
                                validEquippedRelics[slot] = invItem;
                            } else {
                                validRelicInventory.push(eq);
                            }
                        }
                    }

                    const validGourdFailCount = typeof parsed.gourdFailCount === 'number' ? Math.max(0, parsed.gourdFailCount) : 0;

                    this._saveData = {
                        version: parsed.version,
                        lastSaveTimestamp: typeof parsed.lastSaveTimestamp === 'number' ? parsed.lastSaveTimestamp : defaultData.lastSaveTimestamp,
                        player: validPlayer,
                        talents: validTalents,
                        pets: validPets,
                        equippedPetIds: validEquipped,
                        farmingPetId: validFarming,
                        miningPetId: validMining,
                        furniture: validFurniture,
                        equippedRelics: validEquippedRelics,
                        relicInventory: validRelicInventory,
                        gourdFailCount: validGourdFailCount,
                        lastOfflineTime: typeof parsed.lastOfflineTime === 'number' ? parsed.lastOfflineTime : defaultData.lastOfflineTime
                    };

                    log('[SaveManager] 成功读取并校验本地存档，版本号:', parsed.version);
                } else {
                    warn('[SaveManager] 本地存档数据损坏，降级使用默认存档。');
                    this._saveData = this.getDefaultSaveData();
                }
            }
        } catch (e) {
            error('[SaveManager] 读取本地存档失败，降级使用默认存档:', e);
            this._saveData = this.getDefaultSaveData();
        }

        // 将读取到的存档分发应用给各管理器
        this.applySaveToManagers(this._saveData);
        return this._saveData;
    }

    /**
     * 将存档数据还原分配至具体管理器内存中
     * @param data 待恢复的存档结构
     */
    public applySaveToManagers(data: ISaveData) {
        if (!data) return;

        // 恢复 HomeManager 局外资源数据
        const homeMgr = HomeManager.instance;
        if (homeMgr) {
            if (data.player) {
                (homeMgr as any)._spiritStones = data.player.spiritStones || 0;
                (homeMgr as any)._materials = data.player.materials || 0;
                (homeMgr as any)._currentRealmIndex = data.player.realmIndex || 0;
            }
            if (data.lastOfflineTime) {
                (homeMgr as any)._lastOfflineTime = data.lastOfflineTime;
            }
            // 恢复上阵宠物与派遣打工宠物
            (homeMgr as any)._equippedPetIds = data.equippedPetIds || [];
            (homeMgr as any)._farmingPetId = data.farmingPetId || null;
            (homeMgr as any)._miningPetId = data.miningPetId || null;
            (homeMgr as any)._purchasedFurnitureIds = data.furniture || [];

            // 恢复法宝装备与背包数据并重建对象引用关联
            (homeMgr as any)._equippedRelics = data.equippedRelics || { WEAPON: null, ACCESSORY: null, GOURD: null };
            (homeMgr as any)._relicInventory = data.relicInventory || [];
            if (typeof (homeMgr as any).linkRelicReferences === 'function') {
                (homeMgr as any).linkRelicReferences();
            }
        }

        // 恢复 PetCaptureManager 背包与宠物数据
        const petManager = this.getPetCaptureManager();
        if (petManager) {
            petManager.clearAllData();
            if (data.pets && Array.isArray(data.pets.eggs)) {
                data.pets.eggs.forEach(egg => petManager.addPetEgg(egg));
            }
            if (data.pets && Array.isArray(data.pets.appraised)) {
                data.pets.appraised.forEach(pet => petManager.addAppraisedPet(pet));
            }
            if (typeof petManager.setGourdFailCount === 'function') {
                petManager.setGourdFailCount(data.gourdFailCount || 0);
            }
        }
    }

    /**
     * 重置并抹除本地存档
     */
    public resetSave() {
        try {
            sys.localStorage.removeItem(this.STORAGE_KEY);
            this._saveData = this.getDefaultSaveData();
            log('[SaveManager] 本地存档已被清空并重置。');
        } catch (e) {
            error('[SaveManager] 清空本地存档失败:', e);
        }
    }

    /**
     * 检查本地是否存在存档
     */
    public hasSaveData(): boolean {
        return sys.localStorage.getItem(this.STORAGE_KEY) !== null;
    }

    /**
     * 获取当前内存中的存档数据
     */
    public get saveData(): ISaveData | null {
        return this._saveData;
    }

    /**
     * 辅助查找 PetCaptureManager 实例
     */
    private getPetCaptureManager(): PetCaptureManager | null {
        return PetCaptureManager.instance;
    }
}
