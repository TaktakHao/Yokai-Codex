import { _decorator, Component, Node, Label, UITransform, Vec3, Color, Sprite, Button, Layers, log } from 'cc';
import { HomeManager } from '../Manager/HomeManager';
import { PetCaptureManager } from '../Logic/PetCaptureManager';
import { UIManager } from '../Manager/UIManager';
import { GameManager } from '../Manager/GameManager';
import { VisualLoader } from '../Utils/VisualLoader';

const { ccclass } = _decorator;

/**
 * 简约国风主界面 UI 面板 (HomePanel)
 * 纯代码防御性构建，作为游戏局外 UI 核心枢纽：
 * 1. 顶部 HUD：显示灵石、材料、境界名称
 * 2. 中部御兽信息：展示当前上阵宠物列表及五行羁绊共鸣
 * 3. 四大系统入口按钮：【境界突破】、【御兽盲盒】、【仙器法宝】、【洞府装修】
 * 4. 底部核心按钮：【开始降妖】拉起 Level_1 关卡
 */
@ccclass('HomePanel')
export class HomePanel extends Component {

    // 顶部 HUD 文本
    private spiritStoneLabel: Label | null = null;
    private materialLabel: Label | null = null;
    private realmLabel: Label | null = null;

    // 中部羁绊与御兽列表 UI
    private resonanceLabel: Label | null = null;
    private petListContainer: Node | null = null;

    // 按钮引用
    private startBattleBtn: Node | null = null;
    private realmBtn: Node | null = null;
    private eggBtn: Node | null = null;
    private relicBtn: Node | null = null;
    private furnitureBtn: Node | null = null;

    onLoad() {
        this.node.layer = Layers.Enum.UI_2D;
        this.ensureUIElements();
        this.bindEvents();
    }

    onEnable() {
        this.refreshDisplay();
    }

