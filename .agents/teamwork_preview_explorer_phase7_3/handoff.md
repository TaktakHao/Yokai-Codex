# Handoff Report — Phase 7 Explorer 3 (R4 关卡数据与波次难度设计)

## 1. Observation (直接观察)

1. **`assets/resources/Configs/Level_1_Waves.json`**:
   - 现有的格式为一维扁平 JSON 数组（189 行）。
   - 每个元素仅包含 `spawn_time`, `monster_id`, `spawn_count`, `base_hp` 四个字段。
   - 缺失 `attack_damage`, `move_speed`, `exp_value`, `spawn_interval`, `is_elite`, `drop_config` 等核心字段。
2. **`assets/Scripts/LevelManager.ts`**:
   - 行号 7-19：`IWaveData` / `ILevelConfig` 接口定义过于精简，未定义怪物攻防速与精英怪特性的字段。
   - 行号 95-106：`loadLevelConfig()` 方法解析 JSON，仅注入 `loadedWaves: IWaveData[]`。
   - 行号 170-209：`spawnMonster()` 实例化/池化怪物节点后，在 206-208 行仅调用 `enemyComp.init(wave.base_hp, undefined, undefined, texturePath)`。
   - 单帧集中生成：所有怪物在 `gameTime >= wave.spawn_time` 触发的瞬间通过 `for` 循环全额生成。
3. **`assets/Scripts/Logic/Enemy.ts`**:
   - 行号 20-33：类属性 `maxHp`, `moveSpeed`, `attackDamage`, `attackInterval`, `expValue` 存在于组件中，但在初始化时没有被全额设置。
   - 行号 52-67：`init(hp?: number, speed?: number, target?: Node, texturePath?: string)` 方法参数有限，未接收 `attackDamage`, `expValue`, `isElite`, `dropConfig`。
4. **`Design/Outputs/Chapter1_LevelDesign.md`**:
   - 关卡总长 600 秒 (10 分钟)。
   - 第 180 秒（第3分）为阶段 Checkpoint，必刷出精英怪并掉落“聚灵宝箱”，用于玩家初次 Build 3选1 技能引导。

---

## 2. Logic Chain (推理链)

1. **前提 1**: 游戏设计要求怪物随波次呈现阶梯式的数值增长（HP、攻击力、移速、刷新密度），且在指定波次刷新具备特定标识 `isElite` 和掉落配置的精英怪。
2. **前提 2**: 现有 JSON 配置与解析器仅支持生命值 `base_hp` 传递，其余攻防速全走 `Enemy.ts` 硬编码默认值，无法在配置中完成不同波次怪物的阶梯数值差异化。
3. **推导 1**: 必须重构 JSON 结构，引入 `Waves -> MonsterGroups` 的嵌套波次结构，在 JSON 中显式指定 `base_hp`, `attack_damage`, `move_speed`, `exp_value`, `spawn_interval`, `is_elite`, `drop_config`。
4. **推导 2**: 针对关卡前三波（0s - 180s），需构建明确的阶梯难度公式 $HP(w) = HP_{base} \cdot (1 + \alpha(w-1)) \cdot (1 + \beta \lfloor \frac{w-1}{3} \rfloor)$，使前两波（0s-120s）顺利完成战斗教学与基调建立，第三波（180s）以高血高攻的精英怪拉高压迫感并完成宝箱掉落教学。
5. **推导 3**: `LevelManager.ts` 和 `Enemy.ts` 需要联动扩充 TS 接口与 `init` 签名，确保 JSON 配置中的数值能无缝注入运行时的 `Enemy` 实例中，并在精英怪生成时设置放大 Scale（1.5x）和触发掉落事件广播。

---

## 3. Caveats (注意事项)

1. **探险家探针限制**: 作为 Explorer，本探险过程完全只读，未对 `Level_1_Waves.json`、`LevelManager.ts` 或 `Enemy.ts` 源码进行修改。
2. **向后兼容要求 (Backwards Compatibility)**:
   - Implementer 在改造 `LevelManager.ts` 的 `loadLevelConfig()` 时，需判断 `rawJson` 是否为旧格式（扁平 Array），若是旧格式则进行适配转换，防止老版测试数据导致运行崩溃。
3. **性能注意事项**:
   - 当 `spawn_count` 较大时（如后期怪海 50+），单帧实例化可能会引起卡顿。后续可利用新设计的 `spawn_interval` 字段进行定时器分批生成。

---

## 4. Conclusion (结论与建议)

1. **重构 JSON 结构方案可行且具备高扩展性**：设计方案在 `analysis.md` 中给出了完整的嵌套 JSON Schema。
2. **难度曲线公式设计完成**：前三波详细数值表与阶梯公式已产出（见 `analysis.md` 第 4 节）。
3. **精英怪机制完整方案已就绪**：包含标识 `is_elite`、15x~20x 血量倍率加成、1.5x 视觉放大以及包含 `drop_chest: true` 的掉落配置。
4. **代码对接指引明确**：明确指出了 `LevelManager.ts` 与 `Enemy.ts` 需要增加的字段与函数参数签名。

---

## 5. Verification Method (验证方法)

Implementer 实现重构后，可按照以下步骤进行独立验证：

1. **配置文件 Schema 验证**:
   - 检查 `assets/resources/Configs/Level_1_Waves.json` 是否包含 `level_id`, `waves`, `monster_groups` 以及字段 `attack_damage`, `move_speed`, `is_elite`, `drop_config`。
2. **编译与接口验证**:
   - 检查 `assets/Scripts/LevelManager.ts` 中 `ILevelConfig` / `IWaveConfig` / `IMonsterGroupConfig` 接口。
   - 检查 `assets/Scripts/Logic/Enemy.ts` 的 `init()` 是否接收 `attack_damage`, `exp_value`, `is_elite`, `drop_config`。
3. **运行时日志验证**:
   - 启动游戏进入第一关（在 `GameManager` 或运行工程中）。
   - 检查控制台日志输出 `[LevelManager]` 与 `[刷怪]`，验证 0s、60s、120s、180s 刷出的怪物血量、攻击力、移速是否按设计呈阶梯增长（如 Wave 1 草精 HP=40，Wave 2 草精 HP=50，Wave 3 180s 时生成的草精精英 HP=1200、isElite=true）。
4. **精英怪特效与宝箱验证**:
   - 在 180s 时检查生成的精英怪节点 Scale 是否变为 1.5，并且在击杀精英怪后是否正确广播了掉落宝箱/触发技能面板相关事件。
