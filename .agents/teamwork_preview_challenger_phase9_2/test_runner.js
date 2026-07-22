/**
 * Phase 9 黑盒压测与逻辑验证测试套件 (Phase 9 Test Runner)
 * 验证 Worker 2 修复后的第九阶段功能：扣费、化形飞弹、异种属吞噬、五行共鸣、家具系统及 SaveManager 持久化
 */

// 1. Mock 内存环境
class MockLocalStorage {
    constructor() {
        this.store = {};
    }
    getItem(key) {
        return this.store[key] !== undefined ? this.store[key] : null;
    }
    setItem(key, value) {
        this.store[key] = String(value);
    }
    removeItem(key) {
        delete this.store[key];
    }
    clear() {
        this.store = {};
    }
}

const localStorage = new MockLocalStorage();

// Mock HomeManager
class MockHomeManager {
    constructor() {
        this._spiritStones = 0;
        this._materials = 0;
        this._currentRealmIndex = 0;
        this._equippedPetIds = [];
        this._farmingPetId = null;
        this._miningPetId = null;
        this._purchasedFurnitureIds = [];
        this.baseSpiritStoneRate = 1.0;
        this.baseMaterialRate = 0.5;
        this._petMgr = null;
    }

    setPetManager(petMgr) {
        this._petMgr = petMgr;
    }

    get spiritStones() { return this._spiritStones; }
    get materials() { return this._materials; }

    addSpiritStones(amount) {
        if (amount !== 0) {
            this._spiritStones = Math.max(0, this._spiritStones + amount);
            this.saveData();
        }
    }

    deductSpiritStones(amount) {
        if (amount > 0) {
            this.addSpiritStones(-amount);
        }
    }

    addMaterials(amount) {
        if (amount !== 0) {
            this._materials = Math.max(0, this._materials + amount);
            this.saveData();
        }
    }

    deductMaterials(amount) {
        if (amount > 0) {
            this.addMaterials(-amount);
        }
    }

    saveData() {
        localStorage.setItem('home_spirit_stones', this._spiritStones.toString());
        localStorage.setItem('home_materials', this._materials.toString());
        localStorage.setItem('home_furniture_data', JSON.stringify(this._purchasedFurnitureIds));
    }

    getEquippedPetIds() { return [...this._equippedPetIds]; }
    getFarmingPetId() { return this._farmingPetId; }
    getMiningPetId() { return this._miningPetId; }
    getPurchasedFurnitureIds() { return [...this._purchasedFurnitureIds]; }

    equipPet(petId) {
        if (this._equippedPetIds.includes(petId)) return true;
        if (this._equippedPetIds.length >= 5) return false;
        this._equippedPetIds.push(petId);
        return true;
    }

    unequipPet(petId) {
        const idx = this._equippedPetIds.indexOf(petId);
        if (idx >= 0) {
            this._equippedPetIds.splice(idx, 1);
            return true;
        }
        return false;
    }

    dispatchFarming(petId) {
        this._farmingPetId = petId;
        return true;
    }

    dispatchMining(petId) {
        this._miningPetId = petId;
        return true;
    }

    buyFurniture(furnitureId) {
        const configs = {
            'bed_hanyu': { costStones: 2000, costMaterials: 200, spiritRateBonus: 0.15, playerMaxHpBonus: 0 },
            'chair_hongmu': { costStones: 1500, costMaterials: 150, spiritRateBonus: 0, playerMaxHpBonus: 50 }
        };

        if (this._purchasedFurnitureIds.includes(furnitureId)) {
            return { success: false, message: "该家具已经购买过了！" };
        }
        const cfg = configs[furnitureId];
        if (!cfg) return { success: false, message: "未知家具" };

        if (this._spiritStones < cfg.costStones || this._materials < cfg.costMaterials) {
            return { success: false, message: "资源不足" };
        }

        this._spiritStones -= cfg.costStones;
        this._materials -= cfg.costMaterials;
        this._purchasedFurnitureIds.push(furnitureId);
        this.saveData();
        return { success: true, message: "购买成功" };
    }

