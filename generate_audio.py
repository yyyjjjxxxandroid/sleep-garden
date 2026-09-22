"""Generate original procedural prototype sounds. No external recordings or API keys.

Outputs are preview assets; index.html synthesizes the same sound families locally
so the mobile HTML remains a single portable file.
"""
from pathlib import Path
import json
import wave
import numpy as np
def lowpass(noise, coefficient):
    result = np.empty_like(noise)
    previous = 0.0
    for i, sample in enumerate(noise):
        previous += coefficient * (sample - previous)
        result[i] = previous
    return result

ROOT = Path(__file__).resolve().parent / "audio"
ROOT.mkdir(exist_ok=True)
SR = 32000
DURATION = 16
t = np.arange(SR * DURATION) / SR
rng = np.random.default_rng(20260917)
names = {
    "sun": "01-阳光暖调氛围",
    "wind": "02-风拂树叶",
    "rain": "03-花园细雨",
    "bugs": "04-远处虫鸣",
    "cat": "05-猫咪呼噜",
    "water": "06-池塘流水",
}
stats = {}
for kind, name in names.items():
    channels = []
    for ch in range(2):
        noise = rng.uniform(-1, 1, t.size)
        low = lowpass(noise, .014)
        low2 = lowpass(noise, .25)
        if kind == "rain":
            signal = (.45 * noise + .55 * low2) * .3 * (.87 + .13 * np.sin(2 * np.pi * t / 8))
        elif kind == "wind":
            signal = low * 2.2 * (.6 + .22 * np.sin(2 * np.pi * t / 8) + .12 * np.sin(2 * np.pi * t / 16))
        elif kind == "water":
            signal = low2 * .16 + np.sin(2 * np.pi * (430*t+4*np.sin(2*np.pi*t/2))) * .015 * (1+np.sin(2*np.pi*t/4))
        elif kind == "cat":
            breath = .5 + .5 * np.sin(2*np.pi*t/4)
            signal = (np.sin(2*np.pi*52*t)*.55 + np.sin(2*np.pi*104*t)*.16 + low*2) * (.25+.75*(.5+.5*np.sin(2*np.pi*26*t))**2) * (.3+.7*breath)*.19
        elif kind == "bugs":
            phrase = np.maximum(0, np.sin(2*np.pi*t/4+ch*1.2))**3
            pulse = np.maximum(0, np.sin(2*np.pi*13*t))**5
            signal = (np.sin(2*np.pi*(2600+ch*187.5)*t)+.22*np.sin(2*np.pi*3700*t))*phrase*pulse*.075
        else:
            signal = (np.sin(2*np.pi*174*t)+.55*np.sin(2*np.pi*261*t)+.3*np.sin(2*np.pi*348*t))*.04*(.7+.3*np.sin(2*np.pi*t/8))
        edge = np.minimum(1, np.minimum(t/.03, (DURATION-t)/.03))
        channels.append(signal * edge)
    stereo = np.column_stack(channels)
    pcm = (np.clip(stereo, -1, 1)*32767).astype("<i2")
    target = ROOT / f"{name}.wav"
    with wave.open(str(target), "wb") as stream:
        stream.setnchannels(2)
        stream.setsampwidth(2)
        stream.setframerate(SR)
        stream.writeframes(pcm.tobytes())
    stats[name] = {"seconds": DURATION, "sample_rate": SR, "channels": 2,
                   "peak": round(float(np.max(np.abs(stereo))), 5),
                   "rms": round(float(np.sqrt(np.mean(stereo**2))), 5),
                   "file": target.name}
print(json.dumps(stats, ensure_ascii=False, indent=2))
