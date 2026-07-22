# 《万妖录：躺平修仙》第九阶段核心需求技术探查与重构落地方案

## 一、探查摘要与架构总览

针对《万妖录：躺平修仙》第九阶段的 4 大核心需求，对位于 `assets/Scripts/` 目录下的 TypeScript 代码进行了全面的 read-only 探查。涉及到的关键文件包括：
- `Logic/PetCaptureManager.ts`：宠物抓捕、蛋生成、孵化鉴定与变异率判定
- `Logic/PetFollower.ts`：局内跟随宠物 AI、攻速/冷却、投射物生成与伤害/尺寸计算
- `Manager/HomeManager.ts`：局外挂机资源产率、境界/天赋、上阵与打工派遣、洞府持久化
- `Manager/SaveManager.ts`：全量 LocalStorage 序列化、反序列化、版本校验与补全分发
- `Manager/UIManager.ts`：UI 面板注册、动态加载与 Prefab 缺失时的 Pure-Code 防御构建机制
- `PlayerController.ts`：局内主角移动、自动攻击、面板属性计算与受击结算

本次探查旨在明确现存数据结构缺失点、属性计算链路、UI纯代码构建模式与存档升级路径，为后续开发实施提供清晰的落地方案。

---

## 二、六大核心技术点深入分析

### 1. 现有 `PetData` / 宠物属性数据结构缺失字段分析

#### (1) 现有定义分析 (`PetCaptureManager.ts:34-77`)
当前项目中关于妖兽/宠物的接口定义分为未鉴定的 `PetEgg` 与已鉴定的 `AppraisedPet`：

```typescript
// 现有 AppraisedPet 结构 (PetCaptureManager.ts:56-77)
export interface AppraisedPet {
    petId: string;        // 唯一ID
    name: string;         // 宠物名称
    isMutated: boolean;   // 是否变异
    attack: number;       // 攻击力
    hp: number;           // 生命值
    speed: number;        // 移动速度
    form: string;         // 外观标识 (如 "normal_fox" 或 "mutated_fox")
    rarity: PetRarity;    // 稀有度 ('普通' | '稀有' | '史诗' | '传说' | '神话')
    obtainTime: number;   // 获得时间
    appraiseTime: number; // 鉴定时间
}
```

#### (2) 缺失关键字段与原因
要实现 Phase 9 的核心玩法（吞噬升星、化形突破、五行共鸣），现存 `AppraisedPet` 存在以下明显缺失：
1. **`star: number`（星级）**：缺少星级记录（0星 ~ 5星），无法支持同卡/材料吞噬升级。
2. **`isEvolved: boolean`（化形状态）**：缺少化形突破标记，无法判断是否已触发高阶化形形态与属性暴涨。
3. **`element: PetElement`（五行属性）**：缺少五行属性记录（'金' | '木' | '水' | '火' | '土'），无法进行五行共鸣羁绊统计。
4. **`monsterId: string`（原种属/配置ID）**：`PetEgg` 中含有 `monsterId`，但鉴定转换为 `AppraisedPet` 后丢失了该字段。吞噬升星时需要校验是否为同种属宠物，因此必须持久化保留 `monsterId`（或 `speciesId`）。
5. **`starExp: number`（升星经验值）**：可选扩展，用于阶梯式吞噬计数。

#### (3) 补全后的接口重构设计
```typescript
export type PetElement = '金' | '木' | '水' | '火' | '土';

export interface PetEgg {
    eggId: string;
    monsterType: string;
    monsterId: string;
    obtainTime: number;
    rarity: PetRarity;
    element: PetElement; // 新增：蛋阶段即随机或指定生成五行属性
    baseAttack: number;
    baseHp: number;
    baseSpeed: number;
}

export interface AppraisedPet {
    petId: string;
    monsterId: string;   // 补齐：原种属ID (如 "monster_fox")
    name: string;
    isMutated: boolean;
    element: PetElement; // 新增：五行属性 ('金'|'木'|'水'|'火'|'土')
    star: number;        // 新增：星级 (0~5)
    isEvolved: boolean;  // 新增：是否已突破化形
    attack: number;
    hp: number;
    speed: number;
    form: string;        // 外观标识 (化形后更改为 "evolved_fox")
    rarity: PetRarity;
    obtainTime: number;
    appraiseTime: number;
}
```

---

### 2. `HomeManager.ts` 资源管理、上阵列表、家具购买与共鸣统计

