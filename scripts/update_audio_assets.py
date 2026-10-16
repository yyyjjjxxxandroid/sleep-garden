#!/usr/bin/env python3
"""Download the approved CC0 field recordings and build seamless web loops."""
from __future__ import annotations

import json
import argparse
import math
import re
import shutil
import subprocess
import tempfile
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
AUDIO = ROOT / "audio"
MANIFEST = AUDIO / "sources.json"


def require(name: str) -> str:
    value = shutil.which(name)
    if not value:
        raise SystemExit(f"Missing required executable: {name}")
    return value


def download(url: str, destination: Path) -> None:
    request = urllib.request.Request(url, headers={"User-Agent": "SleepGarden/1.0"})
    with urllib.request.urlopen(request, timeout=180) as response, destination.open("wb") as output:
        shutil.copyfileobj(response, output)


def render(ffmpeg: str, source: Path, destination: Path, item: dict) -> None:
    start = float(item["start"])
    duration = float(item["loopDuration"])
    fade = float(item["crossfade"])
    end = duration + fade
    probe = subprocess.run([require('ffprobe'), '-v', 'error', '-show_entries', 'format=duration', '-of', 'json', str(source)], capture_output=True, text=True, check=True)
    available = float(json.loads(probe.stdout)['format']['duration'])
    if not 0 < fade < duration or start + end > available + .01:
        raise ValueError(f"{item['file']}: crossfade needs {start + end:.3f}s, source has {available:.3f}s")
    filters = (
        f"[0:a]atrim=start={start}:end={start + end},asetpts=PTS-STARTPTS,"
        f"highpass=f={item['highpass']},lowpass=f={item['lowpass']},aresample=44100[base];"
        "[base]asplit=3[head0][body0][tail0];"
        f"[head0]atrim=start=0:end={fade},asetpts=PTS-STARTPTS[head];"
        f"[body0]atrim=start={fade}:end={duration},asetpts=PTS-STARTPTS[body];"
        f"[tail0]atrim=start={duration}:end={end},asetpts=PTS-STARTPTS[tail];"
        f"[tail][head]acrossfade=d={fade}:c1=tri:c2=tri[seam];"
        "[seam][body]concat=n=2:v=0:a=1[loop]"
    )
    # Measure once, then use a fixed gain so normalization cannot alter the
    # circular seam. Limiter latency compensation preserves the first samples.
    measured = subprocess.run([ffmpeg, '-hide_banner', '-i', str(source), '-filter_complex', filters + f";[loop]loudnorm=I={item['loudness']}:TP=-9:LRA=7:print_format=json[out]", '-map', '[out]', '-f', 'null', '-'], capture_output=True, text=True, check=True)
    stats = json.loads(re.findall(r'\{[^{}]+\}', measured.stderr)[-1])
    gain = min(float(item['loudness']) - float(stats['input_i']), -10 - float(stats['input_tp']))
    if not math.isfinite(gain):
        raise ValueError('Non-finite loudness measurement')
    filters += f";[loop]volume={gain}dB,alimiter=limit=0.316:level=false:latency=true[out]"
    subprocess.run(
        [
            ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-i", str(source),
            "-filter_complex", filters, "-map", "[out]", "-ar", "44100", "-b:a", "96k",
            "-metadata", f"title={item['title']}",
            "-metadata", f"artist={item['creator']}",
            "-metadata", "license=CC0 1.0",
            "-metadata", f"source={item['sourcePage']}",
            str(destination),
        ],
        check=True,
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--only', nargs='+', help='Rebuild selected manifest keys')
    parser.add_argument('--source-dir', type=Path, help='Reuse raw downloads named <key>.mp3')
    args = parser.parse_args()
    ffmpeg = require("ffmpeg")
    manifest = json.loads(MANIFEST.read_text())
    if args.only and set(args.only) - manifest.keys():
        parser.error('Unknown audio key')
    with tempfile.TemporaryDirectory(prefix="sleep-garden-audio-") as temporary:
        temporary = Path(temporary)
        for key, item in manifest.items():
            if args.only and key not in args.only:
                continue
            source = temporary / f"{key}-source.mp3"
            output = temporary / item["file"]
            print(f"Downloading {key}: {item['title']} — {item['creator']}")
            cached = args.source_dir / f'{key}.mp3' if args.source_dir else None
            if cached and cached.exists():
                shutil.copyfile(cached, source)
            else:
                download(item["previewUrl"], source)
            render(ffmpeg, source, output, item)
            shutil.move(output, AUDIO / item["file"])
            print(f"Wrote audio/{item['file']}")


if __name__ == "__main__":
    main()
