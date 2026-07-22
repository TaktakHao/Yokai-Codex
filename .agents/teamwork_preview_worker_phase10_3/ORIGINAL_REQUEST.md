## 2026-07-21T21:31:36Z

你是 Phase 10 的 Replacement Remediation Worker Subagent（teamwork_preview_worker）。
工作目录：/Users/wesson/YokaiCodex/.agents/teamwork_preview_worker_phase10_3/

前任 Worker 未响应，请你接替完成 Phase 10 的代码修补任务。

请阅读并遵守 MANDATORY INTEGRITY WARNING：
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

请阅读 Reviewer 1 的审查报告 `/Users/wesson/YokaiCodex/.agents/teamwork_preview_reviewer_phase10_1/review.md`，真实、严谨地修复以下 4 项 Finding：

### 1. 修复 Finding 1 [Critical]: 存档读写后已装备法宝内存引用分离与属性丢失 Bug
- **根本原因**: `SaveManager.ts` 反序列化 `equippedRelics` 与 `relicInventory` 后，两处指向不同的 JavaScript 对象实例。导致在已装备期间强化升星修改了 `equippedRelics[slot]` 的对象 A，但背包渲染和脱下后使用的是未强化的对象 B，脱下后属性丢失。
- **修复措施**:
  1. 在 `SaveManager.ts` (`applySaveToManagers` 与 `load`) 以及 `HomeManager.ts` (`loadData`, `setRelicInventory`, `setEquippedRelics`) 中建立对象引用关联：反序列化 `equippedRelics` 时，根据 `relic.id` 检索 `relicInventory` 中的对象实例并建立相同引用指向，确保两处引用同一个对象。
  2. 在 `HomeManager.ts` 的 `equipRelic`、`unequipRelic`、`upgradeRelic`、`synthesizeRelic` 方法中，保证被穿戴的法宝始终从 `_relicInventory` 中取唯一实例引用，升级/升星时直接突变该实例，脱下时仅设 `_equippedRelics[slot] = null`。

### 2. 修复 Finding 2 [Major]: EquipmentPanel 背包列表硬编码 `i < 4` 渲染截断
- **根本原因**: `EquipmentPanel.ts` 渲染背包列表时硬编码 `for (let i = 0; i < inventory.length && i < 4; i++)`，导致第 5 个及以后的法宝胚子在 UI 中无法显示。
- **修复措施**:
  - 移除 `&& i < 4` 截断条件，改为遍历全部 `inventory.length` 项，并动态为每个法宝创建与刷新列表卡片节点，确保多法宝与合成胚子全部正常可见并可被选中。

### 3. 修复 Finding 3 [Minor]: UIManager closeUI 路径匹配
- **修复措施**:
  - 在 `UIManager.ts` 的 `closeUI` 方法中增加格式化匹配逻辑，支持传入 `'EquipmentPanel'` 或 `'UI/EquipmentPanel'` 均能正确关闭面板。

### 4. 修复 Finding 4 [Minor]: PetCaptureManager 吞天葫芦失败计数器持久化
- **修复措施**:
  - 在 `ISaveData` 接口中增加 `gourdFailCount?: number` 字段，并在 `SaveManager.save` 和 `load` 时同步读取与写入 `PetCaptureManager.instance.gourdFailCount`。

### 验证要求
- 在 shell 中验证 TypeScript 编译与语法无误。
- 在 `/Users/wesson/YokaiCodex/.agents/teamwork_preview_worker_phase10_3/` 下输出 `changes.md` 与 `handoff.md`。
- 完成后向 Parent (`509a9885-a627-4528-8772-e494ce117f23`) 发送 `send_message`。
