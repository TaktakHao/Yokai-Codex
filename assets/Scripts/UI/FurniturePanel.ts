import { _decorator, Component, Node, Label, UITransform, Vec3, Color, Sprite, log, Layers, Button } from 'cc';
import { HomeManager, FURNITURE_CONFIGS, IFurnitureConfig } from '../Manager/HomeManager';
import { VisualLoader } from '../Utils/VisualLoader';

const { ccclass, property } = _decorator;

/**
 * 洞府家具装修 UI 面板 (FurniturePanel)
 * 纯代码防御性构建，支持购买极品寒玉床 (挂机收益+15%) 和红木躺椅 (主角生命+50)，实现属性生效与按钮持久化联动
 */
@ccclass('FurniturePanel')
export class FurniturePanel extends Component {

    private titleLabel: Label | null = null;
    private resourceLabel: Label | null = null;
    private tipLabel: Label | null = null;

    private furnitureItemNodes: Map<string, { btnNode: Node; statusLabel: Label }> = new Map();
    private closeBtnNode: Node | null = null;

    onLoad() {
        this.node.layer = Layers.Enum.UI_2D;
        this.ensureUIElements();
        this.bindEvents();
    }

    onEnable() {
        this.refreshDisplay();
    }

    /**
     * 防御性 UI 纯代码生成逻辑，确保缺失预制体资产时能自动补齐运行
     */
    private ensureUIElements() {
        // 1. 720x1280 洞府典雅木纹/古风半透明背景
        let transform = this.node.getComponent(UITransform);
        if (!transform) {
            transform = this.node.addComponent(UITransform);
        }
        transform.setContentSize(720, 1280);

        const bgSprite = this.node.getComponent(Sprite) || this.node.addComponent(Sprite);
        bgSprite.color = new Color(15, 23, 42, 245);
        void VisualLoader.applySolidSprite(bgSprite, bgSprite.color);

        // 2. 头部标题
        if (!this.titleLabel) {
            this.titleLabel = this.createLabel('TitleLabel', '【 洞府家具装修与摆设 】', 28, new Vec3(0, 480, 0), new Color(255, 215, 0, 255));
        }

        // 3. 资源储备状态显示
        if (!this.resourceLabel) {
            this.resourceLabel = this.createLabel('ResourceLabel', '灵石: 0  |  修仙材料: 0', 18, new Vec3(0, 420, 0), Color.WHITE);
        }

        // 4. 提示/操作说明文本
        if (!this.tipLabel) {
            this.tipLabel = this.createLabel('TipLabel', '购买家具可永久为洞府挂机收益或主角初始属性提供强大加成！', 16, new Vec3(0, 360, 0), Color.LIGHT_GRAY);
        }

        // 5. 渲染家具配置列表项目
        let startY = 200;
        for (const config of FURNITURE_CONFIGS) {
            this.createFurnitureItemCard(config, new Vec3(0, startY, 0));
            startY -= 220;
        }

        // 6. 关闭按钮
        if (!this.closeBtnNode) {
            this.closeBtnNode = this.createButton('CloseBtn', '✖ 关闭洞府UI', new Vec3(0, -420, 0), new Color(160, 50, 50, 255), new Vec3(180, 50, 1));
        }
    }

    /**
     * 创建家具展示卡片
     */
    private createFurnitureItemCard(config: IFurnitureConfig, pos: Vec3) {
        const cardNode = new Node(`Card_${config.id}`);
        cardNode.layer = Layers.Enum.UI_2D;
        cardNode.parent = this.node;
        cardNode.setPosition(pos);

        const cardTrans = cardNode.addComponent(UITransform);
        cardTrans.setContentSize(620, 180);

        const cardBg = cardNode.addComponent(Sprite);
        cardBg.color = new Color(40, 35, 55, 255);
        void VisualLoader.applySolidSprite(cardBg, cardBg.color);

        // 家具名称与加成描述 Label
        const nameNode = new Node('NameLabel');
        nameNode.layer = Layers.Enum.UI_2D;
        nameNode.parent = cardNode;
        nameNode.setPosition(-120, 40, 0);

        const nt = nameNode.addComponent(UITransform);
        nt.setContentSize(340, 40);

        const nameLabel = nameNode.addComponent(Label);
        nameLabel.string = config.name;
        nameLabel.fontSize = 22;
        nameLabel.color = new Color(255, 220, 100, 255);
        nameLabel.horizontalAlign = Label.HorizontalAlign.LEFT;

        // 描述 Label
        const descNode = new Node('DescLabel');
        descNode.layer = Layers.Enum.UI_2D;
        descNode.parent = cardNode;
        descNode.setPosition(-120, -20, 0);

        const dt = descNode.addComponent(UITransform);
        dt.setContentSize(340, 60);

        const descLabel = descNode.addComponent(Label);
        descLabel.string = `${config.description}\n消耗: ${config.costStones} 灵石 + ${config.costMaterials} 材料`;
        descLabel.fontSize = 14;
        descLabel.color = Color.WHITE;
        descLabel.horizontalAlign = Label.HorizontalAlign.LEFT;

        // 购买/已购买 按钮
        const btnNode = new Node(`BuyBtn_${config.id}`);
        btnNode.layer = Layers.Enum.UI_2D;
        btnNode.parent = cardNode;
        btnNode.setPosition(190, 0, 0);

        const bt = btnNode.addComponent(UITransform);
        bt.setContentSize(140, 50);

        const btnSprite = btnNode.addComponent(Sprite);
        btnSprite.color = new Color(50, 160, 90, 255);
        void VisualLoader.applySolidSprite(btnSprite, btnSprite.color);

        btnNode.addComponent(Button);

        const btnTextNode = new Node('StatusText');
        btnTextNode.layer = Layers.Enum.UI_2D;
        btnTextNode.parent = btnNode;

        const st = btnTextNode.addComponent(UITransform);
        st.setContentSize(130, 40);

        const statusLabel = btnTextNode.addComponent(Label);
        statusLabel.string = '购买';
        statusLabel.fontSize = 18;
        statusLabel.color = Color.WHITE;

        this.furnitureItemNodes.set(config.id, { btnNode, statusLabel });
    }

