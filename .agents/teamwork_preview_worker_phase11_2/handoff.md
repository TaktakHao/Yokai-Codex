# Handoff Report — Phase 11 Round 2 Code Repair (Worker 2)

## 1. Observation (观察)

针对 Reviewer 1 提出的 3 项 Finding 进行了代码审查与定位：

1. **[Major] Finding 1: 局内外循环二次进入关卡时随行宠物 (`Follower_`) 丢失**
   - 文件路径: `assets/Scripts/PlayerController.ts` (原 68 行) 及 `assets/Scripts/Manager/GameManager.ts` (原 140-177 行)。
   - 原现状: `PlayerController.ts` 中 `initEquippedPets()` 为 `private` 方法，仅在 `start()` 生命周期中调用一次。当玩家从主界面再次点击【开始降妖】调用 `GameManager.startGame()` 时，已加载的 `PlayerController` 节点不会再次触发 `start()`，且 `returnToHome()` 销毁了旧 `Follower_` 节点，导致二次进入关卡时宠物消失。

2. **[Minor] Finding 2: `HomePanel.ts` 节点内存释放彻底化**
   - 文件路径: `assets/Scripts/UI/HomePanel.ts` (原 241 行)。
   - 原现状: `renderPetListCards()` 函数使用 `this.petListContainer.removeAllChildren()` 清空旧卡片节点。`removeAllChildren()` 仅将节点从父节点解除挂载，并未调用 `destroy()` 彻底释放 Cocos Creator Node 内存，多次刷 UI 会导致 Node 泄漏。

3. **[Minor] Finding 3: `GameManager.returnToHome()` 敌人节点清理路径优化**
   - 文件路径: `assets/Scripts/Manager/GameManager.ts` (原 258-272 行) 及 `assets/Scripts/LevelManager.ts` (原 66 行)。
   - 原现状: `GameManager.returnToHome()` 清场怪物时仅遍历了 `canvas.getChildByName('EnemyLayer')`，未优先读取和遍历 `LevelManager.instance.monsterRoot` 节点下的所有怪物子节点，当怪物挂载在 `monsterRoot` 节点下时可能导致清场遗漏。

---

## 2. Logic Chain (推导逻辑链)

1. **针对 Finding 1 (随行宠物二次进入游戏丢失)**：
   - 将 `PlayerController.initEquippedPets()` 方法提升为 `public` 访问权限。
   - 在 `initEquippedPets()` 执行前，增加过滤并销毁已存在 `Follower_` 节点的幂等处理，防止多次调用产生重复节点。
   - 在 `PlayerController` 中增加 `onEnable()` 钩子，当节点被激活时自动触发 `initEquippedPets()`。
   - 在 `GameManager.startGame()` 的关卡启动流程中，显式获取 `PlayerController` 组件并调用 `playerComp.initEquippedPets()`，确保不论如何重新进入关卡，随行宠物节点均能按 `HomeManager` 当前装备的宠物列表重新实例化生成。

2. **针对 Finding 2 (HomePanel 节点内存泄漏)**：
   - 将 `HomePanel.ts` 中的 `this.petListContainer.removeAllChildren()` 替换为 `this.petListContainer.destroyAllChildren()`。
   - `destroyAllChildren()` 会对所有子节点隐式调用 `destroy()`，通知引擎彻底销毁节点并回收 C++ & JS 堆内存。

3. **针对 Finding 3 (GameManager.returnToHome 敌人清理优化)**：
   - 优化 `GameManager.returnToHome()` 的怪物回收逻辑：优先获取 `LevelManager.instance.monsterRoot` 节点。
   - 将 `monsterRoot.children` 与兜底 `enemyLayer.children` 合并去重构建待清理列表 `nodesToClean`。
   - 逐一校验每个节点 `childNode.active` 与 `isEnemy` 判定，若存在 `PoolManager.instance` 则调用 `PoolManager.instance.putNode(childNode)` 进行池化回收，否则调用 `childNode.destroy()` 彻底销毁，确保 100% 清场干净。

---

## 3. Caveats (注意事项)

- 如果未来的技能系统或其它机制创建了名称以 `Follower_` 开头的非宠物节点，`initEquippedPets()` 的清理逻辑会对其销毁。已确认当前代码库中 `Follower_` 前缀仅用于随行宠物。
- `PoolManager.putNode()` 要求节点未在池中，修改后的逻辑已包含 `childNode.isValid` 和 `active` 状态判断，避免重复回收。

---

## 4. Conclusion (结论)

Reviewer 1 提出的 3 项 Finding 均已完成精准代码修复：
- **Finding 1 修复完成**: `PlayerController.initEquippedPets()` 已设为 `public`，并在 `onEnable()` 及 `GameManager.startGame()` 中被正确触发，解决了二次进入关卡宠物丢失问题。
- **Finding 2 修复完成**: `HomePanel.ts` 已改用 `destroyAllChildren()`，保障了 UI 重复渲染时的内存释放。
- **Finding 3 修复完成**: `GameManager.returnToHome()` 已实现优先并精准清理 `LevelManager.instance.monsterRoot` 及其下所有敌人节点。

---

## 5. Verification Method (验证方法)

1. **检查代码文件变动**:
   - 检查 `assets/Scripts/PlayerController.ts` 第 50 行 `onEnable` 及 72 行 `public initEquippedPets()` 方法。
   - 检查 `assets/Scripts/UI/HomePanel.ts` 第 241 行 `destroyAllChildren()` 的调用。
   - 检查 `assets/Scripts/Manager/GameManager.ts` 第 174-177 行 `initEquippedPets()` 调用及第 255-275 行 `returnToHome()` 中针对 `LevelManager.instance.monsterRoot` 的遍历逻辑。

2. **逻辑验证场景**:
   - 场景 A: 玩家从主界面进入关卡，场上有随行宠物 `Follower_`；返回主界面后再点击【开始降妖】二次进入关卡，随行宠物正常生成并在主角身旁随行。
   - 场景 B: 打开主界面反复刷新上阵宠物卡片，旧卡片 Node 被 `destroyAllChildren()` 彻底销毁，无 Node 内存残留。
   - 场景 C: 在关卡中有存活怪物时点击返回主界面，`LevelManager.instance.monsterRoot` 节点下的所有怪物被彻底清理回收。
