# Phase 7 Explorer 3: 首关关卡数据重构与波次难度曲线设计勘测报告 (R4)

## 1. 概述与勘测总结

本报告针对需求 **R4 (首关 Level_1_Waves.json 数据重构与刷怪难度曲线设计)**，对 YokaiCodex 项目 codebase 进行了全方位的只读勘测与设计分析。

项目现有实现中，`Level_1_Waves.json` 采用扁平化的简单数组格式，缺乏明确的“波次 (Wave)”划分、生成速率 (Interval) 控制以及移动速度、攻击力、精英怪 (`isElite`) 掉落表等维度的配置；同时 `LevelManager.ts` 仅将基础生命值 `base_hp` 传递给 `Enemy.ts` 组件。

为此，本报告输出了重构后的 **波次层级 JSON 数据结构**、**前三波及全关卡阶梯式难度曲线模型**、**精英怪机制 (`isElite` + 掉落配置)**，以及相应的 TypeScript 接口对接指导方案。

---

## 2. 现有代码与关卡配置现状排查 (Observation)

### 2.1 关卡配置文件现状 (`assets/resources/Configs/Level_1_Waves.json`)
- **文件路径**: `assets/resources/Configs/Level_1_Waves.json` (共 189 行)
- **目前结构**: 顶级 JSON 数组，每个元素包含 4 个字段：
  ```json
  {
    "spawn_time": 0,
    "monster_id": "mob_grass_sprite",
    "spawn_count": 5,
    "base_hp": 50
  }
  ```
- **缺失信息**:
  1. 缺少关卡元数据 (如 `level_id`, `level_name`, `total_duration`)。
  2. 缺少波次 (`wave_index`, `wave_name`, `duration`) 的明确封装。
  3. 缺少怪物属性配置：攻击力 (`attack_damage`)、移动速度 (`move_speed`)、经验奖励 (`exp_value`)、生成速率 (`spawn_interval`)。
  4. 缺少精英怪特定标识 (`is_elite` / `isElite`) 及特殊掉落/宝箱配置 (`drop_config`)。

### 2.2 关卡管理器解析与生成逻辑 (`assets/Scripts/LevelManager.ts`)
- **文件路径**: `assets/Scripts/LevelManager.ts` (共 213 行)
- **读取逻辑 (L76-L116)**:
  - 在 `loadLevelConfig` 中异步加载 `Configs/${levelId}_Waves`。
  - 能够判断 `Array.isArray(rawJson)` 或 `rawJson.waves`，解析成 `IWaveData[]`。
  - `IWaveData` 接口定义 (L7-L12) 仅有 `spawn_time`, `monster_id`, `spawn_count`, `base_hp`。
- **刷新逻辑 (L142-L164)**:
  - `update` 逐帧更新 `gameTime += deltaTime`，在 `checkSpawns()` 中比对 `gameTime >= wave.spawn_time`。
  - 一旦触发生成时间，直接在单帧内使用 `for` 循环一口气生成 `wave.spawn_count` 只怪物。
- **怪物属性传递 (L170-L209)**:
  - L206-L208: `(enemyComp as any).init(wave.base_hp, undefined, undefined, texturePath)`。
  - **问题**: 仅传递了 `base_hp` 和贴图路径，攻击力、移动速度等均使用 `Enemy.ts` 上的脚本属性默认值（如攻击力默认 10，移速默认 100，经验值默认 10）。

### 2.3 敌人逻辑组件与属性接口 (`assets/Scripts/Logic/Enemy.ts`)
- **文件路径**: `assets/Scripts/Logic/Enemy.ts` (共 220 行)
- **现况分析**:
  - 组件拥有 `@property` 变量：`maxHp` (100), `moveSpeed` (100), `attackDamage` (10), `attackInterval` (1.0), `expValue` (10)。
  - `init` 方法签名 (L52): `public init(hp?: number, speed?: number, target?: Node, texturePath?: string)`。
  - **问题**: `init` 方法暂未接收 `attackDamage`, `expValue`, `isElite`, `dropConfig` 等参数。当怪物被复用时，`attackDamage` 和 `expValue` 无法随波次阶梯增长。