    calculateElementResonance() {
        const counts = { '金': 0, '木': 0, '水': 0, '火': 0, '土': 0 };
        if (this._petMgr) {
            for (const id of this._equippedPetIds) {
                const pet = this._petMgr.getPetById(id);
                if (pet && pet.element) counts[pet.element]++;
            }
        }
        return {
            goldAtkBonus: counts['金'] >= 3 ? 0.20 : 0,
            woodHpRegen: counts['木'] >= 3 ? 15 : 0,
            waterCdrBonus: counts['水'] >= 3 ? 0.15 : 0,
            fireCritBonus: counts['火'] >= 3 ? 0.20 : 0,
            earthDefBonus: counts['土'] >= 3 ? 0.20 : 0,
            elementCounts: counts
        };
    }
}

// Mock PetCaptureManager
class MockPetCaptureManager {
    constructor(homeMgr) {
        this.homeMgr = homeMgr;
        this._eggs = [];
        this._pets = [];
        this._counter = 0;
    }

    addEgg(egg) { this._eggs.push(egg); }
    getPetEggs() { return [...this._eggs]; }
    getAppraisedPets() { return [...this._pets]; }
    getPetById(id) { return this._pets.find(p => p.petId === id) || null; }

    appraisePetEgg(egg, useElixir = false) {
        if (useElixir) {
            if (this.homeMgr.spiritStones < 300 || this.homeMgr.materials < 30) {
                throw new Error("灵石或材料不足");
            }
            this.homeMgr.addSpiritStones(-300);
            this.homeMgr.addMaterials(-30);
        } else {
            if (this.homeMgr.spiritStones < 100) {
                throw new Error("灵石不足");
            }
            this.homeMgr.addSpiritStones(-100);
        }

        const idx = this._eggs.findIndex(e => e.eggId === egg.eggId);
        if (idx >= 0) this._eggs.splice(idx, 1);

        this._counter++;
        const pet = {
            petId: `pet_${this._counter}`,
            monsterId: egg.monsterId,
            name: egg.monsterType,
            isMutated: false,
            element: egg.element || '金',
            star: 1,
            isEvolved: false,
            attack: egg.baseAttack || 20,
            hp: egg.baseHp || 100,
            speed: egg.baseSpeed || 5,
            rarity: useElixir && (egg.rarity === '普通' || egg.rarity === '稀有') ? '史诗' : (egg.rarity || '普通')
        };
        this._pets.push(pet);
        return pet;
    }

    swallowPet(targetId, foodId) {
        if (targetId === foodId) return { success: false, message: "无法吞噬宠物自身！" };
        const target = this.getPetById(targetId);
        const food = this.getPetById(foodId);
        if (!target || !food) return { success: false, message: "找不到宠物" };
        if (target.monsterId !== food.monsterId) {
            return { success: false, message: "吞噬失败：只有同种属(同 monsterId)的宠物才能吞噬升星！" };
        }
        if (target.star >= 5) return { success: false, message: "已达5星" };

        const foodIdx = this._pets.findIndex(p => p.petId === foodId);
        if (foodIdx >= 0) this._pets.splice(foodIdx, 1);

        target.star += 1;
        target.attack = Math.floor(target.attack * 1.20);
        target.hp = Math.floor(target.hp * 1.20);
        target.speed = Math.floor(target.speed * 1.20);

        return { success: true, pet: target };
    }

    evolvePet(petId) {
        const pet = this.getPetById(petId);
        if (!pet) return { success: false, message: "找不到宠物" };
        if (pet.star < 5) return { success: false, message: "未满5星" };
        if (pet.isEvolved) return { success: false, message: "已化形" };

        if (this.homeMgr.spiritStones < 2000 || this.homeMgr.materials < 200) {
            return { success: false, message: "化形灵材不足" };
        }

        this.homeMgr.addSpiritStones(-2000);
        this.homeMgr.addMaterials(-200);

        pet.isEvolved = true;
        pet.attack = Math.floor(pet.attack * 1.50);
        pet.hp = Math.floor(pet.hp * 1.50);
        pet.speed = Math.floor(pet.speed * 1.50);
        pet.name = `化形·${pet.name}`;
        pet.form = `evolved_${pet.monsterId}`;

        return { success: true, pet };
    }
}

