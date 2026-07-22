# Phase 10 法宝系统（Relic System）全面架构分析与修改切入点报告 (`analysis.md`)

## 摘要 (Executive Summary)

本报告针对 Phase 10 法宝系统（Relic System）在项目 `YokaiCodex` 中的架构设计、相关模块代码切入点及数据流转进行了深入分析与全面梳理。法宝系统涉及局外法宝数据存储管理、三种核心法宝被动特效（吸血魔剑、聚宝盆、吞天葫芦）在局内战斗/刷怪/抓捕逻辑中的植入、纯代码 UI 装备面板（`EquipmentPanel.ts`）的防御性构建与注册，以及持久化存档兼容补齐。

---

## 1. `assets/Scripts/Manager/HomeManager.ts` 分析与修改切入点

### 1.1 现有结构分析
- **数据结构与属性**：
  - `_spiritStones`: 灵石储备（第 160 行）
  - `_materials`: 修仙材料储备（第 162 行）
  - `_equippedPetIds`: 上阵宠物唯一 ID 列表（第 173 行）
  - `_farmingPetId`, `_miningPetId`: 打工宠物唯一 ID（第 176-179 行）
  - `_purchasedFurnitureIds`: 已购家具 ID 列表（第 182 行）
- **持久化 Key 约定**：`STORAGE_KEY_SPIRIT_STONES`, `STORAGE_KEY_MATERIALS`, `STORAGE_KEY_EQUIPPED_PETS` 等（第 185-194 行）。
- **定位**：`HomeManager` 作为单例组件（`HomeManager.instance`），承担了局外资源管理、出战配置、离线挂机结算与持久化读写。法宝仓库与装备槽位的内存数据结构与操作接口最适合收拢在 `HomeManager` 中。

### 1.2 法宝实体与配置数据结构扩展设计
```typescript
/** 法宝部位槽位类型 */
export type RelicSlotType = 'WEAPON' | 'ACCESSORY' | 'GOURD';

/** 法宝配置接口 */
export interface IRelicConfig {
    configId: string;        // 配置 ID，如 'relic_sword_vampire', 'relic_treasure_bowl', 'relic_gourd_swallow'
    name: string;            // 法宝名称
    type: RelicSlotType;     // 装备部位：WEAPON (武器), ACCESSORY (饰品), GOURD (葫芦)
    description: string;     // 效果描述
    baseBonus: number;       // 基础加成数值
}

/** 法宝实体数据结构 */
export interface IRelicData {
    id: string;              // 唯一实体 ID (如 "relic_1721500000000_1")
    configId: string;        // 引用配置 ID
    name: string;            // 法宝名称
    type: RelicSlotType;     // 装备部位
    star: number;            // 当前星级 (1 ~ 5)
    level: number;           // 当前强化等级 (1 ~ Max)
    baseBonus: number;       // 当前属性加成数值
}

/** 预设 3 大核心法宝配置 */
export const RELIC_CONFIGS: Record<string, IRelicConfig> = {
    'relic_sword_vampire': {
        configId: 'relic_sword_vampire',
        name: '吸血魔剑',
        type: 'WEAPON',
        description: '降低 50% 基础攻击力；造成伤害时将伤害值的 5% 转化为主角 HP 回复。',
        baseBonus: 0.05
    },
    'relic_treasure_bowl': {
        configId: 'relic_treasure_bowl',
        name: '聚宝盆',
        type: 'ACCESSORY',
        description: '怪物击杀掉落灵石数量翻倍；同时使怪物基础移动速度提升 20%。',
        baseBonus: 2.0
    },
    'relic_gourd_swallow': {
        configId: 'relic_gourd_swallow',
        name: '吞天葫芦',
        type: 'GOURD',
        description: '抓捕失败时增加 5% 额外抓捕成功率（失败计数可叠加）；抓捕成功后重置。',
        baseBonus: 0.05
    }
};
```

### 1.3 `HomeManager` 中的数据结构与操作接口切入点
在 `HomeManager` 类内部新增私有属性与公有操作方法：

