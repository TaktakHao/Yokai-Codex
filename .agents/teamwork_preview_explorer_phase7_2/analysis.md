# R2 玩法与数值系统 (Roguelike三选一技能与局外挂机资源闭环) 勘测分析报告

## 1. 勘测概述与目标

本报告由 **Phase 7 玩法与数值系统探险家 (Explorer 2)** 针对《万妖录：躺平修仙》项目代码库（Cocos Creator 3.x 架构）进行深度只读勘测与方案设计。
本次排查重点关注需求 **R2** 的两大核心模块：
1. **局内 Roguelike 三选一技能系统**：梳理“击杀怪物 -> 经验积累 -> 主角升级 -> 触发 3选1 技能抽取 -> 技能生效与流派共鸣”的完整运行链路，并设计数据结构、抽取算法与防御性 UI / 日志测试方案。
2. **局外挂机资源闭环系统**：检查现有的 `SaveManager.ts`、`HomeManager.ts` 与 `IdleSystem.ts`，设计结合在线/离线时长、境界倍率、天赋加成的灵石与修仙材料产出模型、24小时离线上限衰减算法及经济闭环流转机制。

---

## 2. 局内 Roguelike 三选一技能系统 (R2) 勘测与设计

### 2.1 相关核心文件现状排查

| 文件路径 | 现况与角色职责 | 存在的主要问题/需拓展点 |
|---|---|---|
| `assets/Scripts/Logic/SkillPoolManager.ts` | 实现了 `ISkill` 接口、`SkillTag`（体修/法修/御兽）、12个内置技能数据、`getRandomSkills(count)`、`selectSkill(skillId)` 以及流派共鸣检测 `checkResonance(tag)`。 | 1. 技能数据硬编码在类内部，缺少动态 JSON 加载扩展；<br>2. `getRandomSkills` 采用纯等概率 Fisher-Yates 抽样，未引入流派倾向权重（Weight Bias）或满级兜底奖励机制。 |
| `assets/Scripts/PlayerController.ts` | 维护主角生命、经验（`currentExp`, `maxExp`）、等级（`level`）；实现 `addExp(exp)` 与 `levelUp()`，并在升级时广播 `UIEvent.LEVEL_UP` 事件。 | 1. 升级时仅增加了 `maxHp` 与重新计算 `maxExp`；<br>2. 尚未接收 `selectSkill` 选择后的属性加成/技能效果回调接口。 |
| `assets/Scripts/Manager/GameManager.ts` | 监听 `UIEvent.LEVEL_UP` 事件，触发 `UIManager.instance.openUI('UI/SkillSelectPanel')`。 | 1. 尚未在打开 `SkillSelectPanel` 时自动挂起/暂停战斗时钟（`pauseGame()` / `director.pause()`）；<br>2. 技能选择完成后需取消暂停。 |
| `assets/Scripts/UI/BattleUIPanel.ts` | 负责血条、经验条、计时器、摇杆等战斗 UI 元素的防御性纯代码构建与更新。 | 尚未包含三选一技能面板的触发入口与渲染交互。 |
| `assets/Scripts/Manager/EventManager.ts` | 定义全局事件 `CombatEvent` 与 `UIEvent.LEVEL_UP`。 | 缺 `UIEvent.SKILL_SELECTED` 与 `UIEvent.REROLL_SKILLS` 事件定义。 |

---

### 2.2 击杀怪物 -> 经验积累 -> 升级 -> 触发 3选1 抽取链路

通过对代码的追踪，完整的局内经验与技能抽取链路如下：