### 2.4 关卡设计文档对齐 (`Design/Outputs/Chapter1_LevelDesign.md`)
- 体验目标：
  - **0:00 - 3:00 (平缓期: 早起散步)**：草精与木灵，慢移速，低血量，无生存压力。
  - **3:00 (180s 必定刷出首只精英怪)**：精英怪掉落“聚灵宝箱”，教导玩家进行 3 选 1 Skill Build。
  - **3:00 - 8:00 (压力测试)**：引入疾风狼（高移速突进）和喷毒蛇（远程弹幕），难度递增。
  - **8:00 - 10:00 (怪海尸潮)**：高密度拉满。
  - **10:00 (Boss 战)**：千年树妖王 (25000血量)。

---

## 3. R4 关卡 JSON 数据结构重构方案

### 3.1 重构设计原则
1. **层级解耦**: JSON 采用 `关卡元数据 (Meta) -> 波次配置 (Waves) -> 刷怪组配置 (Groups)` 的三层嵌套结构。
2. **字段完整**: 增加 `move_speed`, `attack_damage`, `spawn_interval`, `exp_value`, `is_elite`, `drop_config`。
3. **向后兼容**: `LevelManager.ts` 在解析时兼容新旧两种 JSON 格式。

### 3.2 新 JSON 数据结构 Schema 说明

```json
{
  "level_id": "Level_1",
  "level_name": "后山散步",
  "total_duration": 600,
  "waves": [
    {
      "wave_index": 1,
      "wave_name": "早起散步-第1波",
      "start_time": 0,
      "duration": 60,
      "monster_groups": [
        {
          "group_id": "w1_grass_1",
          "monster_id": "mob_grass_sprite",
          "spawn_count": 15,
          "spawn_interval": 2.0,
          "base_hp": 40,
          "attack_damage": 5,
          "move_speed": 70,
          "exp_value": 5,
          "is_elite": false
        }
      ]
    }
  ]
}
```

### 3.3 重构后的 `Level_1_Waves.json` 前三波及框架全貌样例

```json
{
  "level_id": "Level_1",
  "level_name": "后山散步",
  "total_duration": 600,
  "waves": [
    {
      "wave_index": 1,
      "wave_name": "平缓期-入门散步",
      "start_time": 0,
      "duration": 60,
      "monster_groups": [
        {
          "group_id": "w1_grass_sprites",
          "monster_id": "mob_grass_sprite",
          "spawn_count": 15,
          "spawn_interval": 3.0,
          "base_hp": 40,
          "attack_damage": 5,
          "move_speed": 70,
          "exp_value": 5,
          "is_elite": false
        }
      ]
    },
    {
      "wave_index": 2,
      "wave_name": "平缓期-木灵初现",
      "start_time": 60,
      "duration": 60,
      "monster_groups": [
        {
          "group_id": "w2_grass_sprites",
          "monster_id": "mob_grass_sprite",
          "spawn_count": 20,
          "spawn_interval": 2.5,
          "base_hp": 50,
          "attack_damage": 6,
          "move_speed": 75,
          "exp_value": 6,
          "is_elite": false
        },
        {
          "group_id": "w2_wood_spirits",
          "monster_id": "mob_wood_spirit",
          "spawn_count": 10,
          "spawn_interval": 4.0,
          "base_hp": 80,
          "attack_damage": 10,
          "move_speed": 60,
          "exp_value": 12,
          "is_elite": false
        }
      ]
    },
    {
      "wave_index": 3,
      "wave_name": "平缓期-首只精英考验",
      "start_time": 120,
      "duration": 60,
      "monster_groups": [
        {
          "group_id": "w3_grass_sprites",
          "monster_id": "mob_grass_sprite",
          "spawn_count": 30,
          "spawn_interval": 1.5,
          "base_hp": 65,
          "attack_damage": 8,
          "move_speed": 80,
          "exp_value": 8,
          "is_elite": false
        },
        {
          "group_id": "w3_wood_spirits",
          "monster_id": "mob_wood_spirit",
          "spawn_count": 20,
          "spawn_interval": 2.5,
          "base_hp": 105,
          "attack_damage": 12,
          "move_speed": 65,
          "exp_value": 15,
          "is_elite": false
        },
        {
          "group_id": "w3_elite_brute",
          "monster_id": "elite_grass_brute",
          "spawn_count": 1,
          "spawn_interval": 0,
          "base_hp": 1200,
          "attack_damage": 25,
          "move_speed": 85,
          "exp_value": 100,
          "is_elite": true,
          "drop_config": {
            "drop_chest": true,
            "chest_tier": "rare",
            "exp_bonus": 50,
            "spirit_stones": 30
          }
        }
      ]
    }
  ]
}
```

