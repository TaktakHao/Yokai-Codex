import { _decorator, Component, Node, Prefab, instantiate, resources, error, director, Layers } from 'cc';
import { BattleUIPanel } from '../UI/BattleUIPanel';
import { SkillSelectPanel } from '../UI/SkillSelectPanel';
import { TribulationPanel } from '../UI/TribulationPanel';
import { AppraisalPanel } from '../UI/AppraisalPanel';
import { FurniturePanel } from '../UI/FurniturePanel';
import { EquipmentPanel } from '../UI/EquipmentPanel';

import { HomePanel } from '../UI/HomePanel';
import { VictoryPanel } from '../UI/VictoryPanel';
import { GameOverPanel } from '../UI/GameOverPanel';
import { DialoguePanel } from '../UI/DialoguePanel';
import { PausePanel } from '../UI/PausePanel';
import { MainMenuPanel } from '../UI/MainMenuPanel';

const { ccclass, property } = _decorator;

@ccclass('UIManager')
export class UIManager extends Component {
    private static _instance: UIManager | null = null;

    // 存储已打开的UI面板，键为面板名称，值为面板节点
    private _uiMap: Map<string, Node> = new Map<string, Node>();

    private get uiMap(): Map<string, Node> {
        if (!this._uiMap) {
            this._uiMap = new Map<string, Node>();
        }
        return this._uiMap;
    }

    /**
     * 获取单例
     */
    public static get instance(): UIManager {
        if (!this._instance) {
            // 尝试主动寻找场景中的 UIManager 实例以防止组件生命周期 onLoad 顺序引发空指针
            const scene = director.getScene();
            const canvas = scene?.getChildByName('Canvas');
            const uiLayer = canvas?.getChildByName('UILayer') || canvas || scene;
            const comp = uiLayer?.getComponentInChildren(UIManager);
            if (comp) {
                this._instance = comp;
            } else {
                error("UIManager 未初始化！请确保其已挂载到场景节点中。");
            }
        }
        return this._instance!;
    }

    onLoad() {
        if (!this._uiMap) {
            this._uiMap = new Map<string, Node>();
        }
        if (UIManager._instance === null) {
            UIManager._instance = this;
        } else {
            // 如果已经存在实例，则销毁当前重复的节点
            this.node.destroy();
        }
    }

    /**
     * 打开UI面板
     * @param panelPath 面板的 resources 路径 (例如: "UI/MainPanel" 或 "EquipmentPanel")
     * @param callback 面板打开后的回调函数
     */
    public openUI(panelPath: string, callback?: (node: Node) => void) {
        console.log(`====== [TRACE] UIManager: Requesting to open UI: ${panelPath} ======`);
        // 如果已经打开，直接显示并提到最前 (匹配 shortName 或 完整路径)
        const matchedKey = this.findMatchingKey(panelPath);
        if (matchedKey) {
            console.log(`====== [TRACE] UIManager: Found existing UI for ${panelPath} ======`);
            const uiNode = this.uiMap.get(matchedKey);
            if (uiNode) {
                uiNode.active = true;
                if (uiNode.parent) {
                    uiNode.setSiblingIndex(uiNode.parent.children.length - 1);
                }
                if (callback) callback(uiNode);
                return;
            }
        }

        console.log(`====== [TRACE] UIManager: Loading Prefab for ${panelPath}... ======`);
        // 动态加载预制体
        resources.load(panelPath, Prefab, (err, prefab: Prefab) => {
            let uiNode: Node;
            if (err || !prefab) {
                console.warn(`====== [TRACE] UIManager WARNING: Prefab not found for ${panelPath}. Generating code-only fallback node! ======`);
                // 回退策略：纯代码防御性构建面板节点
                // 如果预制体不存在，我们根据路径名自动构建空节点并挂载对应的组件
                const panelName = panelPath.split('/').pop() || 'DynamicPanel';
                uiNode = new Node(panelName);
                uiNode.layer = Layers.Enum.UI_2D;
                
                // 尝试提取组件名并挂载
                if (panelName === 'HomePanel') {
                    uiNode.addComponent(HomePanel);
                } else if (panelName === 'VictoryPanel') {
                    uiNode.addComponent(VictoryPanel);
                } else if (panelName === 'GameOverPanel') {
                    uiNode.addComponent(GameOverPanel);
                } else if (panelName === 'BattleUIPanel') {
                    uiNode.addComponent(BattleUIPanel);
                } else if (panelName === 'SkillSelectPanel') {
                    uiNode.addComponent(SkillSelectPanel);
                } else if (panelName === 'TribulationPanel') {
                    uiNode.addComponent(TribulationPanel);
                } else if (panelName === 'AppraisalPanel') {
                    uiNode.addComponent(AppraisalPanel);
                } else if (panelName === 'FurniturePanel') {
                    uiNode.addComponent(FurniturePanel);
                } else if (panelName === 'EquipmentPanel') {
                    uiNode.addComponent(EquipmentPanel);
                } else if (panelName === 'PausePanel') {
                    uiNode.addComponent(PausePanel);
                } else if (panelName === 'DialoguePanel') {
                    uiNode.addComponent(DialoguePanel);
                } else if (panelName === 'MainMenuPanel') {
                    uiNode.addComponent(MainMenuPanel);
                }
            } else {
                console.log(`====== [TRACE] UIManager: Prefab loaded successfully for ${panelPath}. ======`);
                uiNode = instantiate(prefab);
                uiNode.layer = Layers.Enum.UI_2D;
            }
            
            const scene = director.getScene();
            const canvas = scene?.getChildByName('Canvas');
            const uiLayer = canvas?.getChildByName('UILayer') || canvas || this.node;
            
            // 挂载到正确的 2D UI 层级下
            uiNode.parent = uiLayer;
            this.uiMap.set(panelPath, uiNode);
            console.log(`====== [TRACE] UIManager: Attached ${panelPath} to ${uiLayer.name} layer. ======`);
            
            if (callback) callback(uiNode);
        });
    }

    /**
     * 关闭UI面板
     * @param panelPath 面板名称/路径 (支持 'EquipmentPanel' 或 'UI/EquipmentPanel')
     * @param destroy 是否直接销毁节点，默认为 false (仅隐藏)
     */
    public closeUI(panelPath: string, destroy: boolean = false) {
        const matchedKey = this.findMatchingKey(panelPath);
        if (matchedKey) {
            const uiNode = this.uiMap.get(matchedKey);
            if (uiNode) {
                if (destroy) {
                    uiNode.destroy();
                    this.uiMap.delete(matchedKey);
                } else {
                    uiNode.active = false;
                }
            }
        }
    }

    /**
     * 格式化检索已知 UI 地图 Key，支持传入 'EquipmentPanel' 或 'UI/EquipmentPanel' 格式模糊匹配
     */
    private findMatchingKey(panelPath: string): string | null {
        if (this.uiMap.has(panelPath)) {
            return panelPath;
        }

        const shortName = panelPath.split('/').pop();
        if (!shortName) return null;

        for (const key of this.uiMap.keys()) {
            if (key === panelPath || key.split('/').pop() === shortName) {
                return key;
            }
        }
        return null;
    }

    /**
     * 关闭所有UI面板
     * @param destroy 是否销毁节点
     */
    public closeAllUI(destroy: boolean = false) {
        this.uiMap.forEach((uiNode, panelPath) => {
            if (destroy) {
                uiNode.destroy();
            } else {
                uiNode.active = false;
            }
        });
        
        if (destroy) {
            this.uiMap.clear();
        }
    }
}
