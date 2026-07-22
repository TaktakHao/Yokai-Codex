# Phase 11 需求全面探索与架构分析报告

## 探索摘要
本报告针对《万妖录：躺平修仙》第十一阶段（Phase 11）的核心需求进行深度代码库分析，重点解决以下三大模块的设计与实现方案：
1. **R1. 简约国风主界面 UI 搭建 (HomePanel UI Hub)**：纯代码防御性构建 `HomePanel.ts`，打通顶部 HUD 资产显示、中部御兽五行羁绊与出战阵容、四大功能子界面拉起、以及底部【开始降妖】的核心交互。
2. **R2. 局内外关卡切换与结算闭环 (Outer Gameplay Loop Integration)**：重构 `GameManager.ts` 启动流程为默认打开 `HomePanel`；新建 `VictoryPanel.ts` 与 `GameOverPanel.ts` 并挂载【返回洞府】按钮；实现完整的 `returnToHome()` 资源清理、节点回收、关卡重置与 UI 状态切换流程。
3. **R3. 极简美工与易上手引导 (Usability & Simplicity UI Polishing)**：统一全面板国风调色盘、边框卡片规范与返回按钮样式，增加直观的文字引导提升易上手度。

---

## 一、 R1. 简约国风主界面 UI 搭建 (HomePanel UI Hub)

