# Phase 10 Remediation Code Changes (变更记录)

## 1. Finding 1 [Critical]: 存档读写后已装备法宝内存引用分离与属性丢失 Bug

- **修改文件**:
  - `assets/Scripts/Manager/SaveManager.ts`
  - `assets/Scripts/Manager/HomeManager.ts`

- **具体变更**:
  1. **引用关联恢复机制**:
     - 在 `HomeManager.ts` 中新增 `linkRelicReferences()` 方法，遍历 `_equippedRelics[WEAPON | ACCESSORY | GOURD]`，依据 `relic.id` 检索 `_relicInventory` 中的对象实例并重新赋值给 `_equippedRelics[slot]`，确保内存中指向同一 JS 对象实例。
     - 在 `HomeManager.loadData()`、新增的 `setRelicInventory()` 和 `setEquippedRelics()` 中自动触发 `linkRelicReferences()`。
     - 在 `SaveManager.ts` 的 `load()` 方法以及 `applySaveToManagers()` 方法中加入反序列化重连逻辑，保证 `validEquippedRelics` 与 `validRelicInventory` 恢复后引用一致。
  2. **法宝穿脱与强化突变保证**:
     - 在 `HomeManager.ts` 的 `equipRelic` 中，保证穿戴的法宝始终从 `_relicInventory` 中获取唯一实例引用赋值给 `_equippedRelics[slot]`。
     - 在 `unequipRelic` 中，卸下时仅设置 `_equippedRelics[slot] = null`，法宝保留在 `_relicInventory` 中且所有突变属性（等级、属性加成、星级）不丢失。
     - 在 `upgradeRelic` 与 `synthesizeRelic` 中，直接在唯一的 `IRelicData` 实例上做属性修改。
     - 在 `removeRelic` 中增加联动清理，若移除的法宝处于装备状态则同步设为 `null`。

---

## 2. Finding 2 [Major]: EquipmentPanel 背包列表硬编码 `i < 4` 渲染截断

- **修改文件**:
  - `assets/Scripts/UI/EquipmentPanel.ts`

- **具体变更**:
  - 在 `EquipmentPanel.ts` 的 `refreshDisplay()` 中，将背包列表渲染循环 `for (let i = 0; i < inventory.length && i < 4; i++)` 修改为 `for (let i = 0; i < inventory.length; i++)`。
  - 移除 `&& i < 4` 硬编码截断限制，动态为背包中的每一个法宝（包括第 5 个法宝 `extraSword2` 及更多合成胚子）创建并显示列表卡片节点，确保全部法宝均正常可见并可进行装备、强化与合成升星操作。

---

## 3. Finding 3 [Minor]: UIManager closeUI 路径匹配

- **修改文件**:
  - `assets/Scripts/Manager/UIManager.ts`

- **具体变更**:
  - 在 `UIManager.ts` 中新增私有辅助方法 `findMatchingKey(panelPath: string): string | null`。
  - 支持按完整 key 或按组件短名称 (`shortName`) 模糊匹配 `_uiMap` 中的 Key。
  - 在 `openUI` 与 `closeUI` 方法中统一使用 `findMatchingKey` 检索面板节点，使得传入 `'EquipmentPanel'` 或 `'UI/EquipmentPanel'` 均能正确匹配并打开/关闭 UI 面板。

---

## 4. Finding 4 [Minor]: PetCaptureManager 吞天葫芦失败计数器持久化

- **修改文件**:
  - `assets/Scripts/Manager/SaveManager.ts`
  - `assets/Scripts/Logic/PetCaptureManager.ts`

- **具体变更**:
  - 在 `SaveManager.ts` 的 `ISaveData` 接口中添加 `gourdFailCount?: number` 字段。
  - 在 `SaveManager.getDefaultSaveData()` 中初始化 `gourdFailCount: 0`。
  - 在 `SaveManager.save()` 中同步读取 `PetCaptureManager.instance.gourdFailCount` 并存入 JSON 存档。
  - 在 `SaveManager.load()` 与 `applySaveToManagers()` 中反序列化并还原至 `PetCaptureManager`。
  - 在 `PetCaptureManager.ts` 中新增 `setGourdFailCount(count: number)` 方法，并在 `resetGourdFailCount()` 与 `attemptCapture()` 中当失败计数变动时自动触发 `HomeManager.instance?.saveData()` 持久化。