---

## 4. 波次与难度曲线设计 (难度增长模型)

### 4.1 数学公式与阶梯增长机制

难度曲线采用 **指数 + 阶梯跳变 (Stepwise Exponential)** 增长模型：

1. **HP 增长公式**:
   $$HP(w) = HP_{base} \times (1 + \alpha \cdot (w - 1)) \times (1 + \beta \cdot \lfloor \frac{w-1}{3} \rfloor)$$
   - $\alpha \approx 0.20$（每波基础增长 20%）
   - $\beta \approx 0.30$（每 3 波阶梯跨越，难度提升 30%）

2. **攻击力 (ATK) 增长公式**:
   $$ATK(w) = ATK_{base} \times (1 + \gamma \cdot (w - 1))$$
   - $\gamma \approx 0.15$（每波增长 15%，保证玩家被怪物触碰时压力温和增加但不至于猝死）

3. **生成密度与速率 (Density & Interval)**:
   - 单波怪物总数逐波 +25%~+35%。
   - `spawn_interval` 生成间隔逐波从 `3.0s` 缩短至 `1.0s`，增强怪潮拥挤感。

### 4.2 前三波 (0s - 180s) 阶梯式难度对照表

| 波次 | 时间区间 | 主控怪物 | 数量 | 生成间隔 | HP (生命) | ATK (攻击) | 移速 | 单怪经验 | 阶段设计意图 |
|---|---|---|---|---|---|---|---|---|---|
| **Wave 1** | `0s - 60s` | 小草精 (`mob_grass_sprite`) | 15 | 3.0s | 40 | 5 | 70 | 5 | 教学阶段，熟悉移动与自动攻击/灵气拾取 |
| **Wave 2** | `60s - 120s` | 小草精<br>木灵 (`mob_wood_spirit`) | 20<br>10 | 2.5s<br>4.0s | 50 (+25%)<br>80 | 6 (+20%)<br>10 | 75<br>60 | 6<br>12 | 引入高血慢速肉盾怪（木灵），测试持续输出 |
| **Wave 3** | `120s - 180s` | 小草精<br>木灵<br>**草精巨兽精英** (`elite_grass_brute`) | 30<br>20<br>**1** | 1.5s<br>2.5s<br>**瞬发** | 65 (+30%)<br>105 (+31%)<br>**1200** | 8 (+33%)<br>12 (+20%)<br>**25** | 80<br>65<br>**85** | 8<br>15<br>**100** | **高潮与阶段检验**：180s 刷出首只精英怪，检验 DPS，掉落聚灵宝箱定型初期 Build |

---

## 5. 精英怪波次机制 (`isElite`) 详细设计

### 5.1 精英标识与属性加成乘数
- JSON 中由 `is_elite: true` 显式标示。
- 基础属性倍率建议：
  - **HP 倍率**: 普通怪物的 $15\times \sim 20\times$（如 Wave 3 草精精英为 1200 HP，草精普通怪为 65 HP）。
  - **ATK 倍率**: 普通怪物的 $2.5\times \sim 3\times$。
  - **移速**: 微幅提升 +10% ~ +15%。

