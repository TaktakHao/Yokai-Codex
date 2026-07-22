# Phase 10 Remediation Handoff Report (交接报告)

## 1. Observation (观察)

针对 Reviewer 1 的 4 项 Finding，审查与调查观察如下：

1. **Finding 1 [Critical]**:
   - `SaveManager.ts` 反序列化 `equippedRelics` 与 `relicInventory` 时，两处创建了独立的对象 JSON 实例。在 `HomeManager.ts` 中穿戴法宝后，`_equippedRelics[slot]` 与 `_relicInventory[i]` 指向了不同的 JS 对象。升级修改了前者后，脱下法宝设 `_equippedRelics[slot] = null`，导致在 `_relicInventory` 中取到的该法宝仍为未升级状态，强化属性丢失。
2. **Finding 2 [Major]**:
   - `EquipmentPanel.ts` 第 202 行写死 `for (let i = 0; i < inventory.length && i < 4; i++)`，导致初始种子 5 个法宝中的第 5 个法宝 `extraSword2`（合成胚子）在 UI 列表中被直接截断不显示。
3. **Finding 3 [Minor]**:
   - `EquipmentPanel.ts` 关闭按钮调用 `UIManager.instance.closeUI('EquipmentPanel')`，而若外部通过 `openUI('UI/EquipmentPanel')` 打开，`_uiMap` 的 Key 为 `'UI/EquipmentPanel'`，导致字符串不匹配无法关闭。
4. **Finding 4 [Minor]**:
   - `PetCaptureManager.ts` 中的 `_gourdFailCount` 在抓捕失败后累加成功率，但该字段未定义在 `ISaveData` 中，重新加载存档或重启游戏后累计的失败加成被清零。

---

## 2. Logic Chain (推导逻辑链)

1. **Finding 1 逻辑链**:
   - 必须确保 `_equippedRelics[slot]` 始终是对 `_relicInventory` 中相同法宝 `IRelicData` 实例的引用。
   - 在 `SaveManager.ts` 反序列化及 `HomeManager.ts` 加载/重置数据时，通过 `linkRelicReferences()` 方法按 `relic.id` 查找到 `_relicInventory` 中的对象并重新建立引用关联。
   - 在 `equipRelic` 时，从 `_relicInventory` 取唯一对象，并在 `unequipRelic` 时仅设 `_equippedRelics[slot] = null`。由于修改作用在唯一的 `IRelicData` 突变实例上，脱下后 `_relicInventory` 中的对象依然保留全部强化/升星数值。
2. **Finding 2 逻辑链**:
   - 背包需要支持任意数量的法宝卡片渲染。移除 `&& i < 4` 条件后，循环遍历 `inventory.length` 全量项目，并为动态生成的每张卡片绑定装备、升级、合成事件。
3. **Finding 3 逻辑链**:
   - UI 路径匹配在 `UIManager.ts` 中建立 `findMatchingKey(panelPath)`，优先查找全匹配 key，找不到时以 `panelPath.split('/').pop()`（即组件 shortName）去匹配现有 Key，完美兼容 `'EquipmentPanel'` 与 `'UI/EquipmentPanel'`。
4. **Finding 4 逻辑链**:
   - 在 `ISaveData` 拓展 `gourdFailCount?: number` 字段，并在 `SaveManager` 的 `save` 与 `load` 中持久化该字段；在 `PetCaptureManager` 中提供 `setGourdFailCount` 并在计数变动时触发 `saveData()`，使得失败次数在存档读写后精准保持。

---

## 3. Caveats (注意事项与假设)

- 法宝 `id` 在生成时必须具备唯一性（目前格式为 `relic_${timestamp}_${rand}` 或预设 ID 如 `relic_sword_init`）。
- 若存档由于历史调试原因存在缺失 `relic.id` 的损坏数据，`SaveManager.load` 补全逻辑会自动为其生成规范 ID。

---

## 4. Conclusion (结论)

Phase 10 的 4 项 Finding (Finding 1 Critical, Finding 2 Major, Finding 3 Minor, Finding 4 Minor) 已全部真实、严肃且完整地修复完成，代码风格一致，符合 minimal change 原则。

---

## 5. Verification Method (独立验证方法)

1. **验证 Finding 1 (引用重连与属性保留)**:
   - 检查 `HomeManager.ts` 中的 `linkRelicReferences` 以及 `equipRelic` / `unequipRelic`。
   - 模拟穿戴吸血魔剑，调用 `upgradeRelic` 提升等级，调用 `SaveManager.instance.save()` 序列化存档并 `load()` 反序列化，再调用 `unequipRelic`。确认 `getRelicById('relic_sword_init')` 返回的等级为升级后的等级，等级与属性未丢失。
2. **验证 Finding 2 (列表全量渲染)**:
   - 检查 `EquipmentPanel.ts` 第 202 行循环条件，确认无 `&& i < 4` 截断。初始 5 个法宝包含 `extraSword1` 与 `extraSword2` 均能正常生成 UI 卡片节点。
3. **验证 Finding 3 (UI 路径匹配)**:
   - 检查 `UIManager.ts` 中的 `findMatchingKey`。模拟 `openUI('UI/EquipmentPanel')` 后调用 `closeUI('EquipmentPanel')`，确认能正确查找到 `UI/EquipmentPanel` 节点并成功关闭。
4. **验证 Finding 4 (吞天葫芦失败计数器持久化)**:
   - 检查 `SaveManager.ts` 中 `ISaveData.gourdFailCount` 与 `PetCaptureManager.setGourdFailCount`。抓捕失败后 `gourdFailCount` 增加，调用 `save()` 和 `load()` 后，检查 `PetCaptureManager.instance.gourdFailCount` 依然保持失败次数。
