# 《万妖录：躺平修仙》第九阶段代码修改明细 (changes.md)

## 修改概览
本次重构与开发全面覆盖了第九阶段的 4 大核心需求 (R1 - R4)，在确保真实逻辑与数据计算的基础上，实现了无硬编码、防御性纯代码构建及对旧版本存档的向下兼容。

---

## 修改文件清单与具体变更说明

### 1. `assets/Scripts/Logic/PetCaptureManager.ts`
- **接口扩展**：
  - 导出 `PetElement` 类型 (`'金' | '木' | '水' | '火' | '土'`)。
  - `PetEgg` 增加 `element: PetElement`, `star: number` (默认 1), `isEvolved: boolean` (默认 false)。
  - `AppraisedPet` 增加 `monsterId: string`, `element: PetElement`, `star: number` (1-5), `isEvolved: boolean` (默认 false)。
- **鉴定与盲盒接口更新 (`appraisePetEgg`)**：
  - 支持普通孵化 (消耗 100 灵石, 5% 变异率) 与仙露孵化 (消耗 300 灵石 + 30 材料, 15% 变异率, 紫色史诗保底)。
  - 严格校验并扣除 `HomeManager.instance` 中的灵石与材料。
- **吞噬升星接口 (`swallowPet` / `devourPet`)**：
  - 校验目标与材料宠物是否存在且为同名/同种属 (`monsterId`)。
  - 最高提升至 5 星，每升 1 星攻击、生命、速度提升 20%。自动将材料宠物从上阵/打工列表中解雇并扣除。
- **化形突破接口 (`evolvePet`)**：
  - 校验满 5 星且未化形，校验并消耗 `HomeManager.instance` 中的 2000 灵石与 200 材料。
  - 化形后属性额外 +50%，名称加上 `"化形·"` 前缀，`form` 更新为 `evolved_${monsterId}`。

### 2. `assets/Scripts/Manager/HomeManager.ts`
- **家具配置与购买管理 (R4)**：
  - 引入 `IFurnitureConfig` 与 `FURNITURE_CONFIGS` 静态数据表：
    - `bed_hanyu`: 极品寒玉床 (2000 灵石, 200 材料) -> 挂机收益速率 +15%。
    - `chair_hongmu`: 红木躺椅 (1500 灵石, 150 材料) -> 主角初始生命上限 +50。
  - 实现 `buyFurniture(id)` 购买与扣费逻辑，并在 `getSpiritStoneRate()` 中叠加家具挂机效率加成。
  - 提供 `getFurnitureMaxHpBonus()` 供主角面板调用。
- **五行共鸣羁绊统计 (`calculateElementResonance`) (R3)**：
  - 遍历最多 5 只上阵宠物的五行属性 (`element`)。
  - 同系满 3 只触发共鸣加成：
    - 3金: 全员攻击力 +20%
    - 3木: 主角与宠物每秒恢复 15 HP
    - 3水: CDR / 攻速 +15%
    - 3火: 暴击率 +20%
    - 3土: 免伤 / 防御 +20%

### 3. `assets/Scripts/Logic/PetFollower.ts`
- **局内随行战斗加成 (R1 & R3)**：
  - `start()` 中攻击冷却计算接入 3水 共鸣 CDR 攻速加成 (`waterCdrBonus`)。
  - `fireProjectile()` 飞弹伤害接入 3金 共鸣攻击加成，并在宠物化形后额外获得 50% 伤害加成。
  - 飞弹尺寸按星级 (+10%/星) 与化形 (额外 +50%) 动态放大，并按金/木/水/火/土分配光效色彩。

### 4. `assets/Scripts/PlayerController.ts`
- **局内数值聚合与五行/家具接入 (R3 & R4)**：
  - `start()` 中最大生命值加入红木躺椅家具加成 (+50 HP)。
  - `update()` 中实时结算 3木 共鸣每秒 15 点生命回复。
  - `handleAutoAttack()` 中攻击间隔结算 3水 共鸣 15% CDR。
  - `executeAutoAttack()` 中结算 3金 攻击 (+20%) 与 3火 暴击率 (+20%, 触发 1.5 倍爆伤)。
  - `takeDamage()` 中结算 3土 共鸣 20% 免伤受击计算。

### 5. `assets/Scripts/Manager/SaveManager.ts`
- **持久化与向下兼容**：
  - `ISaveData` 新增 `furniture?: string[]` 家具 ID 保存字段。
  - `save()` 与 `load()` 正确读写 `STORAGE_KEY_FURNITURE`。
  - `load()` 中对旧存档宠物补充缺失的 `star` (默认 1)、`isEvolved` (默认 false)、`element` (默认 '金') 和 `monsterId`。

### 6. `assets/Scripts/UI/AppraisalPanel.ts` (新建)
- **盲盒孵化鉴定面板**：
  - 使用 Cocos Creator 3.x 纯代码防御构建。
  - 展现盲盒解封摇晃 Tween 动画、普通孵化/仙露孵化切换、结果属性广播与变异金光提示。

### 7. `assets/Scripts/UI/FurniturePanel.ts` (新建)
- **洞府家具装修面板**：
  - 使用 Cocos Creator 3.x 纯代码防御构建。
  - 展示极品寒玉床与红木躺椅的属性效果、资源消耗及“购买/已购买”状态同步。

### 8. `assets/Scripts/Manager/UIManager.ts`
- **面板注册**：
  - 在 `openUI()` 的 Prefab 缺失回退代码段中注册 `AppraisalPanel` 与 `FurniturePanel`。