#### (1) 资源与上阵现状分析 (`HomeManager.ts:92-133, 631-778`)
- **资源管理**：通过 `_spiritStones`（灵石）与 `_materials`（修仙材料）记录。挂机产率根据境界倍率 `REALM_CONFIGS[realmIndex].rateMultiplier`、天赋加成（摸鱼心法、聚灵符阵、卧榻吐纳）以及灵田/矿脉打工宠物的 `getPetWorkBonus()` 综合计算得出（`getSpiritStoneRate()`, `getMaterialRate()`）。
- **上阵管理**：使用 `_equippedPetIds: string[]` 保存已上阵宠物 ID，容量上限受当前境界限制（`Math.min(5, _currentRealmIndex + 1)`）。

#### (2) 家具装修系统 (Furniture System) 整合方案
要在 `HomeManager` 中支持洞府家具购买与挂机加成：
1. **定义家具配置**：
   ```typescript
   export interface IFurnitureConfig {
       id: string;
       name: string;
       type: 'bed' | 'table' | 'statue' | 'potted'; // 卧榻、茶几、神像、盆景
       costStones: number;
       costMaterials: number;
       spiritRateBonus: number;   // 灵石产率加成 (如 0.05 代表 +5%)
       materialRateBonus: number; // 材料产率加成
       globalAtkBonus: number;    // 主角攻击力加成 (%)
       description: string;
   }
   ```
2. **状态持久化**：
   - 增加 `_purchasedFurnitureIds: string[] = []`。
   - 增加 `STORAGE_KEY_FURNITURE = 'home_furniture_data'`。
3. **加成计算注入**：
   - 修改 `getSpiritStoneRate()` 和 `getMaterialRate()`，将已购买家具的产率加成直接叠加至天赋加成中。

#### (3) 五行属性共鸣羁绊 (Element Resonance) 统计方案
在 `HomeManager` 中新增 `calculateElementResonance()` 方法：
- 遍历 `_equippedPetIds` 找到对应的 `AppraisedPet` 数据。
- 统计 `金`、`木`、`水`、`火`、`土` 各元素的上阵数量。
- **羁绊激活规则**：
  - **同元素羁绊**：
    - **金系共鸣 (2/3只)**：暴击率 +10% / 暴击率 +20% & 暴击伤害 +30%
    - **木系共鸣 (2/3只)**：每秒回血 +1% / 每秒回血 +3% & 最大生命 +20%
    - **水系共鸣 (2/3只)**：冷却缩减 (CDR) +10% / CDR +20% & 每秒回血 +1.5%
    - **火系共鸣 (2/3只)**：攻击力 +15% / 攻击力 +35%
    - **土系共鸣 (2/3只)**：免伤/防御 +10% / 免伤/防御 +25%
  - **组合羁绊**：
    - **五行大圆满 (金木水火土各1只)**：全属性加成 +20%！
- `HomeManager` 提供 `public getElementResonanceBonus(): IResonanceBonus` 接口供 `PlayerController` 和 `PetFollower` 调用。

---

### 3. `PetFollower.ts` 投射物飞弹伤害与尺寸计算逻辑

#### (1) 现有逻辑分析 (`PetFollower.ts:31-38, 176-227`)
- **攻击冷却**：`attackCooldown = Math.max(0.35, 1.8 - (this.petData.speed * 0.05))`。
- **飞弹生成与尺寸**：在 `fireProjectile()` 中，创建 `projNode` 并赋予 `UITransform`，默认 `setContentSize(14, 14)`。
- **飞弹伤害**：直接取 `this.petData.attack`（`const damageVal = this.petData.attack;`）。

#### (2) 结合星级 (Star) 与化形 (Evolved) 的重构方案
1. **伤害算式**：
   - 考虑宠物基础攻击力、变异倍率、星级提升系数与化形系数：
   $$\text{FinalDamage} = \text{attack} \times (1 + \text{star} \times 0.25) \times (\text{isEvolved} ? 1.5 : 1.0)$$
2. **飞弹尺寸与外观动态算式**：
   - 基础尺寸 $14 \times 14$；
   - 每升 1 星，尺寸扩大 10%；
   - 化形突破后，尺寸额外放大 60%，并附加五行专属光效色彩（金-金色、木-翡翠绿、水-冰蓝、火-烈焰红、土-大地黄）：
   $$\text{ProjSize} = 14 \times (1 + \text{star} \times 0.1) \times (\text{isEvolved} ? 1.6 : 1.0)$$
3. **五行元素打击效果**：
   - 根据 `petData.element` 赋予飞弹特效色彩或在命中时触发小范围元素效果（例如火元素爆炸、木元素治愈主角）。

---

### 4. `PlayerController.ts` 数值属性计算点与战斗整合

