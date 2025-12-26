/**
 * LED 边框灯控制器
 * 
 * 创建老虎机边框的 LED 灯珠效果，支持多种动画模式。
 * 根据容器宽高比自动分配每边灯的数量，保持间距一致。
 * 
 * 支持的模式:
 * - normal: 正常流动效果，5灯组顺时针移动
 * - red: 全部红灯闪烁，用于警告状态
 * - fast: 快速流动效果，10灯组快速移动
 * 
 * @module led-controller
 * @example
 * const led = new LedController(document.querySelector('.led-container'), 60);
 * led.build();
 * led.start('normal');
 */
export default class LedController {
    /**
     * @param {HTMLElement} container - LED 容器元素
     * @param {number} [totalLedCount=60] - 总灯珠数量
     */
    constructor(container, totalLedCount = 60) {
        this.container = container;
        this.totalLedCount = totalLedCount;
        this.leds = [];
        this.timer = null;
        this.mode = 'normal';
    }

    /**
     * 根据容器宽高和总灯数，计算每边的灯数量（保持间距一致）
     * 算法：按周长比例分配，确保灯珠均匀分布
     * @returns {{top: number, right: number, bottom: number, left: number}} 每边灯数
     */
    calculateLedDistribution() {
        if (!this.container) return { top: 10, right: 10, bottom: 10, left: 10 };

        const rect = this.container.getBoundingClientRect();
        // 减去四个角落的宽度（每个角16px）
        const cornerSize = 16;
        const width = rect.width - cornerSize * 2;
        const height = rect.height - cornerSize * 2;

        // 周长（不含四个角落）
        const perimeter = (width + height) * 2;
        
        // 根据周长比例分配灯的数量
        const topCount = Math.round((width / perimeter) * this.totalLedCount);
        const rightCount = Math.round((height / perimeter) * this.totalLedCount);
        const bottomCount = Math.round((width / perimeter) * this.totalLedCount);
        // 剩余的分给左边，确保总数正确
        const leftCount = this.totalLedCount - topCount - rightCount - bottomCount;

        return {
            top: Math.max(topCount, 2),
            right: Math.max(rightCount, 2),
            bottom: Math.max(bottomCount, 2),
            left: Math.max(leftCount, 2)
        };
    }

    /**
     * 构建 LED 边框 DOM 结构
     * 创建四个角落装饰、金属框架和灯珠
     */
    build() {
        if (!this.container) return;
        this.container.innerHTML = '';
        this.leds = [];

        // 创建四个角落装饰
        const corners = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
        corners.forEach(corner => {
            const cornerEl = document.createElement('div');
            cornerEl.className = `led-corner ${corner}`;
            this.container.appendChild(cornerEl);
        });

        // 创建四边的金属框
        const frameSides = ['top', 'right', 'bottom', 'left'];
        frameSides.forEach(side => {
            const frame = document.createElement('div');
            frame.className = `led-frame ${side}`;
            this.container.appendChild(frame);
        });

        // 计算每边灯的数量
        const counts = this.calculateLedDistribution();
        const sides = ['top', 'right', 'bottom', 'left'];

        sides.forEach(side => {
            const strip = document.createElement('div');
            strip.className = `led-strip ${side}`;
            
            for (let i = 0; i < counts[side]; i++) {
                // 创建灯座
                const socket = document.createElement('div');
                socket.className = 'led-socket';
                
                // 创建灯珠
                const dot = document.createElement('div');
                dot.className = 'led-dot';
                
                socket.appendChild(dot);
                strip.appendChild(socket);
                this.leds.push(dot);
            }
            this.container.appendChild(strip);
        });
    }

    /**
     * 启动 LED 动画
     * @param {'normal'|'red'|'fast'} [mode='normal'] - 动画模式
     */
    start(mode = 'normal') {
        this.mode = mode;
        if (this.timer) clearInterval(this.timer);
        let index = 0;

        // 50ms 间隔，即 20fps
        this.timer = setInterval(() => {
            this.leds.forEach(l => l.className = 'led-dot');

            if (this.mode === 'normal') {
                // 正常模式：5灯组顺时针流动
                for (let i = 0; i < 5; i++) {
                    const target = (index + i) % this.leds.length;
                    this.leds[target].classList.add('active-normal');
                }
                index = (index + 1) % this.leds.length;
            } else if (this.mode === 'red') {
                // 红灯模式：200ms 间隔全部闪烁
                const blink = Math.floor(Date.now() / 200) % 2 === 0;
                if (blink) {
                    this.leds.forEach(l => l.classList.add('active-red'));
                }
            } else if (this.mode === 'fast') {
                // 快速模式：10灯组间隔3快速流动
                for (let i = 0; i < 10; i++) {
                    const target = (index + i * 3) % this.leds.length;
                    this.leds[target].classList.add('active-fast');
                }
                index = (index + 3) % this.leds.length;
            }
        }, 50);
    }

    /**
     * 设置动画模式
     * @param {'normal'|'red'|'fast'} mode - 动画模式
     * @param {number} [duration=0] - 持续时间(ms)，0表示永久
     */
    setMode(mode, duration = 0) {
        this.mode = mode;
        if (duration > 0) {
            setTimeout(() => {
                this.mode = 'normal';
            }, duration);
        }
    }

    /**
     * 更新总灯数并重建
     * @param {number} count - 新的灯珠总数
     */
    setTotalLedCount(count) {
        this.totalLedCount = count;
        this.build();
    }
}
