# 审查与对抗性验证报告 — YokaiCodex Phase 5 (Challenger 1)

## Challenge Summary

**Overall risk assessment**: HIGH

经过静态代码分析与边界条件推演，在核心模块 `SaveManager.ts`、`PoolManager.ts`、`Enemy.ts`、`EventManager.ts` 和 `EffectManager.ts` 中共发现 **8 个潜在缺陷与安全隐患**，其中包括 1 个 Critical（严重风险）、3 个 High（高风险）、4 个 Medium（中风险）。主要风险集中在对象池重复归还导致的数据污染、缺少局部与世界坐标系转换导致的距离判定失效、存档字段缺失导致的空指针崩溃，以及事件载荷缺少深层校验导致的运行时报错。

---

## 1. Observation (观察到的代码事实)

1. **`SaveManager.ts` (Line 146-170, 96-102)**:
   - Line 154: `if (parsed && typeof parsed.version === 'number')` 仅判断了 `parsed.version` 是否为 `number` 类型。
   - 当 `rawData` 为 `{"version": 1}`（缺少 `player` 结构）时，`load()` 会将其直接赋值给 `this._saveData`。
   - Line 96-97: 在 `HomeManager.instance` 为 `null` 的环境下调用 `save()` 时，执行到 `realmIdx = this._saveData.player.realmIndex;` 会触发 `TypeError: Cannot read properties of undefined (reading 'realmIndex')`。
   - Line 149: 当 `rawData` 为 `""` 或 `null` 时，`if (!rawData)` 评估为 `true`，正确降级并调用 `getDefaultSaveData()`。
   - Line 153: 当 `rawData` 为非合法 JSON 字符串（如 `"{invalid"`）时，`JSON.parse` 抛出 `SyntaxError`，被 catch 块安全捕获并回退至默认存档。

2. **`PoolManager.ts` (Line 66-72, 107-120, 127-139)**:
   - Line 67 & Line 130: `poolKey` 提取逻辑为 `(prefabOrKey.data && prefabOrKey.data.name) ? prefabOrKey.data.name : prefabOrKey.name`。
   - Line 107-120: `putNode(node)` 执行 `node.active = false; node.removeFromParent(); pool.put(node);`，未检查 `node` 是否已存在于 `pool` 中。
   - 若对同一个 `Node` 连续调用两次 `putNode(node)`，`cc.NodePool.put(node)` 会将同一个节点引用重复压入池数组中。后续连续两次 `getNode()` 会返回完全相同的 `Node` 实例引用。
   - 若两个不同的 `Prefab` 资源具有相同的名称（如 `Enemies/Goblin.prefab` 与 `Pets/Goblin.prefab`），`poolKey` 均为 `"Goblin"`，会导致 `_prefabMap` 被覆盖，且不同类型的节点在同一个 `NodePool` 中混合存放。
   - Line 128: `prewarm(prefab, count)` 中包含 `if (!prefab || count <= 0) return;` 保护逻辑，`count <= 0` 时不会异常。

3. **`Enemy.ts` (Line 95-96, 122-123, 137-159)**:
   - Line 95-96 & Line 122: 距离计算分别使用 `this.node.position` 与 `this.targetPlayer.position`（或 `Vec3.distance(this.node.position, ...)`）。在 Cocos Creator 中，`node.position` 返回的是相对于**父节点**的本地坐标（Local Position）。
   - 若 `Enemy` 与 `Player` 挂载在场景树中不同的父节点之下，直接计算 `position` 的距离是在比较两个不同的本地坐标系，导致追击与攻击判定距离彻底失效。
   - Line 140: `this.currentHp -= amount;` 当 `takeDamage(amount)` 传入负数（如 `-50`）时，`currentHp` 会增加且突破 `maxHp` 上限。
   - Line 138 & Line 165: `if (this.isDead) return;` 防御标志位能有效防止死亡后重复受击与二次触发 `die()`。

