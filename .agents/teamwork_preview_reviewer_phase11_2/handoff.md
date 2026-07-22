# 审查与对抗测试报告 (Phase 11 Round 2 Code Review)

## Review Summary

**Verdict**: PASS (通过)

本次审查针对 Phase 11 Round 2 中 Worker 2 对 Reviewer 1 提出的 3 项 Findings 的修复代码进行了详细的代码审查与对抗性压力测试。审查结果确认 3 项 Finding 均已完满修复，且未发现代码作假、伪装实现或引入新的 Side Effect。

---

## 1. Observation (客观观察)

### Finding 1: 随行宠物 (`Follower_`) 二次进入关卡丢失与防重逻辑
- **文件路径**: `assets/Scripts/PlayerController.ts`
- **代码观察**:
  - 第 72 行：`initEquippedPets()` 方法已正确暴露为 `public initEquippedPets()`。
  - 第 80-86 行：添加了防重与残存节点清理逻辑：
    ```typescript
    if (this.node.parent) {
        const existingFollowers = this.node.parent.children.filter(child => child.name.startsWith('Follower_'));
        for (const follower of existingFollowers) {
            follower.destroy();
        }
    }
    ```
  - 第 50-52 行：`onEnable()` 生命周期钩子中重调 `this.initEquippedPets()`。
  - 第 66 行：`start()` 生命周期中调用 `this.initEquippedPets()`。
  - `assets/Scripts/Manager/GameManager.ts` 第 171-178 行：在 `startGame()` 加载关卡成功回调中，显式获取 `PlayerController` 实例并重新调用 `playerComp.initEquippedPets()`，确保二次进入关卡时随行宠物节点重新实例化生成。
  - `assets/Scripts/Manager/GameManager.ts` 第 297-304 行：在 `returnToHome()` 中，遍历 `Canvas` 节点并销毁残存的 `Follower_` 宠物节点与投射物。

### Finding 2: `HomePanel.ts` 节点彻底销毁释放内存
- **文件路径**: `assets/Scripts/UI/HomePanel.ts`
- **代码观察**:
  - 第 237-242 行：`renderPetListCards()` 方法中：
    ```typescript
    private renderPetListCards() {
        if (!this.petListContainer) return;

        // 彻底销毁旧卡片 Node 节点，释放内存
        this.petListContainer.destroyAllChildren();
    ```
  - 原先使用 `removeAllChildren()` 仅游离节点而未释放内存，现已完全替换为 `destroyAllChildren()`，触发子节点及其组件的 `onDestroy` 生命周期并彻底释放 Node 内存。

### Finding 3: `GameManager.returnToHome()` 敌人节点清理与优先读取 `monsterRoot`
- **文件路径**: `assets/Scripts/Manager/GameManager.ts`
- **代码观察**:
  - 第 262-295 行：`returnToHome()` 方法中：
    ```typescript
    const monsterRoot = LevelManager.instance ? LevelManager.instance.monsterRoot : null;
    const enemyLayer = canvas?.getChildByName('EnemyLayer') || canvas;

    const nodesToClean: Node[] = [];
    if (monsterRoot && monsterRoot.isValid) {
        nodesToClean.push(...monsterRoot.children);
    }
    if (enemyLayer && enemyLayer.isValid && enemyLayer !== monsterRoot) {
        for (const child of enemyLayer.children) {
            if (!nodesToClean.includes(child)) {
                nodesToClean.push(child);
            }
        }
    }

    for (const childNode of nodesToClean) {
        if (childNode && childNode.isValid && childNode.active) {
            const isEnemy = childNode.name.includes('Monster') || childNode.name.includes('mob_') || childNode.name.includes('Dynamic') || childNode.getComponent('Enemy');
            if (isEnemy) {
                if (PoolManager.instance) {
                    PoolManager.instance.putNode(childNode);
                } else {
                    childNode.destroy();
                }
            }
        }
    }
    ```
  - 逻辑优先检查并读取 `LevelManager.instance.monsterRoot` 中的活怪节点，同时对 `enemyLayer` 做了补漏去重。
  - 存活敌人节点优先通过 `PoolManager.instance.putNode(childNode)` 进行对象池回收（重置 `active = false` 并 `removeFromParent`），在对象池不可用时降级使用 `destroy()` 销毁。
  - 第 322 行：同步调用 `lvlMgr.resetLevel()`，停止刷怪计时并将 `activeEnemyCount` 归零。

---

## 2. Logic Chain (推理逻辑链)