### 5.2 视觉表现与逻辑联动
- **缩放倍率 (Scale)**: 当 `isElite` 为 `true` 时，`Enemy.ts` 在挂载贴图或节点初始化时自动调大 Local Scale (如 `Vec3(1.5, 1.5, 1.0)`)。
- **高亮/视觉组件**: 给精英怪动态叠加特定颜色调（如微调 Sprite 颜色为偏红/金）或提示光圈。

### 5.3 掉落配置 (`drop_config`) 规范
在 JSON 中提供 `drop_config` 对象：
```json
"drop_config": {
  "drop_chest": true,
  "chest_tier": "rare",
  "exp_bonus": 50,
  "spirit_stones": 30
}
```
- **掉落逻辑与死亡联动**: `Enemy.ts` 的 `die()` 方法中，判断若存在 `dropConfig.drop_chest`，广播事件 `EventManager.emit('Event_Spawn_Chest', { position, chestTier })` 或调用掉落逻辑，掉落“聚灵宝箱”（促发 UI 的 3 选 1 技能面板），提升玩家战术反馈。

---

## 6. 代码对接与接口重构指导

### 6.1 TypeScript 数据接口定义更新 (`LevelManager.ts`)

建议在 `LevelManager.ts` 中增加并更新以下接口：

```typescript
/** 掉落配置接口 */
export interface IEliteDropConfig {
    drop_chest?: boolean;
    chest_tier?: string;
    exp_bonus?: number;
    spirit_stones?: number;
}

/** 怪物生成组接口 */
export interface IMonsterGroupConfig {
    group_id: string;
    monster_id: string;
    spawn_count: number;
    spawn_interval?: number; // 单只生成间隔（0 为瞬间全刷）
    base_hp: number;
    attack_damage?: number;
    move_speed?: number;
    exp_value?: number;
    is_elite?: boolean;
    drop_config?: IEliteDropConfig;
}

/** 波次配置接口 */
export interface IWaveConfig {
    wave_index: number;
    wave_name?: string;
    start_time: number;
    duration: number;
    monster_groups: IMonsterGroupConfig[];
}

/** 关卡完整配置接口 */
export interface ILevelConfig {
    level_id: string;
    level_name: string;
    total_duration: number;
    waves: IWaveConfig[];
}
```

### 6.2 `LevelManager.ts` 逻辑对接修改

1. **兼容性 JSON 解析**:
   在 `loadLevelConfig` 中，根据 `rawJson` 是否包含 `waves` 和 `monster_groups` 自动转换为统一的内存结构。
2. **刷怪参数完整传递**:
   调用 `Enemy` 组件的 `init` 时，将 `attack_damage`, `move_speed`, `exp_value`, `is_elite`, `drop_config` 完整传入：
   ```typescript
   if (enemyComp && typeof enemyComp.init === 'function') {
       enemyComp.init(
           group.base_hp,
           group.move_speed,
           group.attack_damage,
           group.exp_value,
           group.is_elite,
           group.drop_config,
           undefined, // targetPlayer
           texturePath
       );
   }
   ```

### 6.3 `Enemy.ts` 组件扩展建议

建议升级 `Enemy.ts` 的 `init` 签名与属性赋值：

```typescript
public init(
    hp?: number,
    speed?: number,
    attack?: number,
    exp?: number,
    isElite?: boolean,
    dropConfig?: IEliteDropConfig,
    target?: Node,
    texturePath?: string
) {
    if (hp !== undefined && hp > 0) this.maxHp = hp;
    if (speed !== undefined && speed > 0) this.moveSpeed = speed;
    if (attack !== undefined && attack > 0) this.attackDamage = attack;
    if (exp !== undefined && exp > 0) this.expValue = exp;
    
    this.isElite = !!isElite;
    this.dropConfig = dropConfig || null;

    if (this.isElite) {
        this.node.setScale(1.5, 1.5, 1.0);
    } else {
        this.node.setScale(1.0, 1.0, 1.0);
    }

    if (target) this.targetPlayer = target;
    if (texturePath) this.texturePath = texturePath;

    this.resetState();
    this.setupVisual();
}
```

---
*探险家报告编写完毕。下一步将编写 handoff.md 并向 parent 汇报。*