```
[Enemy.ts] takeDamage(amount)
   │ (HP <= 0)
   ▼
[Enemy.ts] die()
   ├── targetPlayer.addExp(expValue)
   └── EventManager.emit(CombatEvent.ENEMY_DIED, { expReward: 10 })
   │
   ▼
[PlayerController.ts] addExp(exp)
   ├── currentExp += exp
   ├── EventManager.emit(UIEvent.UPDATE_EXP, { currentExp, maxExp })
   │   (currentExp >= maxExp)
   ▼
[PlayerController.ts] levelUp()
   ├── level++, maxExp = Math.floor(maxExp * 1.5), maxHp += 20
   └── EventManager.emit(UIEvent.LEVEL_UP, newLevel)
   │
   ▼
[GameManager.ts] onPlayerLevelUpEvent(newLevel)
   ├── director.pause() / GameManager.pauseGame() [暂停局内战斗]
   └── UIManager.instance.openUI('UI/SkillSelectPanel')
   │
   ▼
[SkillSelectPanel.ts] (纯代码 UI 面板加载)
   ├── SkillPoolManager.getRandomSkills(3) 抽取3个可用技能
   └── 渲染 3 张技能卡片，等待玩家点击选择
   │
   ▼
[玩家点击某个技能]
   ├── SkillPoolManager.selectSkill(chosenSkillId)
   │     ├── skill.level + 1
   │     ├── tagCounts[skill.tag] + 1
   │     └── checkResonance(skill.tag) [检测并激活流派共鸣]
   ├── PlayerController.applySkillEffect(skill) [应用技能属性加成/技能效果]
   ├── UIManager.instance.closeUI('UI/SkillSelectPanel')
   └── director.resume() / GameManager.resumeGame() [恢复局内战斗]
```

---

### 2.3 技能池数据结构与 3选1 抽取算法设计

#### 2.3.1 技能数据结构扩展 (`ISkillConfig`)

在现有 `ISkill` 基础上，设计支持 JSON 加载与丰富效果类型的完整结构：

```typescript
export type SkillTag = '体修' | '法修' | '御兽';

export enum SkillEffectType {
    MAX_HP = 'maxHp',                 // 生命上限加成 (%)
    HP_REGEN = 'hpRegen',             // 每秒生命回复
    ATTACK_DAMAGE = 'attackDamage',   // 攻击力加成 (%)
    DEFENSE = 'defense',             // 减伤/防御加成
    MOVE_SPEED = 'moveSpeed',         // 移速加成 (%)
    CRIT_RATE = 'critRate',           // 暴击率加成 (%)
    CD_REDUCTION = 'cdReduction',     // 冷却缩减 (%)
    LIGHTNING_AOE = 'lightningDamage',// 掌心雷/引雷
    FIRE_STORM = 'fireAoE',           // 烈焰风暴
    SUMMON_WOLF = 'summonWolf',       // 召唤灵狼
    PET_BUFF = 'petBuff'              // 宠物属性Buff
}

export interface ISkill {
    id: string;
    name: string;
    description: string;
    level: number;
    maxLevel: number;
    tag: SkillTag;
    icon: string;
    effectValue: number;              // 基础效果数值（每级增加量）
    effectType: SkillEffectType | string;
    weight?: number;                  // 基础抽取权重 (默认 100)
}
```

#### 2.3.2 带权重与流派协同倾向的 3选1 抽取算法

为提高 Roguelike 构筑流派的爽快感，设计 **流派偏好权重算法 (Weighted Sampling with Tag Bias)**：

1. **筛选有效技能**: `available = pool.filter(s => s.level < s.maxLevel)`
2. **计算加权分值**: 
   - 基础权重 $W_{\text{base}} = \text{skill.weight} \parallel 100$
   - 流派协同加成: 若玩家已在该流派积累了 $N$ 个标签（如法修已选 2 个），则同流派技能权重倍率 $M_{\text{tag}} = 1.0 + N \times 0.25$
   - 最终权重 $W_{\text{final}} = W_{\text{base}} \times M_{\text{tag}}$
3. **加权无放回抽样**:
   - 若可用技能数 $\le 3$，直接返回所有可用技能。
   - 若可用技能数 $> 3$，按 $W_{\text{final}}$ 概率计算连续抽取 3 个不重复技能。
4. **全满级兜底处理**:
   - 若所有技能均达到 `maxLevel`，自动生成保底虚幻技能：
     - `fallback_1`: 【灵石大礼包】(立即获得 +100 灵石)
     - `fallback_2`: 【灵丹妙药】(立即恢复 100% 生命值)
     - `fallback_3`: 【修为大增】(获得攻击力 +10% 临时 Buff)

---

### 2.4 流派共鸣 (Resonance) 触发与生效设计

技能池中配置了三大流派的 3 级 / 5 级共鸣效果：