1. **Finding 1 (随行宠物丢失修复)**：
   - 之前二次进入关卡宠物丢失是因为局内外切换时旧宠物节点未销毁或新关卡中没有重新触发生成。
   - Worker 2 在 `PlayerController` 中将 `initEquippedPets()` 暴露为 `public`，并增加了对以 `Follower_` 开头的旧宠物的清理逻辑。
   - `GameManager.startGame()` 与 `returnToHome()` 形成完整的生命周期闭环：`returnToHome()` 时销毁所有 `Follower_` 节点；`startGame()` 时重新调用 `initEquippedPets()` 生成新 `Follower_` 节点，并且 `initEquippedPets()` 自带防重机制。推导结论：宠物二次进入关卡丢失与重复堆叠问题已彻底解决。

2. **Finding 2 (`HomePanel` 节点销毁修复)**：
   - `removeAllChildren()` 只会将子节点从父节点解除挂载，节点对象与组件仍保留在内存中，在频繁刷新（如改变宠物上阵状态）时会导致 Node 内存泄漏。
   - 使用 `destroyAllChildren()` 后，Cocos Creator 引擎将递归销毁所有子 Node 及其组件，触发垃圾回收。推导结论：内存泄漏隐患已解决。

3. **Finding 3 (敌人节点清理修复)**：
   - `LevelManager` 允许通过 `monsterRoot` 指定怪物挂载根节点。若 `returnToHome()` 只清理 `enemyLayer`，当 `monsterRoot` 不指向 `enemyLayer` 时会导致存活怪物残留在场景中。
   - 修改后的 `returnToHome()` 优先读取 `LevelManager.instance.monsterRoot`，再合并 `enemyLayer` 节点，确保无遗漏；且优先归还 `PoolManager` 对象池，符合高性能节点复用规范。推导结论：存活敌人节点清理逻辑完整可靠。

---

## 3. Caveats (注意事项与假设)

1. **Cocos 引擎帧末销毁机制**：
   - `node.destroy()` 在 Cocos Creator 中会在当前帧末尾统一执行销毁。由于 `initEquippedPets()` 在清理旧节点后会创建新的 `Follower_` Node，在同帧内新节点会被赋予全新的 Node 实例，不会与被标记销毁的旧节点冲突。
2. **环境依赖**：
   - 项目在 Cocos Creator 3.8.8 环境下开发，审查通过 TypeScript 语法静态分析与架构推理验证。

---

## 4. Adversarial Stress-Test & Vulnerability Check (对抗压力测试)

| 场景 / 假设 | 预测行为 | 实际分析结果 | 判定 |
|---|---|---|---|
| **极端场景 1**: 上阵 0 只宠物进入关卡 | `initEquippedPets()` 清理残留节点并打印日志退出 | 逻辑包含 `if (equippedIds.length === 0) return;`，正常退出无报错 | PASS |
| **极端场景 2**: 战斗中含有 50+ 存活怪物时玩家直接点击退回洞府 | `returnToHome()` 批量回收所有 `monsterRoot` 及 `enemyLayer` 下怪物 | `nodesToClean` 收集全部怪物，调用 `PoolManager.putNode()` 清理，无遗漏 | PASS |
| **极端场景 3**: 频繁快速切换进入关卡与返回主界面 | `initEquippedPets()` 防重机制与 `returnToHome()` 双重保障 | 宠物节点不会无限递增，被彻底清理与重建 | PASS |
| **诚信违规检查 (Integrity Violation)** | 无硬编码测试数据，无 Empty Facade Mock | 均为真实业务逻辑实现，无 Integrity Violation | PASS |

---

## 5. Conclusion (结论)

审查结论为 **PASS**。Worker 2 提交的代码完美修复了 Reviewer 1 提出的 3 项 Findings，代码质量良好，无架构漏洞或副作用。

---

## 6. Verification Method (独立验证方法)

1. **检查 `assets/Scripts/PlayerController.ts`**:
   - 确认 `public initEquippedPets()` 声明及第 80-86 行 `filter(child => child.name.startsWith('Follower_'))` 销毁逻辑。
2. **检查 `assets/Scripts/UI/HomePanel.ts`**:
   - 确认第 241 行 `this.petListContainer.destroyAllChildren()`。
3. **检查 `assets/Scripts/Manager/GameManager.ts`**:
   - 确认第 268-295 行 `returnToHome()` 中对 `monsterRoot` 和 `enemyLayer` 的遍历与 `PoolManager.instance.putNode()` 回收逻辑。
