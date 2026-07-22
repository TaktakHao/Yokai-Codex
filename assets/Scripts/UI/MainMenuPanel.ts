import { _decorator, Component, Node, Label, UITransform, Vec3, Color, Sprite, Button, Layers, log, tween, v3 } from 'cc';
import { UIManager } from '../Manager/UIManager';
import { GameManager, GameState } from '../Manager/GameManager';
import { VisualLoader } from '../Utils/VisualLoader';

const { ccclass } = _decorator;

@ccclass('MainMenuPanel')
export class MainMenuPanel extends Component {

    private startBtnNode: Node | null = null;

    onLoad() {
        this.node.layer = Layers.Enum.UI_2D;
        this.ensureUIElements();
        this.bindEvents();
    }

    private ensureUIElements() {
        // 1. 全屏背景
        let transform = this.node.getComponent(UITransform);
        if (!transform) {
            transform = this.node.addComponent(UITransform);
        }
        transform.setContentSize(720, 1280);

        const bgSprite = this.node.getComponent(Sprite) || this.node.addComponent(Sprite);
        bgSprite.color = new Color(20, 25, 40, 255);
        void VisualLoader.applySolidSprite(bgSprite, bgSprite.color);

        // 2. 游戏标题
        const titleNode = new Node('MainTitle');
        titleNode.layer = Layers.Enum.UI_2D;
        titleNode.parent = this.node;
        titleNode.setPosition(0, 300, 0);
        const titleTransform = titleNode.addComponent(UITransform);
        titleTransform.setContentSize(600, 100);
        const titleLabel = titleNode.addComponent(Label);
        titleLabel.string = '万妖录：躺平修仙';
        titleLabel.fontSize = 72;
        titleLabel.lineHeight = 90;
        titleLabel.color = new Color(255, 215, 0, 255);
        titleLabel.isBold = true;

        // 标题呼吸动画
        tween(titleNode)
            .to(1.5, { scale: v3(1.05, 1.05, 1) })
            .to(1.5, { scale: v3(1, 1, 1) })
            .union()
            .repeatForever()
            .start();

        // 3. 开始游戏按钮
        this.startBtnNode = new Node('StartBtn');
        this.startBtnNode.layer = Layers.Enum.UI_2D;
        this.startBtnNode.parent = this.node;
        this.startBtnNode.setPosition(0, -100, 0);

        const btnTransform = this.startBtnNode.addComponent(UITransform);
        btnTransform.setContentSize(300, 100);

        const btnSprite = this.startBtnNode.addComponent(Sprite);
        btnSprite.color = new Color(34, 197, 94, 255);
        void VisualLoader.applySolidSprite(btnSprite, btnSprite.color);

        this.startBtnNode.addComponent(Button);

        const btnTextNode = new Node('BtnText');
        btnTextNode.layer = Layers.Enum.UI_2D;
        btnTextNode.parent = this.startBtnNode;
        const btnTextTransform = btnTextNode.addComponent(UITransform);
        btnTextTransform.setContentSize(200, 50);
        const btnLabel = btnTextNode.addComponent(Label);
        btnLabel.string = '点击开始修仙';
        btnLabel.fontSize = 32;
        btnLabel.lineHeight = 40;
        btnLabel.color = new Color(255, 255, 255, 255);
        
        // 4. 版本号
        const versionNode = new Node('Version');
        versionNode.layer = Layers.Enum.UI_2D;
        versionNode.parent = this.node;
        versionNode.setPosition(0, -600, 0);
        const versionTransform = versionNode.addComponent(UITransform);
        versionTransform.setContentSize(200, 40);
        const versionLabel = versionNode.addComponent(Label);
        versionLabel.string = 'v1.0.0 Alpha';
        versionLabel.fontSize = 18;
        versionLabel.color = new Color(150, 150, 150, 255);
    }

    private bindEvents() {
        if (this.startBtnNode) {
            this.startBtnNode.on(Node.EventType.TOUCH_END, this.onStartClick, this);
        }
    }

    private onStartClick() {
        log('[MainMenuPanel] 点击开始游戏，进入主界面(洞府)！');
        if (UIManager.instance) {
            UIManager.instance.closeUI('UI/MainMenuPanel');
            UIManager.instance.openUI('UI/HomePanel');
            if (GameManager.instance) {
                // @ts-ignore - Dynamically setting state
                GameManager.instance._currentState = GameState.HOME;
                // @ts-ignore
                GameManager.instance.checkAndPlayOpeningCutscene();
            }
        }
    }
}