| 流派 | 阈值 | 共鸣名称 | 详细效果加成 |
|---|---|---|---|
| **体修** | 3 个 | 金刚不坏身 | 物理减伤 +30%，最大生命值 +50% |
| **体修** | 5 个 | 无上肉身 | 获得霸体免控，受击触发 40% 气血反弹 |
| **法修** | 3 个 | 万法归宗 | 法术伤害 +50%，全技能 CD 缩减 20% |
| **法修** | 5 个 | 天道法典 | 法术命中附带天雷连击（3次），法暴率 +30% |
| **御兽** | 3 个 | 百兽朝苍 | 灵兽全属性 +60%，随从出战上限 +2 |
| **御兽** | 5 个 | 万兽降世 | 召唤兽群狂暴，50% 概率召唤神兽领主助战 |

当 `SkillPoolManager.selectSkill()` 被调用后，自动触发 `checkResonance(skill.tag)`，若新激活了共鸣，则派发全局事件 `UIEvent.RESONANCE_ACTIVATED`，通知 `PlayerController` 与 UI 特效层应用共鸣 Buff 并在界面顶部展示金色横幅小提示。

---

### 2.5 测试 UI (`SkillSelectPanel.ts`) 与日志输出方案

项目目前缺少 `SkillSelectPanel.ts` 文件。遵循项目**纯代码防御性构建 (Defensive Code-Only Construction)** 规范，设计 `SkillSelectPanel.ts`：

#### UI 节点层级结构
```
SkillSelectPanel (Root, Semi-transparent Mask)
 ├── PanelBg (Center, 700x450)
 ├── TitleLabel ("选择一项突破修行为你的神通加持")
 ├── SkillCardContainer (Horizontal Layout)
 │    ├── SkillCard_0 (Button + Sprite + Labels: Name, Tag, Level, Desc, Effect)
 │    ├── SkillCard_1 (Button + Sprite + Labels)
 │    └── SkillCard_2 (Button + Sprite + Labels)
 └── RerollButton ("刷新选项 (消耗20灵石)")
```

#### 测试日志标准输出规范
每次触发 3选1 与技能选择时，统一在控制台打印规范日志：

```
[Roguelike技能系统] ════════════════ 玩家升级 ════════════════
[Roguelike技能系统] 玩家升至 Lv.3！触发 Roguelike 3选1 技能抽取。
[Roguelike技能系统] 候选技能 1: 【法修·掌心雷】(Lv.1/5) - 造成高额雷电伤害
[Roguelike技能系统] 候选技能 2: 【体修·金刚不坏】(Lv.0/5) - 提升生命上限与防御
[Roguelike技能系统] 候选技能 3: 【御兽·唤狼术】(Lv.0/5) - 召唤灵狼协助作战
[Roguelike技能系统] 玩家选择了候选 1: 【法修·掌心雷】(Lv.2)
[Roguelike技能系统] 当前流派计数 -> 体修: 0 | 法修: 3 | 御兽: 0
[Roguelike技能系统] 🔥【流派共鸣触发】法修达到 3 层！激活共鸣技能【万法归宗】：法术伤害+50%，CD -20%！
[Roguelike技能系统] ════════════════ 恢复战斗 ════════════════
```

---

## 3. 局外挂机资源闭环 (R2) 勘测与设计

### 3.1 现有数据持久化与资源系统排查

通过排查 `SaveManager.ts` 与 `HomeManager.ts`：

1. **`SaveManager.ts`**:
   - 已定义 `ISaveData` 结构，包含 `player.spiritStones`, `player.materials`, `player.realmIndex`, `lastOfflineTime`, `talents`, `pets`。
   - 基于 `sys.localStorage.setItem('yokai_codex_save_v1', ...)` 实现序列化与反序列化，具备版本校验与默认降级兜底。
2. **`HomeManager.ts`**:
   - 维护 `spiritStones`（灵石）与 `materials`（修仙材料）内存变量。
   - 维护 `REALM_CONFIGS`（练气至渡劫 6 大境界）与 `INITIAL_TALENTS`（摸鱼心法、聚灵符阵、卧榻吐纳、天命机缘 4 大天赋）。
   - 已具备 `getSpiritStoneRate()`, `getMaterialRate()`, `settleOfflineEarnings()`, `upgradeRealm()`, `upgradeTalent()` 的基础逻辑。
