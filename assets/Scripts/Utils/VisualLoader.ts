import { Node, Sprite, SpriteFrame, resources, error, log, UITransform, Size, Color, Layers, Vec3 } from 'cc';

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
    /** 节点缩放 */
    scale?: Vec3;
}

/** 怪物 ID 至磁盘真实 Texture 路径映射字典 */
const ENEMY_TEXTURE_MAP: Record<string, string> = {
    'mob_grass_sprite': 'Textures/Enemies/monster_1',
    'mob_wood_spirit': 'Textures/Enemies/monster_1',
    'mob_venom_snake': 'Textures/Enemies/monster_2',
    'mob_gale_wolf': 'Textures/Enemies/monster_2',
    'elite_grass_brute': 'Textures/Enemies/boss_1',
    'elite_venom_toad': 'Textures/Enemies/monster_2',
    'elite_gale_wolf_alpha': 'Textures/Enemies/boss_1',
    'elite_wood_golem': 'Textures/Enemies/boss_1',
    'boss_millennium_tree_demon': 'Textures/Enemies/boss_1',
    'rare_golden_mouse': 'Textures/Enemies/monster_1',
    'player': 'Textures/Player/player'
};

/** 通用纯色占位精灵路径，用于资源缺失或占位图时的可视化兜底 */
const SOLID_SPRITE_FRAME_PATH = 'Textures/UI/white/spriteFrame';

/**
 * VisualLoader 动态视觉贴图加载工具类
 * 提供通用的节点 Sprite 组件挂载与 resources/Textures 贴图异步加载绑定功能
 */
export class VisualLoader {
    /**
     * 为目标 Sprite 挂载一个纯色可见占位图，避免浏览器预览出现整屏黑但无报错的情况
     */
    public static applySolidSprite(sprite: Sprite, color?: Color): Promise<SpriteFrame | null> {
        return new Promise((resolve) => {
            resources.load(SOLID_SPRITE_FRAME_PATH, SpriteFrame, (err, spriteFrame: SpriteFrame) => {
                if (err || !spriteFrame) {
                    error('[VisualLoader] 纯色占位图加载失败:', err);
                    resolve(null);
                    return;
                }

                if (!sprite.isValid) {
                    resolve(null);
                    return;
                }

                sprite.spriteFrame = spriteFrame;
                if (color) {
                    sprite.color = color;
                }
                resolve(spriteFrame);
            });
        });
    }

    /**
     * 判断当前贴图是否为明显的 1x1 占位资源
     */
    private static isPlaceholderSpriteFrame(spriteFrame: SpriteFrame): boolean {
        const rect = spriteFrame.rect;
        return rect.width <= 1 && rect.height <= 1;
    }

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

            // 确保父节点本身也具备 UI_2D 层级
            if (!targetNode.layer || targetNode.layer === Layers.Enum.DEFAULT) {
                targetNode.layer = Layers.Enum.UI_2D;
            }

            const childName = options?.childName || 'Visual';

            // 1. 幂等检查：获取或创建 Visual 子节点
            let visualNode = targetNode.getChildByName(childName);
            if (!visualNode) {
                visualNode = new Node(childName);
                visualNode.layer = targetNode.layer || Layers.Enum.UI_2D;
                visualNode.setParent(targetNode);
                visualNode.setPosition(0, 0, 0); // 居中相对父节点
            } else {
                visualNode.layer = targetNode.layer || Layers.Enum.UI_2D;
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
            if (options?.scale) {
                visualNode.setScale(options.scale);
            }

            // 4. 解析真实贴图路径 (优先查找 Mapping 表)
            let mappedPath = texturePath;
            const pathParts = texturePath.split('/');
            const rawName = pathParts[pathParts.length - 1];
            if (ENEMY_TEXTURE_MAP[rawName]) {
                mappedPath = ENEMY_TEXTURE_MAP[rawName];
            } else if (ENEMY_TEXTURE_MAP[texturePath]) {
                mappedPath = ENEMY_TEXTURE_MAP[texturePath];
            }

            const spritePath = mappedPath.endsWith('/spriteFrame') ? mappedPath : `${mappedPath}/spriteFrame`;

            const doLoad = (targetPath: string, isFallback: boolean = false) => {
                resources.load(targetPath, SpriteFrame, (err, spriteFrame: SpriteFrame) => {
                    if (err || !spriteFrame) {
                        if (!isFallback) {
                            log(`[VisualLoader] 贴图加载失败: ${targetPath}，尝试降级为纯色占位图`);
                            this.applySolidSprite(sprite, options?.color).then(resolve);
                        } else {
                            error(`[VisualLoader] 纯色占位图同样加载失败: ${targetPath}`);
                            resolve(null);
                        }
                        return;
                    }

                    // 异步安全校验：确保在加载完成时节点仍有效
                    if (!targetNode.isValid || !visualNode.isValid || !sprite.isValid) {
                        log(`[VisualLoader] 节点在加载完成前已被销毁，放弃赋值: ${texturePath}`);
                        resolve(null);
                        return;
                    }

                    // 如果读到的是 1x1 占位图，直接切到纯色兜底，避免场景看起来像黑屏
                    if (this.isPlaceholderSpriteFrame(spriteFrame) && targetPath !== SOLID_SPRITE_FRAME_PATH) {
                        log(`[VisualLoader] 检测到占位贴图: ${targetPath}，切换为纯色占位图渲染`);
                        this.applySolidSprite(sprite, options?.color).then(resolve);
                        return;
                    }

                    // 5. 绑定 SpriteFrame
                    sprite.spriteFrame = spriteFrame;
                    log(`[VisualLoader] 成功为节点 [${targetNode.name}] 加载并绑定贴图: ${targetPath}`);
                    resolve(spriteFrame);
                });
            };

            doLoad(spritePath);
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
