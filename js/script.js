/**
 * 老虎机游戏入口文件
 * 
 * 负责加载所有配置文件并初始化 SlotMachine 实例。
 * 配置文件包括：
 * - config.json: 游戏核心参数（转轮速度、物理参数等）
 * - asset.json: 资源路径映射
 * - symbol-values.json: 符号奖励数值
 * - card.json: 卡片道具定义
 * - anime.json: 动画特效参数
 * - ad.json: 广告系统配置
 * - shop.json: 商店配置
 * - character.json: 角色配置
 * - music.json: 音频配置
 * 
 * @module script
 */

import { fetchAdConfig, fetchAnimeConfig, fetchCardConfig, fetchCharacterConfig, fetchConfig, fetchMusicConfig, fetchShopConfig, fetchSymbolValues, fetchSymbolWeights } from './api.js';
import SlotMachine from './slot-machine.js';

/**
 * 加载静态资源配置
 * @returns {Promise<Object>} 资源配置对象
 */
const loadAssets = () => fetch('asset.json').then(res => {
    if (!res.ok) throw new Error('Failed to load asset.json');
    return res.json();
});

window.addEventListener('DOMContentLoaded', () => {
    Promise.all([
        fetchConfig(), 
        loadAssets(), 
        fetchSymbolValues(), 
        fetchCardConfig(), 
        fetchAnimeConfig(),
        fetchAdConfig(),
        fetchShopConfig(),
        fetchCharacterConfig(),
        fetchMusicConfig(),
        fetchSymbolWeights()
    ])
        .then(([config, assets, symbolValues, cardConfig, animeConfig, adConfig, shopConfig, characterConfig, musicConfig, symbolWeights]) => 
            new SlotMachine(config, assets, symbolValues, cardConfig, animeConfig, adConfig, shopConfig, characterConfig, musicConfig))
        .catch(err => {
            console.error(err);
            const status = document.getElementById('status-text');
            if (status) status.innerText = 'CONFIG/ASSET ERROR';
        });
});