#### (1) 现有代码分析 (`PlayerController.ts:22-48, 164-220`)
现有的 `PlayerController` 仅含有硬编码的 `maxHp = 100`、`attackDamage = 10`、`attackCooldown = 1.0`、`moveSpeed = 200`，缺少进阶战斗数值体系。

#### (2) 补充数值体系与计算方法 (`getFinalStats()`)
在 `PlayerController` 中扩展以下数值字段：
- **`critRate: number`**：暴击率（默认 5%）
- **`critMultiplier: number`**：暴击伤害倍率（默认 150%）
- **`hpRegenPerSec: number`**：每秒生命回复量（默认 0）
- **`cdr: number`**：冷却缩减（0.0 ~ 0.5 封顶）
- **`damageReduction: number`**：免伤/防御率（0.0 ~ 0.7 封顶）

#### (3) 数值汇聚与战斗接入
1. **`getFinalStats()` 聚合算式**：
   - **最终攻击力** = $(\text{baseAttack} + \text{level} \times 5) \times (1 + \text{ResonanceAtkBonus} + \text{FurnitureAtkBonus})$
   - **最终每秒回血** = $\text{maxHp} \times (\text{ResonanceHpRegenBonus} + \text{FurnitureHpRegenBonus})$
   - **最终 CDR** = $\text{ResonanceCdrBonus}$
   - **最终暴击率** = $0.05 + \text{ResonanceCritBonus}$
   - **最终免伤** = $\text{ResonanceDamageReductionBonus}$
2. **自动攻击与受击逻辑修正**：
   - **攻击开火**：实际冷却时间为 $\text{attackCooldown} \times (1 - \text{finalCDR})$。暴击判定：若 `Math.random() < finalCritRate`，伤害乘以 `critMultiplier` 并派发暴击提示。
   - **受到伤害**：实际承受伤害为 $\text{rawDamage} \times (1 - \text{finalDamageReduction})$。
   - **每秒回血**：在 `update(deltaTime)` 中按 `hpRegenPerSec * deltaTime` 持续回复生命值。

---

### 5. `UIManager.ts` 注册机制与 `AppraisalPanel.ts` 防御性纯代码构建

#### (1) `UIManager.ts` 回退机制 (`UIManager.ts:51-75`)
`UIManager.openUI(panelPath)` 在加载 Prefab 失败时，会触发 pure-code 兜底机制。需要在此处添加新面板的映射：

```typescript
// UIManager.ts (lines 61-71 扩展)
if (panelName === 'AppraisalPanel') {
    uiNode.addComponent(AppraisalPanel);
} else if (panelName === 'FurniturePanel') {
    uiNode.addComponent(FurniturePanel);
}
```

#### (2) `AppraisalPanel.ts` 纯代码构建方案
遵循 `TribulationPanel.ts` 和 `BattleUIPanel.ts` 的 `ensureUIElements()` 模式，在 `onLoad()` 时自动用 `UITransform` + `Sprite` + `Label` 搭建界面：
- **背景与布局**：720x1280 铺满，深蓝灰半透明色背景 (`Color(18, 18, 28, 240)`)。
- **头部**：标题 `【妖兽盲盒孵化鉴定】` 与 `未鉴定妖兽蛋数量: X` 文本。
- **列表显示区**：显示背包中当前的未鉴定蛋（显示稀有度颜色与获得时间）。
- **交互按钮**：
  - `【单次鉴定】`：调用 `PetCaptureManager.instance.appraisePetEgg(egg)`。
  - `【一键鉴定】`：循环鉴定所有蛋。
- **鉴定开蛋动画与变异璀璨特效**：
  - 鉴定瞬间播放节点缩放与旋转 `tween`。
  - 若触发变异 (`isMutated == true`)，生成金色光圈闪烁特效并展示 `变异·XXX` 文本，弹出“触发天道变异，属性翻倍！”大号提示。

---

### 6. `SaveManager.ts` 序列化/反序列化机制与向下兼容

#### (1) `ISaveData` 接口扩充 (`SaveManager.ts:6-32`)
在 `ISaveData` 中新增家具数据与补全宠物属性：

```typescript
export interface ISaveData {
    version: number;
    lastSaveTimestamp: number;
    player: {
        realmIndex: number;
        spiritStones: number;
        materials: number;
    };
    talents: Array<{ id: string; level: number }>;
    pets: {
        eggs: PetEgg[];
        appraised: AppraisedPet[]; // AppraisedPet 内部升级带有 star, isEvolved, element, monsterId
    };
    equippedPetIds?: string[];
    farmingPetId?: string | null;
    miningPetId?: string | null;
    furniture?: string[];       // 新增：已购买洞府家具 ID 列表
    lastOfflineTime: number;
}
```

