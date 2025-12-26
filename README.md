# 🎰 老虎机游戏

一款基于 Web 的老虎机游戏，采用纯前端架构，可直接部署到 Netlify 等静态托管平台。

## 🚀 在线部署

### Netlify 部署步骤

1. **将项目推送到 GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/你的用户名/你的仓库名.git
   git push -u origin main
   ```

2. **在 Netlify 部署**
   - 登录 [Netlify](https://www.netlify.com/)
   - 点击 "Add new site" → "Import an existing project"
   - 选择 GitHub 并授权
   - 选择你的仓库
   - 构建设置保持默认（无需构建命令）
   - 点击 "Deploy site"

3. **完成！** 几分钟后即可通过 Netlify 分配的域名访问游戏

### 本地预览（可选）

如果需要本地预览，可以使用任意静态服务器：

```bash
# 使用 Python
python -m http.server 5000

# 或使用 Node.js
npx serve -p 5000

# 或使用 VS Code Live Server 插件
```

访问 `http://localhost:5000`

---

## 📁 项目结构

```
老虎机_大全/
├── index.html             # 游戏主页面
│
├── *.json                 # 配置文件（见下方详细说明）
│
├── js/                    # JavaScript 模块
│   ├── script.js          # 入口文件，加载配置并初始化游戏
│   ├── slot-machine.js    # 核心游戏控制器
│   ├── reel.js            # 单个转轮物理引擎
│   ├── reel-generator.js  # 转轮符号生成器（前端实现）
│   ├── effects-controller.js  # 视觉特效（震动、发光、粒子）
│   ├── led-controller.js  # LED 边框灯动画
│   └── api.js             # 配置加载封装
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
  "initial_coins": 20,   // 初始金币数量
  "reel_strip_length": 6 // 每个转轮的符号数量
}
```

### `symbol-weights.json` - 符号权重配置
控制各符号出现的相对概率：
```json
{
  "symbols": {
    "coin_1": { "weight": 30 },
    "coin_stack": { "weight": 7.5 },
    "gem_1": { "weight": 17.5 },
    "bomb_1": { "weight": 15 }
  }
}
```

### `symbol-values.json` - 符号奖励数值
定义每种符号的奖励倍率：
```json
{
  "symbols": {
    "cherry": 2,
    "seven": 30,
    "diamond": 50,
    "wild": 0,
    "bomb": -1
  }
}
```

### `card.json` - 卡片道具配置
定义可购买的卡片及其效果。

### `anime.json` - 动画特效参数
```json
{
  "shake_intensity": 5,
  "shake_duration": 300,
  "glow_intensity": 2,
  "coin_scale": 0.8,
  "particle_rate": 25
}
```

### `character.json` - 角色配置
服务员升级等级、语音和对话内容。

### `music.json` - 音频配置
BGM 分层和音效路径配置。

### `shop.json` - 商店配置
商店物品及价格。

### `ad.json` - 广告配置
广告视频路径和观看奖励。

### `asset.json` - 资源路径映射
符号图片路径等静态资源。

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

### `Reel` (reel.js)
单个转轮的物理模拟：
- 弹簧-阻尼模型实现平滑停止
- 公式：`force = displacement × tension / 100`

### `ReelGenerator` (reel-generator.js)
转轮符号生成器（纯前端实现）：
- 根据权重随机生成符号序列
- 支持偏向符号（Rigging）机制
- 支持炸弹权重倍率调整

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

### 架构特点
- **纯静态部署**：无需后端服务器，可直接部署到 CDN
- **ES6 模块化**：使用原生 JavaScript 模块
- **前端符号生成**：原 Flask 后端逻辑已迁移到 `reel-generator.js`

### 文件约定
- 图片资源放入 `image/` 对应子目录
- 音频文件放入 `music/` 或 `sfx/` 目录
- 广告视频放入 `ad/video/` 目录

### 本地开发（可选）
如果需要使用原 Flask 后端进行开发：
```bash
pip install flask
python app.py
```

---

## 📄 许可证

MIT License
