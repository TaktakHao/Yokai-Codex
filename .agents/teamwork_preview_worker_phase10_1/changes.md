# Phase 10 代码修改记录 (`changes.md`)

## 1. 修改与新增文件清单

| 文件路径 | 修改类型 | 描述 |
| --- | --- | --- |
| `assets/Scripts/Manager/HomeManager.ts` | 修改 | 定义 `RelicSlotType`、`IRelicData`、`IRelicConfig` 及三大法宝静态配置，在 `HomeManager` 中新增 `_equippedRelics` 与 `_relicInventory` 数据结构、公有操作 API (穿脱、升级、2胚子合成升星) 及 `sys.localStorage` 持久化 |
| `assets/Scripts/PlayerController.ts` | 修改 | 实现吸血魔剑 (`relic_sword_vampire`) 50% 基础攻击力削减计算与伤害吸收 HP 恢复函数 `triggerVampireLifesteal` 及控制台日志输出 |
| `assets/Scripts/Logic/PetFollower.ts` | 修改 | 在随行宠物飞弹命中敌人造成伤害时，联动调用 `PlayerController.triggerVampireLifesteal` 恢复主角 HP |
| `assets/Scripts/Logic/Enemy.ts` | 修改 | 实现聚宝盆 (`relic_treasure_bowl`) 的双向规则篡改：怪物初始化移速永久提升 20%，击杀掉落灵石数量翻倍 |
| `assets/Scripts/Logic/PetCaptureManager.ts` | 修改 | 新增 `_gourdFailCount` 失败计数器，实现吞天葫芦 (`relic_gourd_swallow`) 的抓捕概率累加与成功重置逻辑 |
| `assets/Scripts/UI/EquipmentPanel.ts` | 新增 | 纯代码防御性构建法宝装备与炼制面板，实现 3 大部位槽位展示、背包列表、穿脱、升级扣除资源与 2 同配置同星级胚子合成升星 |
| `assets/Scripts/Manager/UIManager.ts` | 修改 | 在 `openUI()` 动态构建降级分支中注册并挂载 `EquipmentPanel` 组件 |
| `assets/Scripts/Manager/SaveManager.ts` | 修改 | 扩展 `ISaveData` 的 `equippedRelics` 与 `relicInventory` 字段，实现全量存盘、读盘反序列化及旧存档自动兼容补齐 |

---

## 2. 核心逻辑实现细节

### R1.1 法宝数据结构与 HomeManager 管理 API (`HomeManager.ts`)
- **`RelicSlotType`**: 枚举 `WEAPON = 'WEAPON'`, `ACCESSORY = 'ACCESSORY'`, `GOURD = 'GOURD'`。
- **`IRelicData`**: 实体数据结构包含 `id`, `configId`, `name`, `type`, `star`, `level`, `baseBonus`。
- **预设 3 大核心法宝**:
  - `relic_sword_vampire` (吸血魔剑, WEAPON, 5%吸血/50%攻击削减)
  - `relic_treasure_bowl` (聚宝盆, ACCESSORY, 掉落翻倍/移速+20%)
  - `relic_gourd_swallow` (吞天葫芦, GOURD, 抓捕失败+5%/成功重置)
- **API 接口实现**:
  - `getEquippedRelic(slot)` / `getEquippedRelics()`
  - `hasEquippedRelic(configId)`
  - `equipRelic(relicId, slot)`
  - `unequipRelic(slot)`
  - `upgradeRelic(relicId)`: 消耗 `level * 100` 灵石及 `level * 10` 材料，等级+1。
  - `synthesizeRelic(targetId, material1Id, material2Id)`: 校验 `targetId` 与 2 个胚子 `material1Id`, `material2Id` (必须同 configId、同星级、星级<5)，消耗 2 个胚子，目标星级+1，加成倍率提升。

### R1.2 吸血魔剑机制 (`PlayerController.ts` & `PetFollower.ts`)
- 在 `PlayerController.getEffectiveAttackDamage()` 中判断穿戴 `relic_sword_vampire` 时，基础攻击力乘以 0.5。
- 在 `triggerVampireLifesteal(damage)` 中计算 `healVal = Math.max(1, Math.floor(damage * 0.05))`，恢复主角 HP 并打印日志 `[吸血魔剑] 造成 ${damage} 伤害，为主角恢复 ${healVal} HP`。
- `PlayerController.executeAutoAttack()` 和 `PetFollower.fireProjectile()` 命中敌人时均调用 `triggerVampireLifesteal`。

### R1.3 聚宝盆机制 (`Enemy.ts`)
- `Enemy.init()`: 判定穿戴 `relic_treasure_bowl` 时，`moveSpeed *= 1.2`。
- `Enemy.die()`: 掉落灵石结算时，判定穿戴 `relic_treasure_bowl` 时，`dropAmount *= 2`。

### R1.4 吞天葫芦机制 (`PetCaptureManager.ts`)
- 新增 `_gourdFailCount` 变量。
- `calculateCaptureRate()`: 判定穿戴 `relic_gourd_swallow` 时，额外加上 `_gourdFailCount * 0.05`。
- `attemptCapture()`: 判定失败时 `_gourdFailCount++`；成功时重置 `_gourdFailCount = 0`。

### R2 装备与炼制 UI 面板 (`EquipmentPanel.ts` & `UIManager.ts`)
- `EquipmentPanel.ts` 纯代码构建 UI，展示顶栏、灵石与材料余额、3 大部位槽位展示卡片（包含脱下按钮）及背包列表。
- 背包列表提供“装备”、“升级”与“合成升星”交互按钮。合成升星校验背包中剩余 2 个同配置同星级胚子，成功后提升目标星级。
- `UIManager.ts` 注册 `'EquipmentPanel'` 降级构建。

### R3 数据持久化存盘 (`SaveManager.ts`)
- `ISaveData` 新增 `equippedRelics?: Record<RelicSlotType, IRelicData | null>` 及 `relicInventory?: IRelicData[]`。
- 在 `save()` 中序列化并存盘法宝数据。
- 在 `load()` 中反序列化法宝数据，旧存档缺少该属性时补全默认兜底数据，并在 `applySaveToManagers()` 中分配回 `HomeManager`。
