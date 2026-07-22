# Phase 10 代码审查报告 (Review Report)

## Review Summary

**Verdict**: REQUEST_CHANGES (需修改)

Worker 1 在 Phase 10 中完成了规则篡改特质 (R1)、装备面板 UI (R2) 以及存档持久化 (R3) 的核心功能开发。代码整体结构清晰、类型定义完整，对于无预制体情况下的纯代码 UI 防御性构建处理得当。但在深入审查与对抗性测试中，发现了 **1 个 Critical 级数据引用分离 Bug** 和 **1 个 Major 级 UI 渲染截断缺陷**，需要 Worker 1 进行修复后方可批准通过。

---

## Findings (审查发现)

### [Critical] Finding 1: 存档读写后已装备法宝内存引用分离与属性升级丢失 Bug

- **位置**: `assets/Scripts/Manager/SaveManager.ts` (第 237-268 行, `applySaveToManagers`), `assets/Scripts/Manager/HomeManager.ts` (第 1183-1223 行, `getRelicById` / `equipRelic`)
- **原因**: 
  1. 当法宝被穿戴时 (`equipRelic`)，`HomeManager` 的 `_equippedRelics[slot]` 指向该法宝对象，同时该法宝对象仍然保留在 `_relicInventory` 列表中。在内存中两处指向同一个对象引用。
  2. 当 `SaveManager.save()` 执行 `JSON.stringify()` 序列化存档并重新读取 `JSON.parse()` 时，`equippedRelics` 与 `relicInventory` 被解析为**内存中两个独立的 JavaScript 对象实例**（对象引用分离）。
  3. 当玩家调用 `getRelicById` 时，方法优先返回 `_equippedRelics[slot]` 中的对象 A。玩家在 `EquipmentPanel` 或通过 API 强化/升星该法宝时，更新的是对象 A。
  4. 然而，`_relicInventory` 中对应的对象 B 仍然保持未强化的初始状态！`EquipmentPanel` 的背包渲染迭代的是 `_relicInventory`，导致背包列表中始终显示未强化的旧数值。
  5. 极具破坏性的是：一旦玩家将该法宝脱下 (`unequipRelic`)，`_equippedRelics[slot]` 被清空为 `null`。后续 `getRelicById` 将检索到 `_relicInventory` 中的对象 B，**导致玩家在已装备期间进行的所有等级强化与属性加成全部彻底丢失！**
- **建议修复方向**: 
  - 在 `SaveManager.ts` 的 `load()` / `applySaveToManagers()` 方法中，建立对象引用重连逻辑：遍历 `equippedRelics` 时，依据 `id` 在 `relicInventory` 中查找对应的真实对象引用并重新赋值；或者在 `equipRelic` 时从 `relicInventory` 中引用该实例，并在 `load` 时根据 ID 进行单例合并关联。

---

### [Major] Finding 2: EquipmentPanel 背包列表硬编码 `i < 4` 导致第 5 个及以后法宝被截断无法渲染

- **位置**: `assets/Scripts/UI/EquipmentPanel.ts` 第 202 行
- **代码片段**:
  ```typescript
  for (let i = 0; i < inventory.length && i < 4; i++) {
      const relic = inventory[i];
      ...
  }
  ```
- **原因**: 
  - `EquipmentPanel` 在渲染背包列表时，硬编码了 `i < 4` 的限制条件，最多只渲染背包前 4 个法宝。
  - 在 `HomeManager.loadData()` 初始化默认法宝种子时，一共生成了 5 个法宝（吸血魔剑、聚宝盆、吞天葫芦以及 2 个用于合成测试的吸血魔剑胚子 `extraSword1` 和 `extraSword2`）。
  - 由于 `i < 4` 的截断，第 5 个法宝 `extraSword2` 在面板中完全不可见，玩家无法在界面上看到或选中它，直接影响到了 R2 合成升星测试及多法宝背包场景。
- **建议修复方向**:
  - 移除硬编码 `i < 4` 限制，改为基于 `inventory.length` 的完整遍历或滚动容器展示，或按实际面板布局动态适配列表。

---

