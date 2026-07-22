# Phase 9 代码评审报告 (Phase 9 Code Review Report)

**评审专家**: Phase 9 代码评审专家 (`teamwork_preview_reviewer_phase9_1`)  
**评审时间**: 2026-07-21  
**评审结论**: `REQUEST_CHANGES` (需修改重审)

---

## 一、 评审概述 (Review Summary)

针对 Worker 1 在第九阶段 4 大需求 (R1-R4) 的代码落地，本次评审对以下 8 个核心源码文件进行了逐行审查与对抗性校验：
1. `assets/Scripts/Logic/PetCaptureManager.ts`
2. `assets/Scripts/Manager/HomeManager.ts`
3. `assets/Scripts/Logic/PetFollower.ts`
4. `assets/Scripts/PlayerController.ts`
5. `assets/Scripts/Manager/SaveManager.ts`
6. `assets/Scripts/Manager/UIManager.ts`
7. `assets/Scripts/UI/AppraisalPanel.ts`
8. `assets/Scripts/UI/FurniturePanel.ts`

**核心结论**：Worker 1 在 UI Pure-Code 防御构建、盲盒孵化保底、五行共鸣加成接入、洞府家具效果与 `SaveManager` 向下兼容性方面完成了架构搭建。但是，代码中存在 **1 项 Critical (致命级) 资源扣除失效缺陷** 和 **1 项 Major (严重级) 战斗伤害叠加算式缺陷**，导致游戏经济消耗逻辑失效与化形数值失衡，因此给予 **`REQUEST_CHANGES`** 结论。

---

## 二、 缺陷与问题清单 (Findings)

### [Critical] 缺陷 1: 妖兽孵化与化形突破时灵石/材料扣除完全失效 (Resource Deduction Bypassed)

- **位置**: `assets/Scripts/Manager/HomeManager.ts` (第 704~720 行) & `assets/Scripts/Logic/PetCaptureManager.ts` (第 217, 220, 532, 533 行)
- **原因**: 
  在 `HomeManager.ts` 中，`addSpiritStones` 与 `addMaterials` 方法内部设置了硬性校验 `if (amount > 0)`：
  ```typescript
  public addSpiritStones(amount: number) {
      if (amount > 0) {
          this._spiritStones += amount;
          this.saveData();
      }
  }
  ```
  然而在 `PetCaptureManager.ts` 中，普通孵化 (扣除 100 灵石)、仙露孵化 (扣除 300 灵石 + 30 材料) 以及 5 星化形突破 (扣除 2000 灵石 + 200 材料) 时，均是通过传入负数进行扣减：
  ```typescript
  homeMgr.addSpiritStones(-300);
  homeMgr.addMaterials(-30);
  // 或
  homeMgr.addSpiritStones(-2000);
  homeMgr.addMaterials(-200);
  ```
  由于传入的负数在 `if (amount > 0)` 校验处被静默丢弃，**导致灵石和材料在孵化与化形时实际扣除数值为 0**！玩家只需满足余额门槛，即可无消耗无限免费孵化与化形。
- **修改建议**:
  1. 在 `HomeManager.ts` 中支持负数扣减（并进行下限 0 截断），例如：
     ```typescript
     public addSpiritStones(amount: number) {
         this._spiritStones = Math.max(0, this._spiritStones + amount);
         this.saveData();
     }
     ```
  2. 或在 `HomeManager.ts` 中显式提供 `consumeSpiritStones(amount: number): boolean` 与 `consumeMaterials(amount: number): boolean` 供逻辑层调用。

---

### [Major] 缺陷 2: 化形宠物飞弹伤害额外 50% 倍率重复迭加 (Double-Counting Evolved Attack Multiplier)

- **位置**: `assets/Scripts/Logic/PetCaptureManager.ts` (第 539 行) & `assets/Scripts/Logic/PetFollower.ts` (第 242~243 行)
- **原因**: 
  当宠物执行化形突破 (`evolvePet`) 时，`PetCaptureManager.ts` 已将宠物的基础攻击力永久提升 50%：
  ```typescript
  pet.attack = Math.floor(pet.attack * 1.50);
  ```
  但在局内 `PetFollower.ts` 计算发射飞弹伤害 `fireProjectile` 时，又重复判断了 `isEvolved` 再次乘上 `evolveDamageMult = 1.5`:
  ```typescript
  const evolveDamageMult = isEvolved ? 1.5 : 1.0;
  const damageVal = Math.floor(this.petData.attack * (1 + goldAtkBonus) * evolveDamageMult);
  ```
  这导致化形宠物的实际伤害倍率为 `1.5 * 1.5 = 2.25`（即 +125% 伤害），严重偏离需求的额外 +50% 属性设定。
- **修改建议**:
  移除 `PetFollower.ts` 中的二次 `evolveDamageMult` 乘法运算，直接使用已提升的 `this.petData.attack` 参与共鸣结算即可。

---

### [Minor] 缺陷 3: 吞噬升星属性 (+20%/星) 复利计算与平铺计算差异 (Compound vs Flat Attribute Upgrade)

- **位置**: `assets/Scripts/Logic/PetCaptureManager.ts` (第 483~485 行)
- **原因**: 
  `swallowPet` 每次升星均直接对当前 `attack/hp/speed` 进行 `Math.floor(val * 1.20)` 乘法。从 1 星升至 5 星连续 4 次吞噬后，最终属性为 `1.2^4 ≈ 2.0736` 倍，属于复利增长。若需求为基于基础属性平铺增加 `(1 + star * 0.2)`，则存在轻微数值偏高。