#### (2) `save()` 与 `load()` 校验容错
- **`save()`**：提取 `HomeManager` 中的 `_purchasedFurnitureIds` 写入 `dataToSave.furniture`。
- **`load()` 向下兼容补全**：
  - 读取旧存档时，若 `appraised` 列表中宠物缺失 `star`、`isEvolved`、`element`、`monsterId`，在校验阶段自动赋默认兜底值（`star: 0`, `isEvolved: false`, `element: '金'`, `monsterId: 'monster_unknown'`）。
  - 若缺失 `furniture` 字段，默认初始化为空数组 `[]`。

---

## 三、各需求模块 (R1 - R4) 的重构落地实施计划

### R1. 宠物吞噬升星与化形系统落地步骤
1. **修改 `PetCaptureManager.ts`**：
   - 增加 `swallowPet(mainPetId: string, materialPetIds: string[]): { success: boolean, newStar: number, isEvolved: boolean }` 方法。
   - 校验逻辑：消耗同种属或同稀有度的宠物，增加主宠星级 `star`。
   - 当 `star` 达到 3 星时，自动触发化形：`isEvolved = true`，`form` 更新为 `evolved_${monsterId}`，攻击力额外提升 50%。
2. **修改 `PetFollower.ts`**：
   - 在 `fireProjectile()` 中接入星级与化形伤害算式及尺寸算式。
3. **修改 `HomeManager.ts`**：
   - 增加升星与化形后的挂机打工效率加成。

### R2. 盲盒孵化鉴定 UI 与变异率落地步骤
1. **修改 `PetCaptureManager.ts`**：
   - 在 `createPetEggFromMonster()` 中为生成的 `PetEgg` 随机赋予 `element` ('金'|'木'|'水'|'火'|'土')。
   - 在 `appraisePetEgg()` 中将 `element` 与 `monsterId` 正确继承给 `AppraisedPet`，初始 `star = 0`, `isEvolved = false`。
2. **新建/实现 `UI/AppraisalPanel.ts`**：
   - 纯代码构建鉴定面板 UI，绑定单抽与一键鉴定。
   - 实现变异炫彩金光动画及变异结果广播。
3. **修改 `UIManager.ts`**：
   - 在 `openUI()` 的回退构建逻辑中注册 `AppraisalPanel`。

### R3. 五行属性共鸣羁绊系统落地步骤
1. **修改 `HomeManager.ts`**：
   - 实现 `calculateElementResonance()`，根据上阵宠物计算金木水火土羁绊状态。
   - 提供 `getElementResonanceBonus()` 接口。
2. **修改 `PlayerController.ts`**：
   - 实现 `getFinalStats()` 属性聚合计算。
   - 战斗循环中应用暴击、CDR、每秒回血与免伤。
3. **修改 `PetFollower.ts`**：
   - 根据宠物的 `element` 调整飞弹外观颜色与碰撞附带的元素伤害属性。

### R4. 洞府家具装修系统落地步骤
1. **修改 `HomeManager.ts`**：
   - 引入 `IFurnitureConfig` 家具静态配置表（包含卧榻、茶几、神像、植物等）。
   - 实现 `buyFurniture(furnitureId: string)`、`getPurchasedFurniture()` 方法。
   - 将家具加成融合至 `getSpiritStoneRate()` 和 `getMaterialRate()`。
2. **修改 `SaveManager.ts`**：
   - 在 `ISaveData` 中新增 `furniture` 序列化与反序列化。
3. **新建/实现 `UI/FurniturePanel.ts`**（或整合至 Home UI）：
   - 防御性纯代码构建洞府家具购买与摆放界面。

---

## 四、验证与测试方法 (Verification Method)

1. **结构与编译验证**：
   - 检查 TypeScript 语法与接口类型兼容性，确保 `PetEgg` 与 `AppraisedPet` 新增字段无类型报错。
2. ** SaveManager 兼容性验证**：
   - 模拟旧版无 `star` / `element` / `furniture` 的 JSON 字符串进行 `load()`，验证反序列化时是否能优雅补充默认值而不崩溃。
3. **共鸣与数值逻辑验证**：
   - 实例化不同五行组合的上阵宠物列表，验证 `calculateElementResonance()` 输出的羁绊效果数值是否与设计公式完全匹配。
4. **UI 防御构建验证**：
   - 在无 `AppraisalPanel` 与 `FurniturePanel` 预制体的情况下调用 `UIManager.instance.openUI('UI/AppraisalPanel')`，验证纯代码节点与组件是否正常构建并弹出展示。
