/**
 * EffectsController - 视觉特效控制器
 * 
 * 负责管理所有视觉反馈特效：
 * - 整机震动效果（转轮锁定时）
 * - 机身外边缘发光
 * - 蒸汽朋克管道发射器动画
 * - 粒子系统（金币、宝石、金属火花）
 * 
 * 粒子系统采用流式喷射算法：
 * - 不是一次性全部生成，而是在 1-2 秒内按固定速率（最多 25/秒）连续喷射
 * - 使用 GPU 友好的 transform3d 进行位移
 * - 粒子从发射器顶部喷出，受重力影响下落
 * 
 * @module EffectsController
 */
export default class EffectsController {
    /**
     * 创建特效控制器实例
     * @param {Object} animeConfig - 动画配置（来自anime.json）
     * @param {Object} assets - 资源配置（来自asset.json）
     */
    constructor(animeConfig, assets) {
        this.config = animeConfig || {};
        this.assets = assets || {};
        this.particles = [];      // 活动粒子列表
        this.emitters = [];       // 发射器队列（流式喷射）
        this.animationId = null;  // 动画帧ID
        this.lastLauncherPulseAt = 0;

        // ===================== DOM 引用 =====================
        this.machineWrapper = document.getElementById('machine-wrapper');
        this.machineGlow = document.getElementById('machine-glow');
        this.particleContainer = document.getElementById('particle-container');
        this.launcherLeft = document.getElementById('launcher-left');
        this.launcherRight = document.getElementById('launcher-right');

        // ===================== 资源路径 =====================
        const reelBase = this.assets?.base_paths?.reel || 'image/reel_pic/';
        this.coinSrc = `${reelBase}${this.assets?.reel_images?.coin_1 || 'coin_1.png'}`;
        this.gemSrc = `${reelBase}${this.assets?.reel_images?.gem_1 || 'gem_1.png'}`;

        this.tick = this.tick.bind(this);
    }

