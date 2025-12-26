/**
 * 转轮符号生成器（前端实现）
 * 
 * 将原 app.py 的 generate_weighted_strip 逻辑移植到前端，
 * 使项目可以在 Netlify 等纯静态托管平台运行。
 * 
 * 核心功能：
 * - 根据权重随机生成符号序列
 * - 支持偏向符号（Rigging）机制
 * - 支持炸弹权重倍率调整
 * 
 * @module reel-generator
 */

// 默认符号权重（与 symbol-weights.json 一致）
const DEFAULT_WEIGHTS = {
    coin_1: 30,
    coin_stack: 7.5,
    coin_pile: 2.5,
    gem_1: 17.5,
    gem_many: 2.5,
    bomb_1: 15,
    bomb_atom: 5,
    card_item: 10,
    random_item: 5
};

// 缓存加载的权重配置
let cachedWeights = null;

/**
 * 加载符号权重配置
 * @returns {Promise<Object>} 权重映射表 {symbol: weight}
 */
async function loadSymbolWeights() {
    if (cachedWeights) {
        return { ...cachedWeights };
    }

    try {
        const response = await fetch('symbol-weights.json');
        if (!response.ok) {
            throw new Error('Failed to load symbol-weights.json');
        }
        const data = await response.json();
        const symbols = data?.symbols || {};
        const merged = { ...DEFAULT_WEIGHTS };

        // 允许只覆盖部分符号；未知符号也允许加入
        for (const [sym, cfg] of Object.entries(symbols)) {
            if (typeof cfg !== 'object') continue;
            const raw = cfg.probability ?? cfg.weight ?? null;
            const w = parseFloat(raw);
            if (isNaN(w) || w < 0) continue;
            merged[sym] = w;
        }

        // 如果所有权重都为 0，则回退默认值
        const totalWeight = Object.values(merged).reduce((sum, v) => sum + (typeof v === 'number' ? v : 0), 0);
        if (totalWeight <= 0) {
            cachedWeights = { ...DEFAULT_WEIGHTS };
            return { ...cachedWeights };
        }

        cachedWeights = merged;
        return { ...cachedWeights };
    } catch (err) {
        console.warn('Failed to load symbol-weights.json, using defaults:', err);
        cachedWeights = { ...DEFAULT_WEIGHTS };
        return { ...cachedWeights };
    }
}

/**
 * 根据权重随机选择一个符号
 * @param {string[]} population - 符号列表
 * @param {number[]} weights - 对应权重列表
 * @returns {string} 选中的符号
 */
function weightedChoice(population, weights) {
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    let random = Math.random() * totalWeight;
    
    for (let i = 0; i < population.length; i++) {
        random -= weights[i];
        if (random <= 0) {
            return population[i];
        }
    }
    
    // 兜底返回最后一个
    return population[population.length - 1];
}

/**
 * 根据权重随机选择多个符号
 * @param {string[]} population - 符号列表
 * @param {number[]} weights - 对应权重列表
 * @param {number} k - 选择数量
 * @returns {string[]} 选中的符号数组
 */
function weightedChoices(population, weights, k) {
    const result = [];
    for (let i = 0; i < k; i++) {
        result.push(weightedChoice(population, weights));
    }
    return result;
}

/**
 * 生成一个转轮的符号列表
 * 
 * @param {Object} options - 生成选项
 * @param {number} [options.length=6] - 列表长度
 * @param {string[]} [options.biasSymbols=[]] - 偏向符号列表（Rigging），
 *        会把列表中每个符号各插入一次到 strip 中
 * @param {number} [options.bombMultiplier=1.0] - 炸弹权重倍率
 * @returns {Promise<string[]>} 生成的符号数组
 */
export async function generateWeightedStrip(options = {}) {
    const {
        length = 6,
        biasSymbols = [],
        bombMultiplier = 1.0
    } = options;

    // 加载权重配置
    const weightsMap = await loadSymbolWeights();

    // 炸弹卡：对 bomb 类符号权重做倍率调整
    let bm = parseFloat(bombMultiplier);
    if (isNaN(bm) || bm < 0) {
        bm = 1.0;
    }
    if (bm !== 1.0) {
        if (weightsMap.bomb_1 !== undefined) {
            weightsMap.bomb_1 = weightsMap.bomb_1 * bm;
        }
        if (weightsMap.bomb_atom !== undefined) {
            weightsMap.bomb_atom = weightsMap.bomb_atom * bm;
        }
    }

    const population = Object.keys(weightsMap);
    const weights = Object.values(weightsMap);

    // 1. 随机生成基础列表
    const strip = weightedChoices(population, weights, length);

    // 2. 如果有偏向符号列表 (Rigging Logic)
    // 把 biasSymbols 中的每个符号，各替换到 strip 的一个随机位置
    if (biasSymbols && biasSymbols.length > 0) {
        for (const biasSym of biasSymbols) {
            // 找出所有不在 biasSymbols 列表中的位置（避免覆盖已插入的偏向符号）
            const availableIndices = strip
                .map((sym, idx) => ({ sym, idx }))
                .filter(({ sym }) => !biasSymbols.includes(sym))
                .map(({ idx }) => idx);

            if (availableIndices.length > 0) {
                const replaceIdx = availableIndices[Math.floor(Math.random() * availableIndices.length)];
                strip[replaceIdx] = biasSym;
            }
        }
    }

    return strip;
}

/**
 * 获取转轮条带长度配置
 * @returns {Promise<number>} 条带长度
 */
export async function getReelStripLength() {
    try {
        const response = await fetch('config.json');
        if (!response.ok) {
            return 6;
        }
        const config = await response.json();
        const length = parseInt(config.reel_strip_length, 10);
        return isNaN(length) ? 6 : Math.max(3, length);
    } catch {
        return 6;
    }
}

/**
 * 生成单个转轮数据（兼容原 API 接口）
 * 
 * @param {string[]} biasSymbols - 偏向符号数组
 * @param {Object} options - 可选参数
 * @param {number} [options.bombMultiplier=1.0] - 炸弹权重倍率
 * @returns {Promise<{strip: string[]}>} 与原 API 格式一致的响应
 */
export async function generateReel(biasSymbols = [], options = {}) {
    const length = await getReelStripLength();
    const strip = await generateWeightedStrip({
        length,
        biasSymbols,
        bombMultiplier: options.bombMultiplier ?? 1.0
    });
    return { strip };
}

/**
 * 初始化游戏，生成多个转轮（兼容原 API 接口）
 * 
 * @param {number} reelCount - 转轮数量
 * @param {Object} options - 可选参数
 * @param {number} [options.bombMultiplier=1.0] - 炸弹权重倍率
 * @returns {Promise<{reels: string[][]}>} 与原 API 格式一致的响应
 */
export async function initGame(reelCount = 3, options = {}) {
    const length = await getReelStripLength();
    const reels = [];
    
    for (let i = 0; i < reelCount; i++) {
        const strip = await generateWeightedStrip({
            length,
            bombMultiplier: options.bombMultiplier ?? 1.0
        });
        reels.push(strip);
    }
    
    return { reels };
}
