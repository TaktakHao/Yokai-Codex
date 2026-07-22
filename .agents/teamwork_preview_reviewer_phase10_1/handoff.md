# Handoff Report — Phase 10 Code Review

## 1. Observation (观察)

以下为审查过程中直接观察到的具体代码行号与实现细节：

1. **`assets/Scripts/Manager/HomeManager.ts`**:
   - 行 60-82: 定义 `RELIC_CONFIGS`（吸血魔剑 `relic_sword_vampire`、聚宝盆 `relic_treasure_bowl`、吞天葫芦 `relic_gourd_swallow`）。
   - 行 1183-1189 (`getRelicById`): 
     ```typescript
     public getRelicById(relicId: string): IRelicData | null {
         for (const slot of [RelicSlotType.WEAPON, RelicSlotType.ACCESSORY, RelicSlotType.GOURD]) {
             const eq = this._equippedRelics[slot];
             if (eq && eq.id === relicId) return eq;
         }
         return this._relicInventory.find(r => r.id === relicId) || null;
     }
     ```
   - 行 1210-1223 (`equipRelic`): 将法宝对象引用赋给 `_equippedRelics[targetSlot]`，但未从 `_relicInventory` 移除。
   - 行 1270-1310 (`synthesizeRelic`): 校验同配置、同星级、2 个胚子、上限 5 星，解除装备槽并提升 1 星。

2. **`assets/Scripts/Manager/SaveManager.ts`**:
   - 行 31-35 (`ISaveData`): 扩展 `equippedRelics` 与 `relicInventory` 字段。
   - 行 237-254 (`load`): 从 JSON 解析 `equippedRelics` 与 `relicInventory`。
   - 行 312-313 (`applySaveToManagers`): 
     ```typescript
     (homeMgr as any)._equippedRelics = data.equippedRelics || { WEAPON: null, ACCESSORY: null, GOURD: null };
     (homeMgr as any)._relicInventory = data.relicInventory || [];
     ```
     `JSON.parse` 之后，`_equippedRelics` 与 `_relicInventory` 中相同 ID 的法宝在内存中拆分成了两个独立的对象实例。

3. **`assets/Scripts/UI/EquipmentPanel.ts`**:
   - 行 202 (`refreshDisplay`): `for (let i = 0; i < inventory.length && i < 4; i++)` 硬编码了 `i < 4`，导致第 5 个背包法宝（如 `extraSword2`）无法在 UI 面板中渲染显示。
   - 行 136 (`bindEvents`): `UIManager.instance.closeUI('EquipmentPanel')`。

4. **`assets/Scripts/PlayerController.ts` & `assets/Scripts/Logic/Enemy.ts` & `assets/Scripts/Logic/PetCaptureManager.ts`**:
   - `PlayerController.ts` 行 261-286 (`triggerVampireLifesteal`): 包含吸血恢复与 `console.log` 控制台日志。
   - `Enemy.ts` 行 78-85 & 268-276: 包含聚宝盆 20% 移速与 2 倍灵石掉落。
   - `PetCaptureManager.ts` 行 182-187 & 207-227: 包含吞天葫芦失败成功率 +5% 累加与成功重置及控制台日志。

---

## 2. Logic Chain (推演链条)

1. **Bug 1 (内存引用分离)**:
   - 观察: 穿戴法宝时，`_equippedRelics[slot]` 与 `_relicInventory` 在内存中同时保有引用。
   - 观察: `SaveManager.save()` 将两者各自序列化为 JSON 字符串，`SaveManager.load()` 通过 `JSON.parse` 还原。
   - 推演: `JSON.parse` 对同一 JSON 文本中的两个相同对象分别创建了不同的 JS 堆内存对象（对象 A 与对象 B）。
   - 推演: `getRelicById` 优先检索 `_equippedRelics` 并返回对象 A。玩家升级该法宝时，修改的是对象 A。
   - 结论: 运行于 `_relicInventory` 上的背包 UI 渲染显示的是未更新的对象 B。当玩家下阵该法宝后，`_equippedRelics` 变为空，`getRelicById` 检索到未更新的对象 B，导致所有在已装备期间获得的等级与星级提升彻底丢失。

2. **Bug 2 (UI 渲染截断)**:
   - 观察: `EquipmentPanel.ts` 渲染循环条件为 `i < inventory.length && i < 4`。
   - 观察: `HomeManager.loadData()` 初始注入了 5 个法宝（3 个初始法宝 + 2 个合成胚子）。
   - 推演: 下标 `i = 4` 的第 5 个法宝在循环条件中直接被过滤掉。
   - 结论: 界面上最多只能看到 4 个法宝，第 5 个法宝（`extraSword2`）被屏蔽，导致玩家无法在 UI 上完成 2 胚子的合成升星操作。

---

## 3. Caveats (注意事项与假设)

- 本次审查为纯代码静态逻辑审查与结构推理，未挂载 Cocos Creator 编辑器运行图形渲染。
- 假设底层 `sys.localStorage` 正确工作且 JSON 序列化无格式损坏。
- 无其他未调查的隐患。

---

## 4. Conclusion (结论)

Phase 10 的代码完成了所有功能框架的搭建，特质逻辑 (R1) 覆盖全面且日志规范；但是由于存在 **[Critical] 存档恢复后内存引用分离导致等级丢失 Bug** 以及 **[Major] UI 列表硬编码 i < 4 截断 Bug**，审查结论判定为 **REQUEST_CHANGES**。需要 Worker 1 针对 `review.md` 中的 Finding 1 与 Finding 2 进行修复。

---

## 5. Verification Method (独立验证方法)

1. **验证 Finding 1 (内存引用分离与等级丢失)**:
   - 步骤 1: 穿戴 `relic_sword_vampire` 到主武器槽位。
   - 步骤 2: 调用 `SaveManager.instance.save()` 写入存档，随后调用 `SaveManager.instance.load()` 模拟重新加载。
   - 步骤 3: 调用 `HomeManager.instance.upgradeRelic('relic_sword_init')` 提升等级。
   - 步骤 4: 调用 `HomeManager.instance.unequipRelic(RelicSlotType.WEAPON)` 卸下法宝。
   - 步骤 5: 检查 `HomeManager.instance.getRelicById('relic_sword_init')?.level`，观察等级是否回退为 1（若回退即证实 Bug 存在）。

2. **验证 Finding 2 (UI 背包截断)**:
   - 检查 `assets/Scripts/UI/EquipmentPanel.ts` 第 202 行代码 `for (let i = 0; i < inventory.length && i < 4; i++)`。
   - 确认是否限制为 `i < 4` 截断了第 5 个法宝的渲染。
