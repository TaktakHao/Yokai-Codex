## 2026-07-21T09:00:10Z
你是 Phase 10 的 Worker Subagent（teamwork_preview_worker）。
工作目录：/Users/wesson/YokaiCodex/.agents/teamwork_preview_worker_phase10_1/

请阅读并遵守 MANDATORY INTEGRITY WARNING：
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

请参考 Explorer 1 的分析报告（`/Users/wesson/YokaiCodex/.agents/teamwork_preview_explorer_phase10_1/analysis.md` 和 `handoff.md`），在 `/Users/wesson/YokaiCodex/assets/Scripts` 中真实、严谨地实现 Phase 10 的三大核心需求：

### R1. 仙器法宝数据结构与规则篡改特质 (Relic Traits & Mechanics)
1. **`assets/Scripts/Manager/HomeManager.ts`**：
   - 定义法宝部位 `RelicSlotType` (`WEAPON = 'WEAPON'`, `ACCESSORY = 'ACCESSORY'`, `GOURD = 'GOURD'`)。
   - 定义法宝实体 `IRelicData` (id, configId, name, type, star, level, baseBonus 等) 数据结构。
   - 配置三大初始法宝规则：`relic_sword_vampire` (主武器 吸血魔剑), `relic_treasure_bowl` (配饰 聚宝盆), `relic_gourd_swallow` (祖传葫芦 吞天葫芦)。
   - 在 `HomeManager` 中扩展 `_equippedRelics` (`Record<RelicSlotType, IRelicData | null>`) 与 `_relicInventory` (`IRelicData[]`)。
   - 提供 `getEquippedRelic(slot)`, `hasEquippedRelic(configId)`, `equipRelic(relicId, slot)`, `unequipRelic(slot)`, `upgradeRelic(relicId)`, `synthesizeRelic(targetId, material1Id, material2Id)` 等公有 API。

2. **`assets/Scripts/PlayerController.ts`** 与 **`assets/Scripts/Logic/PetFollower.ts`**：
   - 在主角基础攻击力计算时，判定若穿戴吸血魔剑 (`relic_sword_vampire`)，削减 50% 基础攻击力 (`attackDamage * 0.5`)。
   - 在主角造成伤害（含技能攻击与 `PetFollower` 飞弹命中敌人）时，调用 `PlayerController.triggerVampireLifesteal(damage)`。若穿戴吸血魔剑，为主角恢复 `damage * 0.05` 的 HP，且带有明确控制台日志 `console.log(\`[吸血魔剑] 造成 \${damage} 伤害，为主角恢复 \${healVal} HP\`)`。

3. **`assets/Scripts/Logic/Enemy.ts`**：
   - 击杀掉落：在怪物与精英怪被击杀掉落灵石时，若穿戴聚宝盆 (`relic_treasure_bowl`)，灵石掉落数量翻倍 (`dropAmount * 2`)。
   - 基础移速：在怪物生成或初始化移速时，若穿戴聚宝盆 (`relic_treasure_bowl`)，基础移动速度永久提升 20% (`moveSpeed * 1.2`)。

4. **`assets/Scripts/Logic/PetCaptureManager.ts`**：
   - 增加失败计数器 `_gourdFailCount`。
   - 在抓捕概率计算时，若穿戴吞天葫芦 (`relic_gourd_swallow`)，累加 `_gourdFailCount * 0.05` 成功率。
   - 每次抛葫芦抓捕失败时 `_gourdFailCount++`；抓捕判定成功后重置 `_gourdFailCount = 0`。

### R2. 局外法宝装备穿戴、升级与合成面板 (EquipmentPanel UI)
1. 创建 `assets/Scripts/UI/EquipmentPanel.ts`：纯代码防御性构建（不依赖 prefab，使用 `new Node()` 包含槽位展示、背包列表、穿脱、升级扣减灵石材料、合成升星校验与消耗 2 个同配置同星级胚子，星级+1，上限5星）。
2. 在 `assets/Scripts/Manager/UIManager.ts` 中注册 `EquipmentPanel` 动态代码生成模式。

### R3. 装备与背包数据持久化存盘 (Equipment Save System)
1. 在 `assets/Scripts/Manager/SaveManager.ts` 中扩展 `ISaveData` 字段：`equippedRelics` 与 `relicInventory`。
2. 在 `save()` / `load()` 中实现法宝数据的序列化、反序列化以及旧存档兼容补齐。

### 验证要求
- 完成代码编写后，必须在 shell 中运行 TypeScript 编译检查或项目构建/语法校验命令，确保无语法错误与 TypeScript 类型报错。
- 在 `/Users/wesson/YokaiCodex/.agents/teamwork_preview_worker_phase10_1/` 下输出 `changes.md` 与 `handoff.md`。
- 完成后向 Parent (`509a9885-a627-4528-8772-e494ce117f23`) 发送 `send_message`。