```typescript
// --- 私有成员变量 ---
private _relicInventory: IRelicData[] = [];
private _equippedRelics: Record<RelicSlotType, string | null> = {
    WEAPON: null,
    ACCESSORY: null,
    GOURD: null
};

// --- 公有访问与判定方法 ---
public getRelicInventory(): IRelicData[] { return [...this._relicInventory]; }
public getEquippedRelics(): Record<RelicSlotType, string | null> { return { ...this._equippedRelics }; }

public getRelicById(relicId: string): IRelicData | null {
    return this._relicInventory.find(r => r.id === relicId) || null;
}

public getEquippedRelicByType(type: RelicSlotType): IRelicData | null {
    const relicId = this._equippedRelics[type];
    return relicId ? this.getRelicById(relicId) : null;
}

/** 判定是否装备了特定配置 ID 的法宝 */
public hasEquippedRelic(configId: string): boolean {
    for (const type of ['WEAPON', 'ACCESSORY', 'GOURD'] as RelicSlotType[]) {
        const relicId = this._equippedRelics[type];
        if (relicId) {
            const relic = this.getRelicById(relicId);
            if (relic && relic.configId === configId) return true;
        }
    }
    return false;
}

/** 穿戴法宝 */
public equipRelic(relicId: string): boolean {
    const relic = this.getRelicById(relicId);
    if (!relic) return false;
    this._equippedRelics[relic.type] = relicId;
    this.saveData();
    return true;
}

/** 脱下指定部位法宝 */
public unequipRelic(type: RelicSlotType): boolean {
    if (this._equippedRelics[type]) {
        this._equippedRelics[type] = null;
        this.saveData();
        return true;
    }
    return false;
}

/** 升级法宝：消耗灵石与修仙材料 */
public upgradeRelic(relicId: string): { success: boolean; message: string } {
    const relic = this.getRelicById(relicId);
    if (!relic) return { success: false, message: '未找到指定法宝' };
    
    const costStones = relic.level * 100;
    const costMaterials = relic.level * 10;
    if (this._spiritStones < costStones || this._materials < costMaterials) {
        return { success: false, message: `资源不足！需要 ${costStones} 灵石与 ${costMaterials} 材料` };
    }
    
    this._spiritStones -= costStones;
    this._materials -= costMaterials;
    relic.level += 1;
    relic.baseBonus = parseFloat((relic.baseBonus * 1.1).toFixed(2));
    this.saveData();
    return { success: true, message: `法宝 [${relic.name}] 升级成功！当前等级: ${relic.level}` };
}

/** 合成升星法宝：消耗 2 个同配置同星级法宝胚子，星级 +1 (上限 5 星) */
public fuseRelicStar(targetRelicId: string, foodRelicId: string): { success: boolean; message: string } {
    if (targetRelicId === foodRelicId) return { success: false, message: '不能与自身合成！' };
    const target = this.getRelicById(targetRelicId);
    const food = this.getRelicById(foodRelicId);
    if (!target || !food) return { success: false, message: '找不到目标法宝或材料法宝！' };
    if (target.configId !== food.configId) return { success: false, message: '只有同种配置的法宝才能合成升星！' };
    if (target.star !== food.star) return { success: false, message: '只有相同星级的法宝才能合成升星！' };
    if (target.star >= 5) return { success: false, message: '法宝已达最高 5 星！' };

    // 如果材料法宝处于装备状态，自动脱下
    for (const slot of ['WEAPON', 'ACCESSORY', 'GOURD'] as RelicSlotType[]) {
        if (this._equippedRelics[slot] === foodRelicId) {
            this._equippedRelics[slot] = null;
        }
    }

    // 移除消耗胚子并提升目标星级
    this.removeRelic(foodRelicId);
    target.star += 1;
    target.baseBonus = parseFloat((target.baseBonus * 1.25).toFixed(2));
    this.saveData();
    return { success: true, message: `法宝 [${target.name}] 合成升星成功！升至 ${target.star} 星！` };
}

public addRelic(relic: IRelicData) { this._relicInventory.push(relic); this.saveData(); }
public removeRelic(relicId: string): boolean {
    const idx = this._relicInventory.findIndex(r => r.id === relicId);
    if (idx >= 0) {
        this._relicInventory.splice(idx, 1);
        return true;
    }
    return false;
}
```