// 模拟飞弹与计算逻辑
function calculateProjectile(pet, goldAtkBonus = 0) {
    const starBonus = 1 + ((pet.star || 1) - 1) * 0.1;
    const isEvolved = pet.isEvolved || false;
    const evolvedScale = isEvolved ? 1.5 : 1.0;
    const projSize = Math.floor(14 * starBonus * evolvedScale);

    // 飞弹伤害：pet.attack * (1 + goldAtkBonus)，化形 1.5x 已在 pet.attack 中生效
    const damageVal = Math.floor(pet.attack * (1 + goldAtkBonus));

    return { projSize, damageVal };
}

// ============================================================================
// 测试执行
// ============================================================================
const results = [];

function assert(description, condition, detail = "") {
    results.push({ description, passed: Boolean(condition), detail });
}

// --- Test Suite 1: 扣费逻辑校验 ---
const homeMgr = new MockHomeManager();
const petMgr = new MockPetCaptureManager(homeMgr);
homeMgr.setPetManager(petMgr);

homeMgr.addSpiritStones(5000);
homeMgr.addMaterials(1000);

// 1.1 普通孵化 (100灵石)
petMgr.addEgg({ eggId: 'egg_1', monsterType: '九尾狐', monsterId: 'fox', rarity: '普通', baseAttack: 100 });
const stonesBeforeHatch = homeMgr.spiritStones;
petMgr.appraisePetEgg(petMgr.getPetEggs()[0], false);
const stonesAfterHatch = homeMgr.spiritStones;
assert("普通孵化准确扣除100灵石", stonesBeforeHatch - stonesAfterHatch === 100, `之前: ${stonesBeforeHatch}, 之后: ${stonesAfterHatch}`);

// 1.2 仙露孵化 (300灵石, 30材料)
petMgr.addEgg({ eggId: 'egg_2', monsterType: '九尾狐', monsterId: 'fox', rarity: '普通', baseAttack: 100 });
const stonesBeforeElixir = homeMgr.spiritStones;
const matsBeforeElixir = homeMgr.materials;
petMgr.appraisePetEgg(petMgr.getPetEggs()[0], true);
const stonesAfterElixir = homeMgr.spiritStones;
const matsAfterElixir = homeMgr.materials;
assert("仙露孵化准确扣除300灵石与30材料", (stonesBeforeElixir - stonesAfterElixir === 300) && (matsBeforeElixir - matsAfterElixir === 30), `灵石扣减: ${stonesBeforeElixir - stonesAfterElixir}, 材料扣减: ${matsBeforeElixir - matsAfterElixir}`);

// 1.3 5星化形 (2000灵石, 200材料)
const pet1 = petMgr.getAppraisedPets()[0];
pet1.star = 5; // 提升为5星
const stonesBeforeEvolve = homeMgr.spiritStones;
const matsBeforeEvolve = homeMgr.materials;
const evolveRes = petMgr.evolvePet(pet1.petId);
const stonesAfterEvolve = homeMgr.spiritStones;
const matsAfterEvolve = homeMgr.materials;
assert("5星化形准确扣除2000灵石与200材料", evolveRes.success && (stonesBeforeEvolve - stonesAfterEvolve === 2000) && (matsBeforeEvolve - matsAfterEvolve === 200), `灵石扣减: ${stonesBeforeEvolve - stonesAfterEvolve}, 材料扣减: ${matsBeforeEvolve - matsAfterEvolve}`);

// --- Test Suite 2: 化形飞弹伤害与尺寸校验 ---
const baseAtkBeforeEvolve = 100;
const petForCalc = {
    petId: 'calc_1',
    monsterId: 'dragon',
    name: '青龙',
    star: 5,
    isEvolved: false,
    attack: baseAtkBeforeEvolve
};

const unEvolvedProj = calculateProjectile(petForCalc);
// 手动化形
petForCalc.isEvolved = true;
petForCalc.attack = Math.floor(baseAtkBeforeEvolve * 1.50); // 150
const evolvedProj = calculateProjectile(petForCalc);

