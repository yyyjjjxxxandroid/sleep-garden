# 眠境花园

面向“今晚，和音乐一起睡个好觉”课题的声音疗愈花园 Demo。

当前主线是：AI 宠物陪伴 + 个性化疗愈声景 + 可持续的花园记录。3D 花园作为沉浸式视觉层，视障用户的无障碍交互作为重点设计支线。

## 快速运行

直接用支持 WebGL 的现代浏览器打开 `index.html`，或在项目目录运行：

```bash
python3 -m http.server 8765
```

然后打开 <http://127.0.0.1:8765/index.html>。

## 源码结构

- `source.html`：页面结构和产品交互
- `story-world.js`：当前绘本风格 Three.js 世界
- `world-base.js`：3D 场景基础能力
- `story-cat.js`：陪伴宠物模型和动画
- `story-detail.js` / `story-atmosphere.js`：场景细节与氛围
- `assets3d-v2/`：Quaternius Stylized Nature MegaKit 的本地模型资源
- `audio/`：本地 Demo 音效
- `build3d.py`：重新打包离线单文件 HTML
- `index.html`：可直接演示的打包产物

## 构建

需要 Node.js 和 esbuild：

```bash
npm install
npm run build
```

## 协作

分工建议见 [`团队分工.md`](./团队分工.md)。所有功能先在自己的分支开发，通过 Pull Request 合并到 `main`，不要直接改动他人的模块。