3. **`IdleSystem.ts`**:
   - 为早期独立测试脚本，需与 `HomeManager` 和 `SaveManager` 进行彻底解耦统一，由 `HomeManager` 统一掌管挂机收益逻辑。

---

### 3.2 挂机收益计算模型与 24小时上限/衰减机制

#### 3.2.1 产出速率数学模型 (Rate Model)

$$\text{Rate}_{\text{stone}} = R_{\text{base\_stone}} \times M_{\text{realm}} \times \left(1 + \text{Lv}_{\text{fish}} \times 0.10 + \text{Lv}_{\text{meditation}} \times 0.15\right)$$

$$\text{Rate}_{\text{material}} = R_{\text{base\_mat}} \times M_{\text{realm}} \times \left(1 + \text{Lv}_{\text{gather}} \times 0.10 + \text{Lv}_{\text{meditation}} \times 0.15\right)$$

- 基础产率：$R_{\text{base\_stone}} = 1.0$ 个/秒 ($3,600$ 个/小时)；$R_{\text{base\_mat}} = 0.5$ 个/秒 ($1,800$ 个/小时)。
- 境界倍率 $M_{\text{realm}}$：
  - 练气期 (Lv.1): $1.0\times$
  - 筑基期 (Lv.2): $1.5\times$
  - 金丹期 (Lv.3): $2.2\times$
  - 元婴期 (Lv.4): $3.5\times$
  - 化神期 (Lv.5): $5.5\times$
  - 渡劫期 (Lv.6): $10.0\times$

#### 3.2.2 离线时长上限与分段衰减算式

为了防止无限离线导致数值通胀并鼓励玩家每日登录，设计 **24小时无衰减 + 超出部分 20% 软上限衰减算式**：

- 最大全额收益离线时长 $T_{\text{full}} = 86,400 \text{ 秒} (24 \text{ 小时})$。
- 绝对封顶离线时长 $T_{\text{cap}} = 172,800 \text{ 秒} (48 \text{ 小时})$。

计算有效挂机时长 $T_{\text{effective}}$：
$$T_{\text{offline}} = \max\left(0, \frac{\text{Date.now}() - \text{lastOfflineTime}}{1000}\right)$$

$$T_{\text{effective}} = \begin{cases} 
T_{\text{offline}} & \text{若 } T_{\text{offline}} \le T_{\text{full}} \\
T_{\text{full}} + (T_{\text{offline}} - T_{\text{full}}) \times 0.20 & \text{若 } T_{\text{full}} < T_{\text{offline}} \le T_{\text{cap}} \\
T_{\text{full}} + (T_{\text{cap}} - T_{\text{full}}) \times 0.20 & \text{若 } T_{\text{offline}} > T_{\text{cap}}
\end{cases}$$

结算产出：
$$\Delta \text{Stones} = \lfloor \text{Rate}_{\text{stone}} \times T_{\text{effective}} \rfloor$$
$$\Delta \text{Materials} = \lfloor \text{Rate}_{\text{material}} \times T_{\text{effective}} \rfloor$$

---

### 3.3 离线结算与持久化闭环流程 (Offline Settlement Protocol)

```
                       [玩家启动游戏 / 切回前台]
                                   │
                                   ▼
                   [SaveManager.instance.load()]
            从 sys.localStorage 反序列化 ISaveData 数据
                                   │
                                   ▼
             [HomeManager.instance.settleOfflineEarnings()]
     ├── 读取 lastOfflineTime，计算 T_offline = (Now - lastOfflineTime)/1000
     ├── 按分段衰减公式计算 T_effective
     ├── 计算 ΔStones 与 ΔMaterials
     ├── 累加至内存 _spiritStones 与 _materials
     ├── 更新 _lastOfflineTime = Date.now()
     └── 自动调用 HomeManager.instance.saveData() & SaveManager.instance.save()
                                   │
                                   ▼
                 [UIManager 打开 OfflineRewardPanel 结算弹窗]
          展示离线时长 (如 "14小时20分")、获得灵石 +X、获得修仙材料 +Y
                                   │
                                   ▼
                       [游戏运行中 / 切后台前]
     ├── update(dt): 每帧/每5秒同步内存 _lastOfflineTime = Date.now()
     └── onAppHide / 切关卡 / 消耗资源: 自动触发 SaveManager.instance.save()
```

