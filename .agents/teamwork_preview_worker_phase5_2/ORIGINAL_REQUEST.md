## 2026-07-21T09:49:43Z
You are Worker 2 assigned to perform targeted code hardening on Phase 5 files for YokaiCodex based on Challenger findings.
Your workspace directory is `/Users/wesson/YokaiCodex/.agents/teamwork_preview_worker_phase5_2/`. Create this directory if needed and document your work there.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

User Rules:
- 所有的代码注释说明输出等都使用中文。
- 不需要写单元测试 (不需要先写test)。

Apply the following 4 hardening fixes:

1. `assets/Scripts/Manager/PoolManager.ts`:
   - In `putNode(node: Node)`: Check `if ((node as any).__inPool) { warn(...); return; }`. Then set `(node as any).__inPool = true;`.
   - In `getNode(prefabOrKey: Prefab | string)`: Set `(node as any).__inPool = false;`.

2. `assets/Scripts/Logic/Enemy.ts`:
   - Replace `this.node.position` and `this.targetPlayer.position` in distance calculations and chase logic with `this.node.worldPosition` and `this.targetPlayer.worldPosition`.
   - In `takeDamage(amount: number)`: Add check `if (amount <= 0 || this.isDead) return;` and ensure `currentHp` stays within `[0, maxHp]`.

3. `assets/Scripts/Manager/SaveManager.ts`:
   - In `load()`: Validate that `parsed` has valid `player`, `pets`, and `talents` objects. If any section is missing or invalid, deep merge with `getDefaultSaveData()` so that `this._saveData` is guaranteed to have all required fields.

4. `assets/Scripts/Manager/EffectManager.ts`:
   - In `showDamageText`, `playDeathEffect`, `playAttackEffect`: Add guard check `if (!pos || typeof pos.x !== 'number' || typeof pos.y !== 'number') return;` to prevent null pointer exceptions when accessing `pos.x`.

When done, write your handoff report to `/Users/wesson/YokaiCodex/.agents/teamwork_preview_worker_phase5_2/handoff.md` and send a message back to the orchestrator.
