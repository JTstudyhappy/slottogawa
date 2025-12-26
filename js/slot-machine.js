/**
 * SlotMachine - 老虎机游戏核心控制器
 * 
 * 负责管理整个游戏的生命周期，包括：
 * - 游戏状态机（phase: 0=待机, 1~N=转轮停止中, N+1=结算中）
 * - UI绑定与更新
 * - 转轮控制与动画
 * - 卡片道具系统
 * - 角色互动系统
 * - 商店与广告系统
 * - 奖励计算与结算
 * 
 * @module SlotMachine
 */

import Reel from './reel.js';
import LedController from './led-controller.js';
import EffectsController from './effects-controller.js';
import { initGame, generateReel } from './api.js';
import AudioManager from './audio-manager.js';

class SlotMachine {
    /**
     * 创建老虎机实例
     * @param {Object} config - 游戏配置（来自config.json）
     * @param {Object} assets - 资源路径配置（来自asset.json）
     * @param {Object} [symbolValues] - 符号奖励数值（来自symbol-values.json）
     * @param {Object} [cardConfig] - 卡片配置（来自card.json）
     * @param {Object} [animeConfig] - 动画特效配置（来自anime.json）
     * @param {Object} [adConfig] - 广告系统配置（来自ad.json）
     * @param {Object} [shopConfig] - 商店配置（来自shop.json）
     * @param {Object} [characterConfig] - 角色配置（来自character.json）
     * @param {Object} [musicConfig] - 音频配置（来自music.json）
     */
    constructor(config, assets, symbolValues = null, cardConfig = null, animeConfig = null, adConfig = null, shopConfig = null, characterConfig = null, musicConfig = null) {
        this.config = config;
        this.assets = assets;
        this.symbolValues = symbolValues;
        this.cardConfig = cardConfig;
        this.animeConfig = animeConfig;
        this.adConfig = adConfig || { ad_coin: 10, ad_sec: 15, ad_hack_sec: 5, ad_hack_coin_multiplier: 2 };
        this.shopConfig = shopConfig || { items: [] };
        this.characterConfig = characterConfig || { waiter_upgrade_costs: [10, 50, 100, 200, 1680] };
        this.reels = [];
        this.phase = 0;  // 游戏阶段：0=待机, 1~N=停止转轮中, N+1=等待锁定, N+2=结算完成
        this.spinCount = 0;

        // ===================== UI 元素引用 =====================
        this.ui = {
            btn: document.getElementById('action-btn'),
            status: document.getElementById('status-text'),
            lightsContainer: document.getElementById('lights-container'),
            lights: [],
            coinCount: document.getElementById('coin-count'),
            gemCount: document.getElementById('gem-count'),
            cardsContainer: document.getElementById('cards-container'),
            characterBoss: document.getElementById('character-boss'),
            characterWaiter: document.getElementById('character-waiter'),
            characterToast: document.getElementById('character-toast'),
            waiterDialogue: document.getElementById('waiter-dialogue')
        };

        // ===================== 游戏状态 =====================
        this.coins = 20;           // 当前金币
        this.gems = 0;             // 当前宝石
        this.currentBet = 5;       // 当前下注倍率
        this.reelCount = 3;        // 转轮数量

        // ===================== 卡片系统 =====================
        this.inventory = [];       // 持有的卡片列表
        this.activeCards = [];     // 本次选中的卡片索引
        this.availableCardTypes = Object.keys(this.getCardDefs());
        this.currentSpinCardTypes = [];      // 本次旋转使用的卡片类型
        this.currentSpinBombMultiplier = 1;  // 炸弹倍率
        
        // ===================== 商店状态 =====================
        this.adHackActive = false;  // 广告黑客是否激活
        
        // ===================== 角色系统 =====================
        this.waiterUpgradeLevel = 0;  // 角色升级等级（0=初始，1-4=waiter升级，5=boss升级）

        // ===================== 子系统初始化 =====================
        const ledTotalCount = config.led_total_count || 60;
        this.ledController = new LedController(document.getElementById('led-border'), ledTotalCount);
        this.effectsController = new EffectsController(animeConfig, assets);
        this.audioManager = new AudioManager(musicConfig || {});
        this.audioManager.load();
        
        this.eventsBound = false;
        this.tick = this.tick.bind(this);
        this.init();
    }

    init() {
        this.buildLights();
        this.buildReels();
        this.loadInitialReels();
        this.renderCards();
        this.initCharacters();
        this.updateCurrencyUI();
        this.audioManager.playInitialBgm1();

        this.ledController.build();
        this.ledController.start('normal');

        if (!this.eventsBound) {
            this.bindInput();
            this.bindExitButton();
            this.bindAdButton();
            this.bindShopButton();
            this.bindBetButtons();
            this.bindCharacterInteraction();
            this.bindBgmToggleButton();
            requestAnimationFrame(this.tick);
            this.eventsBound = true;
        }
    }

    bindBgmToggleButton() {
        const btn = document.getElementById('bgm-toggle-btn');
        if (!btn) return;

        const refreshText = () => {
            btn.innerText = this.audioManager.bgmEnabled ? 'BGM: ON' : 'BGM: OFF';
        };
        refreshText();

        btn.addEventListener('click', () => {
            this.audioManager.toggleBgmEnabled();
            refreshText();
        });
    }

