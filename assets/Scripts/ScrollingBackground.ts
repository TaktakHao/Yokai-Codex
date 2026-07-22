import { _decorator, Component, Node, Vec3, UITransform, Sprite, Color, Size, director, Camera } from 'cc';
import { VisualLoader } from './Utils/VisualLoader';

const { ccclass, property } = _decorator;

/**
 * 无限滚动背景与摄像机跟随控制
 * 负责：
 * 1. 让 Main Camera 实时跟随 Player 节点
 * 2. 维持 UILayer 相对 Camera 的相对静止
 * 3. 动态加载并管理多张背景切片，实现基于摄像机视野的无限拼接滚动
 */
@ccclass('ScrollingBackground')
export class ScrollingBackground extends Component {

    @property(Node)
    public playerNode: Node | null = null;

    @property(Node)
    public uiLayer: Node | null = null;

    @property(Camera)
    public mainCamera: Camera | null = null;

    private bgTiles: Node[] = [];
    private tileSize: number = 1000; // 背景切片大小（比屏幕稍大，以减少拼缝）
    private bgParent: Node | null = null;

    onLoad() {
        // 确保背景父节点存在
        this.bgParent = new Node('InfiniteBackground');
        // 将背景挂载在 Canvas 下，并且放在最底层 (0)
        const canvas = director.getScene()?.getChildByName('Canvas');
        if (canvas) {
            this.bgParent.parent = canvas;
            this.bgParent.setSiblingIndex(0);
        } else {
            this.bgParent.parent = this.node;
        }

        this.initBackgroundTiles();
    }

    start() {
        // 动态寻找依赖节点
        const scene = director.getScene();
        const canvas = scene?.getChildByName('Canvas');
        if (!this.playerNode) {
            this.playerNode = canvas?.getChildByName('Player') || scene?.getComponentInChildren('PlayerController')?.node || null;
        }
        if (!this.uiLayer) {
            this.uiLayer = canvas?.getChildByName('UILayer') || null;
        }
        if (!this.mainCamera) {
            const camNode = canvas?.getChildByName('Camera');
            this.mainCamera = camNode?.getComponent(Camera) || null;
        }
    }

    /**
     * 初始化 9 宫格背景切片
     */
    private initBackgroundTiles() {
        if (!this.bgParent) return;

        // 创建 3x3 的九宫格背景
        for (let x = -1; x <= 1; x++) {
            for (let y = -1; y <= 1; y++) {
                const tileNode = new Node(`BgTile_${x}_${y}`);
                tileNode.parent = this.bgParent;
                const uiTrans = tileNode.addComponent(UITransform);
                uiTrans.setContentSize(this.tileSize, this.tileSize);
                
                // 初始位置
                tileNode.setPosition(x * this.tileSize, y * this.tileSize, 0);

                // 尝试加载具体的背景贴图
                VisualLoader.loadVisual(tileNode, 'Textures/bg_grassland', {
                    childName: 'Visual',
                    size: new Size(this.tileSize, this.tileSize)
                });

                this.bgTiles.push(tileNode);
            }
        }
    }

    lateUpdate(deltaTime: number) {
        if (!this.playerNode || !this.playerNode.isValid) return;

        const playerPos = this.playerNode.position;

        // 1. 摄像机跟随玩家
        if (this.mainCamera && this.mainCamera.node) {
            // 平滑跟随或者硬跟随，这里使用硬跟随以防止UI抖动
            const camPos = this.mainCamera.node.position;
            this.mainCamera.node.setPosition(playerPos.x, playerPos.y, camPos.z);
        }

        // 2. UI层与摄像机保持相对静止
        if (this.uiLayer && this.uiLayer.isValid) {
            this.uiLayer.setPosition(playerPos.x, playerPos.y, 0);
        }

        // 3. 无限滚动背景逻辑
        this.updateInfiniteBackground(playerPos);
    }

    /**
     * 更新背景块位置，确保摄像机视野始终被覆盖
     */
    private updateInfiniteBackground(cameraPos: Vec3) {
        // 计算摄像机当前所在的“网格”坐标
        const gridX = Math.round(cameraPos.x / this.tileSize);
        const gridY = Math.round(cameraPos.y / this.tileSize);

        let index = 0;
        // 重置 9 宫格的位置，让它们始终以当前网格坐标为中心
        for (let x = -1; x <= 1; x++) {
            for (let y = -1; y <= 1; y++) {
                if (index < this.bgTiles.length) {
                    const tile = this.bgTiles[index];
                    const targetX = (gridX + x) * this.tileSize;
                    const targetY = (gridY + y) * this.tileSize;
                    
                    // 只有当位置不同时才设置，避免无谓的脏标记更新
                    if (tile.position.x !== targetX || tile.position.y !== targetY) {
                        tile.setPosition(targetX, targetY, 0);
                    }
                    index++;
                }
            }
        }
    }
}
