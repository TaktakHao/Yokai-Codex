# Phase 11 代码审查与对抗性测试报告 (Review & Challenge Report)

## Review Summary

**Verdict**: **REQUEST_CHANGES** (建议退回修改)

### 审查概述
在 Phase 11 的审查与对抗性测试中，对项目 `/Users/wesson/YokaiCodex` 的 5 个重点核心模块（`HomePanel.ts`, `UIManager.ts`, `GameManager.ts`, `VictoryPanel.ts`, `GameOverPanel.ts` 以及 `LevelManager.ts`）进行了逐行静态分析、架构校验与局内外循环逻辑推演。

**代码质量与完成度**:
1. **R1 洞府主界面**：`HomePanel.ts` 纯代码构建极其完善，顶部 HUD (灵石/材料/境界)、中部五行羁绊共鸣与卡片槽位、四大功能入口与【开始降妖】按钮逻辑均真实有效。
2. **R2 降级注册与美工**：`UIManager.ts` 完整补齐了所有新面板的防御性纯代码构建注册；面板统一采用国风深色半透明背景 `Color(15, 23, 42, 245)` 及烫金/翡翠绿调色，引导文案丰富流畅。
3. **缺陷发现 (Blocker)**：在对抗性推演局内外循环（洞府 -> 关卡 -> 洞府 -> 关卡）时，发现一个**重大局内循环 Bug**：玩家首次通关/失败并点击【返回洞府】后，场上随行宠物节点被销毁；但当玩家**第二次点击【开始降妖】进入关卡**时，由于 `PlayerController` 节点的 `start()` 不会二次触发，导致**随行宠物（`Follower_`）彻底丢失，无法再次生成**。

---

## Findings

### [Major] Finding 1: 局内外循环二次进入关卡时随行宠物 (`Follower_`) 丢失 Bug
- **What**: 玩家在第二次及后续进入关卡时，局外派驻的随行御兽（`Follower_` 节点）无法生成，玩家只能单人作战。
- **Where**: `assets/Scripts/PlayerController.ts` (62, 68行) 与 `assets/Scripts/Manager/GameManager.ts` (275-281行)。
- **Why**: 
  1. 在 `PlayerController.ts` 中，`initEquippedPets()` 仅在 `start()` 生命周期中调用一次。
  2. `GameManager.returnToHome()` 在返回洞府时，执行 `child.destroy()` 销毁了 Canvas 下所有 `Follower_` 节点。
  3. 当玩家再次点击【开始降妖】触发 `GameManager.startGame()` 时，常驻在 Canvas 上的 `PlayerController` 节点并没有被销毁重建，因此 Cocos Creator 不会再次触发其 `start()` 生命周期。
  4. 这导致 `initEquippedPets()` 在第二次游戏时不被执行，场上不再生成任何随行宠物。
- **Suggestion**: 
  在 `PlayerController.ts` 中将 `initEquippedPets()` 暴露为 `public initEquippedPets()`（并在生成前先清理旧 `Follower_` 节点），在 `GameManager.ts` 的 `startGame()` 流程中（或 `PlayerController.onEnable()`）显式调用 `playerComp.initEquippedPets()`。

### [Minor] Finding 2: `HomePanel.ts` 中 `renderPetListCards()` 子节点清理机制优化
- **What**: `HomePanel.ts` 刷新御兽卡片列表时使用 `this.petListContainer.removeAllChildren()`。
- **Where**: `assets/Scripts/UI/HomePanel.ts` (240行)。
- **Why**: 在 Cocos Creator 3.x 中，`removeAllChildren()` 仅解除节点父子挂载，不会自动调用 `destroy()` 释放内存。虽然 UI 卡片节点轻量，但长期频繁刷新会有潜在 Node 对象存留。
- **Suggestion**: 建议替换为 `this.petListContainer.destroyAllChildren()`，确保卡片子节点完全被销毁回收。

### [Minor] Finding 3: `returnToHome()` 敌人根节点清理的通用性优化
- **What**: `returnToHome()` 中遍历清理敌人时，写死了 `canvas.getChildByName('EnemyLayer')`。
- **Where**: `assets/Scripts/Manager/GameManager.ts` (257-260行)。
- **Why**: 若 `LevelManager` 的 `monsterRoot` 在特定配置或自定义场景中被指定为了非 `EnemyLayer` 节点，可能导致 `returnToHome()` 无法彻底清除场上残留怪物。
- **Suggestion**: 建议优先从 `LevelManager.instance.monsterRoot` 获取敌人根节点进行清理，空值时再回退至 `EnemyLayer` / `Canvas`。

---

## Verified Claims

