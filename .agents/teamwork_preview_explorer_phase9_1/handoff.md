# Handoff Report — Phase 9 Technical Analysis

## 1. Observation (观察)

经过对 `/Users/wesson/YokaiCodex/assets/Scripts/` 目录下 TypeScript 代码的深入 Read-Only 探查，记录具体事实如下：

- **`Logic/PetCaptureManager.ts`**:
  - `PetEgg` 接口（lines 34-51）包含 `eggId`, `monsterType`, `monsterId`, `obtainTime`, `rarity`, `baseAttack`, `baseHp`, `baseSpeed`。
  - `AppraisedPet` 接口（lines 56-77）包含 `petId`, `name`, `isMutated`, `attack`, `hp`, `speed`, `form`, `rarity`, `obtainTime`, `appraiseTime`。缺失 `star`, `isEvolved`, `element`, `monsterId` 等关键字段。
  - `mutationRate` 属性定义于 line 100（默认 `0.05` 即 5%），在 `appraisePetEgg()`（lines 182-222）中实现属性翻倍与 `变异·` 名称前缀处理。
- **`Logic/PetFollower.ts`**:
  - 飞弹在 `fireProjectile()`（lines 176-227）中动态生成，`UITransform` 尺寸硬编码为 `14x14`。伤害直接为 `this.petData.attack`。尚未整合宠物星级 `star` 提升与 `isEvolved` 化形放大系数。
- **`Manager/HomeManager.ts`**:
  - 管理 `_spiritStones`, `_materials`, `_currentRealmIndex`, `_talents`, `_equippedPetIds` (lines 92-133)。
  - 挂机产率由 `getSpiritStoneRate()` 和 `getMaterialRate()` 计算 (lines 216-238)。
  - 缺少洞府家具配置表 `IFurnitureConfig` 与购买持久化逻辑，缺少五行羁绊统计 `calculateElementResonance()`。
- **`PlayerController.ts`**:
  - 仅包含 `maxHp`, `currentHp`, `attackDamage`, `attackCooldown`, `moveSpeed` (lines 22-48)。
  - 自动攻击 `executeAutoAttack()`（lines 154-199）直接造成 `this.attackDamage` 固定伤害。缺少暴击率、暴伤、每秒回血 (HP Regen)、CDR、免伤/防御力等战斗数值体系及共鸣加成整合中枢 `getFinalStats()`。
- **`Manager/UIManager.ts`**:
  - `openUI()` 方法（lines 38-87）在 `resources.load` 失败时通过 `panelName` 判断并纯代码构建面板组件 (`BattleUIPanel`, `SkillSelectPanel`, `TribulationPanel`)。
  - 缺少 `AppraisalPanel`（鉴定盲盒 UI）和 `FurniturePanel`（洞府装修 UI）的自动映射。
- **`Manager/SaveManager.ts`**:
  - `ISaveData` 结构（lines 6-32）定义全量持久化数据。`save()`、`load()` 与 `applySaveToManagers()`（lines 84-256）负责读写 LocalStorage。
  - 尚未包含洞府家具序列化字段 `furniture`，以及宠物星级/化形/五行数据的反序列化向下兼容兜底。

---

## 2. Logic Chain (推理链)

1. **从宠物数据结构推导 R1 & R3 瓶颈**：
   - 现有的 `AppraisedPet` 丢失了 `monsterId`（种属标识），缺少 `star`（星级）、`isEvolved`（化形）和 `element`（五行）。
   - 要实现吞噬升星（必须校验同种属或同稀有度）与五行共鸣（必须统计上阵宠物的元素分布），必须首先在 `PetEgg` 和 `AppraisedPet` 中补齐这 4 个核心字段。
2. **从局外资源与战斗关联推导 R3 & R4 扩展点**：
   - `HomeManager` 掌控上阵宠物列表 `_equippedPetIds` 和洞府挂机数据。
   - 增加五行共鸣时，应由 `HomeManager` 根据 `_equippedPetIds` 动态统计金木水火土数量并计算羁绊，然后暴露接口供 `PlayerController` 和 `PetFollower` 实时查询；
   - 增加洞府家具时，应在 `HomeManager` 增加家具购买方法及产率/属性加成，并将其扩展存入 `SaveManager` 的 JSON 存档中。
3. **从战斗公式推导数值整合中枢需求**：
   - `PlayerController` 和 `PetFollower` 目前的攻击为简单的固定数值。
   - 引入五行共鸣和化形系统后，`PetFollower` 飞弹伤害与尺寸需综合 `star` 与 `isEvolved`；`PlayerController` 需增加 `getFinalStats()` 聚合境界、天赋、家具与共鸣，实现暴击率、CDR 缩减攻速、每秒回血与免伤计算。
4. **从 UI 与存档架构推导防御构建与向下兼容**：
   - 项目采用纯代码 UI 兜底策略（以应对无 Prefab 资产的情况）。因此 `AppraisalPanel` 需继承该设计，在 `onLoad()` 时动态创建 UI 节点与按钮；
   - `SaveManager` 在反序列化旧存档时，必须对缺失的 `star`, `isEvolved`, `element`, `furniture` 等字段填补默认值，防止旧存档导致运行时报错。

---

## 3. Caveats (注意事项与假设)

- **Read-Only 探查原则**：本次阶段为纯技术探查与方案设计，未修改任何项目业务源码。所有的分析与落地重构计划均写入 `analysis.md`。
- **预制体依赖假设**：假设项目后续开发继续遵循纯代码 (Pure-Code) UI 补齐原则，即使没有 `.prefab` 资源也能通过代码完备渲染。
- **数值平衡**：重构方案中给出的加成系数（如星级每级 +25% 伤害、化形 +50% 伤害，五行共鸣同系 2/3 只加成等）为标准推荐方案，后续可由数值策划进行微调。

---

## 4. Conclusion (结论)

针对第九阶段 4 大核心需求的技术探查已全面完成，重构落地方案具备极高的完备性与可实施性：
- 宠物接口 (`PetEgg` / `AppraisedPet`) 补齐了 `star`, `isEvolved`, `element`, `monsterId`；
- `HomeManager` 与 `SaveManager` 实现了家具购买持久化与五行共鸣羁绊统计；
- `PetFollower` 和 `PlayerController` 具备了完整的星级/化形/暴击/CDR/回血/免伤等高级战斗计算体系；
- `AppraisalPanel` 与 `UIManager` 满足防御性纯代码构建标准。

技术分析报告已保存至 `/Users/wesson/YokaiCodex/.agents/teamwork_preview_explorer_phase9_1/analysis.md`。

---

## 5. Verification Method (验证方法)

1. **文档核查**：
   - 检查 `/Users/wesson/YokaiCodex/.agents/teamwork_preview_explorer_phase9_1/analysis.md` 是否覆盖 R1 - R4 四大需求及 6 大核心探查问题。
2. **代码结构对比**：
   - 对照 `PetCaptureManager.ts`、`PetFollower.ts`、`HomeManager.ts`、`PlayerController.ts`、`UIManager.ts`、`SaveManager.ts` 的实际行号与接口字段，核实重构方案的精确性。
3. **接口兼容性断言**：
   - 验证新增的 `PetElement`、`IFurnitureConfig` 与 `IResonanceBonus` 接口是否无冲突地无缝衔接现有 TypeScript 类型系统。
