import { _decorator, Component, Node, Label, UITransform, Vec3, Color, Sprite, Button, Layers, log } from 'cc';
import { GameManager } from '../Manager/GameManager';
import { VisualLoader } from '../Utils/VisualLoader';

const { ccclass } = _decorator;

/**
 * 局内关卡失败结算面板 (GameOverPanel)
 * 纯代码防御性构建，展现渡劫身陨抚慰奖赏并提供【返回洞府】按钮闭环
 */
@ccclass('GameOverPanel')
export class GameOverPanel extends Component {

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

        // 2. 失败大标题
        this.createLabel('TitleLabel', '💀 劫 数 难 逃', 36, new Vec3(0, 320, 0), new Color(240, 60, 60, 255));
        this.createLabel('SubTitleLabel', '道友气血耗尽，暂且退回洞府调养修为！', 18, new Vec3(0, 260, 0), new Color(220, 180, 180, 255));

        // 3. 抚慰奖励展示卡片
        const rewardCard = new Node('RewardCard');
        rewardCard.layer = Layers.Enum.UI_2D;
        rewardCard.parent = this.node;
        rewardCard.setPosition(0, 80, 0);

        const cardTransform = rewardCard.addComponent(UITransform);
        cardTransform.setContentSize(560, 220);

        const cardBg = rewardCard.addComponent(Sprite);
        cardBg.color = new Color(40, 30, 45, 220);
        void VisualLoader.applySolidSprite(cardBg, cardBg.color);

        this.createLabel('RewardHeader', '--- 历练抚慰结算 ---', 20, new Vec3(0, 70, 0), new Color(255, 215, 0, 255), rewardCard);
        
        this.rewardLabel = this.createLabel('RewardText', '💎 获得抚慰灵石: +50\n🧪 获得抚慰材料: +5\n💡 建议: 在主界面突破境界或孵化高阶御兽！', 20, new Vec3(0, -20, 0), Color.WHITE, rewardCard);

        // 4. 【返回洞府】核心按钮
        this.returnBtnNode = new Node('ReturnHomeBtn');
        this.returnBtnNode.layer = Layers.Enum.UI_2D;
        this.returnBtnNode.parent = this.node;
        this.returnBtnNode.setPosition(0, -220, 0);

        const btnTransform = this.returnBtnNode.addComponent(UITransform);
        btnTransform.setContentSize(320, 80);

        const btnSprite = this.returnBtnNode.addComponent(Sprite);
        btnSprite.color = new Color(220, 90, 40, 255); // 朱红返回按钮
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
        log('[GameOverPanel] 点击【返回洞府】，触发资源回收与主界面切回...');
        this.node.active = false;
        if (GameManager.instance) {
            GameManager.instance.returnToHome();
        }
    }
}