    // ===================== 角色前景系统 =====================
    initCharacters() {
        const cfg = this.characterConfig;

        // Boss 配置
        const bossCfg = cfg.boss || {};
        document.documentElement.style.setProperty('--boss-scale', bossCfg.scale || 1.0);
        document.documentElement.style.setProperty('--boss-x', `${bossCfg.idle_x_px || 80}px`);
        document.documentElement.style.setProperty('--boss-y', `${bossCfg.idle_y_px || 0}px`);
        document.documentElement.style.setProperty('--boss-spin-x', `${bossCfg.spin_x_px || -200}px`);

        // Waiter 配置
        const waiterCfg = cfg.waiter || {};
        document.documentElement.style.setProperty('--waiter-scale', waiterCfg.scale || 1.0);
        document.documentElement.style.setProperty('--waiter-x', `${waiterCfg.idle_x_px || 80}px`);
        document.documentElement.style.setProperty('--waiter-y', `${waiterCfg.idle_y_px || 0}px`);
        document.documentElement.style.setProperty('--waiter-spin-x', `${waiterCfg.spin_x_px || -200}px`);
    }

    setCharactersSpinMode(isSpinning) {
        const boss = this.ui.characterBoss;
        const waiter = this.ui.characterWaiter;
        if (boss) {
            boss.classList.toggle('spin-active', isSpinning);
        }
        if (waiter) {
            waiter.classList.toggle('spin-active', isSpinning);
        }
    }

    bindCharacterInteraction() {
        const waiter = this.ui.characterWaiter;
        if (!waiter) return;

        waiter.addEventListener('click', () => {
            // Spin 期间不可交互
            if (this.phase !== 0) return;
            this.handleWaiterClick();
        });
    }

    handleWaiterClick() {
        const costs = this.characterConfig.waiter_upgrade_costs || [10, 50, 100, 200, 1680];
        
        // 已经全部升级完成
        if (this.waiterUpgradeLevel >= costs.length) {
            this.showCharacterToast('ALL UPGRADES COMPLETE!', '✨', '');
            return;
        }

        const requiredGems = costs[this.waiterUpgradeLevel];

        if (this.gems >= requiredGems) {
            // 扣除宝石
            this.gems -= requiredGems;
            this.updateCurrencyUI();
            
            // 播放对应的语音（基于当前waiterUpgradeLevel，从0开始）
            this.audioManager.playWaiter(this.waiterUpgradeLevel);
            
            // 显示对话气泡（前5次）
            this.showWaiterDialogue(this.waiterUpgradeLevel);
            
            // 升级CG
            this.waiterUpgradeLevel++;
            this.updateCharacterCG();
        } else {
            // 宝石不够，显示提示，不播放语音
            this.showCharacterToast('NOT ENOUGH GEMS', '💎', `NEED: ${requiredGems} GEMS`);
        }
    }

    updateCharacterCG() {
        const charBase = this.assets?.base_paths?.character || 'image/character/';
        const charImages = this.assets?.character_images || {};

        if (this.waiterUpgradeLevel <= 4) {
            // 升级 waiter CG (1-4)
            const waiterKey = `waiter_${this.waiterUpgradeLevel}`;
            const waiterSrc = charImages[waiterKey] || `waiter_${this.waiterUpgradeLevel}.png`;
            this.animateCGChange(this.ui.characterWaiter, `${charBase}${waiterSrc}`);
            
            const levelNames = ['', 'CASUAL', 'STYLISH', 'ELEGANT', 'GORGEOUS'];
            this.ui.status.innerText = `WAITER: ${levelNames[this.waiterUpgradeLevel]}`;
        } else if (this.waiterUpgradeLevel === 5) {
            // 最终升级 boss CG
            const bossSrc = charImages['boss_1'] || 'boss_1.png';
            this.animateCGChange(this.ui.characterBoss, `${charBase}${bossSrc}`);
            this.ui.status.innerText = 'BOSS TRANSFORMED!';
            
            // 触发结算界面
            setTimeout(() => {
                this.triggerEnding();
            }, 2000);
            return;
        }

        setTimeout(() => {
            if (this.phase === 0) this.ui.status.innerText = 'INSERT COIN';
        }, 2500);
    }

    triggerEnding() {
        // 锁定BGM4并播放结算音效
        this.audioManager.lockBgmToEnding();
        this.audioManager.playEndingSfx();
        
        // 显示结算界面
        const endingOverlay = document.getElementById('ending-overlay');
        if (endingOverlay) {
            endingOverlay.classList.remove('hidden');
        }
        
        // 绑定确认按钮
        const confirmBtn = document.getElementById('ending-confirm-btn');
        if (confirmBtn) {
            confirmBtn.onclick = () => {
                this.audioManager.playSfx('button_exit');
                endingOverlay.classList.add('hidden');
                if (this.phase === 0) this.ui.status.innerText = 'INSERT COIN';
            };
        }
    }

    animateCGChange(element, newSrc) {
        if (!element) return;

        // 添加像素擦除动画
        element.classList.add('cg-updating');

        // 动画中途更换图片
        setTimeout(() => {
            element.src = newSrc;
        }, 300);

        // 动画结束移除类
        setTimeout(() => {
            element.classList.remove('cg-updating');
        }, 600);
    }