### 1. `UIManager.ts` 注册与纯代码降级机制
项目采用纯代码防御性 UI 构建体系（即在缺少 `.prefab` 资源时，自动实例化 `Node` 并挂载对应 `Component`）。
在 [UIManager.ts](file:///Users/wesson/YokaiCodex/assets/Scripts/Manager/UIManager.ts) 中：
- 需要导入 `HomePanel`：`import { HomePanel } from '../UI/HomePanel';`
- 在 `openUI(panelPath: string)` 的回退创建逻辑分支中（第 68-84 行）：
  ```typescript
  } else if (panelName === 'HomePanel') {
      uiNode.addComponent(HomePanel);
  }
  ```
- 这样无论外部传入 `'UI/HomePanel'` 还是 `'HomePanel'`，`UIManager` 都能安全创建节点并挂载 `HomePanel` 组件。

### 2. `HomePanel.ts` 的节点布局与数据绑定

#### (1) 全屏容器与国风调色
- **节点尺寸**：`720 x 1280`（UI_2D 层级，适配 9:16 移动端竖屏）。
- **背景风格**：深色半透明古风玄青背景 `Color(15, 23, 42, 245)`，使用 `Sprite` + `VisualLoader.applySolidSprite()` 生成。

#### (2) 顶部常驻 HUD
- **位置**：Y = 560（标题）/ Y = 500（HUD）
- **数据来源**：
  - 灵石数量：`HomeManager.instance.spiritStones`
  - 修仙材料：`HomeManager.instance.materials`
  - 当前境界：`HomeManager.instance.getCurrentRealmInfo().name`
- **样式**：金黄色标题 `Color(255, 215, 0)`，纯白/金黄数值呈现。

#### (3) 中部御兽列表与五行羁绊共鸣展示
- **五行羁绊计算**：调用 `HomeManager.instance.calculateElementResonance()`，返回 `IResonanceBonus` 结构：
  - `3金`: 全员攻击 +20%
  - `3木`: 主角与宠物每秒恢复 15 HP
  - `3水`: CDR / 宠物攻速 +15%
  - `3火`: 暴击率 +20%
  - `3土`: 防御力/免伤 +20%
- **显示形式**：以高亮绿字 `Color(34, 197, 94)` 显示已激活的羁绊名称与效果，未激活则显示灰色提示或引导文案（`出战 3 只同五行属性宠物可触发额外羁绊！`）。
- **上阵御兽列表**：
  - 调用 `HomeManager.instance.getEquippedPetIds()` 获得已上阵宠物 ID 列表（最多 5 只）。
  - 调用 `PetCaptureManager.instance.getPetById(petId)` 提取宠物详情（名称、星级 `★`、五行 `[金/木/水/火/土]`、稀有度）。
  - 使用网格/水平排布渲染卡片节点，如果槽位为空则显示 `[空槽位]`。

#### (4) 四大功能子界面按钮
- `【境界突破】`：点击调用 `HomeManager.instance.upgradeRealm()`。若返回 `needChallenge: true`，则调用 `UIManager.instance.openUI('UI/TribulationPanel')` 拉起渡劫面板。
- `【御兽盲盒】`：点击调用 `UIManager.instance.openUI('UI/AppraisalPanel')` 打开宠物孵化面板。
- `【仙器法宝】`：点击调用 `UIManager.instance.openUI('UI/EquipmentPanel')` 打开法宝装备合成面板。
- `【洞府装修】`：点击调用 `UIManager.instance.openUI('UI/FurniturePanel')` 打开家具购买面板。

#### (5) 底部核心【开始降妖】按钮
- **位置**：Y = -480
- **外观**：大尺寸按钮（`320 x 75`），采用朱红/翡翠绿高亮配色 `Color(34, 197, 94)` 或 `Color(220, 90, 40)`。
- **点击逻辑**：
  - 隐藏/关闭 `HomePanel` (`this.node.active = false`)。
  - 调用 `GameManager.instance.startGame('Level_1')` 进入第一关战斗历练。

---

## 二、 R2. 局内外关卡切换与结算闭环 (Outer Gameplay Loop Integration)

### 1. `GameManager.ts` 启动流程重构
在 [GameManager.ts](file:///Users/wesson/YokaiCodex/assets/Scripts/Manager/GameManager.ts) 的 `initSystem()` 方法中：
- 原代码（第 96-102 行）在 0.5s 后自动启动 `startGame('Level_1')`：
  ```typescript
  // 原代码
  this._currentState = GameState.HOME;
  this.scheduleOnce(() => {
      this.startGame('Level_1');
  }, 0.5);
  ```
- **重构方案**：改为在初始化完成后默认打开主界面 `HomePanel`：
  ```typescript
  this._currentState = GameState.HOME;
  log('[GameManager] 全局系统初始化完成，默认显示主界面 HomePanel。');
  if (UIManager.instance) {
      UIManager.instance.openUI('UI/HomePanel');
  }
  ```

### 2. 结算面板 `VictoryPanel.ts` 与 `GameOverPanel.ts` 的创建
通过 `grep_search` 查看发现，代码库中目前尚未创建独立的 `VictoryPanel.ts` 与 `GameOverPanel.ts` 脚本文件。
- **实现方案**：
  1. 在 `assets/Scripts/UI/` 下新增 `VictoryPanel.ts` 与 `GameOverPanel.ts`。
  2. 在 `UIManager.ts` 中引入并注册这两个面板。
  3. 面板功能：
     - 展示通关结果（`🎉 历练大捷` 或 `💀 劫数难逃`）。
     - 显示获得的灵石与修仙材料战利品（从 `GameManager` 的 `settleBattleRewards` 获取）。
     - 提供核心 **`【返回洞府】`** 按钮（点击绑定 `GameManager.instance.returnToHome()`）。

### 3. `GameManager.ts` 中 `returnToHome()` 方法实现步骤详解

当玩家在 `VictoryPanel` 或 `GameOverPanel` 点击“返回洞府”时，`returnToHome()` 必须无遗漏地完成以下四个步骤：

```
+-------------------------------------------------------------------+
|                     GameManager.returnToHome()                    |
+-------------------------------------------------------------------+
                                  |
    +-----------------------------+-----------------------------+
    |                             |                             |
    v                             v                             v
[步骤1: 怪物/弹药回收]         [步骤2: 宠物/主角重置]       [步骤3: 关卡重置]
- 遍历 EnemyLayer              - 销毁 Canvas 下所有        - LevelManager.resetLevel()
- PoolManager.putNode(enemy)     Follower_xxx 宠物节点      - 停止 timer，清空 waves
- 清空 PetSpellProjectile      - 重置 PlayerController       - activeEnemyCount = 0
                                 HP/Exp/Pos 初始状态
                                  |
                                  v
                       [步骤4: UI面板切换]
                       - 关闭 BattleUIPanel
                       - 关闭 Victory/GameOverPanel
                       - 切换 GameState 为 HOME
                       - 打开 HomePanel & 刷新资产
```

#### 具体逻辑步骤：
1. **销毁/回收怪物与飞弹投射物节点**：
   - 查找场景中的怪物根节点 `EnemyLayer`。
   - 遍历子节点，针对处于 active 状态的怪物，优先调用 `PoolManager.instance.putNode(enemyNode)` 回收至对象池；若没有对象池则调用 `enemyNode.destroy()`。
   - 查找并销毁/回收场上残存的 `PetSpellProjectile`（宠物飞弹）及 `EffectManager` 粒子特效。
2. **销毁主角随行宠物节点与重置主角渲染节点**：
   - 遍历 Canvas 子节点，查找所有名称以 `Follower_` 开头的宠物跟随节点，调用 `destroy()` 清理。
   - 获取 `PlayerController` 实例，重置 `currentHp = maxHp`，`currentExp = 0`，位置复位至原点 `(0, 0, 0)`。
3. **停止关卡计时与波次刷怪逻辑，重置 `LevelManager.ts` 数据**：
   - 在 `LevelManager.ts` 中补充 `resetLevel()` 方法：
     ```typescript
     public resetLevel() {
         this.isPlaying = false;
         this.gameTime = 0;
         this.spawnedWaves.clear();
         this.activeEnemyCount = 0;
     }
     ```
   - 在 `returnToHome()` 中显式调用 `LevelManager.instance.resetLevel()`。
4. **关闭局内 UI 与结算面板，重新拉起 `HomePanel`**：
   - 调用 `UIManager.instance.closeUI('UI/BattleUIPanel')` 或 `closeAllUI()`。
   - 切换 `this._currentState = GameState.HOME`。
   - 调用 `UIManager.instance.openUI('UI/HomePanel')` 显示主界面。
   - 触发 `HomeManager.instance.settleOfflineEarnings()`，保存最新存档状态。

---

## 三、 R3. 极简美工与易上手引导 (Usability & Simplicity UI Polishing)

### 1. 统一国风主题调色盘 (Color Palette Specification)
为了保持项目风格的连贯性与唯美视觉表现，所有 UI 面板（`HomePanel`, `AppraisalPanel`, `EquipmentPanel`, `FurniturePanel`, `TribulationPanel`, `VictoryPanel`, `GameOverPanel`）统一遵循以下调色规范：

| 元素分类 | Color RGBA 配置 | 视觉说明 |
| :--- | :--- | :--- |
| **面板半透明背景** | `Color(15, 23, 42, 245)` | 深黑海蓝玄青古风半透明底色 |
| **标题 / 强调文字** | `Color(255, 215, 0, 255)` | 鎏金烫金高亮文字 |
| **共鸣 / 成功 / 属性** | `Color(34, 197, 94, 255)` | 翡翠绿 / 灵石绿高亮状态 |
| **卡片背景框** | `Color(30, 35, 50, 255)` | 深灰色凸起边框面板卡片 |
| **关闭 / 返回按钮** | `Color(160, 50, 50, 255)` | 墨红 / 灰红规范返回按钮 |
| **核心操作按钮** | `Color(34, 197, 94, 255)` / `Color(220, 90, 40)` | 醒目绿/朱红按钮 |

### 2. 上手引导与提示文案 (Usability Guidance)
- 在 `HomePanel` 中部御兽栏添加提示文本：`“提示：出战相同五行的宠物可触发额外羁绊！”`
- 在四大功能按钮旁或面板头部添加通俗易懂的说明（如 `突破境界提升挂机产率`、`法宝合成升星大幅增幅规则特质` 等）。

---

## 四、 拟订的代码修改方案 (Proposed Code Snippets)

### 1. `HomePanel.ts` 拟订结构
新建 `assets/Scripts/UI/HomePanel.ts`：
```typescript
import { _decorator, Component, Node, Label, UITransform, Vec3, Color, Sprite, Button, Layers } from 'cc';
import { HomeManager } from '../Manager/HomeManager';
import { PetCaptureManager } from '../Logic/PetCaptureManager';
import { UIManager } from '../Manager/UIManager';
import { GameManager } from '../Manager/GameManager';
import { VisualLoader } from '../Utils/VisualLoader';

const { ccclass } = _decorator;

@ccclass('HomePanel')
export class HomePanel extends Component {
    private spiritStoneLabel: Label | null = null;
    private materialLabel: Label | null = null;
    private realmLabel: Label | null = null;
    private resonanceLabel: Label | null = null;
    private petListContainer: Node | null = null;
    private startBattleBtn: Node | null = null;

    onLoad() {
        this.node.layer = Layers.Enum.UI_2D;
        this.ensureUIElements();
        this.bindEvents();
    }

    onEnable() {
        this.refreshDisplay();
    }

    private ensureUIElements() {
        // 构建 720x1280 深色背景
        // 构建 顶部 HUD Label
        // 构建 中部 5 行羁绊与宠物卡片容器
        // 构建 四大功能按钮 (突破、盲盒、法宝、装修)
        // 构建 底部【开始降妖】按钮
    }

    public refreshDisplay() {
        // 读取 HomeManager 灵石、材料、境界
        // 计算并更新五行共鸣文本
        // 渲染已上阵宠物卡片
    }

    private bindEvents() {
        // 按钮点击回调绑定
    }
}
```

### 2. `GameManager.ts` `returnToHome()` 拟订实现
在 [GameManager.ts](file:///Users/wesson/YokaiCodex/assets/Scripts/Manager/GameManager.ts) 中增加：
```typescript
public returnToHome() {
    log('[GameManager] 执行 returnToHome() 返回洞府主界面...');

    // 1. 清理怪物与飞弹投射物节点
    const scene = director.getScene();
    const canvas = scene?.getChildByName('Canvas');
    const enemyLayer = canvas?.getChildByName('EnemyLayer') || canvas;
    if (enemyLayer) {
        const enemies = [...enemyLayer.children];
        for (const enemyNode of enemies) {
            if (enemyNode.active) {
                if (PoolManager.instance) {
                    PoolManager.instance.putNode(enemyNode);
                } else {
                    enemyNode.destroy();
                }
            }
        }
    }

    // 2. 清理随行宠物节点与重置主角
    if (canvas) {
        const children = [...canvas.children];
        for (const child of children) {
            if (child.name.startsWith('Follower_') || child.name === 'PetSpellProjectile') {
                child.destroy();
            }
        }

        const playerNode = canvas.getChildByName('Player') || scene?.getComponentInChildren('PlayerController')?.node;
        if (playerNode) {
            const playerComp = playerNode.getComponent('PlayerController') as any;
            if (playerComp) {
                playerComp.restoreFullHp();
                playerNode.setPosition(0, 0, 0);
            }
        }
    }

    // 3. 停止关卡刷怪与重置 LevelManager
    if (this.levelManager) {
        this.levelManager.resetLevel();
    }

    // 4. 关闭局内与结算 UI，打开 HomePanel
    if (UIManager.instance) {
        UIManager.instance.closeUI('UI/BattleUIPanel');
        UIManager.instance.closeUI('UI/VictoryPanel');
        UIManager.instance.closeUI('UI/GameOverPanel');
        UIManager.instance.openUI('UI/HomePanel');
    }

    this._currentState = GameState.HOME;
    if (HomeManager.instance) {
        HomeManager.instance.settleOfflineEarnings();
    }
}
```

---

## 总结
Phase 11 的需求探索已全面完成，架构清晰，接口契约与依赖关系明确。后续 Implementer 可严格按照本报告的设计方案进行代码编写与面板注册。
