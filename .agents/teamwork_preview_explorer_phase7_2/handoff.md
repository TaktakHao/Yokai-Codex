# HANDOFF REPORT — Phase 7 Explorer 2 (玩法与数值系统)

## 1. Observation (直接观察)

通过对项目 codebase（位于 `/Users/wesson/YokaiCodex`）进行只读勘测，记录以下具体文件路径与关键代码片段观察：

1. **`assets/Scripts/Logic/SkillPoolManager.ts`**:
   - 行 50~103：定义了 `SkillPoolManager` 类与三大流派 (`体修`, `法修`, `御兽`) 的 3 级/5 级共鸣配置字典 `_resonanceConfigs`。
   - 行 122~261：`initSkillPool()` 内内置了 12 个基础技能（3 流派 × 4 技能）。
   - 行 269~289：`getRandomSkills(count)` 使用 Fisher-Yates 算法随机抽取未满级技能，目前未引入流派权重倾斜及全技能满级的兜底逻辑。
   - 行 297~326：`selectSkill(skillId)` 升级技能并增加对应流派标签计数，自动触发 `checkResonance(skill.tag)`。

2. **`assets/Scripts/PlayerController.ts`**:
   - 行 171~182：`addExp(exp)` 累加经验，触发 `UIEvent.UPDATE_EXP` 并判定升级。
   - 行 187~199：`levelUp()` 处理升级（`level++`, `maxExp = Math.floor(maxExp * 1.5)`, `maxHp += 20`），派发 `UIEvent.LEVEL_UP` 事件。

3. **`assets/Scripts/Manager/GameManager.ts`**:
   - 行 112~118 & 行 244~250：`onPlayerLevelUpEvent()` 监听 `UIEvent.LEVEL_UP` 事件，目前调用 `UIManager.instance.openUI('UI/SkillSelectPanel')`。

4. **`assets/Scripts/Manager/SaveManager.ts`**:
   - 行 6~26：`ISaveData` 定义了 `player`（含 `realmIndex`, `spiritStones`, `materials`）、`talents`、`pets` 以及 `lastOfflineTime`。
   - 行 115~139：`save()` 将内存存档序列化保存至 `sys.localStorage.setItem('yokai_codex_save_v1', ...)`。

5. **`assets/Scripts/Manager/HomeManager.ts`**:
   - 行 33~40：定义 6 大境界配置 `REALM_CONFIGS`（练气至渡劫，挂机产率倍率 $1.0\times \sim 10.0\times$）。
   - 行 180~200：`getSpiritStoneRate()` 和 `getMaterialRate()` 计算综合实时产率。
   - 行 207~248：`settleOfflineEarnings()` 根据时间差结算挂机收益，目前直接按线型时长计算，未包含 24 小时上限与分段衰减算式。

---

## 2. Logic Chain (推理逻辑链)

1. **观察 1 (经验 -> 升级 -> 事件派发)**：`Enemy.die()` -> `PlayerController.addExp()` -> `levelUp()` 派发 `UIEvent.LEVEL_UP`。
2. **观察 2 (GameManager 捕获与暂停)**：`GameManager` 收到 `UIEvent.LEVEL_UP` 广播后，应挂起战斗（`director.pause()`），并调起 `SkillSelectPanel`。
3. **观察 3 (SkillPoolManager 抽取与选择)**：`SkillPoolManager` 提供 `getRandomSkills(3)` 和 `selectSkill(id)`。升级选技能后，技能等级与流派 Tag 增加，触发共鸣检测 `checkResonance()`。
4. **推理结论 A (局内 3选1)**：整个 Roguelike 3选1 链路闭环完整，主要缺少纯代码构建的 `SkillSelectPanel.ts` 视图组件、流派偏好权重算法及全局日志打点。
5. **观察 4 (挂机产率与离线结算)**：`HomeManager` 已有境界倍率、天赋加成与 `settleOfflineEarnings()`，`SaveManager` 已有 `lastOfflineTime` 的持久化支持。
6. **推理结论 B (局外资源闭环)**：离线挂机闭环已具备核心框架，只需在 `settleOfflineEarnings()` 中补全 24 小时全额 + 48 小时 20% 软上限衰减算式，并配合局内关卡结算与突破/升级消耗，即可形成完美正反馈经济闭环。

---

## 3. Caveats (保留意见与注意事项)

1. **未深入勘测区域**：未对 `PetCaptureManager.ts` 中宠物出战对局外挂机产率的额外加成进行复杂配表勘测（目前预留了接口）。
2. **假设与前提**：假定 UI 均采用 Cocos Creator 纯代码防御性构建（`Defensive Code-Only Construction`），不依赖编辑器场景中的 Node 绑定，以确保自动化测试一致性。

---

## 4. Conclusion (最终结论与方案评估)

1. **局内 R2 方案**：
   - 击杀 -> 经验 -> 升级 -> 3选1 -> 属性应用 -> 恢复战斗 链路清晰、结构高度解耦。
   - 需要Implementer在 `SkillPoolManager.ts` 中增加基于流派标签的加权抽样与全满级保底逻辑，并新建 `SkillSelectPanel.ts` 防御性 UI 组件。
2. **局外 R2 方案**：
   - 挂机收益模型由 `HomeManager.ts` 统一承载，基于公式 $R_{\text{real}} = R_{\text{base}} \times M_{\text{realm}} \times (1 + \text{Talents})$ 计算。
   - 离线结算引入 24h 全额 + 48h 20% 衰减算式，进游戏/切后台时由 `SaveManager` 自动触发持久化。

---

## 5. Verification Method (独立验证方法)

1. **局内三选一验证**：
   - 步骤：在控制台或测试代码中触发 `PlayerController.addExp(100)` 使玩家升级。
   - 预期结果：控制台输出 `[Roguelike技能系统]` 升级与抽取 Log，游戏暂停并弹出 `SkillSelectPanel` 面板；选择技能后打印流派 Tag 计数与共鸣触发 Log，游戏恢复运行。
2. **局外挂机闭环验证**：
   - 步骤：修改 `sys.localStorage` 中的 `yokai_codex_save_v1` 内 `lastOfflineTime` 为 24 小时前（`-86400000` ms），重启游戏。
   - 预期结果：`GameManager.initSystem()` 调用 `HomeManager.settleOfflineEarnings()`，控制台输出 `[HomeManager] 离线挂机结算完成: 离线 86400 秒... 获得灵石 +86400，获得修仙材料 +43200`，灵石与材料数量准确累加。