### [Minor] Finding 3: EquipmentPanel 关闭面板路径与 UIManager openUI 路径可能存在 Key 不匹配

- **位置**: `assets/Scripts/UI/EquipmentPanel.ts` 第 136 行
- **原因**: 
  - `EquipmentPanel` 内部关闭按钮绑定为 `UIManager.instance.closeUI('EquipmentPanel')`。
  - 若其他模块使用 `UIManager.instance.openUI('UI/EquipmentPanel')` 打开面板，`UIManager._uiMap` 中保存的 Key 为 `'UI/EquipmentPanel'`。
  - 此时点击关闭按钮传递 `'EquipmentPanel'` 会因 Key 不匹配而无法成功关闭面板。
- **建议修复方向**: 
  - 在 `UIManager.closeUI` 中对路径进行统一的格式化截取（提取 `panelName`），或在调用 `closeUI` 时保持路径格式绝对统一。

---

### [Minor] Finding 4: PetCaptureManager 吞天葫芦失败计数器未纳入持久化存档

- **位置**: `assets/Scripts/Logic/PetCaptureManager.ts` 第 135-146 行
- **原因**: 
  - 吞天葫芦 (`relic_gourd_swallow`) 抓捕失败后增加 5% 成功率的失败计数器 `_gourdFailCount` 仅保存在 `PetCaptureManager` 内存变量中，未扩展至 `ISaveData` 存档字段。
  - 玩家若在抓捕失败数次后退出游戏或重新加载存档，失败加成层数将被重置为 0。
- **建议修复方向**: 
  - 可在 `ISaveData` 中扩展 `gourdFailCount?: number` 字段，并在 `SaveManager.save` 和 `load` 时进行保存与还原。

---

## Verified Claims (验证项)

- **R1 吸血魔剑 (Vampire Sword)**: 
  - 50% 基础攻击削减: `PlayerController.getEffectiveAttackDamage()` 校验通过。
  - 5% HP 恢复: `PlayerController.triggerVampireLifesteal()` 校验通过，并在 `PetFollower` 飞弹命中时正确联动。
  - 控制台日志: 控制台存在 `console.log('[吸血魔剑] ...')` 与 `log(...)` 输出，通过。
- **R1 聚宝盆 (Treasure Bowl)**: 
  - 20% 怪物移速加成: `Enemy.init()` 判定 `hasEquippedRelic('relic_treasure_bowl')` 并增加 20% 移速，通过。
  - 2 倍灵石掉落: `Enemy.die()` 判定掉落灵石 `dropAmount *= 2`，通过。
- **R1 吞天葫芦 (Swallowing Gourd)**: 
  - 抓捕失败成功率 +5% 累加: `PetCaptureManager.calculateCaptureRate()` 中累加 `_gourdFailCount * 0.05`，通过。
  - 成功重置与日志: `attemptCapture()` 判定成功时重置 `_gourdFailCount = 0`，失败时 `_gourdFailCount++`，并记录 `console.log` 控制台日志，通过。
- **R2 装备面板纯代码防御构建**: 
  - `EquipmentPanel.ts` 纯代码构建 UI 元素，并在 `UIManager.ts` 找不到预制体时回退代码挂载，通过。
- **R2 穿脱与升级扣减**: 
  - `HomeManager.equipRelic` / `unequipRelic` / `upgradeRelic` 资源扣减逻辑正确，通过。
- **R2 合成升星校验**: 
  - `synthesizeRelic` 严格校验同配置、同星级、2 个材料胚子及 5 星上限，校验逻辑正确，通过。
- **R3 存档持久化**: 
  - `ISaveData` 包含 `equippedRelics` 与 `relicInventory`，旧存档兼容补齐逻辑健全，通过。

---

## Coverage Gaps (覆盖率缺口)

- 无重大覆盖率缺口。所有 8 个目标文件及相关逻辑链已进行完整代码审查。

---

## Adversarial Integrity Assessment (对抗性诚信评估)

- **硬编码/伪实现排查**: 未发现硬编码测试输出或伪造实现，功能逻辑均为真实计算。
- **作弊/规避排查**: 核心规则逻辑完整接入战斗与 UI 循环，无伪造日志或假接口行为。
