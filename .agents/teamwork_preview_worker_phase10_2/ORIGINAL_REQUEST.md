## 2026-07-21T13:31:31Z
你是 Phase 10 的 Worker 2。请接管并完成《万妖录：躺平修仙》第十阶段（仙器法宝系统）针对 Reviewer 1 输出的 4 项 Finding 的代码修复与验证工作。

## 你的工作目录
`/Users/wesson/YokaiCodex/.agents/teamwork_preview_worker_phase10_2`

## 待修复的 4 项 Findings
1. **[Critical] Finding 1: 存档读写后已装备法宝内存引用分离 Bug**
   - 文件: `assets/Scripts/Manager/SaveManager.ts` & `assets/Scripts/Manager/HomeManager.ts`
   - 原因: `JSON.parse` 反序列化后，`equippedRelics` 与 `relicInventory` 变成内存中独立的 2 个对象。强化/升星修改了 `_equippedRelics` 里的对象 A，脱下法宝后再从 `_relicInventory` 获取的是未强化的对象 B，导致强化等级和属性丢失。
   - 修复要求: 在 `SaveManager.ts` 的 `applySaveToManagers(data)` 或 `load()` 恢复 `HomeManager` 法宝数据时，建立对象引用重连逻辑：遍历 `data.equippedRelics`（`WEAPON`, `ACCESSORY`, `GOURD`），如果存在装备对象且包含 `id`，在 `_relicInventory` 中按 `id` 查找匹配的法宝引用对象，并将 `_equippedRelics[slot]` 指向该 `_relicInventory` 中的对象实例，确保两处内存引用完全一致！

2. **[Major] Finding 2: EquipmentPanel 背包列表硬编码 `i < 4` 截断**
   - 文件: `assets/Scripts/UI/EquipmentPanel.ts`
   - 原因: 第 202 行硬编码 `for (let i = 0; i < inventory.length && i < 4; i++)`，导致第 5 个及以后的法宝无法在 UI 中渲染。
   - 修复要求: 移除 `i < 4` 硬编码限制，改为 `for (let i = 0; i < inventory.length; i++)` 遍历完整背包列表，确保所有背包法宝均可正常渲染和选中操作。

3. **[Minor] Finding 3: EquipmentPanel 关闭面板路径 Key 不匹配**
   - 文件: `assets/Scripts/UI/EquipmentPanel.ts` & `assets/Scripts/Manager/UIManager.ts`
   - 原因: 点击关闭按钮 `UIManager.instance.closeUI('EquipmentPanel')` 与注册/打开 Key `'UI/EquipmentPanel'` 不匹配。
   - 修复要求: 在 `UIManager.closeUI` 中对传入 key 进行规范化截取/统一匹配处理（如兼容带/不带 `UI/` 前缀），或在 `EquipmentPanel.ts` 中使用统一的 Key 格式。

4. **[Minor] Finding 4: PetCaptureManager 吞天葫芦失败计数器未持久化**
   - 文件: `assets/Scripts/Manager/SaveManager.ts` & `assets/Scripts/Logic/PetCaptureManager.ts`
   - 原因: `PetCaptureManager` 中的吞天葫芦抓捕失败计数器 `_gourdFailCount` 未存盘，重新加载存档后加成层数丢了。
   - 修复要求: 在 `ISaveData` 接口中扩展 `gourdFailCount?: number` 字段。在 `SaveManager.save()` 中将 `PetCaptureManager.instance.gourdFailCount` 保存至 `_saveData`，并在 `SaveManager.applySaveToManagers()` 中读出并恢复给 `PetCaptureManager`，确保抓捕失败计数器持久化。

## 强制诚信警示 (MANDATORY INTEGRITY WARNING)
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## 验证与产物要求
1. 在修改完成后，请运行 TypeScript 编译/类型检查（例如 `npx tsc --noEmit`）验证代码中没有任何 syntax/type 错误，并将命令与输出填入 handoff 报告中。
2. 将完成的修改汇总说明写入你的工作目录下的 `changes.md` 与 `handoff.md`。
3. 更新你的 `progress.md`。
4. 使用 `send_message` 向 Parent (`509a9885-a627-4528-8772-e494ce117f23`) 汇报完成情况与 `handoff.md` 路径。