---

## 2. `assets/Scripts/PlayerController.ts` 分析与修改切入点

### 2.1 现有攻击、HP与伤害结算逻辑
- **攻击力计算**：`PlayerController` 中定义了基础 `attackDamage`（默认 10，第 41 行）。在 `executeAutoAttack()`（第 218-235 行）中，加上 3 金共鸣羁绊 `goldAtkBonus` 计算最终伤害 `finalDamage`，并调用 `enemyComp.takeDamage(finalDamage)`。
- **随行宠物飞弹伤害**：`PetFollower.ts`（第 242 行）独立计算宠物攻击力 `damageVal` 并调用 `enemyComp.takeDamage(damageVal)`。
- **HP 恢复机制**：目前有 `handleResonanceHpRegen`（3 木共鸣每秒回血，第 126-139 行）与 `restoreFullHp()`（满血恢复，第 280-286 行），其中使用了统一的广播 `EventManager.emit(UIEvent.UPDATE_HP, { currentHp, maxHp })` 以及 `director.emit('UI_Event_Update_HP', currentHp, maxHp)`。

### 2.2 吸血魔剑 (`relic_sword_vampire`) 攻击力 50% 削减植入
在 `PlayerController` 中，攻击力结算切入点建议收拢在 `getEffectiveAttackDamage()` 或直接在 `executeAutoAttack()` 基础计算处：

```typescript
/** 获取玩家当前有效基础攻击力 (计算吸血魔剑 50% 削减) */
public getEffectiveAttackDamage(): number {
    let baseAtk = this.attackDamage;
    const homeMgr = HomeManager.instance;
    if (homeMgr && homeMgr.hasEquippedRelic('relic_sword_vampire')) {
        baseAtk *= 0.5; // 吸血魔剑: 削减 50% 基础攻击力
    }
    return baseAtk;
}
```
在 `executeAutoAttack()` 中替换 `this.attackDamage` 为 `this.getEffectiveAttackDamage()`。

### 2.3 吸血魔剑 5% 吸血恢复与控制台日志
由于造成伤害来源包含主角攻击/技能与随行宠物飞弹命中，最优雅且无侵入的修改方式是在 `PlayerController` 提供静态或实例吸血触发方法 `triggerVampireLifesteal(damage: number)`：

```typescript
/**
 * 触发吸血魔剑生命恢复判定
 * @param damage 造成的实际伤害数值
 */
public triggerVampireLifesteal(damage: number) {
    if (damage <= 0) return;
    const homeMgr = HomeManager.instance;
    if (homeMgr && homeMgr.hasEquippedRelic('relic_sword_vampire')) {
        const recoverHp = Math.max(1, Math.floor(damage * 0.05));
        const prevHp = this.currentHp;
        this.currentHp = Math.min(this.maxHp, this.currentHp + recoverHp);
        const actualHeal = this.currentHp - prevHp;

        log(`[吸血魔剑] 造成 ${damage} 伤害，为主角恢复 ${actualHeal} HP`);

        // 刷新的 UI 血条
        EventManager.emit(UIEvent.UPDATE_HP, { currentHp: this.currentHp, maxHp: this.maxHp });
        director.emit('UI_Event_Update_HP', this.currentHp, this.maxHp);
    }
}
```
**调用切入点**：
1. `PlayerController.ts` 中的 `executeAutoAttack()` 在 `enemyComp.takeDamage(finalDamage)` 之后调用 `this.triggerVampireLifesteal(finalDamage)`。
2. `PetFollower.ts` 中的 `fireProjectile()` 飞弹命中 `enemyComp.takeDamage(damageVal)` 之后，通过获取主角组件调用 `playerComp.triggerVampireLifesteal(damageVal)`。