    // ===================== 震动效果（整机+控制面板） =====================
    /**
     * 触发整机震动效果
     * @param {number} intensity - 震动强度（像素）
     * @param {number} duration - 持续时间（毫秒）
     */
    shake(intensity = 4, duration = 200) {
        if (!this.machineWrapper) return;
        const startTime = performance.now();
        const originalTransform = this.machineWrapper.style.transform || '';

        const animate = (now) => {
            const elapsed = now - startTime;
            if (elapsed > duration) {
                this.machineWrapper.style.transform = originalTransform;
                return;
            }
            const dx = (Math.random() - 0.5) * 2 * intensity;
            const dy = (Math.random() - 0.5) * 2 * intensity;
            this.machineWrapper.style.transform = `translate(${dx}px, ${dy}px)`;
            requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
    }

    /** 单个转轮锁定时的震动效果 */
    shakeOnReelLock() {
        const cfg = this.config.shake || {};
        this.shake(cfg.reel_lock_intensity || 3, cfg.reel_lock_duration_ms || 150);
        this.flashGlow(cfg.reel_lock_duration_ms || 150, this.config.glow?.reel_lock_color || 'rgba(139, 90, 43, 0.6)');
    }

    // 全部转轮锁定震动
    shakeOnAllLock() {
        const cfg = this.config.shake || {};
        this.shake(cfg.all_lock_intensity || 6, cfg.all_lock_duration_ms || 300);
        this.flashGlow(cfg.all_lock_duration_ms || 300, this.config.glow?.all_lock_color || 'rgba(255, 179, 0, 0.7)');
    }

    // ===================== 机身外边缘发光 =====================
    flashGlow(duration = 200, color = 'rgba(139, 90, 43, 0.6)') {
        if (!this.machineGlow) return;
        // 外边缘发光效果：box-shadow + border-glow
        this.machineGlow.style.boxShadow = `
            0 0 30px 10px ${color},
            0 0 60px 20px ${color},
            inset 0 0 20px 5px ${color}
        `;
        this.machineGlow.classList.add('active');
        setTimeout(() => {
            this.machineGlow.classList.remove('active');
        }, duration);
    }

    // ===================== 发射器动画 =====================
    pulseLaunchers() {
        [this.launcherLeft, this.launcherRight].forEach(launcher => {
            if (!launcher) return;
            launcher.classList.add('firing');
            setTimeout(() => launcher.classList.remove('firing'), 300);
        });
    }

    // ===================== 粒子系统 =====================
    launchCoins(count) {
        const cfg = this.config.particles || {};
        const scale = cfg.coin_scale || 0.4;
        this.launchParticlesStream(count, this.coinSrc, scale);
    }

    launchGems(count) {
        const cfg = this.config.particles || {};
        const scale = cfg.gem_scale || 0.35;
        this.launchParticlesStream(count, this.gemSrc, scale);
    }

    launchSparks(count = 30) {
        const cfg = this.config.particles || {};
        // 金属火花用 CSS 纯色方块
        for (let i = 0; i < count; i++) {
            this.createSparkParticle(cfg);
        }
        this.startParticleLoop();
        this.pulseLaunchers();
    }

    // 将“爆发式”喷射改为“流式”喷射：1-2秒内连续喷出，且每秒最多25个
    launchParticlesStream(count, imageSrc, scale) {
        if (!this.particleContainer) return;

        const total = Math.min(Math.max(0, Number(count) || 0), 50);
        if (total <= 0) return;

        const maxPerSecond = 25;
        const durationSec = Math.max(1, Math.min(2, total / maxPerSecond));
        const rate = Math.min(maxPerSecond, total / durationSec);

        this.emitters.push({
            total,
            emitted: 0,
            rate,
            startTime: performance.now(),
            imageSrc,
            scale
        });

        this.startParticleLoop();
    }

    spawnOneParticle(imageSrc, scale) {
        if (!this.particleContainer) return;
        const cfg = this.config.particles || {};

        // 随机从左或右发射器发射
        const isLeft = Math.random() < 0.5;
        const launcher = isLeft ? this.launcherLeft : this.launcherRight;
        if (!launcher) return;

        // 适配新的蒸汽朋克管道结构
        const tubes = launcher.querySelectorAll('.pipe-opening');
        const tube = tubes[Math.floor(Math.random() * tubes.length)] || launcher;
        const rect = tube.getBoundingClientRect();

        // 容器是 fixed 全屏，直接用 viewport 坐标
        const startXCenter = rect.left + rect.width / 2;
        const startYCenter = rect.top + rect.height / 2;

        const particle = document.createElement('img');
        particle.src = imageSrc;
        particle.className = 'effect-particle';

        const particleSize = 80 * scale;
        particle.style.width = `${particleSize}px`;
        particle.style.height = `${particleSize}px`;

        // 用 transform 移动，避免频繁 left/top 触发布局
        particle.style.left = '0px';
        particle.style.top = '0px';

        const startX = startXCenter - particleSize / 2;
        const startY = startYCenter - particleSize / 2;
        particle.style.transform = `translate3d(${startX}px, ${startY}px, 0)`;

        this.particleContainer.appendChild(particle);

        // 物理属性 - 向上发射并带有水平扩散
        const spreadX = (Math.random() - 0.5) * (cfg.horizontal_spread || 60);
        const speedY = -(cfg.launch_speed_min || 12) - Math.random() * ((cfg.launch_speed_max || 22) - (cfg.launch_speed_min || 12));

        this.particles.push({
            el: particle,
            x: startX,
            y: startY,
            vx: spreadX * 0.1 + (isLeft ? 3 : -3),
            vy: speedY,
            gravity: cfg.gravity || 0.35,
            fadeOutY: cfg.fade_out_y || 50
        });
    }

    createSparkParticle(cfg) {
        if (!this.particleContainer) return;
        // 从两边发射器中间发射（viewport 坐标）
        const startX = window.innerWidth / 2 + (Math.random() - 0.5) * 100;
        const startY = window.innerHeight / 2;

        const spark = document.createElement('div');
        spark.className = 'effect-spark';
        const size = 4 + Math.random() * 6;
        spark.style.width = `${size}px`;
        spark.style.height = `${size}px`;
        spark.style.left = '0px';
        spark.style.top = '0px';
        spark.style.transform = `translate3d(${startX}px, ${startY}px, 0)`;

        this.particleContainer.appendChild(spark);

        const angle = Math.random() * Math.PI * 2;
        const speed = 8 + Math.random() * 12;

        this.particles.push({
            el: spark,
            x: startX,
            y: startY,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 5,
            gravity: (cfg.gravity || 0.35) * 0.8,
            fadeOutY: cfg.fade_out_y || 50,
            isSpark: true,
            life: 1.0
        });
    }

    startParticleLoop() {
        if (this.animationId) return;
        this.animationId = requestAnimationFrame(this.tick);
    }

    tick(now) {
        // 先处理“流式喷射”队列
        if (this.emitters.length) {
            this.emitters = this.emitters.filter(em => {
                const elapsedSec = (now - em.startTime) / 1000;
                const shouldHaveEmitted = Math.min(em.total, Math.floor(elapsedSec * em.rate));
                const toSpawn = shouldHaveEmitted - em.emitted;
                if (toSpawn > 0) {
                    for (let i = 0; i < toSpawn; i++) {
                        this.spawnOneParticle(em.imageSrc, em.scale);
                    }
                    em.emitted += toSpawn;
                }
                return em.emitted < em.total;
            });

            // 喷射期间让发射器有节奏地闪一下（避免每个粒子都触发一次）
            if (now - this.lastLauncherPulseAt > 250) {
                this.pulseLaunchers();
                this.lastLauncherPulseAt = now;
            }
        }

        if (!this.particles.length && !this.emitters.length) {
            this.animationId = null;
            return;
        }

        const maxY = window.innerHeight + 100;

        this.particles = this.particles.filter(p => {
            p.vy += p.gravity;
            p.x += p.vx;
            p.y += p.vy;

            // 统一使用 transform 位移（GPU 友好）
            p.el.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`;

            // 火花额外处理生命周期
            if (p.isSpark) {
                p.life -= 0.02;
                p.el.style.opacity = p.life;
                if (p.life <= 0) {
                    p.el.remove();
                    return false;
                }
            }

            // 粒子超出底部，淡出并移除
            if (p.y > maxY) {
                p.el.classList.add('fading');
                // fading 时保持当前位置并缩小
                p.el.style.transform = `translate3d(${p.x}px, ${p.y}px, 0) scale(0.5)`;
                setTimeout(() => p.el.remove(), 300);
                return false;
            }

            return true;
        });

        this.animationId = requestAnimationFrame(this.tick);
    }

    // ===================== 结算特效入口 =====================
    onReelLock(reelIndex, totalReels) {
        this.shakeOnReelLock();
    }

    onAllReelsLocked() {
        this.shakeOnAllLock();
    }

    onWin(coinNum, gemNum) {
        if (coinNum > 0) this.launchCoins(coinNum);
        if (gemNum > 0) this.launchGems(gemNum);
    }

    onJackpot() {
        // 全部转轮一样时，喷出金属火花
        this.flashGlow(500, this.config.glow?.jackpot_color || 'rgba(255, 215, 0, 0.9)');
        this.launchSparks(40);
    }
}
