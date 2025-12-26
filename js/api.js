/**
 * API 请求模块
 * 
 * 提供所有配置文件的加载函数。
 * 游戏核心逻辑（转轮生成）已迁移到 reel-generator.js，
 * 使项目可以在 Netlify 等纯静态托管平台运行。
 * 
 * @module api
 */

/**
 * 将 fetch Response 转换为 JSON，失败时抛出错误
 * @param {Response} response - fetch 响应对象
 * @returns {Promise<Object>} 解析后的 JSON 数据
 * @throws {Error} 请求失败时抛出带状态码的错误
 */
const toJson = async (response) => {
    if (!response.ok) {
        const error = new Error(`Request failed: ${response.status}`);
        error.response = response;
        throw error;
    }
    return response.json();
};

/* ========== 配置文件加载 ========== */

/** 加载游戏核心配置 (转轮速度、物理参数等) */
export const fetchConfig = () => fetch('config.json').then(toJson);

/** 加载符号奖励数值表 */
export const fetchSymbolValues = () => fetch('symbol-values.json').then(toJson);

/** 加载卡片道具定义 */
export const fetchCardConfig = () => fetch('card.json').then(toJson);

/** 加载动画特效参数 */
export const fetchAnimeConfig = () => fetch('anime.json').then(toJson);

/** 加载广告系统配置 */
export const fetchAdConfig = () => fetch('ad.json').then(toJson);

/** 加载商店配置 */
export const fetchShopConfig = () => fetch('shop.json').then(toJson);

/** 加载角色配置 */
export const fetchCharacterConfig = () => fetch('character.json').then(toJson);

/** 加载音频配置 */
export const fetchMusicConfig = () => fetch('music.json').then(toJson);

/* ========== 游戏核心逻辑（前端实现） ========== */

// 从 reel-generator.js 重新导出，保持 API 兼容性
export { initGame, generateReel } from './reel-generator.js';
