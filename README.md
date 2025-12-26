# 🎰 老虎机游戏

一款基于 Web 的老虎机游戏，采用纯静态 JavaScript 架构（原 Flask 后端逻辑已移植到前端，支持静态部署）。

## 📁 项目结构

```
老虎机_大全/
├── index.html             # 游戏主页面
├── app.py                 # (可选) 本地开发用的 Python 服务器
├── requirements.txt       # (可选) Python 依赖
│
├── *.json                 # 配置文件（见下方详细说明）
│
├── js/                    # JavaScript 模块
│   ├── script.js          # 入口文件，加载配置并初始化游戏
│   ├── slot-machine.js    # 核心游戏控制器
│   ├── reel.js            # 单个转轮物理引擎
│   ├── effects-controller.js  # 视觉特效（震动、发光、粒子）
│   ├── led-controller.js  # LED 边框灯动画
│   └── api.js             # API 请求封装
│
├── css/                   # 样式文件
│   ├── style.css          # 主样式入口（导入其他CSS）
│   ├── base.css           # 基础样式和布局
│   ├── cabinet.css        # 老虎机柜体样式
│   ├── cards.css          # 卡片道具样式
│   ├── controls.css       # 控制面板样式
│   ├── led.css            # LED 灯珠样式
│   └── overlays.css       # 弹窗覆盖层样式
│
├── image/                 # 图片资源
│   ├── card/              # 卡片图标
│   └── reel_pic/          # 转轮符号图片
│
└── ad/video/              # 广告视频文件
```

---

## ⚙️ 配置文件说明

### `config.json` - 游戏核心配置
```json
{
  "speed": 50,           // 转轮基础速度（像素/帧）
  "tension": 120,        // 弹簧张力系数（用于停止动画）
  "friction": 14,        // 摩擦力系数
  "initial_coins": 20    // 初始金币数量
}
```

### `symbol-values.json` - 符号奖励数值
定义每种符号的奖励倍率：
```json
{
  "symbols": {
    "cherry": 2,
    "lemon": 3,
    "orange": 4,
    "plum": 5,
    "bell": 8,
    "bar": 15,
    "seven": 30,
    "diamond": 50,
    "wild": 0,   // Wild 符号可替代其他符号
    "bomb": -1   // 炸弹符号扣除金币
  }
}
```

### `card.json` - 卡片道具配置
定义可购买的卡片及其效果：
```json
{
  "cards": [
    {
      "id": "bias_cherry",
      "name": "樱桃偏向",
      "cost": 10,
      "effect": { "bias_symbol": "cherry", "duration": 3 }
    }
  ]
}
```

### `anime.json` - 动画特效参数
```json
{
  "shake_intensity": 5,      // 震动强度
  "shake_duration": 300,     // 震动持续时间(ms)
  "glow_intensity": 2,       // 发光强度
  "coin_scale": 0.8,         // 金币粒子缩放
  "particle_rate": 25        // 粒子发射速率（个/秒）
}
```

### `character.json` - 角色配置
```json
{
  "waiter": {
    "image": "image/waiter.png",
    "upgrade_levels": [50, 150, 300, 500],  // 升级所需金币
    "voices": ["voice_1.mp3", "voice_2.mp3", ...]
  }
}
```

### `music.json` - 音频配置
```json
{
  "bgm": {
    "tier1": "music/bgm_1.mp3",   // 金币 ≤50
    "tier2": "music/bgm_2.mp3",   // 金币 51-150
    "tier3": "music/bgm_3.mp3",   // 金币 151-300
    "tier4": "music/bgm_4.mp3"    // 金币 >300 或结局
  },
  "sfx": {
    "spin": "sfx/spin.mp3",
    "win": "sfx/win.mp3",
    "coin": "sfx/coin.mp3"
  }
}
```

### `shop.json` - 商店配置
定义商店物品及价格。

### `ad.json` - 广告配置
定义广告视频路径和观看奖励。

### `asset.json` - 资源路径映射
定义符号图片路径等静态资源。

---

## 🎮 核心模块说明

### `SlotMachine` (slot-machine.js)
游戏主控制器，负责：
- 游戏状态管理（idle/spinning/result/ending）
- 金币计数和奖励计算
- UI 交互绑定
- 角色系统（服务员升级、对话气泡）
- 卡片系统（购买、激活、效果应用）
- 音频系统（BGM 分层、SFX、语音）
- 广告系统和商店系统

### `Reel` (reel.js)
单个转轮的物理模拟：
- 弹簧-阻尼模型实现平滑停止
- 公式：`force = displacement × tension / 100`
- 支持偏向符号的服务端请求

### `EffectsController` (effects-controller.js)
视觉特效控制：
- 屏幕震动效果
- 发光边框效果
- 金币粒子系统（GPU 友好的 transform3d）

### `LedController` (led-controller.js)
LED 边框灯效果：
- 自动适配容器宽高比
- 三种模式：normal（流动）、red（闪烁）、fast（快速）

---

## 🚀 启动方式

### 静态部署 (推荐)
本项目已完全静态化，可以直接部署到 Netlify, GitHub Pages, Vercel 等平台。
只需将根目录作为网站根目录即可。

### 本地开发
可以使用 Python 启动简单的静态文件服务：
```bash
python -m http.server 8000
```
或者继续使用 `app.py` (但前端逻辑已改为本地执行，不再依赖后端 API)。

### 访问游戏
打开浏览器访问 `http://localhost:8000`

---

## 🔧 后端 API (已本地化)

原 `/api/generate-reel` 等接口逻辑已移植到 `js/api.js` 中，在浏览器端直接执行。
这意味着游戏不再依赖 Python 后端，可以离线运行（只要静态资源加载完成）。

### 逻辑说明
- **initGame**: 根据 `config.json` 和 `symbol-weights.json` 在本地生成初始转轮数据。
- **generateReel**: 在本地进行加权随机生成，支持 `bias_symbols` (偏向) 和 `bomb_multiplier` (炸弹倍率) 逻辑。

---

## 🎵 音频系统

### BGM 分层机制
根据当前金币数量自动切换背景音乐：
| 金币范围 | BGM |
|---------|-----|
| ≤50 | bgm_1.mp3 |
| 51-150 | bgm_2.mp3 |
| 151-300 | bgm_3.mp3 |
| >300 或结局 | bgm_4.mp3 |

### 音量控制
- 主音量：控制 BGM 和 SFX
- 语音音量：独立控制服务员语音

---

## 🎭 角色系统

### 服务员升级
服务员根据总金币数自动升级，共5个等级：
- 每个等级有不同外观
- 每个等级有专属语音和对话内容
- 升级时播放对应语音和显示对话气泡

### 角色动画
服务员摇摆速度根据金币数动态调整：
| 金币范围 | 速度倍率 |
|---------|---------|
| ≤20 | 1x |
| 21-100 | 2x |
| 101-500 | 3x |
| >500 | 4x |

---

## 🏆 结局系统

当金币达到指定数量时触发游戏结局：
1. BGM 锁定为 bgm_4
2. 播放结局音效 (sound_6.mp3)
3. 显示恭喜覆盖层
4. 禁用所有游戏操作

---

## 📝 开发说明

### 代码规范
- 使用 ES6 模块化
- 类使用 JSDoc 注释
- CSS 按功能模块拆分

### 文件约定
- 图片资源放入 `image/` 对应子目录
- 音频文件放入 `music/` 或 `sfx/` 目录
- 广告视频放入 `ad/video/` 目录

---

## 📄 许可证

MIT License
