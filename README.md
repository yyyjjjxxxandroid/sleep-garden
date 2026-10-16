# 眠境花园

面向“今晚，和音乐一起睡个好觉”课题的声音疗愈花园 Demo。

当前主线是：当下状态推荐 + 音乐与自然声 + 会回应触摸的小猫 + 不打扰的睡前收尾。推荐使用本机规则与明确反馈，不接入 AI 模型。3D 花园作为沉浸式视觉层，视障用户的无障碍交互作为重点设计支线。

## 打开体验

- 电脑：用浏览器打开 `index.html`。
- 手机：将 `index.html` 保存到手机，选择「用浏览器打开」。如果手机只能预览本地文件，可将 `index.html` 发布为网页，再用手机浏览器访问网页链接。

打开后可直接点「听听今晚的音乐」，也可选「思绪很多 / 想被陪伴 / 有点困了」。可选设置支持环境、耳机和开始前感受；播放中可进入低亮度听音或一分钟呼吸引导。定时后安静结束，感受可以下次补记。

当前网页版切后台或锁屏会暂停，低亮度界面仅支持前台听音。产品定位、赛题映射、演示流程与待验证指标见 [比赛产品方案](./比赛产品方案.md)。

## 源码结构

- `source.html`：页面结构和产品交互
- `garden-personalization.js`：可解释推荐与有效反馈统计
- `garden-experience.js` / `garden-experience.css`：今晚状态、低亮度听音、呼吸与感受回访
- `story-world.js`：当前绘本风格 Three.js 世界
- `world-base.js`：3D 场景基础能力
- `story-cat.js`：陪伴宠物模型和动画
- `story-detail.js` / `story-atmosphere.js`：场景细节与氛围
- `assets3d-v2/`：Quaternius Stylized Nature MegaKit 的本地模型资源
- `audio/`：六条 CC0 自然实录、一条可选背景音乐、来源与质量报告
- `garden-audio.js`：手势后初始化的 Web Audio 混音、淡入淡出、循环边缘修复和中断同步
- `build3d.py`：重新打包离线单文件 HTML
- `index.html`：可直接演示的打包产物

## 修改源码后重新构建（开发者使用）

修改源码后，使用 Node.js、esbuild 和 Python 3 重新生成 `index.html`：

```bash
npm install
npm run build
```

重新下载并处理声音素材（需要 FFmpeg 和网络）：

```bash
python3 scripts/update_audio_assets.py
python3 scripts/check_audio_assets.py
```

## 测试与验收

第二轮修复、浏览器回归方法与验证边界见 [测试与优化记录](./测试与优化记录.md)。

## 协作

分工建议见 [`团队分工.md`](./团队分工.md)。所有功能先在自己的分支开发，通过 Pull Request 合并到 `main`，不要直接改动他人的模块。
