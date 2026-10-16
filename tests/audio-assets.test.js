const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');

const root=path.resolve(__dirname,'..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'audio/sources.json'),'utf8'));
const keys=['sun','wind','rain','bugs','cat','water','music'];

test('all CC0 sound assets are present with reproducible source metadata',()=>{
  assert.deepEqual(Object.keys(manifest),keys);
  for(const key of keys){
    const item=manifest[key];
    assert.equal(item.license,'CC0-1.0');
    assert.match(item.sourcePage,/^https:\/\/freesound\.org\/people\//);
    assert.match(item.previewUrl,/^https:\/\/cdn\.freesound\.org\/previews\//);
    assert.ok(item.creator&&item.title);
    assert.ok(fs.statSync(path.join(root,'audio',item.file)).size>item.loopDuration*10000);
  }
  assert.equal(fs.readdirSync(path.join(root,'audio')).some(name=>name.endsWith('.wav')),false);
});

test('processed recordings are browser-sized MP3 loops with safe durations',()=>{
  const ffprobe=spawnSync('ffprobe',['-version'],{encoding:'utf8'});
  if(ffprobe.status!==0)return;
  for(const key of keys){
    const file=path.join(root,'audio',manifest[key].file);
    const result=spawnSync('ffprobe',['-v','error','-show_entries','format=duration:stream=codec_name,sample_rate','-of','json',file],{encoding:'utf8'});
    assert.equal(result.status,0,result.stderr);
    const info=JSON.parse(result.stdout);
    assert.equal(info.streams[0].codec_name,'mp3');
    assert.equal(Number(info.streams[0].sample_rate),44100);
    const duration=Number(info.format.duration);
    assert.ok(Math.abs(duration-manifest[key].loopDuration)<.1,`${key} duration ${duration}`);
  }
});

test('the product loads recordings and the offline build embeds them',()=>{
  const source=fs.readFileSync(path.join(root,'source.html'),'utf8');
  const builder=fs.readFileSync(path.join(root,'build3d.py'),'utf8');
  assert.match(source,/const audioSources=\{sun:'audio\/01-林间晨鸟\.mp3'/);
  assert.match(fs.readFileSync(path.join(root,'garden-audio.js'),'utf8'),/decodeAudioData/);
  assert.doesNotMatch(source,/本地程序化音频|createBuffer\(2,sr\*seconds/);
  assert.match(builder,/window\.GARDEN_AUDIO_ASSETS/);
  assert.match(builder,/data:audio\/mpeg;base64/);
});

test('sound engine supports interrupted fades and browser-safe loop repair',()=>{
  const engine=fs.readFileSync(path.join(root,'garden-audio.js'),'utf8');
  assert.match(engine,/cancelScheduledValues\(time\)/);
  assert.match(engine,/linearRampToValueAtTime/);
  assert.match(engine,/gardenLoopBuffer/);
  assert.match(engine,/this\.ctx\.resume\(\)/);
  assert.match(engine,/ctx\.onstatechange/);
});
