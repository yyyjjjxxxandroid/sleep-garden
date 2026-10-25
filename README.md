# 眠境花园

面向“音乐 × AI 陪伴”的音乐疗愈花园 Demo。

当前主线是：对小猫说一句需求 → AI 提出音乐、自然声、城市/花园与小猫动作安排 → 用户采用后执行 → 经用户确认保存声音与场景偏好。首页状态按钮仍使用本机规则，AI 对话则实际调用配置的模型；未接入时明确显示不可用。3D 花园与广州、深圳、泉州漫游作为陪伴空间。

## 启动 AI 小猫

```bash
cp .env.example .env
npm start
```

打开 <http://127.0.0.1:8766/index.html>，点击“和小猫说说”。默认 `.env.example` 选择 `gpt-5.6-sol`，并在服务端读取本机 `~/.codex/config.toml` 当前选中 provider 的独立 API Token。需要该服务本身可访问且支持这个模型；不读取或复用 ChatGPT/OAuth 登录凭证。此方式适合本机演示，其他电脑需要自行配置服务。

也可设置 `AI_USE_CODEX_PROVIDER=false`，填写 `AI_BASE_URL`、`AI_API_KEY`、`AI_MODEL`。Responses 接口用 `AI_WIRE_API=responses`；兼容 Chat Completions 的平台用 `AI_WIRE_API=chat`。凭证不进入浏览器、不进入构建产物，`.env` 已被 Git 忽略。切勿把 Key 填进 HTML、截图或提交记录。

本地服务仅监听 loopback。独立部署需要另外接入服务端凭证、用户认证及额度管理，不要将当前开发服务直接暴露到公网。

示例：“今天有点累，不想聊天，陪我去深圳湾坐一会儿，风声轻一点。”点击“就这样陪我”采用安排，再点“听听这段”开启播放，以满足手机浏览器的用户手势要求。已有播放中的同场景只调整混音，不重置计时。

偏好只在点击“把这个偏好记住”后保存，可随时清除；对话仅留在当前页面，清空/刷新后移除。发送时，当前消息、最近 8 条成功对话、当前场景/声景与确认偏好会发送至配置的 AI 服务。服务端不存储对话，Responses 请求使用 `store:false`；上游服务仍遵循其自身数据政策。

当前曲库只有一首已授权 Lo-fi 和六种自然/陪伴录音；AI 可以编排混音，不能检索或切换不存在的歌曲。没有 AI 作曲、自动情绪识别或睡眠检测。

## 离线打开体验

- 电脑：用浏览器打开 `index.html`。
- 手机：将 `index.html` 保存到手机，选择「用浏览器打开」。如果手机只能预览本地文件，可将 `index.html` 发布为网页，再用手机浏览器访问网页链接。

打开后可直接点「听听今晚的音乐」，也可选「思绪很多 / 想被陪伴 / 有点困了」。可选设置支持环境、耳机和开始前感受；播放中可进入低亮度听音或一分钟呼吸引导。定时后安静结束，感受可以下次补记。

当前网页版切后台或锁屏会暂停，低亮度界面仅支持前台听音。产品定位、赛题映射、演示流程与待验证指标见 [比赛产品方案](./比赛产品方案.md)。

## 源码结构

- `server.mjs` / `ai-service.mjs`：本地静态服务、服务端凭证读取与真实模型请求
- `companion-plan.js`：前后端共用的动作白名单与音量校验
- `ai-companion.js` / `ai-companion.css`：小猫文字对话、采用安排与确认偏好
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
