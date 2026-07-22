import { _decorator, Component, JsonAsset, resources, error, log, warn, director } from 'cc';
import { UIManager } from './Manager/UIManager';
import { DialoguePanel } from './UI/DialoguePanel';
import { GameManager } from './Manager/GameManager';

const { ccclass } = _decorator;

/** 对话数据接口 */
export interface IDialogueData {
    speaker: string;
    text: string;
    trigger_condition: string;
}

@ccclass('DialogueSystem')
export class DialogueSystem extends Component {

    private static _instance: DialogueSystem | null = null;

    /** 单例访问接口 */
    public static get instance(): DialogueSystem {
        if (!this._instance) {
            // 尝试从场景中获取实例
            const scene = director.getScene();
            const canvas = scene?.getChildByName('Canvas');
            const globalNode = scene?.getChildByName('GlobalManager') || canvas;
            let comp = globalNode?.getComponent(DialogueSystem) || scene?.getComponentInChildren(DialogueSystem);
            if (!comp && globalNode) {
                comp = globalNode.addComponent(DialogueSystem);
            }
            this._instance = comp;
        }
        return this._instance!;
    }

    /** 存储所有的对话数据 */
    private dialoguesData: IDialogueData[] = [];

    /** 当前正在显示的对话列表 */
    private currentDialogues: IDialogueData[] = [];
    private currentIndex: number = 0;
    private currentCondition: string = '';

    onLoad() {
        if (DialogueSystem._instance === null) {
            DialogueSystem._instance = this;
        }
    }

    start() {
        this.loadDialogueConfig();
    }

    /**
     * 加载对话配置
     */
    private loadDialogueConfig() {
        resources.load('Configs/Chapter1_Dialogues', JsonAsset, (err, jsonAsset) => {
            if (err) {
                error('[DialogueSystem] 加载对话配置失败: ', err);
                return;
            }
            if (jsonAsset && jsonAsset.json) {
                this.dialoguesData = jsonAsset.json as IDialogueData[];
                log('[DialogueSystem] 对话配置加载成功，共 ', this.dialoguesData.length, ' 条对话。');
            }
        });
    }

    /**
     * 根据触发条件触发一段对话
     * @param condition 触发条件（例如 "Game_Start", "Intro_Scene_1"）
     */
    public triggerDialogue(condition: string) {
        if (!this.dialoguesData || this.dialoguesData.length === 0) {
            warn('[DialogueSystem] 对话数据尚未加载完毕，等待 0.5s 后重试...');
            this.scheduleOnce(() => {
                this.triggerDialogue(condition);
            }, 0.5);
            return;
        }

        // 筛选出符合条件的对话内容
        const matchedDialogues = this.dialoguesData.filter(d => d.trigger_condition === condition);
        if (matchedDialogues.length > 0) {
            this.currentDialogues = matchedDialogues;
            this.currentIndex = 0;
            this.currentCondition = condition;
            log(`[DialogueSystem] 触发条件为 [${condition}] 的对话流，共 ${this.currentDialogues.length} 句。`);
            
            // 触发防御性战斗冻结
            if (GameManager.instance) {
                GameManager.instance.freezeBattle();
            }

            this.showNextDialogue();
        } else {
            log(`[DialogueSystem] 没有找到触发条件为 [${condition}] 的对话。`);
            // 若未找到对话，也直接广播结束事件以防流程卡死
            director.emit('Dialogue_System_Finished', condition);
        }
    }

    /**
     * 显示下一句对话
     */
    public showNextDialogue() {
        if (this.currentIndex < this.currentDialogues.length) {
            const currentLine = this.currentDialogues[this.currentIndex];
            log(`[DialogueSystem] 播放中 (${this.currentIndex + 1}/${this.currentDialogues.length}) -> ${currentLine.speaker}: ${currentLine.text}`);
            
            // 通知 UI 层打开并更新剧情对话面板
            if (UIManager.instance) {
                UIManager.instance.openUI('UI/DialoguePanel', (node) => {
                    const dialoguePanel = node.getComponent(DialoguePanel);
                    if (dialoguePanel) {
                        dialoguePanel.showDialogue(
                            currentLine.speaker,
                            currentLine.text,
                            () => {
                                // 点击推进到下一句
                                this.currentIndex++;
                                this.showNextDialogue();
                            },
                            () => {
                                // 跳过全部
                                this.endDialogue(true);
                            }
                        );
                    }
                });
            }
        } else {
            // 对话结束
            this.endDialogue(false);
        }
    }

    /**
     * 结束当前对话流程
     * @param isSkippedAll 是否是通过右上角“跳过”按钮直接全部跳过
     */
    private endDialogue(isSkippedAll: boolean = false) {
        log(`[DialogueSystem] 对话条件 [${this.currentCondition}] 流程已结束。是否全跳过: ${isSkippedAll}`);
        this.currentDialogues = [];
        this.currentIndex = 0;

        // 隐藏 UI 对话面板
        if (UIManager.instance) {
            UIManager.instance.closeUI('UI/DialoguePanel');
        }

        // 解除战斗冻结，完美恢复正常战斗逻辑
        if (GameManager.instance) {
            GameManager.instance.resumeBattle();
        }

        // 广播结束事件并携带 condition 与是否跳过全部的负载
        director.emit('Dialogue_System_Finished', { condition: this.currentCondition, isSkippedAll });
    }
}