    /**
     * 防御性 UI 纯代码生成逻辑
     */
    private ensureUIElements() {
        // 1. 全屏 720x1280 简约国风半透明背景 Color(15, 23, 42, 245)
        let transform = this.node.getComponent(UITransform);
        if (!transform) {
            transform = this.node.addComponent(UITransform);
        }
        transform.setContentSize(720, 1280);

        const bgSprite = this.node.getComponent(Sprite) || this.node.addComponent(Sprite);
        bgSprite.color = new Color(15, 23, 42, 245);
        void VisualLoader.applySolidSprite(bgSprite, bgSprite.color);

        // 2. 顶部主标题
        this.createLabel('MainTitle', '【 万妖录：躺平修仙 】', 32, new Vec3(0, 560, 0), new Color(255, 215, 0, 255));

        // 3. 顶部 HUD 卡片 (灵石、材料、境界)
        const hudCardNode = new Node('HUDCard');
        hudCardNode.layer = Layers.Enum.UI_2D;
        hudCardNode.parent = this.node;
        hudCardNode.setPosition(0, 470, 0);

        const hudTransform = hudCardNode.addComponent(UITransform);
        hudTransform.setContentSize(660, 75);

        const hudBg = hudCardNode.addComponent(Sprite);
        hudBg.color = new Color(30, 35, 50, 230);
        void VisualLoader.applySolidSprite(hudBg, hudBg.color);

        this.spiritStoneLabel = this.createLabel('SpiritStoneLabel', '💎 灵石: 0', 18, new Vec3(-210, 0, 0), Color.WHITE, hudCardNode);
        this.materialLabel = this.createLabel('MaterialLabel', '🧪 材料: 0', 18, new Vec3(0, 0, 0), Color.WHITE, hudCardNode);
        this.realmLabel = this.createLabel('RealmLabel', '☯ 境界: 练气期', 18, new Vec3(210, 0, 0), new Color(255, 215, 0, 255), hudCardNode);

        // 4. 中部御兽与五行羁绊区域
        const petSectionTitle = this.createLabel('PetSectionTitle', '【 派驻上阵御兽 & 五行共鸣 】', 22, new Vec3(0, 380, 0), new Color(255, 215, 0, 255));
        
        // 羁绊共鸣文本
        this.resonanceLabel = this.createLabel('ResonanceLabel', '💡 提示：出战 3 只同五行属性宠物可触发额外羁绊！', 16, new Vec3(0, 340, 0), new Color(34, 197, 94, 255));

        // 5 个出战宠物卡片容器
        this.petListContainer = new Node('PetListContainer');
        this.petListContainer.layer = Layers.Enum.UI_2D;
        this.petListContainer.parent = this.node;
        this.petListContainer.setPosition(0, 220, 0);

        const containerTransform = this.petListContainer.addComponent(UITransform);
        containerTransform.setContentSize(660, 180);

        // 5. 四大功能按钮 (2x2 排布)
        // 第一排: 境界突破 & 御兽盲盒
        this.realmBtn = this.createFuncButton('RealmBtn', '【 境界突破 】', '提升修为与挂机效率', new Vec3(-160, 40, 0), new Color(40, 50, 75, 255));
        this.eggBtn = this.createFuncButton('EggBtn', '【 御兽盲盒 】', '孵化鉴定稀有妖兽', new Vec3(160, 40, 0), new Color(40, 50, 75, 255));

        // 第二排: 仙器法宝 & 洞府装修
        this.relicBtn = this.createFuncButton('RelicBtn', '【 仙器法宝 】', '炼制强化神兵利器', new Vec3(-160, -90, 0), new Color(40, 50, 75, 255));
        this.furnitureBtn = this.createFuncButton('FurnitureBtn', '【 洞府装修 】', '购买家具永久加成', new Vec3(160, -90, 0), new Color(40, 50, 75, 255));

        // 6. 底部核心【开始降妖】按钮
        this.startBattleBtn = new Node('StartBattleBtn');
        this.startBattleBtn.layer = Layers.Enum.UI_2D;
        this.startBattleBtn.parent = this.node;
        this.startBattleBtn.setPosition(0, -350, 0);

        const startTransform = this.startBattleBtn.addComponent(UITransform);
        startTransform.setContentSize(360, 85);

        const startBg = this.startBattleBtn.addComponent(Sprite);
        startBg.color = new Color(34, 197, 94, 255); // 翡翠绿醒目核心按钮
        void VisualLoader.applySolidSprite(startBg, startBg.color);

        this.startBattleBtn.addComponent(Button);

        this.createLabel('StartText', '【 开 始 降 妖 】', 28, new Vec3(0, 5, 0), new Color(255, 255, 255, 255), this.startBattleBtn);
        this.createLabel('StartSubText', '进入关卡历练刷怪 封印大妖', 14, new Vec3(0, -22, 0), new Color(230, 255, 230, 255), this.startBattleBtn);

        // 底部提示
        this.createLabel('FooterTip', '💡 提示: 在关卡中使用乾坤葫芦可将残血妖兽收服为盲盒蛋！', 14, new Vec3(0, -440, 0), new Color(160, 175, 200, 255));
    }

    /**
     * 动态创建 Label 辅助方法
     */
    private createLabel(name: string, text: string, fontSize: number, pos: Vec3, color: Color = Color.WHITE, parentNode?: Node): Label {
        const labelNode = new Node(name);
        labelNode.layer = Layers.Enum.UI_2D;
        labelNode.parent = parentNode || this.node;
        labelNode.setPosition(pos);

        const transform = labelNode.addComponent(UITransform);
        transform.setContentSize(600, 40);

        const label = labelNode.addComponent(Label);
        label.string = text;
        label.fontSize = fontSize;
        label.lineHeight = fontSize + 4;
        label.color = color;

        return label;
    }

