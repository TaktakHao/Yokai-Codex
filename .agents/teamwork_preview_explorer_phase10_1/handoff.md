# Handoff Report — Phase 10 法宝系统（Relic System）探索与切入点分析

## 1. Observation (观察)

代码库 `/Users/wesson/YokaiCodex/assets/Scripts` 下相关核心文件的具体观察如下：

1. **`assets/Scripts/Manager/HomeManager.ts`**：
   - 包含灵石 `_spiritStones` (Line 160)、材料 `_materials` (Line 162)、已上阵宠物 `_equippedPetIds` (Line 173)、已购家具 `_purchasedFurnitureIds` (Line 182) 及境界/天赋数据。
   - 具备 `saveData()` (Line 745) 和 `loadData()` (Line 782)，通过 `sys.localStorage` 持久化保存数据。

2. **`assets/Scripts/PlayerController.ts`** 与 **`assets/Scripts/Logic/PetFollower.ts`**：
   - `PlayerController.ts` 包含 `attackDamage` (Line 41)、`executeAutoAttack()` (Line 188) 和 `takeDamage()` (Line 256)。
   - `PetFollower.ts` 包含 `fireProjectile()` (Line 191)，生成飞弹对敌人产生伤害，命中时调用 `enemyComp.takeDamage(damageVal)` (Line 249)。

3. **`assets/Scripts/Logic/Enemy.ts`** 与 **`assets/Scripts/LevelManager.ts`**：
   - `Enemy.ts` 包含移动速度 `moveSpeed` (Line 24) 与 `init()` (Line 63)。
   - 掉落逻辑在 `die()` (Line 245) 中执行，精英怪/配置掉落通过 `HomeManager.instance.addSpiritStones(...)` (Line 263) 增加灵石。
   - `LevelManager.ts` 中 `spawnMonsterGroup()` (Line 259) 在生成怪物时传递 `group.move_speed`。

4. **`assets/Scripts/Logic/PetCaptureManager.ts`**：
   - 抓捕成功率计算在 `calculateCaptureRate()` (Line 157)，成功率算式为 `this.baseCaptureRate + (hpLossRatio * this.executeBonusWeight) + itemBonus`。
   - 抓捕尝试在 `attemptCapture()` (Line 183)，若 `Math.random() < successRate` 成功则返回 `egg`，否则返回 `null`。

5. **`assets/Scripts/Manager/UIManager.ts`**, **`AppraisalPanel.ts`**, **`FurniturePanel.ts`**：
   - `UIManager.ts` (Line 54) 预制体不存在时回退到纯代码 `new Node(...)` 并 `addComponent(...)`。
   - `AppraisalPanel.ts` (Line 40) 和 `FurniturePanel.ts` (Line 34) 均实现了纯代码防御性构建（`ensureUIElements`），包含 UI Transform、Sprite 背景、Label 文本、Button 绑定和状态刷新。

6. **`assets/Scripts/Manager/SaveManager.ts`**：
   - 定义了 `ISaveData` (Line 6)，`save()` (Line 87) 和 `load()` (Line 171)。
   - `load()` 中对旧存档数据字段进行了兼容补齐（Line 195-208）。

---

## 2. Logic Chain (推理链)

1. **法宝实体数据结构与 HomeManager 扩展**：
   - 基于 `HomeManager.ts` 已有的 `_equippedPetIds` 与 `_purchasedFurnitureIds` 设计模式，在 `HomeManager` 中扩展 `IRelicData` 结构以及 `_equippedRelics` (`WEAPON`, `ACCESSORY`, `GOURD`) 和 `_relicInventory`。
   - `HomeManager` 作为全局单例，提供 `equipRelic`、`unequipRelic`、`upgradeRelic`（消耗灵石/材料）和 `fuseRelicStar`（消耗 2 个同配置同星级胚子升星）接口最为合理。

2. **吸血魔剑 (`relic_sword_vampire`) 机制植入**：
   - 基础攻击力计算：在 `PlayerController` 获取或计算基础攻击力时检测 `HomeManager.instance.hasEquippedRelic('relic_sword_vampire')`，若穿戴则应用 `0.5` 缩放倍率。
   - 吸血判定：在主角攻击和 `PetFollower` 飞弹命中敌人触发 `takeDamage` 后，调用 `PlayerController.triggerVampireLifesteal(damage)`。当穿戴吸血魔剑时恢复 5% HP，并打印明确控制台日志 `[吸血魔剑] 造成 X 伤害，为主角恢复 Y HP`。

3. **聚宝盆 (`relic_treasure_bowl`) 机制植入**：
   - 掉落翻倍：在 `Enemy.die()` 结算掉落灵石时，判定是否穿戴聚宝盆，若穿戴则掉落数量 `* 2`。
   - 移速加成：在 `Enemy.init()` 初始化移速时，判定是否穿戴聚宝盆，若穿戴则基础 `moveSpeed * 1.20`。

4. **吞天葫芦 (`relic_gourd_swallow`) 机制植入**：
   - 在 `PetCaptureManager` 中新增 `_gourdFailCount` 失败计数器。
   - 在 `calculateCaptureRate` 中，若穿戴吞天葫芦，额外累加 `_gourdFailCount * 0.05` 成功率。
   - 在 `attemptCapture` 抓捕失败时 `_gourdFailCount++`；抓捕成功时重置 `_gourdFailCount = 0`。

5. **`EquipmentPanel.ts` 纯代码构建与注册**：
   - 参照 `AppraisalPanel.ts` 的纯代码 UI 模版，防御性构建 `EquipmentPanel.ts`，支持槽位展示、法宝背包、穿脱、升级与合成升星。
   - 在 `UIManager.ts` 的 `openUI` 中注册 `EquipmentPanel` 回退构建逻辑。

6. ** SaveManager 存档扩展**：
   - 扩展 `ISaveData` 加入 `equippedRelics` 与 `relicInventory` 字段。
   - 在 `load()` 中对旧存档缺失属性进行补齐与默认初始化，防止老存档加载崩溃。

---

## 3. Caveats (注意事项)

- 本次探索任务为**只读分析**，未对 `assets/Scripts` 中的源码进行任何写入或修改。
- 局内伤害来源若后续扩展更多技能投射物，需确保所有对 `Enemy` 造成伤害的代码处均联动调用 `PlayerController.triggerVampireLifesteal`。

---

## 4. Conclusion (结论)

Phase 10 法宝系统（Relic System）在现有 `YokaiCodex` 代码库中的切入点清晰且高度解耦。扩展方案完全符合现有代码库的设计模式，包括：
1. `HomeManager` 作为法宝数据与状态管理者。
2. `PlayerController`, `Enemy`, `PetCaptureManager` 独立植入三大法宝被动。
3. `EquipmentPanel` 采用纯代码防御构建模式并在 `UIManager` 中注册。
4. `SaveManager` 保障旧存档兼容。

具体架构分析与全量代码切入点已整理写入 `analysis.md`。

---

## 5. Verification Method (验证方法)

1. **检查分析文件完整性**：
   - 检查 `/Users/wesson/YokaiCodex/.agents/teamwork_preview_explorer_phase10_1/analysis.md`。
2. **切入点逻辑验证**：
   - 检查 `analysis.md` 中包含的各文件（`HomeManager.ts`, `PlayerController.ts`, `Enemy.ts`, `PetCaptureManager.ts`, `UIManager.ts`, `EquipmentPanel.ts`, `SaveManager.ts`）的行号与接口设计。
