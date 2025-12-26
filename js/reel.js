/**
 * Reel - 单个转轮物理引擎
 * 
 * 使用弹簧阻尼物理模型实现转轮的启动、旋转和停止动画。
 * 
 * 物理公式：
 * - 旋转阶段：y += velocity（匀速运动）
 * - 停止阶段：采用弹簧阻尼模型
 *   - force = displacement × (tension / 100)  // 弹簧力
 *   - velocity += force                        // 加速度
 *   - velocity *= friction                     // 阻尼
 *   - y += velocity                            // 位移
 * 
 * 状态机：
 * - 'idle': 静止状态
 * - 'spinning': 匀速旋转中
 * - 'stopping': 弹簧减速中
 * - 'locked': 完全停止
 * 
 * @module Reel
 */
export default class Reel {
    /**
     * 创建转轮实例
     * @param {HTMLElement} element - 转轮DOM容器
     * @param {number} index - 转轮索引（0开始）
     * @param {Object} config - 游戏配置
     * @param {Object} assets - 资源配置
     */
    constructor(element, index, config, assets) {
        this.el = element;
        this.index = index;
        this.config = config;
        this.assets = assets;

        this.y = 0;           // 当前Y偏移
        this.velocity = 0;    // 当前速度
        this.state = 'idle';  // 状态机
        this.targetY = 0;     // 目标Y位置（停止时）

        this.itemHeight = config.item_height;
        this.visibleHeight = this.el.parentElement?.clientHeight || config.visible_height;
        this.centerOffset = (this.visibleHeight / 2) - (this.itemHeight / 2);

        this.items = [];          // 符号列表
        this.fullListHeight = 0;  // 完整列表高度（用于循环）
    }

    /**
     * 更新转轮符号列表
     * @param {string[]} newItems - 新的符号数组
     */
    updateItems(newItems) {
        this.items = newItems;
        this.fullListHeight = this.itemHeight * this.items.length;

        if (!this.el.innerHTML) {
            this.initDOM();
        } else {
            this.updateDOMContent();
        }
    }

    initDOM() {
        let html = '';
        for (let i = 0; i < 4; i++) {
            this.items.forEach(itemKey => {
                const src = this.getReelSrc(itemKey);
                html += `<div class="reel-item" style="height:${this.itemHeight}px" data-key="${itemKey}">
                    <img src="${src}" class="reel-img" alt="${itemKey}" onerror="this.style.display='none';this.parentElement.innerText='${itemKey}'">
                </div>`;
            });
        }
        this.el.innerHTML = html;

        const startIdx = Math.floor(Math.random() * this.items.length);
        this.y = -(startIdx * this.itemHeight) + this.centerOffset;
        this.render();
    }

    updateDOMContent() {
        const domItems = this.el.querySelectorAll('.reel-item');
        domItems.forEach((el, idx) => {
            const itemIndex = idx % this.items.length;
            const newItemKey = this.items[itemIndex];
            const src = this.getReelSrc(newItemKey);
            if (el.dataset.key !== newItemKey) {
                el.innerHTML = `<img src="${src}" class="reel-img" alt="${newItemKey}" onerror="this.style.display='none';this.parentElement.innerText='${newItemKey}'">`;
                el.dataset.key = newItemKey;
            }
        });
    }

    start(speedOverride = null) {
        this.state = 'spinning';
        this.velocity = speedOverride || this.config.scroll_speed;
    }

    stop() {
        if (this.state !== 'spinning') return;
        this.state = 'stopping';

        const relativeY = this.y - this.centerOffset;
        const itemIndexFloat = -relativeY / this.itemHeight;
        let targetIndex = Math.round(itemIndexFloat);

        this.targetY = -(targetIndex * this.itemHeight) + this.centerOffset;
    }

    update() {
        const cycle = this.fullListHeight;

        if (this.y < -cycle * 2) {
            this.y += cycle;
            this.targetY += cycle;
        }
        if (this.y > 0) {
            this.y -= cycle;
            this.targetY -= cycle;
        }

        if (this.state === 'spinning') {
            this.y += this.velocity;
        } else if (this.state === 'stopping') {
            const displacement = this.targetY - this.y;
            const force = displacement * (this.config.tension / 100);

            this.velocity += force;
            this.velocity *= this.config.friction;
            this.y += this.velocity;

            if (Math.abs(this.velocity) < 0.1 && Math.abs(displacement) < 0.5) {
                this.y = this.targetY;
                this.state = 'locked';
                this.velocity = 0;
                return true;
            }
        }

        this.render();
        return false;
    }

    render() {
        this.el.style.transform = `translate3d(0, ${this.y}px, 0)`;
    }

    getResult() {
        const rawIndex = Math.round((this.centerOffset - this.y) / this.itemHeight);
        const len = this.items.length;
        const finalIndex = ((rawIndex % len) + len) % len;
        return this.items[finalIndex];
    }

    getReelSrc(key) {
        const base = this.assets?.base_paths?.reel || 'image/reel_pic/';
        const file = this.assets?.reel_images?.[key];
        return file ? `${base}${file}` : `${base}${key}.png`;
    }
}
