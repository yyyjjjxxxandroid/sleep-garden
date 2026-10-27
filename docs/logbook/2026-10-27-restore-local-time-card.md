# 恢复左下角时间看板

## 原因与修复

`f3b5e41` 引入的 `.pet-life-enabled .local-environment{display:none}` 随宠物模块初始化一直生效，压过时间看板自身的显示逻辑，所以首次打开和刷新也看不到时间。

移除这条全局隐藏规则，并用 `npm run build` 同步 `index.html`。沿用 main 的浏览器原生离线打包方式，`world3d.bundle.js` 无差异。未修改计时、暂停、声音、宠物或记录逻辑。

时间看板继续使用原有策略：首次具备显示条件时短暂展示约8秒，整点或定位变化时可再次展示；弹窗、城市、低亮度、后台和可用空间不足时隐藏。本次不是改为常驻时钟。

## 验证

- 独立分支基于 `origin/main` 的 `388e0e7`，没有混入原工作区的 AI 接入与其他未提交内容。
- `npm run build` 成功；`npm test`：261通过、0失败、0跳过。单测需允许监听本机 HTTP 测试端口。
- `git diff --check` 通过。
- 同类规则检查：源码 CSS 中仅发现这条因启用宠物而隐藏时间看板的规则；弹窗等有意避让规则保留。
- 用户处理定位提示后，ego 同一验证空间继续回归。`tests/browser-local-time-card.mjs` 在修复页7项检查通过：宠物初始化后的 computed style、实际时间文本、设置弹窗避让、390×844和320×640的显示及边界。
- 最终浏览器脚本对照基线 HTML 时，在“The initialized pet module does not remove the time card”断言处失败，实际 display=none、petEnabled=true；修复页通过。
- 已查看1440×1000、390×844和320×640实际页面截图，时间/日期/城市/天气清楚可见，没有与开始面板重叠。截图固定了临时页面的 is-visible 展示态，目的是避免控制工具延迟错过短暂提示；不把它当作自然显示时长证据，也没有延长产品的提示时间。
- 八秒淡出、整点/地点变化和可见性策略由已通过的 `tests/garden-environment.test.cjs` 验证。尝试过浏览器虚拟时间，但它干扰加载，已弃用；最终回归使用同一空间的新标签页和正常浏览器时间。

## 复用经验

跨模块样式应避免用“模块已初始化”这种常驻 class 隐藏独立信息组件。显示组件已有自己的生命周期和避让条件，应保留其控制权；视觉回归需要检查最终 computed style，不能只检查 DOM 节点或 is-visible class。