    showCharacterToast(text, icon = '💎', costText = '') {
        const toast = this.ui.characterToast;
        if (!toast) return;

        const iconEl = toast.querySelector('.toast-icon');
        const textEl = toast.querySelector('.toast-text');
        const costEl = toast.querySelector('.toast-cost');

        if (iconEl) iconEl.innerText = icon;
        if (textEl) textEl.innerText = text;
        if (costEl) costEl.innerText = costText;

        toast.classList.add('show');

        setTimeout(() => {
            toast.classList.remove('show');
        }, 2000);
    }

    showWaiterDialogue(upgradeIndex) {
        // 只在前5次升级显示对话
        if (upgradeIndex < 0 || upgradeIndex >= 5) return;

        const dialogues = [
            '都算在我身上吧；',
            '这点收入根本不够；',
            '我应该告诉过你快住手了吧；',
            '你真是满脑子都想着你自己呢；',
            '到底要我说几次你才懂啊？'
        ];

        const bubble = this.ui.waiterDialogue;
        if (!bubble) return;

        const textEl = bubble.querySelector('.bubble-text');
        if (textEl) textEl.innerText = dialogues[upgradeIndex];

        // 计算waiter的实际位置（考虑character.json中的配置）
        const waiterConfig = this.characterConfig.waiter || {};
        const waiterIdleX = waiterConfig.idle_x_px || 450;
        const waiterIdleY = waiterConfig.idle_y_px || 50;

        // waiter在右侧，CSS中使用：right: 0, bottom: waiterIdleY
        // 所以waiter的实际x位置（从右边）是 waiterIdleX
        // waiter的实际y位置（从底部）是 waiterIdleY
        // 气泡应该在waiter上方偏左一些
        const bubbleRight = waiterIdleX + 120; // 向左偏移
        const bubbleBottom = waiterIdleY + 550; // 在waiter上方（角色高度约85vh，这里估算为500px往上）

        bubble.style.right = `${bubbleRight}px`;
        bubble.style.bottom = `${bubbleBottom}px`;
        bubble.classList.remove('hidden');

        // 3秒后隐藏
        setTimeout(() => {
            bubble.classList.add('hidden');
        }, 5000);
    }

    updateCharacterSwaySpeed() {
        // 计算摇摆速度：金币 -9999~20 为基础速度（4s），金币 100 为最快速度（2s，即2倍速）
        let speedMultiplier = 1;
        
        if (this.coins <= 20) {
            // 低于等于20金币时，保持基础速度
            speedMultiplier = 1;
        } else if (this.coins >= 500) {
            // 500金币及以上，达到4倍速度
            speedMultiplier = 4;
        } else {
            // 20-500之间线性插值
            const progress = (this.coins - 20) / (500 - 20);
            speedMultiplier = 1 + progress * (4 - 1);
        }

        // 基础周期 4s，速度倍数越高周期越短
        const baseDuration = 4;
        const duration = baseDuration / speedMultiplier;

        // 应用到两个角色
        if (this.ui.characterBoss) {
            this.ui.characterBoss.style.setProperty('--sway-duration', `${duration}s`);
        }
        if (this.ui.characterWaiter) {
            this.ui.characterWaiter.style.setProperty('--sway-duration', `${duration}s`);
        }
    }

    buildLights() {
        this.ui.lightsContainer.innerHTML = '';
        for (let i = 0; i < this.reelCount; i++) {
            const lamp = document.createElement('div');
            lamp.className = 'lamp';
            this.ui.lightsContainer.appendChild(lamp);
        }
        this.ui.lights = document.querySelectorAll('.lamp');
    }

    buildReels() {
        const slotsContainer = document.querySelector('.slots-container');
        slotsContainer.innerHTML = '';
        slotsContainer.className = `slots-container reels-${this.reelCount}`;

        for (let i = 0; i < this.reelCount; i++) {
            const win = document.createElement('div');
            win.className = 'reel-window';
            const strip = document.createElement('div');
            strip.className = 'reel-strip';
            strip.id = `reel-${i}`;
            win.appendChild(strip);
            slotsContainer.appendChild(win);
        }

        const reelContainers = document.querySelectorAll('.reel-strip');
        this.reels = [];
        reelContainers.forEach((el, idx) => {
            this.reels.push(new Reel(el, idx, this.config, this.assets));
        });
    }

    async loadInitialReels() {
        try {
            const data = await initGame(this.reelCount);
            this.reels.forEach((r, i) => {
                if (data.reels?.[i]) r.updateItems(data.reels[i]);
            });
        } catch (err) {
            console.error('Init game failed', err);
        }
    }

