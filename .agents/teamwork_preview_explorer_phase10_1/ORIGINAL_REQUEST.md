## 2026-07-21T16:50:05+08:00
你是 Phase 10 的 Exploration Subagent（teamwork_preview_explorer）。
工作目录：/Users/wesson/YokaiCodex/.agents/teamwork_preview_explorer_phase10_1/

请深入探索 codebase `/Users/wesson/YokaiCodex/assets/Scripts`，重点分析以下文件的现有结构与修改切入点：

1. `assets/Scripts/Manager/HomeManager.ts`：
   - 现有的灵石、材料、宠物及洞府数据结构。
   - 如何扩展法宝实体数据结构 `IRelicData` (id, configId, name, type, star, level, baseBonus 等) 和装备部位槽位 (`WEAPON`, `ACCESSORY`, `GOURD`)。
   - 如何在 `HomeManager` 中提供 `equippedRelics` 和 `relicInventory` 数据结构与操作方法。

2. `assets/Scripts/PlayerController.ts`：
   - 现有的攻击力、HP、伤害结算逻辑与随行宠物飞弹伤害结算逻辑。
   - 如何在主角基础攻击力计算中植入吸血魔剑 (`relic_sword_vampire`) 削减 50% 基础攻击力的逻辑。
   - 如何在造成的伤害（包含主角自身技能/攻击与随行宠物飞弹命中）触发时，判定是否穿戴吸血魔剑，若穿戴则按 5% 恢复 HP，并打印明确控制台日志 `[吸血魔剑] 造成 X 伤害，为主角恢复 Y HP`。

3. `assets/Scripts/Logic/Enemy.ts`：
   - 击杀掉落灵石逻辑 `dropSpiritStone` 与 基础移动速度 `moveSpeed`。
   - 如何在怪物与精英怪被击杀掉落灵石时检测聚宝盆 (`relic_treasure_bowl`) 并实现掉落翻倍。
   - 如何在怪物生成或初始化移动速度时检测聚宝盆 (`relic_treasure_bowl`) 并将基础移动速度提升 20%。

4. `assets/Scripts/Logic/PetCaptureManager.ts`：
   - 局内抓捕宠物流程 `capturePet` / `attemptCapture` 及其概率计算机制。
   - 如何引入“失败计数器” (`gourdFailCount`)。
   - 如何检测穿戴吞天葫芦 (`relic_gourd_swallow`)：在抓捕失败时 `gourdFailCount++`；每次计算抓捕概率时累加 `gourdFailCount * 0.05` 的额外成功率；抓捕成功后重置 `gourdFailCount = 0`。

5. `assets/Scripts/Manager/UIManager.ts` 与纯代码 UI `EquipmentPanel.ts`：
   - 现有 UI 面板注册与纯代码防御性构建模式（如 `AppraisalPanel.ts`, `FurniturePanel.ts`）。
   - 如何防御性代码构建 `EquipmentPanel.ts`，并在 `UIManager.ts` 中注册。
   - 包含：穿戴/脱装、升级（消耗灵石与修仙材料）、合成升星（消耗2个同配置同星级法宝胚子，星级+1，上限5星）。

6. `assets/Scripts/Manager/SaveManager.ts`：
   - 现有 `ISaveData` 结构、`save()` / `load()` 逻辑。
   - 如何扩展 `equippedRelics` 与 `relicInventory` 字段并保障旧存档兼容补齐。

请在 `/Users/wesson/YokaiCodex/.agents/teamwork_preview_explorer_phase10_1/` 目录下生成 `analysis.md` 和 `handoff.md`。完成后通过 `send_message` 向 Parent (ID: `509a9885-a627-4528-8772-e494ce117f23`) 汇报。