    /**
     * 创建 Label 工厂方法
     */
    private createLabel(name: string, text: string, fontSize: number, pos: Vec3, color: Color = Color.WHITE): Label {
        const labelNode = new Node(name);
        labelNode.layer = Layers.Enum.UI_2D;
        labelNode.parent = this.node;
        labelNode.setPosition(pos);

        const lTransform = labelNode.addComponent(UITransform);
        lTransform.setContentSize(640, 50);

        const label = labelNode.addComponent(Label);
        label.string = text;
        label.fontSize = fontSize;
        label.color = color;
        label.lineHeight = fontSize + 4;
        
        return label;
    }

    /**
     * 创建 Button 工厂方法
     */
    private createButton(name: string, title: string, pos: Vec3, bgColor: Color, sizeScale: Vec3 = new Vec3(280, 60, 1)): Node {
        const btnNode = new Node(name);
        btnNode.layer = Layers.Enum.UI_2D;
        btnNode.parent = this.node;
        btnNode.setPosition(pos);

        const bt = btnNode.addComponent(UITransform);
        bt.setContentSize(sizeScale.x, sizeScale.y);

        const sprite = btnNode.addComponent(Sprite);
        sprite.color = bgColor;
        void VisualLoader.applySolidSprite(sprite, sprite.color);

        btnNode.addComponent(Button);

        // 按钮文本
        const labelNode = new Node('Title');
        labelNode.layer = Layers.Enum.UI_2D;
        labelNode.parent = btnNode;
        const lt = labelNode.addComponent(UITransform);
        lt.setContentSize(sizeScale.x - 10, sizeScale.y - 10);

        const label = labelNode.addComponent(Label);
        label.string = title;
        label.fontSize = 18;
        label.color = Color.WHITE;

        return btnNode;
    }

    /**
     * 绑定交互事件
     */
    private bindEvents() {
        for (const config of FURNITURE_CONFIGS) {
            const item = this.furnitureItemNodes.get(config.id);
            if (item && item.btnNode) {
                item.btnNode.on(Button.EventType.CLICK, () => this.onBuyFurnitureClicked(config.id), this);
            }
        }

        if (this.closeBtnNode) {
            this.closeBtnNode.on(Button.EventType.CLICK, () => {
                this.node.active = false;
            }, this);
        }
    }

    /**
     * 点击购买家具操作
     */
    private onBuyFurnitureClicked(furnitureId: string) {
        const homeMgr = HomeManager.instance;
        if (!homeMgr) return;

        const result = homeMgr.buyFurniture(furnitureId);
        if (this.tipLabel) {
            this.tipLabel.string = result.message;
        }

        this.refreshDisplay();
    }

    /**
     * 刷新界面状态与已购买标记
     */
    public refreshDisplay() {
        const homeMgr = HomeManager.instance;
        if (!homeMgr) return;

        if (this.resourceLabel) {
            this.resourceLabel.string = `当前拥有 - 灵石: ${homeMgr.spiritStones}  |  修仙材料: ${homeMgr.materials}`;
        }

        for (const config of FURNITURE_CONFIGS) {
            const item = this.furnitureItemNodes.get(config.id);
            if (!item) continue;

            const isOwned = homeMgr.hasFurniture(config.id);
            if (isOwned) {
                item.statusLabel.string = '✓ 已购买';
                const sprite = item.btnNode.getComponent(Sprite);
                if (sprite) {
                    sprite.color = new Color(90, 90, 100, 255); // 灰暗表示已拥有
                }
            } else {
                item.statusLabel.string = '购买';
                const sprite = item.btnNode.getComponent(Sprite);
                if (sprite) {
                    sprite.color = new Color(50, 160, 90, 255);
                }
            }
        }
    }
}
