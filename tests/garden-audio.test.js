const {test}=require('node:test');
const assert=require('node:assert/strict');
const {GardenAudio,GardenEnvelope,gardenLoopBuffer}=require('../garden-audio.js');

class Param {
  constructor(){this.value=0;this.calls=[]}
  cancelScheduledValues(time){this.calls.push(['cancel',time])}
  setValueAtTime(value,time){this.calls.push(['set',value,time]);this.value=value}
  linearRampToValueAtTime(value,time){this.calls.push(['ramp',value,time]);this.value=value}
  exponentialRampToValueAtTime(value,time){this.calls.push(['exponential',value,time]);this.value=value}
}

test('interrupted fades continue from their instantaneous level',()=>{
  const param=new Param(),envelope=new GardenEnvelope(param,0);
  envelope.to(1,10);
  assert.equal(envelope.valueAt(4),.4);
  envelope.ramp(0,4,2);
  assert.deepEqual(param.calls.slice(-3),[['cancel',4],['set',.4,4],['ramp',0,6]]);
  assert.equal(envelope.valueAt(5),.2);
});

test('decoded loop buffers overlap codec edges without changing sample rate',()=>{
  const input=Float32Array.from([0,1,2,3,4,5,6,7]);
  const source={numberOfChannels:1,length:8,sampleRate:10,getChannelData:()=>input};
  const output={createBuffer:(channels,length,sampleRate)=>{
    const data=new Float32Array(length);
    return {numberOfChannels:channels,length,sampleRate,getChannelData:()=>data};
  }};
  const loop=gardenLoopBuffer(output,source);
  assert.equal(loop.length,7);
  assert.equal(loop.sampleRate,10);
  assert.deepEqual([...loop.getChannelData(0)],[7,1,2,3,4,5,6]);
});

test('timer gain reaches silence at deadline, even for less than one second',()=>{
  for(const seconds of [.1,2,60]){
    const engine={ctx:{currentTime:100},endEnvelope:new GardenEnvelope(new Param(),1)};
    GardenAudio.prototype.scheduleStop.call(engine,seconds);
    assert.equal(engine.endEnvelope.valueAt(100+seconds),0);
    assert.ok(engine.endEnvelope.points.every(p=>p.time>=100));
    assert.ok(engine.endEnvelope.valueAt(100+seconds/2)>0);
  }
});

test('changing or cancelling a countdown preserves continuity and removes old stop',()=>{
  const engine={ctx:{currentTime:0},endEnvelope:new GardenEnvelope(new Param(),1)};
  GardenAudio.prototype.scheduleStop.call(engine,10);
  engine.ctx.currentTime=8.5;
  const value=engine.endEnvelope.valueAt(8.5);
  GardenAudio.prototype.scheduleStop.call(engine,0);
  assert.equal(engine.endEnvelope.valueAt(8.5),value);
  assert.equal(engine.endEnvelope.valueAt(10),1);
});

test('plant cues are quiet, short, and follow active audio and the user mix',()=>{
  const tones=[],gains=[],ctx={state:'running',currentTime:10,createOscillator(){const tone={frequency:new Param(),connect(node){this.output=node;return node},start(time){this.started=time},stop(time){this.stopped=time},disconnect(){}};tones.push(tone);return tone},createGain(){const gain={gain:new Param(),connect(node){this.output=node;return node},disconnect(){}};gains.push(gain);return gain}};
  const state={mix:{rain:25,wind:0},playing:true},engine={ctx,master:{},readMix:()=>state,closed:false};
  assert.equal(GardenAudio.prototype.plantGrowthCue.call(engine,1),true);
  assert.equal(tones.length,1);assert.equal(tones[0].started,10);assert.equal(tones[0].stopped,10.74);
  assert.deepEqual(gains[0].gain.calls,[['set',.0001,10],['exponential',.009,10.045],['exponential',.0001,10.72]]);
  assert.equal(tones[0].output,gains[0]);assert.equal(gains[0].output,engine.master,'cues must pass through the existing pause and timer fade chain');
  assert.equal(GardenAudio.prototype.plantGrowthCue.call(engine,2),false,'nearby cues are rate limited');
  ctx.currentTime=16;state.playing=false;assert.equal(GardenAudio.prototype.plantGrowthCue.call(engine,2),false);
  state.playing=true;state.mix={rain:0,wind:0};assert.equal(GardenAudio.prototype.plantGrowthCue.call(engine,2),false,'muting all user audio also mutes garden cues');
  state.mix.rain=40;engine.closed=true;assert.equal(GardenAudio.prototype.plantGrowthCue.call(engine,2),false);
});

test('pausing ends an active plant cue before context suspension so it cannot resume later',()=>{
  let stoppedAt;
  const engine={closed:false,ctx:{currentTime:12,state:'running'},endEnvelope:new GardenEnvelope(new Param(),1),masterEnvelope:new GardenEnvelope(new Param(),.68),plantCue:{stop:time=>{stoppedAt=time}}};
  GardenAudio.prototype.pause.call(engine);clearTimeout(engine.suspendTimer);
  assert.equal(stoppedAt,12.3);assert.equal(engine.masterEnvelope.valueAt(12.3),0);
  stoppedAt=undefined;engine.ctx.state='suspended';GardenAudio.prototype.pause.call(engine);clearTimeout(engine.suspendTimer);
  assert.equal(stoppedAt,12,'an already interrupted context must not replay the cue on resume');
});
test('scene sounds follow motion, wind and independent volume switches',()=>{
  const state={playing:true,catMoving:false,catDistance:0,chimeContact:0,wind:35,mix:{footsteps:22,chime:18}};
  const calls=[],engine={ctx:{state:'running'},readMix:()=>state,lastStepDistance:null,lastChimeContact:null,pawStep:v=>calls.push(['step',v]),chimeStrike:v=>calls.push(['chime',v])};
  const tick=()=>GardenAudio.prototype.sceneTick.call(engine);
  tick();state.catDistance=.3;tick();assert.equal(calls.length,0,'stationary cat stays silent');
  state.catMoving=true;state.catDistance=.6;tick();assert.equal(calls[0][0],'step');
  state.chimeContact=1;tick();assert.equal(calls[1][0],'chime');
  state.mix.footsteps=0;state.mix.chime=0;state.catDistance=.9;state.chimeContact=2;tick();assert.equal(calls.length,2,'muted channels stay silent');
  state.mix.chime=20;state.wind=0;state.chimeContact=3;tick();assert.equal(calls.length,2,'no wind means no chime');
  state.playing=false;state.mix.footsteps=20;state.wind=60;state.chimeContact=4;state.catDistance=2;tick();assert.equal(calls.length,2,'pause stops all new scene sounds');
});