    bindInput() {
        this.ui.btn.addEventListener('mousedown', () => this.handleInput());
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space') this.handleInput();
        });
    }

    bindShopButton() {
        const shopBtn = document.getElementById('shop-btn');
        const overlay = document.getElementById('shop-overlay');
        const closeBtn = document.getElementById('shop-close-btn');
        const buyCardBtn = document.getElementById('buy-card-btn');
        const buyReelBtn = document.getElementById('buy-reel-btn');
        const buyAdHackBtn = document.getElementById('buy-adhack-btn');

        // 从 shop.json 读取商品配置
        const getItemConfig = (itemId) => {
            return this.shopConfig.items?.find(item => item.id === itemId) || {};
        };

        if (!shopBtn) return;

        shopBtn.addEventListener('click', () => {
            if (this.phase !== 0) return;
            this.audioManager.playSfx('button_entry');
            this.updateShopUI();
            overlay.classList.remove('hidden');
        });

        closeBtn.addEventListener('click', () => {
            this.audioManager.playSfx('button_exit');
            overlay.classList.add('hidden');
        });

        buyCardBtn?.addEventListener('click', () => {
            const itemCfg = getItemConfig('random_card');
            const cost = itemCfg.cost || 5;
            if (this.gems >= cost) {
                if (this.inventory.length >= 5) {
                    this.ui.status.innerText = 'INVENTORY FULL';
                    setTimeout(() => this.ui.status.innerText = 'INSERT COIN', 2000);
                    return;
                }
                this.gems -= cost;
                const newCardType = this.pickRandomCardType();
                this.inventory.push(newCardType);
                this.renderCards();
                this.updateCurrencyUI();
                const def = this.getCardDef(newCardType);
                const shown = def?.name ? def.name : newCardType;
                this.ui.status.innerText = `BOUGHT ${shown}`;
                setTimeout(() => this.ui.status.innerText = 'INSERT COIN', 2000);
            } else {
                this.ui.status.innerText = 'NOT ENOUGH GEMS';
                setTimeout(() => this.ui.status.innerText = 'INSERT COIN', 2000);
            }
        });

        buyReelBtn?.addEventListener('click', () => {
            const itemCfg = getItemConfig('add_reel');
            const cost = itemCfg.cost || 50;
            if (this.reelCount >= 5) {
                this.ui.status.innerText = 'MAX REELS';
                setTimeout(() => this.ui.status.innerText = 'INSERT COIN', 2000);
                return;
            }
            if (this.gems >= cost) {
                this.gems -= cost;
                this.reelCount++;
                this.updateCurrencyUI();

                overlay.classList.add('hidden');
                const adOverlay = document.getElementById('ad-overlay');
                const adContent = adOverlay.querySelector('.ad-content');
                adContent.style.display = 'none';
                adOverlay.classList.remove('hidden');

                setTimeout(() => {
                    this.init();
                    setTimeout(() => {
                        adOverlay.classList.add('hidden');
                        adContent.style.display = 'flex';
                    }, 500);
                }, 500);
            } else {
                this.ui.status.innerText = 'NOT ENOUGH GEMS';
                setTimeout(() => this.ui.status.innerText = 'INSERT COIN', 2000);
            }
        });

        // 广告黑客购买
        buyAdHackBtn?.addEventListener('click', () => {
            if (this.adHackActive) {
                this.ui.status.innerText = 'ALREADY HACKED';
                setTimeout(() => this.ui.status.innerText = 'INSERT COIN', 2000);
                return;
            }
            const itemCfg = getItemConfig('ad_hack');
            const cost = itemCfg.cost || 20;
            if (this.gems >= cost) {
                this.gems -= cost;
                this.adHackActive = true;
                this.updateCurrencyUI();
                this.updateShopUI();
                this.ui.status.innerText = 'AD HACK ON!';
                setTimeout(() => this.ui.status.innerText = 'INSERT COIN', 2000);
            } else {
                this.ui.status.innerText = 'NOT ENOUGH GEMS';
                setTimeout(() => this.ui.status.innerText = 'INSERT COIN', 2000);
            }
        });
    }

    // 更新商店界面显示（根据配置和状态）
    updateShopUI() {
        const getItemConfig = (itemId) => {
            return this.shopConfig.items?.find(item => item.id === itemId) || {};
        };

        // 更新各商品的价格显示
        const cardCfg = getItemConfig('random_card');
        const reelCfg = getItemConfig('add_reel');
        const hackCfg = getItemConfig('ad_hack');

        const cardCost = document.querySelector('#buy-card-btn .shop-cost');
        const reelCost = document.querySelector('#buy-reel-btn .shop-cost');
        const hackCost = document.querySelector('#buy-adhack-btn .shop-cost');
        const hackBtn = document.getElementById('buy-adhack-btn');

        if (cardCost) cardCost.innerText = `${cardCfg.cost || 5} GEMS`;
        if (reelCost) reelCost.innerText = `${reelCfg.cost || 50} GEMS`;
        if (hackCost) hackCost.innerText = this.adHackActive ? 'ACTIVE' : `${hackCfg.cost || 20} GEMS`;
        if (hackBtn) {
            if (this.adHackActive) {
                hackBtn.classList.add('purchased');
            } else {
                hackBtn.classList.remove('purchased');
            }
        }
    }

    bindBetButtons() {
        const betBtns = document.querySelectorAll('.bet-btn');
        betBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                if (this.phase !== 0) return;
                this.audioManager.playSfx('button_entry');
                const betVal = parseInt(btn.dataset.bet, 10);
                if (!Number.isNaN(betVal)) {
                    this.currentBet = betVal;
                    betBtns.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                }
            });
        });
    }

    bindExitButton() {
        const exitBtn = document.getElementById('exit-btn');
        if (!exitBtn) return;
        exitBtn.addEventListener('click', () => {
            this.audioManager.playSfx('button_exit');
            // 逃跑卡：旋转中允许 EXIT 提前结算已进行的转轮
            const isSpinning = this.phase >= 1 && this.phase <= this.reelCount;
            const activeTypes = this.getActiveCardTypes();
            const canEscape = isSpinning && activeTypes.includes('escape');

            if (canEscape) {
                this.reels.forEach(r => r.stop());
                if (this.rigTimeout) clearTimeout(this.rigTimeout);

                // 进入“等待全部锁定后结算”的阶段
                this.phase = this.reelCount + 1;
                this.ui.btn.innerText = '...';
                this.ui.btn.disabled = true;
                this.ui.status.innerText = 'SETTLING...';
                this.ui.status.style.color = '#FFECB3';
                this.updateLights();
                return;
            }

            // 默认：直接中止本次旋转（并消耗已选择的卡）
            if (isSpinning) {
                this.reels.forEach(r => r.stop());
                if (this.rigTimeout) clearTimeout(this.rigTimeout);
                this.audioManager.stopReelSound();

                this.phase = 0;
                this.ui.btn.innerText = 'SPIN';
                this.ui.btn.disabled = false;
                this.ui.status.innerText = 'ABORTED!';
                this.ui.status.style.color = '#D32F2F';
                this.ui.cardsContainer.classList.remove('locked');

                this.activeCards.sort((a, b) => b - a).forEach(idx => {
                    this.inventory.splice(idx, 1);
                });
                this.activeCards = [];
                this.renderCards();
                this.updateLights();
            }
        });
    }

    getCardDefs() {
        return this.cardConfig?.cards || {
            slow: { name: '冷眼', description: '冷眼：降低转轮速度', probability: 20, icon_path: 'image/card/card_slow.png' },
            double: { name: '双倍', description: '双倍：提升本次收益', probability: 10, icon_path: 'image/card/card_double.png' }
        };
    }

    getCardDef(cardType) {
        return this.getCardDefs()?.[cardType] || null;
    }

    pickRandomCardType() {
        const defs = this.getCardDefs();
        const entries = Object.entries(defs);
        if (!entries.length) return 'slow';

        const weights = entries.map(([_, def]) => {
            const raw = def?.probability;
            const w = Number(raw);
            return Number.isFinite(w) && w > 0 ? w : 0;
        });

        const total = weights.reduce((a, b) => a + b, 0);
        if (total <= 0) return entries[0][0];

        let r = Math.random() * total;
        for (let i = 0; i < entries.length; i++) {
            r -= weights[i];
            if (r <= 0) return entries[i][0];
        }
        return entries[entries.length - 1][0];
    }

    getActiveCardTypes() {
        return this.activeCards.map(idx => this.inventory[idx]).filter(Boolean);
    }

    bindAdButton() {
        const adBtn = document.getElementById('ad-btn');
        const overlay = document.getElementById('ad-overlay');
        const video = document.getElementById('ad-video');
        const closeBtn = document.getElementById('ad-close-btn');
        const timerDisplay = document.getElementById('ad-timer');

        if (!adBtn) return;

        adBtn.addEventListener('click', async () => {
            if (this.phase !== 0) return;

            const files = this.assets?.ad_videos || [];
            const adBase = this.assets?.base_paths?.ad || 'ad/video/';
            if (!files.length) {
                this.ui.status.innerText = 'NO ADS';
                setTimeout(() => this.ui.status.innerText = 'INSERT COIN', 2000);
                return;
            }
            const randomFile = files[Math.floor(Math.random() * files.length)];
            const resolvedAd = /^(https?:)?\//.test(randomFile) ? randomFile : `${adBase}${randomFile}`;

            overlay.classList.remove('hidden');
            closeBtn.classList.add('hidden');
            video.src = resolvedAd;
            video.loop = true; // 循环播放
            this.audioManager.playSfx('button_entry');
            
            // 根据广告黑客状态调整播放速度和时长
            const baseSec = this.adConfig.ad_sec || 15;
            const hackSec = this.adConfig.ad_hack_sec || 5;
            const baseCoins = this.adConfig.ad_coin || 10;
            const hackMultiplier = this.adConfig.ad_hack_coin_multiplier || 2;
            
            let timeLeft, rewardCoins;
            if (this.adHackActive) {
                timeLeft = hackSec;
                rewardCoins = baseCoins * hackMultiplier;
                video.playbackRate = baseSec / hackSec; // 加速播放产生喜剧效果
            } else {
                timeLeft = baseSec;
                rewardCoins = baseCoins;
                video.playbackRate = 1.0;
            }
            
            video.play().catch(e => console.error('Video play failed:', e));
            timerDisplay.innerText = timeLeft;

            const timer = setInterval(() => {
                timeLeft--;
                timerDisplay.innerText = timeLeft;
                if (timeLeft <= 0) {
                    clearInterval(timer);
                    closeBtn.classList.remove('hidden');
                    closeBtn.innerText = `CLOSE (+${rewardCoins} COINS)`;
                    timerDisplay.innerText = '';
                }
            }, 1000);

            const closeHandler = () => {
                overlay.classList.add('hidden');
                video.pause();
                video.src = '';
                video.playbackRate = 1.0;
                this.audioManager.playSfx('button_exit');
                this.coins += rewardCoins;
                this.updateCurrencyUI();
                // 不弹出 alert，改用状态栏显示
                this.ui.status.innerText = `+${rewardCoins} COINS!`;
                setTimeout(() => this.ui.status.innerText = 'INSERT COIN', 2000);
                closeBtn.removeEventListener('click', closeHandler);
            };

            closeBtn.addEventListener('click', closeHandler);
        });
    }

    renderCards() {
        this.ui.cardsContainer.innerHTML = '';
        const cardBase = this.assets?.base_paths?.card || 'image/card/';
        const defaults = this.cardConfig?.defaults || {};
        const defaultFontFamily = defaults.font_family;
        const defaultFontSize = defaults.font_size_px;

        this.inventory.forEach((cardType, index) => {
            const slot = document.createElement('div');
            slot.className = `card-slot has-card ${this.activeCards.includes(index) ? 'active' : ''}`;

            const def = this.getCardDef(cardType);

            const img = document.createElement('img');
            const fromConfig = def?.icon_path;
            const cardFile = this.assets?.card_images?.[cardType];
            const cardSrc = fromConfig
                ? fromConfig
                : (cardFile ? `${cardBase}${cardFile}` : `${cardBase}card_${cardType}.png`);
            img.src = cardSrc;
            img.className = 'card-img';
            img.onerror = () => { img.style.display = 'none'; slot.innerText = cardType; };
            slot.appendChild(img);

            const desc = document.createElement('div');
            desc.className = 'card-desc';
            desc.innerText = def?.description || cardType;
            const fontFamily = def?.font_family || defaultFontFamily;
            const fontSize = def?.font_size_px || defaultFontSize;
            if (fontFamily) desc.style.fontFamily = fontFamily;
            if (fontSize) desc.style.fontSize = `${fontSize}px`;
            slot.appendChild(desc);

            slot.addEventListener('click', () => {
                if (this.phase !== 0) return;
                if (this.activeCards.includes(index)) {
                    this.activeCards = this.activeCards.filter(i => i !== index);
                } else {
                    this.activeCards.push(index);
                }
                this.audioManager.playSfx('card_select');
                this.renderCards();
            });

            this.ui.cardsContainer.appendChild(slot);
        });

        for (let i = this.inventory.length; i < 5; i++) {
            const emptySlot = document.createElement('div');
            emptySlot.className = 'card-slot empty';
            this.ui.cardsContainer.appendChild(emptySlot);
        }
    }

    updateCurrencyUI() {
        if (this.ui.coinCount) this.ui.coinCount.innerText = this.coins;
        if (this.ui.gemCount) this.ui.gemCount.innerText = this.gems;
        this.audioManager.updateBgmByCoins(this.coins);
        this.updateCharacterSwaySpeed();
    }

    tick() {
        let anyStopped = false;
        this.reels.forEach(r => {
            const stopped = r.update();
            if (stopped) anyStopped = true;
        });

        if (this.phase > 0 && this.phase < 4) {
            const blink = Math.floor(Date.now() / 200) % 2 === 0;
            const activeIndex = this.phase - 1;
            if (this.ui.lights[activeIndex]) {
                if (blink) this.ui.lights[activeIndex].classList.add('active');
                else this.ui.lights[activeIndex].classList.remove('active');
            }
        }

        if (this.phase === this.reelCount + 1 && this.reels.every(r => r.state === 'locked')) {
            // 全部转轮锁定，触发加剧震动特效
            this.audioManager.stopReelSound();
            this.audioManager.playSfx('all_locked');
            this.effectsController.onAllReelsLocked();
            this.evaluateWin();
        }

        requestAnimationFrame(this.tick);
    }

    handleInput() {
        if (this.phase === 0) {
            this.startSpin();
        } else if (this.phase >= 1 && this.phase <= this.reelCount) {
            const reelIndexToStop = this.phase - 1;
            this.reels[reelIndexToStop].stop();

            // 触发单个转轮锁定特效
            this.effectsController.onReelLock(reelIndexToStop, this.reelCount);
            this.audioManager.playSfx('lock');

            this.phase++;
            this.updateLights();

            // 检测是否是最后一个转轮
            const isLastReel = reelIndexToStop === this.reelCount - 1;

            if (!isLastReel) {
                this.rigTimeout = setTimeout(() => this.rigNextReel(reelIndexToStop), 50);
            } else {
                // 最后一个转轮锁定时，立即停止转轮声音
                this.audioManager.stopReelSound();
                this.ui.btn.innerText = '...';
                this.ui.btn.disabled = true;
                // 全部转轮锁定特效会在 tick 中检测到全部 locked 后触发
            }
        } else if (this.phase === this.reelCount + 2) {
            this.reset();
        }
    }

    async startSpin() {
        this.audioManager.playSfx('button_entry');
        if (this.coins < this.currentBet) {
            this.ui.status.innerText = 'NO COINS!';
            this.ui.status.style.color = '#FF5252';
            this.ui.coinCount.style.color = 'red';
            setTimeout(() => this.ui.coinCount.style.color = '#FFECB3', 500);
            return;
        }

        // 角色滑开让出游戏机视角
        this.setCharactersSpinMode(true);

        this.coins -= this.currentBet;
        this.updateCurrencyUI();
        this.ledController.setMode('red', 500);

        // 本次旋转使用的卡片类型（用于“下一次旋转”效果）
        this.currentSpinCardTypes = this.getActiveCardTypes();
        this.currentSpinBombMultiplier = this.currentSpinCardTypes.includes('bomb') ? 2 : 1;

        let speedMultiplier = 1;
        this.activeCards.forEach(idx => {
            const cardType = this.inventory[idx];
            if (cardType === 'slow') speedMultiplier = 0.5;
        });

        const originalSpeed = this.config.scroll_speed;
        this.config.scroll_speed = Math.max(3, originalSpeed * speedMultiplier);

        this.ui.btn.disabled = true;

        try {
            const data = await initGame(this.reelCount, { bombMultiplier: this.currentSpinBombMultiplier });
            let maxSpinSpeed = 0;
            this.reels.forEach((r, i) => {
                if (data.reels?.[i]) r.updateItems(data.reels[i], data.svg_defs);
                let baseSpeed = Math.floor(Math.random() * (30 - 5 + 1)) + 5;
                let finalSpeed = Math.max(3, baseSpeed * speedMultiplier);
                maxSpinSpeed = Math.max(maxSpinSpeed, finalSpeed);
                r.start(finalSpeed);
            });

            if (maxSpinSpeed > 0) {
                const rate = this.computeReelPlaybackRate(maxSpinSpeed);
                this.audioManager.startReelSound(rate);
            }

            this.phase = 1;
            this.ui.btn.disabled = false;
            this.ui.btn.innerText = 'STOP';
            this.ui.status.innerText = 'GOOD LUCK!';
            this.ui.status.style.color = '#FFECB3';

            this.spinCount++;
            this.updateLights();
            this.ui.cardsContainer.classList.add('locked');
        } catch (err) {
            console.error('Start spin failed:', err);
            this.ui.btn.disabled = false;
            this.ui.btn.innerText = 'SPIN';
            this.ui.status.innerText = 'ERROR';
            this.coins += this.currentBet;
            this.updateCurrencyUI();
        }
    }

    async rigNextReel(stoppedReelIndex) {
        const nextReelIdx = stoppedReelIndex + 1;
        if (nextReelIdx >= this.reels.length) return;

        // 收集所有已锁定转轮（0 到 stoppedReelIndex）的结果
        const lockedResults = [];
        for (let i = 0; i <= stoppedReelIndex; i++) {
            lockedResults.push(this.reels[i].getResult());
        }

        try {
            // 传递所有已锁定的符号，后端会把每个符号各插入到新strip的一个位置
            const data = await generateReel(lockedResults, { bombMultiplier: this.currentSpinBombMultiplier });
            this.reels[nextReelIdx].updateItems(data.strip);
            console.log(`Rigged Reel ${nextReelIdx} to favor [${lockedResults.join(', ')}]`);
        } catch (err) {
            console.error('Rig reel failed', err);
        }
    }

    updateLights() {
        this.ui.lights.forEach((l, idx) => {
            if (idx < this.phase - 1) {
                l.classList.add('active');
            } else {
                l.classList.remove('active');
            }
        });
    }

    evaluateWin() {
        this.phase = this.reelCount + 2;
        this.ui.btn.disabled = true;
        this.audioManager.stopReelSound();

        let results = this.reels.map(r => r.getResult());
        console.log('Raw Result:', results);

        const possibleSymbols = ['coin_1', 'coin_stack', 'gem_1', 'bomb_1'];
        results = results.map(s => {
            if (s === 'random_item') {
                const revealed = possibleSymbols[Math.floor(Math.random() * possibleSymbols.length)];
                console.log('Random revealed as:', revealed);
                return revealed;
            }
            return s;
        });

        const reward = this.calculateReward(results);

        // 提现卡：本次旋转结束时返还投入金币
        const usedCashout = this.currentSpinCardTypes.includes('cashout');
        if (usedCashout) {
            this.coins += this.currentBet;
        }

        if (reward.restart) {
            this.ui.status.innerText = 'CARD OVERLOAD! RESTART';
            this.ui.status.style.color = '#FFB300';
            setTimeout(() => this.reset(), 2000);
            return;
        }

        let multiplier = 1;
        this.activeCards.forEach(idx => {
            if (this.inventory[idx] === 'double') multiplier *= 2;
        });

        const betMultiplier = this.currentBet / 5;
        multiplier *= betMultiplier;

        reward.coins *= multiplier;
        reward.gems *= multiplier;

        // 护盾卡：若本次结算为扣除金币，则抵消这次扣除并视为 NICE TRY
        const usedShield = this.currentSpinCardTypes.includes('shield');
        let shieldedLoss = false;
        if (usedShield && reward.coins < 0) {
            reward.coins = 0;
            shieldedLoss = true;
        }

        this.activeCards.sort((a, b) => b - a).forEach(idx => {
            this.inventory.splice(idx, 1);
        });
        this.activeCards = [];
        this.renderCards();

        this.coins += reward.coins;
        this.gems += reward.gems;

        if (reward.newCard) {
            if (this.inventory.length < 5) {
                const newCardType = this.pickRandomCardType();
                this.inventory.push(newCardType);
                this.renderCards();
                this.ui.status.innerText = `GET CARD: ${newCardType.toUpperCase()}!`;
                this.ui.status.style.color = '#FFB300';
            }
        }

        this.updateCurrencyUI();

        // 检测是否全部转轮结果一样（大奖/Jackpot）
        const isExactMatch = results[0] && results.every(s => s === results[0]);

        if (reward.coins > 0 || reward.gems > 0) {
            this.playCoinSfx(reward.coins);
            this.audioManager.playGemSfx(reward.gems);
            let msg = 'WIN: ';
            if (reward.coins > 0) msg += `${reward.coins} COINS `;
            if (reward.gems > 0) msg += `${reward.gems} GEMS`;
            this.ui.status.innerText = msg;
            this.ui.status.style.color = '#FF5252';
            this.flashLights();

            // 发射器喷射金币和宝石
            this.effectsController.onWin(reward.coins, reward.gems);

            // 如果全部一样，额外喷出金属火花
            if (isExactMatch) {
                this.effectsController.onJackpot();
                this.audioManager.playSfx('jackpot');
            }
        } else if (shieldedLoss) {
            this.ui.status.innerText = 'NICE TRY!';
            this.ui.status.style.color = '#FFECB3';
        } else if (reward.coins < 0) {
            this.ui.status.innerText = `BOOM! ${reward.coins} COINS`;
            this.ui.status.style.color = '#FFFFFF';
            this.ledController.setMode('red', 2000);
        } else if (!reward.newCard) {
            this.ui.status.innerText = 'NICE TRY!';
            this.ui.status.style.color = '#FFECB3';
        }

        setTimeout(() => {
            this.reset();
        }, 1000);
    }

    calculateReward(symbols) {
        let totalCoins = 0;
        let totalGems = 0;
        let newCard = false;
        let restart = false;

        // 从 symbol-values.json 读取符号数值；缺失时用内置默认兜底
        const fallbackSymbols = {
            coin_1: { type: 'coin', coins: 5, gems: 0 },
            coin_stack: { type: 'coin', coins: 10, gems: 0 },
            coin_pile: { type: 'coin', coins: 20, gems: 0 },
            gem_1: { type: 'gem', coins: 0, gems: 330 },
            gem_many: { type: 'gem', coins: 0, gems: 333 },
            bomb_1: { type: 'bomb', coins: -10, gems: 0 },
            bomb_atom: { type: 'bomb', coins: -20, gems: 0 },
            card_item: { type: 'card', coins: 0, gems: 0 },
            random_item: { type: 'random', coins: 0, gems: 0 }
        };
        const symbolMap = this.symbolValues?.symbols || fallbackSymbols;

        symbols.forEach(s => {
            const data = symbolMap[s];
            if (!data) return;

            if (data.type === 'card') {
                newCard = true;
                return;
            }

            totalCoins += Number(data.coins || 0);
            totalGems += Number(data.gems || 0);
        });

        const types = symbols.map(s => symbolMap[s]?.type);
        const isSameCategory = types[0] && types.every(t => t === types[0]);
        const isExactMatch = symbols[0] && symbols.every(s => s === symbols[0]);

        if (isSameCategory) {
            this.ledController.setMode('fast', 3000);
            const type = types[0];
            if (type === 'coin') {
                if (isExactMatch) totalCoins *= 3;
                else totalCoins *= 2;
            } else if (type === 'gem') {
                totalGems *= 3;
            } else if (type === 'bomb') {
                if (isExactMatch) {
                    if (symbols[0] === 'bomb_atom') {
                        totalCoins = 888;
                    } else {
                        totalCoins = 20;
                    }
                } else {
                    totalCoins = 20;
                }
            } else if (type === 'card') {
                restart = true;
            }
        }

        return { coins: totalCoins, gems: totalGems, newCard, restart };
    }

    playCoinSfx(amount) {
        if (!amount || amount <= 0) return;
        if (amount <= 10) {
            this.audioManager.playSfx('coin_small');
        } else if (amount <= 50) {
            this.audioManager.playSfx('coin_mid');
        } else {
            this.audioManager.playSfx('coin_big');
        }
    }

    computeReelPlaybackRate(speed) {
        return Math.min(3, Math.max(0.5, speed / 10));
    }

    reset() {
        this.phase = 0;
        this.ui.cardsContainer.classList.remove('locked');
        this.ui.btn.disabled = false;
        this.ui.btn.innerText = 'SPIN';
        this.ui.status.innerText = 'INSERT COIN';
        this.ui.status.style.color = '#FFECB3';
        this.audioManager.stopReelSound();
        
        // 角色滑回原位
        this.setCharactersSpinMode(false);
    }

    flashLights() {
        let count = 0;
        const interval = setInterval(() => {
            this.ui.lights.forEach(l => l.classList.toggle('active'));
            count++;
            if (count > 10) clearInterval(interval);
        }, 200);
    }
}

export default SlotMachine;