4. **`EventManager.ts` & `EffectManager.ts` (Line 60-73, 83-106)**:
   - `EffectManager.ts` 在 Line 28-38 的 `onLoad` 与 `onDestroy` 中成对调用了 `registerEvents()` 和 `unregisterEvents()`，本身不存在组件销毁后的内存泄漏问题。
   - Line 60-63: `onEnemyDamaged(payload)` 包含 `if (!payload) return;`，但随后直接调用 `this.showDamageText(payload.position, payload.damage, ...)`。
   - Line 85: `log(`[EffectManager] 伤害飘字 ... -> 位置: (${pos.x.toFixed(1)}, ...`)`。若派发的 `payload` 中未提供 `position` 字段（即 `pos` 为 `undefined`），执行 `pos.x` 将抛出 `TypeError: Cannot read properties of undefined (reading 'x')`。

---

## 2. Logic Chain (推演与逻辑链)

1. **`SaveManager` 字段缺失崩溃逻辑链**:
   - 观察 1.1：`load()` 判断 JSON 合法性的条件是 `parsed && typeof parsed.version === 'number'`。
   - 推演：若本地存储的数据被篡改或升级遗留为 `{"version": 1}`（缺少 `player` 属性），`typeof parsed.version === 'number'` 为 `true`，`_saveData` 被设置为 `{ version: 1 }`。
   - 观察 1.2：Line 97 在保存时试图从 `this._saveData.player.realmIndex` 读取回退数据。
   - 结论：由于 `_saveData.player` 为 `undefined`，访问 `.realmIndex` 必然触发运行时 `TypeError` 崩溃。

2. **`PoolManager` 重复入池双重引用逻辑链**:
   - 观察 2.2：`putNode(node)` 没有对节点是否已经在池内的标记（如 `(node as any).__inPool`）进行二次校验，直接调用 `pool.put(node)`。
   - 推演：若业务代码因为逻辑错误（例如死亡动画结束和碰撞回调同时触发）对同一节点调用了两次 `putNode`，`NodePool` 内部数组将插入两个相同的引用。
   - 结论：当后续两次 `getNode()` 被调用时，两个独立的逻辑实体将获得同一个 `Node` 对象的引用，对节点的平移、缩放、激活状态操作将互相干涉，引发严重的逻辑混乱与渲染错乱。

3. **`Enemy` 本地坐标系跨层级计算失效逻辑链**:
   - 观察 3.1：`Enemy.ts` 中计算距离使用了 `node.position`（本地坐标）。
   - 推演：在实际游戏开发中，敌人节点通常节点树为 `Root/EnemyContainer/EnemyNode`，而玩家节点树为 `Root/PlayerNode`。
   - 结论：`EnemyContainer` 的坐标与 `Root` 的坐标不同，直接比较 `EnemyNode.position` 和 `PlayerNode.position` 得到的值在数学上无物理意义，导致追击停止距离 `> 5.0` 和攻击判定距离 `<= 30.0` 出现严重的偏移或失灵。必须统一使用 `worldPosition`（世界坐标）。

4. **`EffectManager` 载荷解构空指针逻辑链**:
   - 观察 4.1：`EffectManager` 收到事件回调时仅检查了 `if (!payload) return;`。
   - 推演：`EventManager.emit` 在 TypeScript 中仅提供编译期泛型约束，在运行时可接受任意对象。若战斗逻辑派发事件时漏传 `position`（如 `EventManager.emit(CombatEvent.ENEMY_DAMAGED, { damage: 10 })`）。
   - 结论：`pos` 为 `undefined`，Line 85 执行 `pos.x.toFixed(1)` 时抛出 `TypeError`，导致特效管理器崩溃中断。

---

## 3. Adversarial Challenges (对抗性挑战与风险评估)

### [Critical] Challenge 1: `PoolManager` 双重 `putNode` 导致对象池节点多重分配
- **被挑战假设**: 假设业务层绝对不会对同一个 `Node` 调用两次 `putNode`。
- **攻击场景**: 敌人受击死亡时触发 `die()` 归还节点，同时由于延时特效/销毁回调或重复碰撞，再次触发 `putNode(this.node)`。
- **破坏半径**: 对象池内部产生重复节点引用，后续场景中两个不同单位同时持有同一个 Node，UI/位置修改互相污染。
- **防御建议**: 在 `putNode` 中检查 `(node as any).__inPool` 标记；若已为 `true` 则警告并返回。

### [High] Challenge 2: `Enemy` 使用 `position` (本地坐标) 而非 `worldPosition` 导致跨父节点距离计算失灵
- **被挑战假设**: 假设 `Enemy` 节点与 `Player` 节点永远处于完全相同的父节点空间下。
- **攻击场景**: 将 `Enemy` 放入 `EnemiesNode` 容器层，`Player` 放在根节点下，移动 `EnemiesNode` 坐标。
- **破坏半径**: 敌人 AI 追击停止距离与攻击半径判定失灵，敌人隔空攻击或穿透玩家。
- **防御建议**: 将 `this.node.position` 与 `targetPlayer.position` 统一替换为 `this.node.worldPosition` 与 `this.targetPlayer.worldPosition`。

### [High] Challenge 3: `SaveManager` 载荷缺少子对象防空保护导致崩溃
- **被挑战假设**: 假设只要 `version` 为 number，JSON 结构中 `player`、`pets` 等字段必然存在。
- **攻击场景**: 本地 `localStorage` 被写入 `{"version": 1}` 或损坏的缺失结构。
- **破坏半径**: 游戏启动加载正常，但在切换场景或调用 `SaveManager.instance.save()` 时触发不可捕获的 `TypeError` 崩溃。
- **防御建议**: 完善 `load()` 中的数据校验与补齐逻辑，对缺失字段用 `getDefaultSaveData()` 的默认值进行 merge 填充。

### [High] Challenge 4: `EffectManager` 缺乏对 `payload.position` 的空值防护
- **被挑战假设**: 假设所有派发 `ENEMY_DAMAGED` 事件的代码都会完整提供 `position` 字段。
- **攻击场景**: 某种技能或状态伤害触发 `EventManager.emit(CombatEvent.ENEMY_DAMAGED, { damage: 50 })` 未带 position。
- **破坏半径**: `pos.x.toFixed(1)` 抛出 JavaScript `TypeError` 异常，中断代码执行。
- **防御建议**: 在 `onEnemyDamaged` / `showDamageText` 中加入 `if (!pos) return;` 防护。

---

## 4. Stress Test Results (压力与边界测试结果)

| 测试场景 | 预期行为 | 实际/推演行为 | 结果 |
|---|---|---|---|
| `SaveManager.load()` 读取空字符串 `""` | 识别为无效，恢复默认存档 | `!rawData` 为 true，加载默认存档 | **PASS** |
| `SaveManager.load()` 读取损坏 JSON `"{bad"` | 捕获异常，恢复默认存档 | `catch(e)` 捕获 SyntaxError，加载默认存档 | **PASS** |
| `SaveManager.load()` 读取缺少 player 的 JSON `{"version":1}` | 补齐字段或恢复默认存档 | 识别为成功，后续 `save()` 访问 `player.realmIndex` 崩溃 | **FAIL** |
| `PoolManager.putNode()` 对同一 Node 调用 2 次 | 防御重复归还，丢弃或警告 | 压入 2 次相同引用，导致双重分配 | **FAIL** |
| `PoolManager.prewarm(prefab, 0)` | 不生成节点，安全返回 | `count <= 0` 触发 early return | **PASS** |
| `PoolManager.getNode("unregistered")` 池为空 | 抛出带有明确 Key 的错误 | 抛出 `Prefab not found for key: unregistered` | **WARN** |
| `Enemy.takeDamage(-50)` 传入负数伤害 | 忽略或限制不超过 maxHp | `currentHp` 增加至 150，突破 `maxHp` | **FAIL** |
| `Enemy` 与 `Player` 处于不同父节点下 | 正确计算世界距离 | 本地坐标混用，距离计算数值严重偏差 | **FAIL** |
| `EffectManager.onEnemyDamaged({ damage: 10 })` 缺少 pos | 忽略飘字或默认位置 | 访问 `pos.x` 抛出 `TypeError` 崩溃 | **FAIL** |

---

## 5. Caveats (局限性与说明)

- **环境限制**: 由于当前 CLI 终端环境对于交互式 `node -v` 命令的权限确认触发超时，本次验证基于严格的 TypeScript 语法树与 Cocos Creator 3.8.8 运行时 API 规范进行的静态推演与对抗性分析。
- **Cocos 原生 NodePool 行为**: `cc.NodePool` 在 3.x 版本中默认不会防重，重复 `put` 的防范必须由上层管理器（即 `PoolManager`）实现。

---

## 6. Conclusion (结论与修复建议)

**评估结论**: **拒绝 (REJECT)** / **需修复后方可提交**。
现有的 5 个管理器/组件在标准流程下表现正常，但在边界条件、跨层级节点计算、对象池重复回收和不完整存档加载等异常场景下存在 4 个高危崩溃点。

### 修复方案建议:

1. **`SaveManager.ts`**:
   - 在 `load()` 中对解析出的对象进行深度默认值合并（如使用 `Object.assign` 或深拷贝补齐 `player`, `pets`, `talents` 字段）。
   - 增加版本号精确校验 `if (parsed && parsed.version === this.CURRENT_VERSION && parsed.player)`。

2. **`PoolManager.ts`**:
   - 在 `putNode(node)` 中防重:
     ```ts
     if ((node as any).__inPool) {
         warn('[PoolManager] 节点已在对象池中，忽略重复归还:', node.name);
         return;
     }
     (node as any).__inPool = true;
     ```
   - 在 `getNode` 中提取节点时重置标记 `(node as any).__inPool = false;`。

3. **`Enemy.ts`**:
   - 将 Line 95-96 与 Line 122 改为使用世界坐标:
     ```ts
     const currentPos = this.node.worldPosition;
     const targetPos = this.targetPlayer.worldPosition;
     ```
   - 在 `takeDamage(amount)` 中防范负数伤害与血量上限:
     ```ts
     if (amount <= 0) return;
     this.currentHp = Math.clamp(this.currentHp - amount, 0, this.maxHp);
     ```

4. **`EffectManager.ts`**:
   - 在 `showDamageText`, `playDeathEffect`, `playAttackEffect` 入口处对 `pos` 进行完整性校验:
     ```ts
     if (!pos || typeof pos.x !== 'number' || typeof pos.y !== 'number') return;
     ```

---

## 7. Verification Method (验证方法)

1. **静态检查**:
   - 检查 `SaveManager.ts` 226 行、`PoolManager.ts` 158 行、`Enemy.ts` 200 行、`EffectManager.ts` 108 行。
2. **失效重现条件 (Invalidation Conditions)**:
   - 构造 `sys.localStorage.setItem('yokai_codex_save_v1', '{"version":1}')` 启动游戏并触发 `SaveManager.instance.save()`。
   - 创建 `Node` 并连续执行 `PoolManager.instance.putNode(node); PoolManager.instance.putNode(node);`，检查 `pool.size()` 是否为 2。
   - 将 `Enemy` 节点移入子节点层级 `Scene/Container/Enemy`，观察追击与攻击判定是否正常。
