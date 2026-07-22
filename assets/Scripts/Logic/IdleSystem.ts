import { _decorator, Component, sys } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('IdleSystem')
export class IdleSystem extends Component {
    
    @property({ tooltip: "每秒自动产出的资源数量" })
    public resourcePerSecond: number = 10;

    // 当前积累的资源总量
    private _currentResource: number = 0;
    
    // 最后一次状态更新的时间戳 (毫秒)
    private _lastUpdateTime: number = 0;

    // 本地存储的数据键名
    private readonly SAVE_KEY_RESOURCE = "idle_game_save_resource";
    private readonly SAVE_KEY_TIME = "idle_game_save_last_time";

    onLoad() {
        this.loadData();
        this.calculateOfflineEarnings();
    }

    /**
     * Cocos Creator 生命周期 - 每帧调用
     * @param deltaTime 距离上一帧的时间间隔（秒）
     */
    update(deltaTime: number) {
        // 游戏在线时的资源积累逻辑
        this._currentResource += this.resourcePerSecond * deltaTime;
        
        // 实时更新当前时间戳
        this._lastUpdateTime = Date.now();
    }

    /**
     * 计算离线收益
     */
    private calculateOfflineEarnings() {
        const currentTime = Date.now();
        if (this._lastUpdateTime > 0) {
            // 计算离线了多少秒
            const offlineSeconds = (currentTime - this._lastUpdateTime) / 1000;
            if (offlineSeconds > 0) {
                const earnings = offlineSeconds * this.resourcePerSecond;
                this._currentResource += earnings;
                console.log(`离线结算: 离线时间 ${offlineSeconds.toFixed(2)} 秒, 获得收益: ${earnings.toFixed(2)}`);
            }
        }
        
        // 结算后同步最新时间
        this._lastUpdateTime = currentTime;
    }

    /**
     * 获取当前的资源总量
     * @returns 资源总数
     */
    public getCurrentResource(): number {
        return this._currentResource;
    }

    /**
     * 消耗资源进行升级或购买操作
     * @param amount 需要消耗的资源数量
     * @returns 消耗是否成功（资源是否充足）
     */
    public consumeResource(amount: number): boolean {
        if (this._currentResource >= amount) {
            this._currentResource -= amount;
            // 操作后及时保存状态
            this.saveData();
            return true;
        }
        return false;
    }

    /**
     * 将核心状态数据保存到本地
     */
    public saveData() {
        sys.localStorage.setItem(this.SAVE_KEY_RESOURCE, this._currentResource.toString());
        sys.localStorage.setItem(this.SAVE_KEY_TIME, this._lastUpdateTime.toString());
    }

    /**
     * 从本地存储中读取数据
     */
    private loadData() {
        const savedResource = sys.localStorage.getItem(this.SAVE_KEY_RESOURCE);
        const savedTime = sys.localStorage.getItem(this.SAVE_KEY_TIME);

        if (savedResource) {
            this._currentResource = parseFloat(savedResource);
        }
        if (savedTime) {
            this._lastUpdateTime = parseInt(savedTime);
        }
    }

    onDestroy() {
        // 在组件销毁时保存一次数据，防止丢失
        this.saveData();
    }
}