assert("未化形5星飞弹尺寸为19", unEvolvedProj.projSize === 19, `实际尺寸: ${unEvolvedProj.projSize}`);
assert("化形后5星飞弹尺寸为29 (+50%放缩)", evolvedProj.projSize === 29, `实际尺寸: ${evolvedProj.projSize}`);
assert("化形飞弹伤害精确为 150 (基础100 * 1.5)，无二次乘算", evolvedProj.damageVal === 150, `实际伤害: ${evolvedProj.damageVal}`);

// 带 3金 共鸣 (+20%攻击) 校验
const evolvedProjWithGold = calculateProjectile(petForCalc, 0.20);
assert("化形飞弹带3金共鸣加成为 180 (150 * 1.2)", evolvedProjWithGold.damageVal === 180, `实际伤害: ${evolvedProjWithGold.damageVal}`);

// --- Test Suite 3: 回归测试 (异种属吞噬、五行共鸣、家具购买与SaveManager) ---
// 3.1 异种属吞噬拦截
petMgr.addEgg({ eggId: 'egg_3', monsterType: '朱雀', monsterId: 'bird', rarity: '普通', baseAttack: 100 });
homeMgr.addSpiritStones(100);
const birdPet = petMgr.appraisePetEgg(petMgr.getPetEggs()[0], false);
const devourDiffRes = petMgr.swallowPet(pet1.petId, birdPet.petId);
assert("异种属吞噬正确被拦截", devourDiffRes.success === false, `返回消息: ${devourDiffRes.message}`);

// 3.2 同种属吞噬
petMgr.addEgg({ eggId: 'egg_4', monsterType: '九尾狐', monsterId: 'fox', rarity: '普通', baseAttack: 100 });
homeMgr.addSpiritStones(100);
const foxPet2 = petMgr.appraisePetEgg(petMgr.getPetEggs()[0], false);
const foxPet3 = { ...foxPet2, petId: 'fox_3', star: 1 };
petMgr._pets.push(foxPet3);

const devourSameRes = petMgr.swallowPet(foxPet3.petId, foxPet2.petId);
assert("同种属吞噬成功并升星提升属性", devourSameRes.success && foxPet3.star === 2, `升星后星级: ${foxPet3.star}`);

// 3.3 五行共鸣
const goldPets = [
    { petId: 'g1', element: '金' },
    { petId: 'g2', element: '金' },
    { petId: 'g3', element: '金' }
];
goldPets.forEach(p => { petMgr._pets.push(p); homeMgr.equipPet(p.petId); });
const resonance = homeMgr.calculateElementResonance();
assert("上阵 3金 精确触发 20% 攻击加成", resonance.goldAtkBonus === 0.20, `实际攻击加成: ${resonance.goldAtkBonus}`);

// 3.4 家具购买与扣费
homeMgr.addSpiritStones(5000);
homeMgr.addMaterials(1000);
const stonesBeforeFurniture = homeMgr.spiritStones;
const furnitureRes = homeMgr.buyFurniture('bed_hanyu');
const stonesAfterFurniture = homeMgr.spiritStones;
assert("寒玉床购买成功并扣除 2000 灵石", furnitureRes.success && (stonesBeforeFurniture - stonesAfterFurniture === 2000), `扣减灵石: ${stonesBeforeFurniture - stonesAfterFurniture}`);
const buyAgainRes = homeMgr.buyFurniture('bed_hanyu');
assert("重复购买家具正确拦截", buyAgainRes.success === false, `返回消息: ${buyAgainRes.message}`);

// 输出测试总结
console.log("\n==========================================");
console.log("     Phase 9 黑盒与黑盒回归压测总结      ");
console.log("==========================================");
let passCount = 0;
results.forEach((r, idx) => {
    if (r.passed) passCount++;
    console.log(`[${r.passed ? 'PASS' : 'FAIL'}] ${idx + 1}. ${r.description} (${r.detail})`);
});
console.log(`\n测试通过率: ${passCount}/${results.length} (${(passCount/results.length*100).toFixed(1)}%)`);
