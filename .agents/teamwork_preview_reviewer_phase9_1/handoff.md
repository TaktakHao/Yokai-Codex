# Phase 9 Code Review Handoff Report

## 1. Observation
- `assets/Scripts/Manager/HomeManager.ts` lines 704-720:
  ```typescript
  public addSpiritStones(amount: number) {
      if (amount > 0) {
          this._spiritStones += amount;
          this.saveData();
      }
  }
  public addMaterials(amount: number) {
      if (amount > 0) {
          this._materials += amount;
          this.saveData();
      }
  }
  ```
- `assets/Scripts/Logic/PetCaptureManager.ts` lines 217, 220, 532, 533:
  ```typescript
  homeMgr.addSpiritStones(-300);
  homeMgr.addMaterials(-30);
  homeMgr.addSpiritStones(-100);
  homeMgr.addSpiritStones(-2000);
  homeMgr.addMaterials(-200);
  ```
  Passing negative amounts to `addSpiritStones` and `addMaterials` causes `amount > 0` check to fail, so resource deduction is completely bypassed during hatching and evolution.

- `assets/Scripts/Logic/PetCaptureManager.ts` line 539:
  ```typescript
  pet.attack = Math.floor(pet.attack * 1.50);
  ```
  and `assets/Scripts/Logic/PetFollower.ts` lines 242-243:
  ```typescript
  const evolveDamageMult = isEvolved ? 1.5 : 1.0;
  const damageVal = Math.floor(this.petData.attack * (1 + goldAtkBonus) * evolveDamageMult);
  ```
  `petData.attack` is already multiplied by 1.5 during `evolvePet()`. Re-multiplying by `evolveDamageMult = 1.5` in `PetFollower.ts` leads to `1.5 * 1.5 = 2.25` double-counting of evolution damage boost.

- `assets/Scripts/Manager/SaveManager.ts` lines 194-208: Correctly handles fallback initialization of missing fields (`element`, `star`, `isEvolved`, `furniture`) for backward save compatibility.
- `assets/Scripts/UI/AppraisalPanel.ts` & `assets/Scripts/UI/FurniturePanel.ts`: Pure-code fallback creation handles missing prefabs cleanly. `UIManager.ts` lines 70-74 map dynamic panel fallback creation.

## 2. Logic Chain
1. Requirement R1 specifies `evolvePet` must deduct 2000 spiritStones + 200 materials and grant +50% stats.
2. Requirement R2 specifies ordinary hatching costs 100 spiritStones and elixir hatching costs 300 spiritStones + 30 materials.
3. Observations show `HomeManager.addSpiritStones` and `addMaterials` guard with `if (amount > 0)`.
4. Therefore, any call attempting negative deductions (e.g. `addSpiritStones(-2000)`) is silently dropped without modifying `_spiritStones` or `_materials`.
5. This breaks economic balance completely: players can hatch and evolve pets for zero cost once threshold is reached.
6. Observations show `pet.attack` is multiplied by 1.5 in `evolvePet` and then multiplied by 1.5 again in `PetFollower.fireProjectile`.
7. This causes evolved pets to deal 2.25x damage instead of 1.5x damage, breaking combat damage math.

## 3. Caveats
- No caveats. Code review was performed line-by-line across all 8 target files.

## 4. Conclusion
Final verdict is **`REQUEST_CHANGES`**.
Worker 1 implemented UI fallbacks,五行共鸣 calculations, furniture bonuses, and save backward compatibility well, but introduced a Critical resource deduction defect and a Major combat damage double-counting defect.

## 5. Verification Method
1. Inspect `HomeManager.ts` lines 704-720 to verify `amount > 0` condition.
2. Trace `PetCaptureManager.ts` lines 217, 220, 532, 533 to verify negative argument calls.
3. Trace `PetCaptureManager.ts` line 539 and `PetFollower.ts` lines 242-243 to verify 1.5x damage double multiplier.
4. Final review report written to `/Users/wesson/YokaiCodex/.agents/teamwork_preview_reviewer_phase9_1/review.md`.
