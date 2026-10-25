# 场景联动音效

这两条音效由本 Demo 的 Web Audio 原创合成，未使用 AI 生成或第三方录音。Fal 账户额度不足，因此采用本地实现。

- 猫咪脚步声（footsteps）：仅在小猫实际移动时，按行走距离触发轻柔、低通处理的草叶摩擦短音；停止或暂停时不触发。
- 风铃声（chime）：种植区栅栏旁的五管竹木风铃。低音基频叠加快速衰减的非整数泛音，随风速调整触发疏密，音量独立调节。无风或暂停时不触发。

分类按声源互斥划分：自然声、小猫声、花园物件声、背景音乐。每条声音只出现一次，声音名称均以“声”结尾。

后续可替换的生成提示词：

- 猫咪脚步声：Small kitten walking slowly on soft garden grass. Very quiet padded paw landings and delicate grass friction, relaxed natural gait. Isolated close foley, no human footsteps, collar bells, voices, music, meows or purring.
- 风铃声：A small five-tube bamboo wind chime in a gentle garden breeze. Sparse irregular warm hollow wooden knocks, soft rounded attacks and natural short resonant decays, quiet space between strikes. No bright metal ringing, melody, music, voices or background ambience.