| 序号 | 验证断言 (Claim) | 验证方法 | 结果 |
|---|---|---|---|
| 1 | `HomePanel.ts` 纯代码降级构建包含顶部 HUD、中部御兽/五行羁绊、四大功能按钮与底部开始按钮 | 检查 `HomePanel.ts` 源代码 | **PASS** (结构完整，逻辑通畅) |
| 2 | `UIManager.ts` 完成 `HomePanel`, `VictoryPanel`, `GameOverPanel` 的纯代码降级注册 | 检查 `UIManager.ts` 64-92 行 | **PASS** (均已挂载对应组件) |
| 3 | `GameManager.ts` 启动流程默认显示 `HomePanel` 且 `returnToHome()` 执行资源回收与 LevelManager 重置 | 检查 `GameManager.ts` 95-101 行及 `returnToHome()` | **PASS** (流程连贯，但存在宠物二次生成 Bug) |
| 4 | `VictoryPanel` 与 `GameOverPanel` 的【返回洞府】按钮正确绑定 `returnToHome()` | 检查 `VictoryPanel.ts` / `GameOverPanel.ts` | **PASS** (事件监听与回调正确) |
| 5 | 全面板国风主题色 `Color(15, 23, 42, 245)` 保持一致 | `grep_search` 检索 UI 面板底色 | **PASS** (7个 UI 面板完全统一) |

---

## Stress Test & Attack Surface Results

- **场景 1: 局内外循环重复进入关卡 (洞府 -> 关卡 -> 洞府 -> 关卡)**
  - *预期*: 每次点击【开始降妖】进入关卡，均能根据局外上阵配置正常生成 1-5 只随行宠物。
  - *实际*: 第一次进入正常；点击【返回洞府】后再次点击【开始降妖】进入，随行宠物全部丢失。
  - *判定*: **FAIL** (发现 Major Finding 1)。

- **场景 2: Prefab 资源缺失下的防御性运行**
  - *预期*: 在 `resources/UI` 无 `.prefab` 资产时，所有 UI 面板由纯代码自动实例化 Node 并挂载组件。
  - *实际*: `UIManager.ts` 的回退分支在加载 Prefab 报错时完美触发 `uiNode.addComponent(PanelClass)`。
  - *判定*: **PASS**。

- **场景 3: 五行羁绊动态计算**
  - *预期*: 根据 `HomeManager.instance.getEquippedPetIds()` 的宠物属性，达到 3 只同系触发高亮共鸣文案，不足 3 只提示上手引导。
  - *实际*: `HomePanel.ts` 212-229 行动态计算 `calculateElementResonance()`，高亮与绿色文字切换准确。
  - *判定*: **PASS**。

---

## Coverage Gaps

- **局内弹药/投射物 Pools 对象池彻底回收**: `returnToHome()` 仅通过 `name.includes('Projectile')` 对 Canvas 下的投射物进行了 `destroy()`。若后续新增基于 `PoolManager` 的玩家弹药，需确保弹药也通过 `PoolManager.putNode()` 清理。

---

## Unverified Items

- **真机/模拟器运行时帧率与 GPU 渲染性能**: 当前通过代码静态审查与逻辑推演完成校验，未在实际 Cocos Creator 运行环境中进行带帧率测量的 Profile。

---

## 5-Component Handoff Section

### 1. Observation
- `assets/Scripts/PlayerController.ts` 第 50-63 行：
  ```typescript
  start() {
      ...
      this.initEquippedPets();
  }
  ```
- `assets/Scripts/Manager/GameManager.ts` 第 275-281 行：
  ```typescript
  for (const child of canvasChildren) {
      if (child.name.startsWith('Follower_') || child.name === 'PetSpellProjectile' || child.name.includes('Projectile')) {
          child.destroy();
      }
  }
  ```
- `assets/Scripts/Manager/GameManager.ts` 第 140-177 行 (`startGame` 方法)：仅加载关卡、重置技能池与启动 `LevelManager`，未对 `PlayerController` 或随行宠物进行重新初始化。

### 2. Logic Chain
1. 游戏首次启动，`PlayerController.start()` 被引擎触发，`initEquippedPets()` 成功在 `Canvas` 下创建 `Follower_` 随行宠物节点。
2. 关卡结束或玩家主动返回洞府，触发 `GameManager.instance.returnToHome()`。
3. `returnToHome()` 执行 `child.destroy()` 销毁了所有的 `Follower_` 节点。
4. 玩家回到 `HomePanel` 后再次点击【开始降妖】，触发 `GameManager.instance.startGame('Level_1')`。
5. 因为 `PlayerController` 节点始终常驻于 `Canvas` 且保持 active，Cocos Creator 引擎**不会第二次触发其 `start()` 回调**。
6. `initEquippedPets()` 未被再次调用，且 `startGame()` 中亦无重新生成随行宠物的逻辑，导致玩家在后续关卡中失去了所有随行宠物。

### 3. Caveats
- 没有任何关于代码完整性的假实现或硬编码绕过（未发现 Integrity Violation）。代码风格、国风配色与纯代码降级支持质量均极高，仅需修复此局内外循环状态重置 Bug 即可达到 100% 完美发布标准。

### 4. Conclusion
- Verdict: **REQUEST_CHANGES**。
- 请 worker 针对 Finding 1 进行修复（在 `startGame()` 或 `PlayerController` 重新初始化随行宠物），并可选对 Finding 2 和 Finding 3 进行优化后，重新提交审核。

### 5. Verification Method
- **检验修复方法**:
  1. 检查 `assets/Scripts/PlayerController.ts` 是否提供了可重复调用的 `initEquippedPets()` 方法。
  2. 检查 `assets/Scripts/Manager/GameManager.ts` 的 `startGame()` 或 `returnToHome()` 中是否包含对 `PlayerController.initEquippedPets()` 的重新调用。
  3. 模拟局内外二次循环，确认二次进入关卡时 `Follower_` 宠物节点正常生成。
