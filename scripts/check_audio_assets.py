#!/usr/bin/env python3
"""Measure local delivered assets with FFmpeg; subjective listening is separate."""
import array, json, math, re, subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def measure(path):
    probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration,size:stream=codec_name,sample_rate,channels,bit_rate','-of','json',str(path)]))
    command=['ffmpeg','-hide_banner','-i',str(path),'-af','loudnorm=I=-28:TP=-9:LRA=7:print_format=json','-f','null','-']
    data=subprocess.run(command,capture_output=True,text=True,check=True)
    levels=json.loads(re.findall(r'\{[^{}]+\}',data.stderr)[-1])
    samples=array.array('f',subprocess.check_output(['ffmpeg','-v','error','-i',str(path),'-ac','1','-ar','44100','-f','f32le','-']))
    assert all(math.isfinite(x) for x in samples)
    differences=[abs(samples[i]-samples[i-1]) for i in range(1,len(samples))]
    rms=math.sqrt(sum(x*x for x in samples)/len(samples))
    return {'duration':float(probe['format']['duration']),'bytes':int(probe['format']['size']),**probe['streams'][0],
      'integratedLUFS':float(levels['input_i']),'truePeakDBTP':float(levels['input_tp']),'LRA':float(levels['input_lra']),
      'edgeJump':abs(samples[0]-samples[-1]),'differenceRMS':math.sqrt(sum(x*x for x in differences)/len(differences)),
      'rms':rms,'finite':True}
if __name__=='__main__':
    manifest=json.loads((ROOT/'audio/sources.json').read_text())
    report={key:measure(ROOT/'audio'/item['file']) for key,item in manifest.items()}
    destination=ROOT/'audio/quality-report.json';destination.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(report,ensure_ascii=False,indent=2))
