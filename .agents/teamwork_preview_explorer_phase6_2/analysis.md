# 阶段六 R2 动态生成节点与贴图绑定调查与设计报告

## 1. 渲染绑定现状分析

通过对现有代码库的深度调查（重点针对 `PlayerController.ts` 和 `Logic/Enemy.ts`），现状总结如下：

1. **PlayerController 现状** (`assets/Scripts/PlayerController.ts`):
   - 实现了移动逻辑 (`handleMovement`)、自动寻敌与攻击逻辑 (`executeAutoAttack`)、血量经验升级机制 (`takeDamage`, `addExp`, `levelUp`) 等完整逻辑。
   - **渲染缺失**：目前完全没有任何动态挂载 UI/Sprite 渲染组件或自动加载贴图的代码逻辑，节点渲染依赖场景中手动预制或处于无贴图可视化状态。

2. **Enemy 现状** (`assets/Scripts/Logic/Enemy.ts`):
   - 实现了 `IEnemy` 接口、AI 追击 (`handleChase`)、近战触碰判定 (`handleContactAttack`) 以及与 `PoolManager` 的节点回收销毁复用机制 (`die`, `onEnable`)。
   - **渲染缺失**：`Enemy` 脚本包含基础数值与 AI，但未定义 Sprite 挂载或贴图加载逻辑。

3. **LevelManager 现状** (`assets/Scripts/LevelManager.ts`):
   - 负责读取 `resources/Configs/Level_1_Waves.json` 并根据波次数据 (`monster_id`, `spawn_count`, `base_hp`) 从 `PoolManager` 获取或实例化 `monsterPrefab`，随后调用 `enemyComp.init(wave.base_hp)`。

---

## 2. 资源目录结构调查与规划

### 现有资源目录检查
通过对 `/Users/wesson/YokaiCodex/assets/resources/` 的文件检索发现：
- 现有目录结构仅包含配置文件夹：`assets/resources/Configs/`（内含 `Chapter1_Dialogues.json` 和 `Level_1_Waves.json`）。
- **`assets/resources/` 下目前尚无 `Textures` 目录**。

### 规划资源目录结构
为支持动态贴图加载，建议在 `assets/resources/` 下建立如下标准层级结构：

```text
assets/resources/
├── Configs/
│   ├── Chapter1_Dialogues.json
│   └── Level_1_Waves.json
└── Textures/
    ├── Player/
    │   └── player.png       # 主角贴图 (resources.load('Textures/Player/player', SpriteFrame))
    └── Enemies/
        ├── monster_1.png    # 基础怪物贴图
        ├── monster_2.png    # 精英怪物贴图
        └── boss_1.png       # Boss 怪物贴图
```

*注：在 Cocos Creator 3.x 中，使用 `resources.load('Textures/Player/player', SpriteFrame, ...)` 会自动将图片文件转化为 `SpriteFrame` 资源进行加载。*

---

## 3. VisualLoader 详细设计方案

VisualLoader 为静态通用工具类，存放于 `assets/Scripts/Utils/VisualLoader.ts`。

### 核心设计原则
1. **幂等性**：重复调用时，优先查找是否已存在名称为 `Visual`（或自定义名称）的子节点及 `Sprite` 组件；若存在直接复用，避免产生重复节点。
2. **异步安全性**：Cocos Creator 资源加载为异步过程，回调触发时需校验目标节点及子节点是否依然有效 (`isValid`)，防止由于对象池回收或节点销毁导致 Null Component 操作异常。
3. **高拓展性**：提供配置选项接口 `IVisualOptions`，支持设置节点名称、渲染尺寸 (`Size`)、颜色叠加 (`Color`) 及 `Sprite.SizeMode`。

### 完整代码结构草案 (`assets/Scripts/Utils/VisualLoader.ts`)

