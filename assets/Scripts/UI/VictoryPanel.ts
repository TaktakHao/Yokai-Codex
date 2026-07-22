import { _decorator, Component, Node, Label, UITransform, Vec3, Color, Sprite, Button, Layers, log } from 'cc';
import { GameManager } from '../Manager/GameManager';
import { VisualLoader } from '../Utils/VisualLoader';

const { ccclass } = _decorator;

/**
 * 局内关卡胜利结算面板 (VictoryPanel)
 * 纯代码防御性构建，展现通关大捷奖赏并提供【返回洞府】按钮闭环
 */
@ccclass('VictoryPanel')
export class VictoryPanel extends Component {

    private rewardLabel: Label | null = null;
    private returnBtnNode: Node | null = null;

    onLoad() {
        this.node.layer = Layers.Enum.UI_2D;
        this.ensureUIElements();
        this.bindEvents();
    }

    private ensureUIElements() {
        // 1. 背景铺设 Color(15, 23, 42, 245)
        let transform = this.node.getComponent(UITransform);
        if (!transform) {
            transform = this.node.addComponent(UITransform);
        }
        transform.setContentSize(720, 1280);

        const bgSprite = this.node.getComponent(Sprite) || this.node.addComponent(Sprite);
        bgSprite.color = new Color(15, 23, 42, 245);
        void VisualLoader.applySolidSprite(bgSprite, bgSprite.color);

        // 2. 胜利大标题
        this.createLabel('TitleLabel', '🎉 历 练 大 捷', 36, new Vec3(0, 320, 0), new Color(255, 215, 0, 255));
        this.createLabel('SubTitleLabel', '道友神通广阔，顺利平定本关万妖乱局！', 18, new Vec3(0, 260, 0), new Color(200, 230, 255, 255));

        // 3. 战利品展示卡片
        const rewardCard = new Node('RewardCard');
        rewardCard.layer = Layers.Enum.UI_2D;
        rewardCard.parent = this.node;
        rewardCard.setPosition(0, 80, 0);

        const cardTransform = rewardCard.addComponent(UITransform);
        cardTransform.setContentSize(560, 220);

        const cardBg = rewardCard.addComponent(Sprite);
        cardBg.color = new Color(30, 40, 60, 220);
        void VisualLoader.applySolidSprite(cardBg, cardBg.color);

        this.createLabel('RewardHeader', '--- 降妖战利品结算 ---', 20, new Vec3(0, 70, 0), new Color(255, 215, 0, 255), rewardCard);
        
        this.rewardLabel = this.createLabel('RewardText', '💎 获得灵石: +200\n🧪 获得修仙材料: +20\n⭐ 关卡评级: 极品通关', 20, new Vec3(0, -20, 0), Color.WHITE, rewardCard);

        // 4. 【返回洞府】核心按钮
        this.returnBtnNode = new Node('ReturnHomeBtn');
        this.returnBtnNode.layer = Layers.Enum.UI_2D;
        this.returnBtnNode.parent = this.node;
        this.returnBtnNode.setPosition(0, -220, 0);

        const btnTransform = this.returnBtnNode.addComponent(UITransform);
        btnTransform.setContentSize(320, 80);

        const btnSprite = this.returnBtnNode.addComponent(Sprite);
        btnSprite.color = new Color(34, 197, 94, 255); // 翡翠绿返回按钮
        void VisualLoader.applySolidSprite(btnSprite, btnSprite.color);

        this.returnBtnNode.addComponent(Button);

        this.createLabel('ReturnBtnText', '【 返 回 洞 府 】', 26, new Vec3(0, 0, 0), Color.WHITE, this.returnBtnNode);
    }

    private createLabel(name: string, text: string, fontSize: number, pos: Vec3, color: Color = Color.WHITE, parentNode?: Node): Label {
        const labelNode = new Node(name);
        labelNode.layer = Layers.Enum.UI_2D;
        labelNode.parent = parentNode || this.node;
        labelNode.setPosition(pos);

        const transform = labelNode.addComponent(UITransform);
        transform.setContentSize(560, 140);

        const label = labelNode.addComponent(Label);
        label.string = text;
        label.fontSize = fontSize;
        label.lineHeight = fontSize + 6;
        label.color = color;

        return label;
    }

    private bindEvents() {
        if (this.returnBtnNode) {
            this.returnBtnNode.on(Node.EventType.TOUCH_END, this.onReturnHomeClick, this);
        }
    }

    private onReturnHomeClick() {
        log('[VictoryPanel] 点击【返回洞府】，触发资源回收与主界面切回...');
        this.node.active = false;
        if (GameManager.instance) {
            GameManager.instance.returnToHome();
        }
    }
}
