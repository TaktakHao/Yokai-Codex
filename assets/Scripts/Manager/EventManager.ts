import { EventTarget, Vec3, Vec2, Node } from 'cc';

/** 战斗相关全局事件枚举 */
export enum CombatEvent {
    /** 玩家发动攻击 */
    PLAYER_ATTACKED = 'COMBAT_PLAYER_ATTACKED',
    /** 敌人受到伤害 */
    ENEMY_DAMAGED = 'COMBAT_ENEMY_DAMAGED',
    /** 敌人死亡 */
    ENEMY_DIED = 'COMBAT_ENEMY_DIED',
    /** 玩家受到伤害 */
    PLAYER_DAMAGED = 'COMBAT_PLAYER_DAMAGED',
}

/** UI 相关全局事件枚举 */
export enum UIEvent {
    UPDATE_HP = 'UI_UPDATE_HP',
    UPDATE_EXP = 'UI_UPDATE_EXP',
    LEVEL_UP = 'UI_LEVEL_UP',
    GAME_OVER = 'UI_GAME_OVER',
}

/** 敌人受击事件参数载荷接口 */
export interface IEnemyDamagedPayload {
    enemyNode: Node;
    damage: number;
    position: Vec3 | Vec2;
    isCritical?: boolean;
}

/** 敌人死亡事件参数载荷接口 */
export interface IEnemyDiedPayload {
    enemyNode: Node;
    position: Vec3 | Vec2;
    expReward: number;
}

/** 玩家攻击事件参数载荷接口 */
export interface IPlayerAttackedPayload {
    attackerPos: Vec3 | Vec2;
    targetPos?: Vec3 | Vec2;
    damage: number;
}

/**
 * 全局发布-订阅 (Pub-Sub) 事件分发中枢 (EventManager)
 * 基于 Cocos Creator cc.EventTarget 封装
 */
export class EventManager {
    private static _dispatcher: EventTarget = new EventTarget();

    /**
     * 监听全局事件
     * @param type 事件类型 (CombatEvent / UIEvent 或字符串)
     * @param callback 事件响应回调函数
     * @param target 绑定回调执行上下文
     */
    public static on<T = any>(type: string, callback: (payload: T) => void, target?: any): void {
        this._dispatcher.on(type, callback, target);
    }

    /**
     * 取消监听全局事件
     * @param type 事件类型
     * @param callback 事件响应回调函数
     * @param target 绑定回调执行上下文
     */
    public static off<T = any>(type: string, callback: (payload: T) => void, target?: any): void {
        this._dispatcher.off(type, callback, target);
    }

    /**
     * 单次监听全局事件 (触发后自动销毁)
     * @param type 事件类型
     * @param callback 事件响应回调函数
     * @param target 绑定回调执行上下文
     */
    public static once<T = any>(type: string, callback: (payload: T) => void, target?: any): void {
        this._dispatcher.once(type, callback, target);
    }

    /**
     * 派发/广播全局事件
     * @param type 事件类型
     * @param payload 携带的数据载荷
     */
    public static emit<T = any>(type: string, payload?: T): void {
        this._dispatcher.emit(type, payload);
    }
}