---

### 3.4 局外经济闭环模型 (Economic Loop)

整个局外闭环由“**产出 (Sources)** -> **积累 (Storage)** -> **消耗与转化 (Sinks & Upgrades)**”构成完整回路：

```
       ┌────────────────────────────────────────────────────────┐
       │                       产出端 (Sources)                  │
       │  1. 洞府挂机 (灵石/材料，受境界与天赋加成)                 │
       │  2. 局内战斗结算 (通关/失败奖励灵石与材料)                │
       └──────────────────────────┬─────────────────────────────┘
                                  │ 积累 (SaveManager 持久化)
                                  ▼
       ┌────────────────────────────────────────────────────────┐
       │                       积累端 (Storage)                 │
       │  灵石 (Spirit Stones)        修仙材料 (Materials)       │
       └──────────┬─────────────────────────────────┬───────────┘
                  │ 消耗                            │ 消耗
                  ▼                                 ▼
┌──────────────────────────────────┐  ┌──────────────────────────────────┐
│      突破境界 (upgradeRealm)     │  │      升级天赋 (upgradeTalent)    │
│  - 消耗大量灵石                  │  - 消耗灵石                       │
│  - 提升挂机倍率 (1.0x -> 10.0x)  │  │  - 提升灵石/材料产率 (+10%/级)    │
│  - 形成挂机产出的【正反馈循环】   │  │  - 降低境界突破消耗 (-5%/级)      │
└──────────────────────────────────┘  └──────────────────────────────────┘
                  │                                 │
                  └────────────────┬────────────────┘
                                   │ 提升实力与产率
                                   ▼
                     [进入更高关卡割草 & 更高挂机收益]
```

---

## 4. 代码修改与扩展计划 (Code Modification Plan)

> **声明**：本计划供 Implementer 阶段参考执行，探险家本身保持只读。

### 计划 1: 扩展 `EventManager.ts`
- **文件**: `assets/Scripts/Manager/EventManager.ts`
- **变更**: 在 `UIEvent` 中新增 `SKILL_SELECTED`, `RESONANCE_ACTIVATED`, `OFFLINE_SETTLED` 事件枚举，供 UI 与系统解耦联动。

### 计划 2: 完善 `SkillPoolManager.ts`
- **文件**: `assets/Scripts/Logic/SkillPoolManager.ts`
- **变更**: 
  1. 优化 `getRandomSkills(count)`：实现基于玩家流派标签积累的权重视效算法（Tag Weight Bias）与全满级保底（Fallback）逻辑。
  2. 增强 `selectSkill(skillId)`：选择技能后通过 `EventManager` 广播 `UIEvent.SKILL_SELECTED` 并返回所获技能的效果参数给 `PlayerController`。

### 计划 3: 新建纯代码 `SkillSelectPanel.ts`
- **文件**: `assets/Scripts/UI/SkillSelectPanel.ts` (新建)
- **变更**: 
  1. 采用纯代码防御性构建 3 张技能选项卡与“刷新”按钮。
  2. 界面打开时调用 `SkillPoolManager.getRandomSkills(3)` 并展示。
  3. 选项被点击时调用 `SkillPoolManager.selectSkill(id)`，触发共鸣检测与控制台格式化 Log，恢复游戏时间轴。

### 计划 4: 增强 `HomeManager.ts` 离线挂机与上限衰减
- **文件**: `assets/Scripts/Manager/HomeManager.ts`
- **变更**: 
  1. 在 `settleOfflineEarnings()` 中引入 24 小时全额 + 48 小时 20% 衰减算式。
  2. 规范离线收益结算的控制台 Log 输出与 UI 弹窗触发。

---

## 5. 结论

需求 **R2 (Roguelike 三选一技能框架与局外挂机资源闭环)** 的整体架构设计清晰且完备。`SkillPoolManager` 与 `HomeManager` 已提供了良好的基础，只需补全 `SkillSelectPanel` UI 面板、优化带权重的 3选1 抽样算法以及 24 小时离线衰减算式，即可达成高性能、解耦且具备极佳体验的完整闭环。