- **修改建议**:
  明确设计预期。若采用复利提升，建议在注释中予以标明；若采用平铺加成，建议保留初始 `baseAttack` 记录并按星级公式计算。

---

### [Minor] 缺陷 4: SaveManager 与 HomeManager 局部 Storage Key 存在冗余与同步风险

- **位置**: `assets/Scripts/Manager/HomeManager.ts` 与 `assets/Scripts/Manager/SaveManager.ts`
- **原因**: 
  `HomeManager` 在修改状态时会单独写入 `home_furniture_data` 等单项 Key，而 `SaveManager` 统一写入 `yokai_codex_save_v1`。虽然 `SaveManager.load()` 在游戏启动时能够正确覆盖还原，但双重写入机制增加了数据状态不一致的风险。
- **修改建议**:
  统一由 `SaveManager` 进行存档触发与持久化管理。

---

## 三、 需求逐项审查验证 (Requirement-by-Requirement Verification)

| 需求项 | 审查要点 | 验证结果 | 详细说明 |
|---|---|---|---|
| **R1 吞噬升星与化形** | `swallowPet` 同种属校验 | **PASS** | 严格校验 `targetPet.monsterId === foodPet.monsterId` |
| | 星级上限 (5星) | **PASS** | 5 星限制判定生效 |
| | 自动下阵逻辑 | **PASS** | 自动检查并从出战、灵田打工、矿脉打工中卸下 |
| | `evolvePet` 条件与扣除 | **FAIL** | 2000 灵石 + 200 材料由于缺陷 1 无法正常扣除 |
| | 化形名称/外观/属性 | **FAIL** | 名称加前缀 "化形·"、form 变更生效；但攻击力由于缺陷 2 在局内造成 2.25x 超额伤害 |
| | `PetFollower` 飞弹尺寸算式 | **PASS** | 尺寸公式 `Math.floor(14 * starBonus * evolvedScale)` 计算正确 |
| **R2 盲盒孵化与 UI** | 普通/仙露消耗与变异率 | **FAIL** | 变异率 (5% / 15%) 与史诗保底正常；但消耗由于缺陷 1 无法扣除 |
| | `AppraisalPanel.ts` Pure-Code 构建 | **PASS** | 纯代码生成背景、标题、按钮及摇晃解封 animation 正确 |
| | `UIManager.ts` 回退映射 | **PASS** | 资源缺失时能够正确 fallback 实例化 `AppraisalPanel` 节点 |
| **R3 五行共鸣** | `HomeManager.ts` 五行统计 | **PASS** | 正确统计 5 种五行已上阵宠物数量 |
| | 同系 3 只共鸣触发 | **PASS** | 3金/3木/3水/3火/3土 判断逻辑完整 |
| | 局内战斗数值接入 | **PASS** | 3金(+20%攻击)、3木(每秒15HP回复)、3水(+15%攻速/CDR)、3火(+20%暴击率)、3土(20%免伤) 均已接入 `PlayerController` 与 `PetFollower` |
| **R4 洞府家具** | 家具购买与效果接入 | **PASS** | 极品寒玉床 (+15% 挂机) 与红木躺椅 (+50 主角血量) 正确接入挂机速率与玩家初始属性 |
| | `SaveManager.ts` 读写与向下兼容 | **PASS** | 字段缺省补全 (element, star, isEvolved, furniture) 兼容良好 |

---

## 四、 对抗性与边界测试 (Adversarial & Edge-Case Assessment)

1. **边界条件 1 (零资源孵化与化形)**:
   - 攻击场景: 玩家积累满 2000 灵石 + 200 材料触发化形后，连续多次进行化形或孵化。
   - 结果: 由于 `HomeManager.addSpiritStones(-2000)` 静默失效，玩家资源始终保持 2000，可无限化形/孵化所有宠物。（已在缺陷 1 标出）
2. **边界条件 2 (重复化形保护)**:
   - 攻击场景: 对已化形的宠物再次调用 `evolvePet`。
   - 结果: 正确被 `pet.isEvolved` 拦截，提示“该宠物已经完成过化形，不可重复化形！”。
3. **边界条件 3 (自我吞噬)**:
   - 攻击场景: 传入 `targetPetId === foodPetId`。
   - 结果: 正确被 `targetPetId === foodPetId` 拦截，提示“无法吞噬宠物自身！”。
4. **边界条件 4 (存档向下兼容测试)**:
   - 场景: 模拟旧版本存档（缺少 `furniture`、`isEvolved`、`element` 字段）。
   - 结果: `SaveManager.ts` 在 `load()` 时使用了 `.map()` 进行默认值填充 (默认 '金' 属性, 1 星, un-evolved)，避免了 undefined 导致的 UI 崩塌。

---

## 五、 改进建议 (Actionable Recommendations)

1. 修复 `HomeManager.ts` 中的 `addSpiritStones` / `addMaterials` 方法，允许负数传入进行资源消耗，或实现专门的资源扣减接口。
2. 修正 `PetFollower.ts` 中的化形伤害计算，移除重复的 `evolveDamageMult` 倍率。
3. 在修复上述两个问题后，重新触发 Phase 9 代码评审。