    /**
     * 创建通用功能入口按钮辅助方法
     */
    private createFuncButton(name: string, titleText: string, subText: string, pos: Vec3, bgColor: Color): Node {
        const btnNode = new Node(name);
        btnNode.layer = Layers.Enum.UI_2D;
        btnNode.parent = this.node;
        btnNode.setPosition(pos);

        const transform = btnNode.addComponent(UITransform);
        transform.setContentSize(300, 100);

        const sprite = btnNode.addComponent(Sprite);
        sprite.color = bgColor;
        void VisualLoader.applySolidSprite(sprite, sprite.color);

        btnNode.addComponent(Button);

        this.createLabel(`${name}_Title`, titleText, 22, new Vec3(0, 12, 0), new Color(255, 215, 0, 255), btnNode);
        this.createLabel(`${name}_Sub`, subText, 13, new Vec3(0, -18, 0), new Color(200, 210, 235, 255), btnNode);

        return btnNode;
    }

    /**
     * 绑定按钮事件
     */
    private bindEvents() {
        if (this.startBattleBtn) {
            this.startBattleBtn.on(Node.EventType.TOUCH_END, this.onStartBattleClick, this);
        }
        if (this.realmBtn) {
            this.realmBtn.on(Node.EventType.TOUCH_END, this.onRealmClick, this);
        }
        if (this.eggBtn) {
            this.eggBtn.on(Node.EventType.TOUCH_END, this.onEggClick, this);
        }
        if (this.relicBtn) {
            this.relicBtn.on(Node.EventType.TOUCH_END, this.onRelicClick, this);
        }
        if (this.furnitureBtn) {
            this.furnitureBtn.on(Node.EventType.TOUCH_END, this.onFurnitureClick, this);
        }
    }

    /**
     * 刷新主界面数值与卡片展示
     */
    public refreshDisplay() {
        if (!HomeManager.instance) return;

        // 1. 刷新顶部 HUD
        if (this.spiritStoneLabel) {
            this.spiritStoneLabel.string = `💎 灵石: ${Math.floor(HomeManager.instance.spiritStones)}`;
        }
        if (this.materialLabel) {
            this.materialLabel.string = `🧪 材料: ${Math.floor(HomeManager.instance.materials)}`;
        }
        if (this.realmLabel) {
            const realmInfo = HomeManager.instance.getCurrentRealmInfo();
            this.realmLabel.string = `☯ 境界: ${realmInfo.name}`;
        }

        // 2. 刷新五行共鸣文本
        const resonance = HomeManager.instance.calculateElementResonance();
        if (this.resonanceLabel) {
            if (resonance.activeResonances.length > 0) {
                const activeStrList: string[] = [];
                if (resonance.goldAtkBonus > 0) activeStrList.push('【3金】全员攻击+20%');
                if (resonance.woodHpRegen > 0) activeStrList.push('【3木】每秒回复15HP');
                if (resonance.waterCdrBonus > 0) activeStrList.push('【3水】CDR/攻速+15%');
                if (resonance.fireCritBonus > 0) activeStrList.push('【3火】暴击率+20%');
                if (resonance.earthDefBonus > 0) activeStrList.push('【3土】防御/免伤+20%');
                this.resonanceLabel.string = `✨ 已激活羁绊: ${activeStrList.join('  ')}`;
                this.resonanceLabel.color = new Color(34, 197, 94, 255); // 翡翠绿高亮
            } else {
                this.resonanceLabel.string = '💡 提示：出战 3 只同五行属性宠物可触发额外五行羁绊！';
                this.resonanceLabel.color = new Color(200, 200, 200, 255);
            }
        }

        // 3. 刷新上阵宠物卡片展示
        this.renderPetListCards();
    }