---

## 3. `assets/Scripts/Logic/Enemy.ts` 分析与修改切入点

### 3.1 现有掉落灵石与移动速度逻辑
- **掉落灵石**：`Enemy.ts` 的 `die()` 方法中（第 262-265 行）检查 `this.dropConfig.spirit_stones`，直接调用 `HomeManager.instance.addSpiritStones(dropConfig.spirit_stones)`。
- **移动速度**：`Enemy.ts` 中定义了 `public moveSpeed: number = 100;`（第 24 行），并在 `init(...)` 方法中赋值 `this.moveSpeed = speed;`（第 78-80 行）。在 `handleChase(...)`（第 192 行）中依照 `this.moveSpeed * deltaTime` 进行移动。

### 3.2 聚宝盆 (`relic_treasure_bowl`) 掉落翻倍植入
在 `Enemy.ts` 的 `die()` 掉落逻辑中增加聚宝盆检测：

```typescript
// 处理精英怪与怪物掉落
if (this.dropConfig && this.dropConfig.spirit_stones && HomeManager.instance) {
    let stonesEarned = this.dropConfig.spirit_stones;
    if (HomeManager.instance.hasEquippedRelic('relic_treasure_bowl')) {
        stonesEarned *= 2; // 聚宝盆掉落翻倍
        log(`[聚宝盆] 触发宝物光环！掉落灵石翻倍: ${this.dropConfig.spirit_stones} -> ${stonesEarned}`);
    }
    HomeManager.instance.addSpiritStones(stonesEarned);
    log(`[Enemy ${this.node.name}] 怪物掉落灵石 +${stonesEarned}`);
}
```

### 3.3 聚宝盆 (`relic_treasure_bowl`) 怪物移速 +20% 植入
在 `Enemy.ts` 的 `init(...)` 初始化移速逻辑中增加聚宝盆检测：

```typescript
if (speed !== undefined && speed > 0) {
    let finalSpeed = speed;
    const homeMgr = HomeManager.instance;
    if (homeMgr && homeMgr.hasEquippedRelic('relic_treasure_bowl')) {
        finalSpeed *= 1.20; // 聚宝盆副作用：怪物基础移速提升 20%
        log(`[聚宝盆] 聚宝盆影响，怪物 [${this.node.name}] 基础移动速度提升 20%: ${speed} -> ${finalSpeed}`);
    }
    this.moveSpeed = finalSpeed;
}
```

---

## 4. `assets/Scripts/Logic/PetCaptureManager.ts` 分析与修改切入点

### 4.1 现有抓捕与概率计算机制
- `calculateCaptureRate(monster, itemBonus)`（第 157-175 行）：根据怪物极值计算 `hpLossRatio = 1 - (currentHp / maxHp)`，概率公式为 `this.baseCaptureRate + (hpLossRatio * this.executeBonusWeight) + itemBonus`。
- `attemptCapture(monster, itemBonus)`（第 183-198 行）：计算概率并使用 `Math.random() < successRate` 随机判定。

### 4.2 吞天葫芦 (`relic_gourd_swallow`) 失败计数器与加成植入
- **私有变量定义**：在 `PetCaptureManager` 中新增 `private _gourdFailCount: number = 0;`。
- **修改 `calculateCaptureRate`**：

```typescript
public calculateCaptureRate(monster: CaptureMonsterInput, itemBonus: number = 0): number {
    if (!monster || monster.maxHp <= 0) return 0;
    const maxHp = monster.maxHp;
    const currentHp = Math.max(0, Math.min(monster.currentHp, maxHp));
    const hpLossRatio = 1 - (currentHp / maxHp);

    let extraGourdRate = 0;
    const homeMgr = HomeManager.instance;
    if (homeMgr && homeMgr.hasEquippedRelic('relic_gourd_swallow')) {
        extraGourdRate = this._gourdFailCount * 0.05; // 每次抓捕失败累加 5% 概率
    }

    const totalRate = this.baseCaptureRate + (hpLossRatio * this.executeBonusWeight) + itemBonus + extraGourdRate;
    return Math.min(1.0, Math.max(0.0, totalRate));
}
```

