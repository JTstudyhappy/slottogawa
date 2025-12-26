/**
 * API 请求模块 (静态化版本)
 * 
 * 提供所有配置文件的加载函数和本地模拟的后端逻辑。
 * 为了支持 Netlify 静态部署，原 Python 后端逻辑已移植到此模块。
 * 
 * @module api
 */

const toJson = async (response) => {
    if (!response.ok) {
        const error = new Error(`Request failed: ${response.status}`);
        error.response = response;
        throw error;
    }
    return response.json();
};

// 缓存配置，用于本地逻辑生成
let cachedConfig = null;
let cachedSymbolWeights = null;

const DEFAULT_WEIGHTS = {
    "coin_1": 25,
    "coin_stack": 10,
    "coin_pile": 5,
    "gem_1": 15,
    "gem_many": 5,
    "bomb_1": 15,
    "bomb_atom": 5,
    "card_item": 10,
    "random_item": 5
};

/* ========== 配置文件加载 ========== */

/** 加载游戏核心配置 (转轮速度、物理参数等) */
export const fetchConfig = () => fetch('config.json').then(toJson).then(data => {
    cachedConfig = data;
    return data;
});

/** 加载符号权重配置 (用于本地生成逻辑) */
export const fetchSymbolWeights = () => fetch('symbol-weights.json').then(toJson).then(data => {
    cachedSymbolWeights = data;
    return data;
}).catch(() => {
    console.warn('Failed to load symbol-weights.json, using defaults');
    cachedSymbolWeights = { symbols: DEFAULT_WEIGHTS };
    return cachedSymbolWeights;
});

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

/* ========== 本地逻辑模拟后端 ========== */

/**
 * 生成加权随机转轮条带
 */
const generateWeightedStrip = (length = 6, biasSymbols = [], bombMultiplier = 1.0) => {
    // 1. 获取权重配置
    let weightsMap = { ...DEFAULT_WEIGHTS };
    if (cachedSymbolWeights && cachedSymbolWeights.symbols) {
        // 合并配置中的权重
        Object.assign(weightsMap, cachedSymbolWeights.symbols);
    }

    // 2. 应用炸弹倍率
    const bm = parseFloat(bombMultiplier) || 1.0;
    if (bm !== 1.0) {
        if (weightsMap['bomb_1']) weightsMap['bomb_1'] *= bm;
        if (weightsMap['bomb_atom']) weightsMap['bomb_atom'] *= bm;
    }

    // 3. 准备随机池
    const population = Object.keys(weightsMap);
    const weights = Object.values(weightsMap);
    
    // 辅助函数：加权随机选择
    const weightedRandom = () => {
        const total = weights.reduce((a, b) => a + b, 0);
        let r = Math.random() * total;
        for (let i = 0; i < population.length; i++) {
            r -= weights[i];
            if (r <= 0) return population[i];
        }
        return population[population.length - 1];
    };

    // 4. 生成基础列表
    const strip = [];
    for (let i = 0; i < length; i++) {
        strip.push(weightedRandom());
    }

    // 5. 插入偏向符号 (Rigging)
    if (biasSymbols && biasSymbols.length > 0) {
        const biases = Array.isArray(biasSymbols) ? biasSymbols : [biasSymbols];
        biases.forEach(biasSym => {
            const availableIndices = [];
            for(let i=0; i<strip.length; i++) {
                if(strip[i] !== biasSym) availableIndices.push(i);
            }
            if (availableIndices.length > 0) {
                const replaceIdx = availableIndices[Math.floor(Math.random() * availableIndices.length)];
                strip[replaceIdx] = biasSym;
            }
        });
    }

    return strip;
};

const getReelStripLength = () => {
    return (cachedConfig && cachedConfig.reel_strip_length) ? parseInt(cachedConfig.reel_strip_length) : 6;
};

/* ========== API 接口 (本地实现) ========== */

/**
 * 初始化游戏 (本地生成)
 * @param {number} reelCount - 转轮数量
 * @param {Object} options - 可选参数
 * @returns {Promise<Object>} 初始化结果
 */
export const initGame = async (reelCount, options = {}) => {
    const stripLength = getReelStripLength();
    const reels = [];
    for (let i = 0; i < reelCount; i++) {
        reels.push(generateWeightedStrip(stripLength, [], options.bombMultiplier));
    }
    return Promise.resolve({ reels });
};

/**
 * 生成转轮符号序列 (本地生成)
 * @param {string[]} biasSymbols - 偏向符号数组
 * @param {Object} options - 可选参数
 * @returns {Promise<Object>} 包含 strip 数组的响应
 */
export const generateReel = async (biasSymbols = [], options = {}) => {
    const stripLength = getReelStripLength();
    const strip = generateWeightedStrip(stripLength, biasSymbols, options.bombMultiplier);
    return Promise.resolve({ strip });
};