    /**
     * 渲染 5 个上阵宠物卡片槽位
     */
    private renderPetListCards() {
        if (!this.petListContainer) return;

        // 彻底销毁旧卡片 Node 节点，释放内存
        this.petListContainer.destroyAllChildren();

        const equippedIds = HomeManager.instance ? HomeManager.instance.getEquippedPetIds() : [];
        const petMgr = PetCaptureManager.instance;

        // 渲染 5 个固定槽位
        const slotStartX = -240;
        const slotSpacing = 120;

        for (let i = 0; i < 5; i++) {
            const slotNode = new Node(`PetSlot_${i}`);
            slotNode.layer = Layers.Enum.UI_2D;
            slotNode.parent = this.petListContainer;
            slotNode.setPosition(slotStartX + i * slotSpacing, 0, 0);

            const slotTransform = slotNode.addComponent(UITransform);
            slotTransform.setContentSize(105, 140);

            const slotSprite = slotNode.addComponent(Sprite);
            slotSprite.color = new Color(30, 40, 60, 220); // 暗卡片底
            void VisualLoader.applySolidSprite(slotSprite, slotSprite.color);

            const petId = equippedIds[i];
            if (petId && petMgr) {
                const pet = petMgr.getPetById(petId);
                if (pet) {
                    // 五行属性颜色映射
                    let elementColor = Color.WHITE;
                    if (pet.element === '金') elementColor = new Color(255, 215, 0);
                    else if (pet.element === '木') elementColor = new Color(50, 220, 50);
                    else if (pet.element === '水') elementColor = new Color(50, 180, 255);
                    else if (pet.element === '火') elementColor = new Color(255, 80, 80);
                    else if (pet.element === '土') elementColor = new Color(220, 160, 50);

                    // 显示五行图标与名称
                    this.createLabel('ElemTag', `[${pet.element}]`, 16, new Vec3(0, 45, 0), elementColor, slotNode);
                    this.createLabel('PetName', pet.name, 14, new Vec3(0, 15, 0), Color.WHITE, slotNode);
                    this.createLabel('StarRating', `★ ${pet.star}星`, 13, new Vec3(0, -15, 0), new Color(255, 215, 0, 255), slotNode);
                    this.createLabel('RarityText', pet.rarity, 12, new Vec3(0, -45, 0), new Color(180, 190, 210, 255), slotNode);
                } else {
                    this.createEmptySlotText(slotNode);
                }
            } else {
                this.createEmptySlotText(slotNode);
            }
        }
    }

    private createEmptySlotText(parentNode: Node) {
        this.createLabel('EmptyText', '[空槽位]', 14, new Vec3(0, 0, 0), new Color(120, 130, 150, 255), parentNode);
    }

    // ==========================================
    // 按钮交互逻辑
    // ==========================================

    private onStartBattleClick() {
        log('[HomePanel] 点击【开始降妖】，进入局内第一关 (Level_1)...');
        this.node.active = false;
        if (GameManager.instance) {
            GameManager.instance.startGame('Level_1');
        }
    }

    private onRealmClick() {
        log('[HomePanel] 点击【境界突破】...');
        if (!HomeManager.instance) return;

        const result = HomeManager.instance.upgradeRealm();
        if (result.needChallenge) {
            log('[HomePanel] 境界突破满足前置要求，即将拉起雷劫挑战 TribulationPanel');
            if (UIManager.instance) {
                UIManager.instance.openUI('UI/TribulationPanel');
            }
        } else if (!result.success) {
            log(`[HomePanel] 无法突破境界: ${result.currentRealm}`);
        }
    }

    private onEggClick() {
        log('[HomePanel] 点击【御兽盲盒】，拉起 AppraisalPanel');
        if (UIManager.instance) {
            UIManager.instance.openUI('UI/AppraisalPanel');
        }
    }

    private onRelicClick() {
        log('[HomePanel] 点击【仙器法宝】，拉起 EquipmentPanel');
        if (UIManager.instance) {
            UIManager.instance.openUI('UI/EquipmentPanel');
        }
    }

    private onFurnitureClick() {
        log('[HomePanel] 点击【洞府装修】，拉起 FurniturePanel');
        if (UIManager.instance) {
            UIManager.instance.openUI('UI/FurniturePanel');
        }
    }
}