- **修改 `attemptCapture`**：

```typescript
public attemptCapture(
    monster: { currentHp: number; maxHp: number; name?: string; id?: string },
    itemBonus: number = 0
): PetEgg | null {
    const successRate = this.calculateCaptureRate(monster, itemBonus);
    const roll = Math.random();

    const isGourdEquipped = HomeManager.instance?.hasEquippedRelic('relic_gourd_swallow');

    if (roll < successRate) {
        // 抓捕成功：如果穿戴吞天葫芦，重置失败计数器
        if (isGourdEquipped) {
            log(`[吞天葫芦] 抓捕成功！重置失败计数器 (原累计失败次数: ${this._gourdFailCount})`);
            this._gourdFailCount = 0;
        }
        const egg = this.createPetEggFromMonster(monster);
        this.addPetEgg(egg);
        return egg;
    } else {
        // 抓捕失败：如果穿戴吞天葫芦，失败计数器 +1
        if (isGourdEquipped) {
            this._gourdFailCount++;
            log(`[吞天葫芦] 抓捕失败！失败计数器 +1 (当前累计: ${this._gourdFailCount}, 下次额外加成: ${(this._gourdFailCount * 5)}%)`);
        }
        return null;
    }
}
```

---

## 5. `assets/Scripts/Manager/UIManager.ts` 与纯代码 `EquipmentPanel.ts`

### 5.1 现有 UI 面板构建与注册模式
- 在 `UIManager.ts`（第 64-78 行）的 `openUI()` 方法中，当 `resources.load` 预制体不存在时，回退到 `new Node(panelName)` 并挂载对应的 UI 组件（如 `AppraisalPanel`, `FurniturePanel`）。
- 组件（如 `AppraisalPanel.ts`）在 `onLoad` 中通过纯代码 `ensureUIElements()` 动态创建节点、Sprite 背景、Label 标题、Button 交互按钮并布局。

### 5.2 `UIManager.ts` 注册修改切入点
在 `UIManager.openUI()` 的条件判断分支中加入 `EquipmentPanel`：

```typescript
} else if (panelName === 'EquipmentPanel') {
    uiNode.addComponent(EquipmentPanel);
}
```

### 5.3 `EquipmentPanel.ts` 纯代码构建架构设计
新建 `assets/Scripts/UI/EquipmentPanel.ts`，包含以下模块与功能：
1. **背景与框架构建**：720x1280 黑色半透明背景、标题 `【 法宝装备与炼制面板 】`。
2. **装备槽位展示区 (Section 1: Equipped Relics)**：
   - 3 个槽位卡片：武器 (`WEAPON`)、饰品 (`ACCESSORY`)、葫芦 (`GOURD`)。
   - 展示当前部位已装备法宝的图标/名字/星级/强化等级；无装备时显示“未装备”。
   - 包含【脱下】按钮。
3. **法宝背包列表区 (Section 2: Relic Inventory)**：
   - 遍历 `HomeManager.instance.getRelicInventory()` 渲染法宝卡片。
   - 卡片上展示：法宝名称、星级（★1~5）、等级（Lv.X）、加成效果。
   - 按钮组：
     - 【装备】：调用 `HomeManager.instance.equipRelic(relic.id)`。
     - 【升级】：消耗灵石与材料，调用 `HomeManager.instance.upgradeRelic(relic.id)`。
     - 【合成升星】：选择背包中同配置同星级胚子，调用 `HomeManager.instance.fuseRelicStar(targetId, foodId)`。
4. **状态同步刷新**：`refreshDisplay()` 在面板 `onEnable` 及任何按钮操作后触发，更新灵石/材料/槽位/背包展示。

---

## 6. `assets/Scripts/Manager/SaveManager.ts` 分析与修改切入点