```typescript
import { _decorator, Node, Sprite, SpriteFrame, resources, error, log, UITransform, Size, Color } from 'cc';

/**
 * 视觉渲染贴图加载配置选项
 */
export interface IVisualOptions {
    /** 视觉挂载子节点名称，默认 'Visual' */
    childName?: string;
    /** 节点尺寸 (Width, Height) */
    size?: Size;
    /** 渲染颜色叠加 */
    color?: Color;
    /** 贴图尺寸适配模式 */
    sizeMode?: Sprite.SizeMode;
}

/**
 * VisualLoader 动态视觉贴图加载工具类
 * 提供通用的节点 Sprite 组件挂载与 resources/Textures 贴图异步加载绑定功能
 */
export class VisualLoader {

    /**
     * 为目标节点动态挂载/更新 Sprite 组件并加载贴图
     * @param targetNode 挂载的目标父节点 (如 Player 或 Enemy 节点)
     * @param texturePath resources 目录下的相对贴图路径 (例: 'Textures/Player/player')
     * @param options 可选的尺寸、颜色、节点名等配置项
     * @returns Promise<SpriteFrame | null> 加载成功返回 SpriteFrame，失败或节点被销毁返回 null
     */
    public static loadVisual(
        targetNode: Node,
        texturePath: string,
        options?: IVisualOptions
    ): Promise<SpriteFrame | null> {
        return new Promise((resolve) => {
            // 参数合法性检查
            if (!targetNode || !targetNode.isValid) {
                error('[VisualLoader] 目标节点为空或已失效，无法加载贴图。');
                resolve(null);
                return;
            }

            const childName = options?.childName || 'Visual';

            // 1. 幂等检查：获取或创建 Visual 子节点
            let visualNode = targetNode.getChildByName(childName);
            if (!visualNode) {
                visualNode = new Node(childName);
                visualNode.setParent(targetNode);
                visualNode.setPosition(0, 0, 0); // 居中相对父节点
            }

            // 2. 获取或添加 Sprite 与 UITransform 组件
            let sprite = visualNode.getComponent(Sprite);
            if (!sprite) {
                sprite = visualNode.addComponent(Sprite);
            }

            let uiTransform = visualNode.getComponent(UITransform);
            if (!uiTransform) {
                uiTransform = visualNode.addComponent(UITransform);
            }

            // 3. 应用配置参数
            if (options?.sizeMode !== undefined) {
                sprite.sizeMode = options.sizeMode;
            }
            if (options?.color) {
                sprite.color = options.color;
            }
            if (options?.size) {
                uiTransform.setContentSize(options.size);
            }

            // 4. 异步加载 resources/ 目录下的 SpriteFrame
            resources.load(texturePath, SpriteFrame, (err, spriteFrame: SpriteFrame) => {
                if (err) {
                    error(`[VisualLoader] 加载贴图失败: ${texturePath}`, err);
                    resolve(null);
                    return;
                }

                // 异步安全校验：确保在加载完成时节点仍有效
                if (!targetNode.isValid || !visualNode.isValid || !sprite.isValid) {
                    log(`[VisualLoader] 节点在加载完成前已被销毁，放弃赋值: ${texturePath}`);
                    resolve(null);
                    return;
                }

                // 5. 绑定 SpriteFrame
                sprite.spriteFrame = spriteFrame;
                log(`[VisualLoader] 成功为节点 [${targetNode.name}] 加载并绑定贴图: ${texturePath}`);
                resolve(spriteFrame);
            });
        });
    }

    /**
     * 清理/移除目标节点的 Visual 视觉子节点
     * @param targetNode 目标父节点
     * @param childName 子节点名称，默认 'Visual'
     */
    public static clearVisual(targetNode: Node, childName: string = 'Visual'): void {
        if (!targetNode || !targetNode.isValid) return;
        const visualNode = targetNode.getChildByName(childName);
        if (visualNode) {
            visualNode.destroy();
        }
    }
}
```

---

## 4. PlayerController 与 Enemy 调用集成方案

### 4.1 PlayerController 集成修改分析
在 `PlayerController.ts` 中：
1. 导入 `VisualLoader` 和 `Size`。
2. 增加可选的 `@property public texturePath: string = 'Textures/Player/player';` 属性，方便编辑器调整。
3. 在 `start()` 生命周期中调用 `setupVisual()` 自动初始化 Visual 子节点。

**集成代码示例**：
```typescript
import { VisualLoader } from './Utils/VisualLoader';
import { Size } from 'cc';

// 在 PlayerController 类内部添加：
@property
public texturePath: string = 'Textures/Player/player';

start() {
    this.currentHp = this.maxHp;
    this.currentExp = 0;
    this.setupVisual();
}

/**
 * 自动为主角创建挂载 Sprite 的子节点并加载贴图
 */
private setupVisual() {
    VisualLoader.loadVisual(this.node, this.texturePath, {
        childName: 'Visual',
        size: new Size(64, 64)
    });
}
```

### 4.2 Enemy 集成修改分析
在 `Logic/Enemy.ts` 中：
1. 导入 `VisualLoader` 和 `Size`。
2. 添加 `@property public texturePath: string = 'Textures/Enemies/monster_1';`。
3. 修改 `init` 签名，支持动态传入 `texturePath`；在 `init()` 内部调用 `setupVisual()`。
4. **对象池兼容**：对象池复用该节点时，`loadVisual` 的幂等逻辑会自动重用已有的 `Visual` 子节点和 `Sprite` 组件，仅在贴图路径变更时更新赋值。

**集成代码示例**：
```typescript
import { VisualLoader } from '../Utils/VisualLoader';
import { Size } from 'cc';

// 在 Enemy 类内部添加：
@property
public texturePath: string = 'Textures/Enemies/monster_1';

/**
 * 节点复用与属性重置初始化
 */
public init(hp?: number, speed?: number, target?: Node, texturePath?: string) {
    if (hp !== undefined && hp > 0) {
        this.maxHp = hp;
    }
    if (speed !== undefined && speed > 0) {
        this.moveSpeed = speed;
    }
    if (target) {
        this.targetPlayer = target;
    }
    if (texturePath) {
        this.texturePath = texturePath;
    }
    this.resetState();
    this.setupVisual();
}

/**
 * 自动为怪物创建挂载 Sprite 的子节点并加载贴图
 */
private setupVisual() {
    VisualLoader.loadVisual(this.node, this.texturePath, {
        childName: 'Visual',
        size: new Size(48, 48)
    });
}
```

### 4.3 LevelManager 联动升级（可选推荐）
在 `LevelManager.ts` 中 spawn 怪物时，可结合 `wave.monster_id` 动态为每种怪物传入对应的贴图路径：
```typescript
const texturePath = `Textures/Enemies/${wave.monster_id}`;
if (enemyComp && typeof (enemyComp as any).init === 'function') {
    (enemyComp as any).init(wave.base_hp, undefined, undefined, texturePath);
}
```
这样波次配置文件中配置 `monster_1`, `monster_2` 时，能自动加载相对应的纹理。
