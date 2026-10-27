# 手机性能优化验证 · 2026-10-27

手机原先承担桌面级实时阴影、倒影和模型复杂度。当前通过像素预算、倒影节流、静态合批、空间裁剪、植物远景低模及小猫毛发预算减少每帧工作。城市小猫也传入设备画质，避免城市继续使用完整桌面毛发。

## 最终验证

- `npm test`：255 项通过，0 失败。
- `npm run build`：成功，单文件 `index.html` 约 8.05 MB。
- `tests/browser-performance.mjs`：花园、泉州、广州、深圳的静止与旋转共 8 组场景，无浏览器异常。
- `tests/browser-mobile.mjs`：单指旋转、双指放大/缩小、手势不误触行走、点击可行走区域、人物抵达，以及 320/390/844/1440 宽度布局；另外验证广州、深圳使用手机预算且步道可达。

最终性能采样使用 Apple M5 Pro、Chrome Metal GPU，模拟 390×844、触屏、设备 DPR 3；实际 3D 渲染 DPR 1。每组预热后采样约 3.5 秒，包含倒影绘制。测量在独立浏览器进行，没有同时运行单元测试。

| 场景 | 静止 FPS | 转动 FPS | 转动帧间隔 P95 | 转动平均渲染调用耗时 |
| --- | ---: | ---: | ---: | ---: |
| 花园 | 60.0 | 60.0 | 17.4ms | 7.9ms |
| 泉州 | 60.0 | 60.0 | 17.5ms | 7.7ms |
| 广州 | 60.0 | 60.0 | 17.5ms | 8.7ms |
| 深圳 | 60.0 | 60.0 | 17.6ms | 8.1ms |

花园静止绘制调用约 338 次、约 48 万三角形。此前保存的基线约 925 次、218 万三角形，绘制调用减少约 63%，三角形减少约 78%。基线来自较早的浏览器会话，帧率受环境变化影响，不用它推算真机提速比例。原始结果和截图在 `build/product-qa/performance-final*.json/png`，手势结果在 `build/product-qa/mobile-results.json`。

这些是电脑模拟结果，不是 iPhone/Android 实机结果，也未覆盖长时间发热降频或系统来电。清晰度与流畅度的取舍包括手机不显示实时投影、远处植物简化、毛发密度降低，低帧率时还会降低渲染分辨率；近处植物恢复完整模型。

## 复现

启动服务和开启 CDP 端口 9558 的独立 Chrome 后，分别运行（不要并行，以免干扰性能采样）：

```bash
PORT=8770 npm run start:lan
GARDEN_PLAYWRIGHT=/absolute/path/to/playwright/index.mjs GARDEN_PERF_LABEL=final node tests/browser-performance.mjs
GARDEN_PLAYWRIGHT=/absolute/path/to/playwright/index.mjs GARDEN_URL=http://127.0.0.1:8770/index.html node tests/browser-mobile.mjs
```

如使用其他服务端口或 CDP 端口，可通过 `GARDEN_URL`、`GARDEN_CDP` 覆盖。修改自然素材后运行 `node scripts/build-nature-lod.mjs` 更新低模，再运行 `npm run build`。
