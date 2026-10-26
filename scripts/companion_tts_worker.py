"""Private line-delimited worker. No HTTP listener, files, cloud keys or transcripts saved."""
import base64, io, json, os, sys, wave
from pathlib import Path
import numpy as np
import sherpa_onnx

model = Path(sys.argv[1])
config = sherpa_onnx.OfflineTtsConfig(
    model=sherpa_onnx.OfflineTtsModelConfig(
        kokoro=sherpa_onnx.OfflineTtsKokoroModelConfig(
            model=str(model / 'model.int8.onnx'), voices=str(model / 'voices.bin'),
            tokens=str(model / 'tokens.txt'),
            lexicon=','.join(str(model / n) for n in ['lexicon-us-en.txt', 'lexicon-zh.txt']),
            data_dir=str(model / 'espeak-ng-data'),
        ), num_threads=2, provider='cpu', debug=False,
    ), max_num_sentences=1,
    rule_fsts=','.join(str(p) for p in sorted(model.glob('*.fst'))),
)
if not config.validate():
    raise SystemExit('invalid_tts_config')
tts = sherpa_onnx.OfflineTts(config)
speaker = int(os.environ.get('COMPANION_TTS_SPEAKER', '18'))

def fade(samples, rate, duration=.045):
    samples = np.asarray(samples, dtype=np.float32).copy()
    n = min(int(rate * duration), len(samples) // 2)
    if n:
        samples[:n] *= np.linspace(0, 1, n)
        samples[-n:] *= np.linspace(1, 0, n)
    return samples

def synthesize(text, cue):
    gen = sherpa_onnx.GenerationConfig()
    gen.sid = speaker
    gen.speed = .88
    gen.silence_scale = .65
    audio = tts.generate(text, gen)
    rate = audio.sample_rate
    samples = fade(audio.samples, rate)
    if not len(samples) or len(samples) > rate * 65:
        raise ValueError('invalid_audio')
    # Gently tame peaks, then apply a consistent quiet speech level.
    peak = float(np.max(np.abs(samples)))
    rms = float(np.sqrt(np.mean(samples ** 2)))
    if peak > 0 and rms > 0:
        samples *= min(.48 / peak, .095 / rms, 2)
    if cue in ('meow', 'purr'):
        cue_file = Path(__file__).resolve().parent.parent / 'audio/companion' / (cue + '.wav')
        with wave.open(str(cue_file), 'rb') as source:
            if source.getframerate() != rate or source.getnchannels() != 1 or source.getsampwidth() != 2:
                raise ValueError('invalid_cue')
            sound = np.frombuffer(source.readframes(source.getnframes()), dtype='<i2').astype(np.float32) / 32768
        samples = np.concatenate([samples, np.zeros(int(rate * .30)), fade(sound, rate)])
    samples = np.concatenate([np.zeros(int(rate * .10)), samples, np.zeros(int(rate * .12))])
    output = io.BytesIO()
    with wave.open(output, 'wb') as wav:
        wav.setnchannels(1); wav.setsampwidth(2); wav.setframerate(rate)
        wav.writeframes((np.clip(samples, -1, 1) * 32767).astype('<i2').tobytes())
    return base64.b64encode(output.getvalue()).decode('ascii')

for line in sys.stdin:
    try:
        request = json.loads(line)
        text = request.get('text', '')
        if not isinstance(text, str) or not 0 < len(text.strip()) <= 240:
            raise ValueError('invalid_text')
        result = {'audio': synthesize(text.strip(), request.get('cue', 'none'))}
    except Exception:
        result = {'error': 'synthesis_failed'}
    print(json.dumps(result, separators=(',', ':')), flush=True)
