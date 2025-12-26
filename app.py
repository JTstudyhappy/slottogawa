from flask import Flask, send_from_directory, jsonify, request
import os
import json
import random

app = Flask(__name__)
# 设置根目录为当前文件所在目录
ROOT_DIR = os.path.dirname(os.path.abspath(__file__))

# ---------------------------------------------------------
#  SVG 资源定义 (已废弃，改用图片)
# ---------------------------------------------------------
# SVG_DEFS = { ... }

# 权重默认值（可被 symbol-weights.json 覆盖）
DEFAULT_WEIGHTS = {
    "coin_1": 25,
    "coin_stack": 10,
    "coin_pile": 5,
    "gem_1": 15,
    "gem_many": 5,
    "bomb_1": 15,
    "bomb_atom": 5,
    "card_item": 10,
    "random_item": 5
}

# ---------------------------------------------------------
#  老虎机核心逻辑 (Backend Logic)
# ---------------------------------------------------------

def load_config():
    """
    读取根目录下的 config.json
    """
    config_path = os.path.join(ROOT_DIR, 'config.json')
    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"Error: Config file not found at {config_path}")
        return None


def load_symbol_weights():
    """读取 symbol-weights.json，返回 {symbol: weight}；失败则回退默认值。"""
    weights_path = os.path.join(ROOT_DIR, 'symbol-weights.json')
    data = None
    try:
        with open(weights_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except FileNotFoundError:
        return DEFAULT_WEIGHTS.copy()
    except Exception as e:
        print(f"Error: Failed to load symbol-weights.json: {e}")
        return DEFAULT_WEIGHTS.copy()

    symbols = (data or {}).get('symbols', {})
    merged = DEFAULT_WEIGHTS.copy()

    # 允许只覆盖部分符号；未知符号也允许加入
    for sym, cfg in symbols.items():
        if not isinstance(cfg, dict):
            continue
        raw = cfg.get('probability', cfg.get('weight', None))
        try:
            w = float(raw)
        except (TypeError, ValueError):
            continue
        if w < 0:
            continue
        merged[sym] = w

    # 如果所有权重都为 0，则回退默认值，避免 random.choices 异常
    if sum(float(v) for v in merged.values() if isinstance(v, (int, float))) <= 0:
        return DEFAULT_WEIGHTS.copy()

    return merged

def generate_weighted_strip(length=6, bias_symbols=None, bomb_multiplier=1.0):
    """
    生成一个转轮的符号列表
    :param length: 列表长度
    :param bias_symbols: 需要偏向的符号列表 (Rigging)，例如 ['coin_1', 'gem_1']
                         会把列表中每个符号各插入一次到strip中
    :param bomb_multiplier: 炸弹权重倍率
    """
    weights_map = load_symbol_weights()

    # 炸弹卡：对 bomb 类符号权重做倍率调整
    try:
        bm = float(bomb_multiplier)
    except (TypeError, ValueError):
        bm = 1.0
    if bm < 0:
        bm = 1.0
    if bm != 1.0:
        if 'bomb_1' in weights_map:
            weights_map['bomb_1'] = float(weights_map['bomb_1']) * bm
        if 'bomb_atom' in weights_map:
            weights_map['bomb_atom'] = float(weights_map['bomb_atom']) * bm
    population = list(weights_map.keys())
    weights = list(weights_map.values())
    
    # 1. 随机生成基础列表
    strip = random.choices(population, weights=weights, k=length)
    
    # 2. 如果有偏向符号列表 (Rigging Logic)
    # 把 bias_symbols 中的每个符号，各替换到 strip 的一个随机位置
    if bias_symbols and len(bias_symbols) > 0:
        # 逐个插入偏向符号
        for bias_sym in bias_symbols:
            # 找出所有不在 bias_symbols 列表中的位置（避免覆盖已插入的偏向符号）
            available_indices = [i for i, sym in enumerate(strip) if sym not in bias_symbols]
            if available_indices:
                replace_idx = random.choice(available_indices)
                strip[replace_idx] = bias_sym
                
    return strip


def get_reel_strip_length():
    """从 config.json 获取每个转轮的图案数量（strip 长度）。"""
    config = load_config() or {}
    length = config.get('reel_strip_length', 6)
    try:
        length = int(length)
    except (TypeError, ValueError):
        length = 6
    return max(3, length)

# ---------------------------------------------------------
#  Web Server Routes
# ---------------------------------------------------------

@app.route('/api/init-game')
def init_game():
    """初始化游戏，返回初始转轮数据"""
    # 获取请求中的 reel_count，默认为 3
    try:
        reel_count = int(request.args.get('reel_count', 3))
    except ValueError:
        reel_count = 3

    try:
        bomb_multiplier = float(request.args.get('bomb_multiplier', 1.0))
    except ValueError:
        bomb_multiplier = 1.0
        
    strip_length = get_reel_strip_length()
    # 生成对应数量的转轮，完全随机
    reels = [generate_weighted_strip(length=strip_length, bomb_multiplier=bomb_multiplier) for _ in range(reel_count)]
    return jsonify({
        "reels": reels
    })

@app.route('/api/generate-reel')
def generate_reel():
    """
    生成单个转轮数据 (用于动态更新)
    Query Params:
    - bias_symbols: 偏向符号列表，逗号分隔 (可选)，例如 "coin_1,gem_1"
    - bomb_multiplier: 炸弹权重倍率 (可选)
    """
    bias_symbols_raw = request.args.get('bias_symbols', '')
    # 解析逗号分隔的符号列表
    bias_symbols = [s.strip() for s in bias_symbols_raw.split(',') if s.strip()]

    try:
        bomb_multiplier = float(request.args.get('bomb_multiplier', 1.0))
    except ValueError:
        bomb_multiplier = 1.0

    strip_length = get_reel_strip_length()
    strip = generate_weighted_strip(
        length=strip_length,
        bias_symbols=bias_symbols if bias_symbols else None,
        bomb_multiplier=bomb_multiplier,
    )
    return jsonify({"strip": strip})

@app.route('/api/get-ad-videos')
def get_ad_videos():
    """获取广告视频列表"""
    video_dir = os.path.join(ROOT_DIR, 'ad', 'video')
    if not os.path.exists(video_dir):
        return jsonify([])
    
    files = [f for f in os.listdir(video_dir) if f.lower().endswith(('.mp4', '.webm', '.ogg'))]
    return jsonify(files)

@app.route('/')
def index():
    """主页路由"""
    return send_from_directory(ROOT_DIR, 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    """
    通用静态文件路由
    处理: config.json, js/*.js, css/*.css 等
    """
    return send_from_directory(ROOT_DIR, path)

if __name__ == '__main__':
    porter = 5000 
    print("---------------------------------------")
    print(" 🎰 老虎机服务器启动中...")
    print(f" 👉 请访问: http://127.0.0.1:{porter}")
    print("---------------------------------------")
    app.run(debug=True, port=porter, use_reloader=False)