### 6.1 现有 `ISaveData` 结构与 `save()` / `load()`
- `ISaveData` 定义了版本号、`player`（境界、灵石、材料）、`talents`、`pets`（eggs, appraised）、`equippedPetIds`、`furniture`、`lastOfflineTime`。
- `save()`（第 87-165 行）：从 `HomeManager` 和 `PetCaptureManager` 提取内存状态，序列化为 JSON 存入 `sys.localStorage`。
- `load()`（第 171-247 行）：解析 JSON，校验各属性类型，对旧存档补充默认值，并通过 `applySaveToManagers()` 恢复到内存中。

### 6.2 法宝数据扩展与旧存档兼容切入点

1. **`ISaveData` 接口扩展**：

```typescript
export interface ISaveData {
    // ... 原有字段 ...
    /** 已穿戴法宝部位索引 (WEAPON, ACCESSORY, GOURD -> relicId) */
    equippedRelics?: Record<RelicSlotType, string | null>;
    /** 法宝背包实体数据列表 */
    relicInventory?: IRelicData[];
}
```

2. **`save()` 逻辑扩展**：

```typescript
let equippedRelicsMap: Record<RelicSlotType, string | null> = { WEAPON: null, ACCESSORY: null, GOURD: null };
let relicInvList: IRelicData[] = [];

if (homeMgr) {
    equippedRelicsMap = homeMgr.getEquippedRelics();
    relicInvList = homeMgr.getRelicInventory();
}

// 写入 dataToSave 结构
dataToSave.equippedRelics = equippedRelicsMap;
dataToSave.relicInventory = relicInvList;
```

3. **`load()` 旧存档兼容补齐逻辑**：

```typescript
const defaultEquippedRelics: Record<RelicSlotType, string | null> = { WEAPON: null, ACCESSORY: null, GOURD: null };
const validEquippedRelics = (parsed.equippedRelics && typeof parsed.equippedRelics === 'object')
    ? {
        WEAPON: typeof parsed.equippedRelics.WEAPON === 'string' ? parsed.equippedRelics.WEAPON : null,
        ACCESSORY: typeof parsed.equippedRelics.ACCESSORY === 'string' ? parsed.equippedRelics.ACCESSORY : null,
        GOURD: typeof parsed.equippedRelics.GOURD === 'string' ? parsed.equippedRelics.GOURD : null
      }
    : defaultEquippedRelics;

const rawRelicInv = Array.isArray(parsed.relicInventory) ? parsed.relicInventory : [];
const validRelicInventory: IRelicData[] = rawRelicInv.map(r => ({
    id: r.id || `relic_${Date.now()}_${Math.random()}`,
    configId: r.configId || 'relic_sword_vampire',
    name: r.name || '法宝',
    type: r.type || 'WEAPON',
    star: typeof r.star === 'number' ? Math.min(5, Math.max(1, r.star)) : 1,
    level: typeof r.level === 'number' ? Math.max(1, r.level) : 1,
    baseBonus: typeof r.baseBonus === 'number' ? r.baseBonus : 0.05
}));

this._saveData.equippedRelics = validEquippedRelics;
this._saveData.relicInventory = validRelicInventory;
```

4. **`applySaveToManagers()` 恢复映射**：

```typescript
if (homeMgr) {
    (homeMgr as any)._equippedRelics = data.equippedRelics || { WEAPON: null, ACCESSORY: null, GOURD: null };
    (homeMgr as any)._relicInventory = data.relicInventory || [];
}
```

---

## 结论与后续实施路线图
1. **模块隔离清晰**：法宝仓库数据及状态存在 `HomeManager.ts` 中，与现有宠物、家具保持同等架构规范。
2. **逻辑切入点明确**：吸血魔剑植入 `PlayerController.ts`（伤害判定）及 `PetFollower.ts`；聚宝盆植入 `Enemy.ts`（掉落与移速）；吞天葫芦植入 `PetCaptureManager.ts`（失败计数与抓捕概率）。
3. **UI 与存档防破损**：`EquipmentPanel.ts` 沿用全项目的纯代码防御构建模式；`SaveManager.ts` 完备处理旧存档缺失 `relics` 属性的自动兼容兜底。
