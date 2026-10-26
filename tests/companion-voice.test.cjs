const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createCompanionVoice}=require('../companion-voice.js');

function fixture(){
  let time=0,next=0;const timers=new Map(),instances=[],sent=[],drafts=[],states=[];
  class Recognition{
    constructor(){instances.push(this);this.aborted=0;this.stopped=0;}
    start(){} stop(){this.stopped++;} abort(){this.aborted++;}
    result(final='',interim=''){
      const results=[];
      for(const [text,isFinal]of [[final,true],[interim,false]])if(text){const r=[{transcript:text}];r.isFinal=isFinal;results.push(r);}
      this.onresult({results});
    }
  }
  const voice=createCompanionVoice({Recognition,onSend:s=>sent.push(s),onDraft:s=>drafts.push(s),onState:s=>states.push(s),now:()=>time,
    schedule:(fn,delay)=>{const id=++next;timers.set(id,{fn,at:time+delay});return id;},unschedule:id=>timers.delete(id)});
  function advance(ms){const target=time+ms;while(true){const task=[...timers].filter(([,v])=>v.at<=target).sort((a,b)=>a[1].at-b[1].at)[0];if(!task)break;timers.delete(task[0]);time=task[1].at;task[1].fn();}time=target;}
  function start(){assert.equal(voice.begin(),true);const r=instances.at(-1);r.onstart();advance(500);return r;}
  return {voice,start,advance,instances,sent,drafts,states,timers};
}

test('release waits for final text, sends exactly once, and ignores late recognition events',()=>{
  const f=fixture(),r=f.start();r.result('','今天有点累');f.voice.release();assert.equal(r.stopped,1);assert.deepEqual(f.sent,[]);
  r.result('今天有点累，陪我去海边。');r.onend();r.onend();r.result('不应再发送');f.advance(10000);
  assert.deepEqual(f.sent,['今天有点累，陪我去海边。']);assert.equal(f.voice.active,false);assert.equal(f.timers.size,0);
});

test('swipe to cancel never sends or preserves words, even when results arrive late',()=>{
  const f=fixture(),r=f.start();r.result('不想发送的私语');f.voice.setCancelling(true);f.voice.release();r.result('延迟文字');r.onend();f.advance(65000);
  assert.equal(r.aborted,1);assert.deepEqual(f.sent,[]);assert.deepEqual(f.drafts,[]);assert.equal(f.timers.size,0);
});

test('swiping back restores release-to-send, and native early end still waits for release',()=>{
  const f=fixture(),r=f.start();f.voice.setCancelling(true);f.voice.setCancelling(false);r.result('风声小一点');r.onend();assert.deepEqual(f.sent,[]);
  f.voice.release();assert.deepEqual(f.sent,['风声小一点']);
});

test('a recognition error while swiping to cancel does not restore private words as a draft',()=>{
  const f=fixture(),r=f.start();r.result('这句话取消');f.voice.setCancelling(true);r.onerror({error:'network'});f.voice.release();
  assert.deepEqual(f.sent,[]);assert.deepEqual(f.drafts,[]);assert.equal(f.voice.active,false);
});

test('short taps and release during permission do not send and stop delayed microphone starts',()=>{
  const f=fixture();f.voice.begin();const old=f.instances[0];f.voice.release();old.onstart();old.result('旧结果');old.onend();assert.deepEqual(f.sent,[]);assert.ok(old.aborted>=1);
  f.voice.begin();const r=f.instances[1];r.onstart();f.advance(100);r.result('误触');f.voice.release();r.onend();assert.deepEqual(f.sent,[]);
});

test('cancel/close invalidates the old session without disturbing a later recording',()=>{
  const f=fixture(),old=f.start();old.result('旧消息');f.voice.cancel();const r=f.start();old.onerror({error:'network'});old.onend();old.result('旧消息追加');
  r.result('新消息');f.voice.release();r.onend();assert.deepEqual(f.sent,['新消息']);
});

test('network or permission errors show recovery and never auto-send a partial recognition',()=>{
  for(const code of ['network','not-allowed','audio-capture','no-speech','service-not-allowed']){
    const f=fixture(),r=f.start();r.result('','已听到的话');r.onerror({error:code});r.onend();
    assert.deepEqual(f.sent,[]);assert.deepEqual(f.drafts,['已听到的话']);assert.ok(f.states.at(-1).message);assert.equal(f.timers.size,0);
  }
});

test('unfinished words or recognition timeout become editable drafts rather than incomplete messages',()=>{
  const f=fixture(),r=f.start();r.result('我想听','一点雨声');f.voice.release();r.onend();assert.deepEqual(f.sent,[]);assert.deepEqual(f.drafts,['我想听一点雨声']);
  const g=fixture(),s=g.start();s.result('你好');g.voice.release();g.advance(4000);s.onend();assert.deepEqual(g.sent,[]);assert.deepEqual(g.drafts,['你好']);assert.equal(s.aborted,1);
});

test('microphone start timeout and 60-second recording limit release resources',()=>{
  const f=fixture();f.voice.begin();f.advance(15000);assert.equal(f.voice.active,false);assert.equal(f.instances[0].aborted,1);
  const g=fixture(),r=g.start();r.result('安静陪我');g.advance(15000);assert.equal(g.voice.active,true);g.advance(45000);assert.equal(r.stopped,1);r.onend();assert.deepEqual(g.sent,['安静陪我']);assert.equal(g.timers.size,0);
});

test('empty recognition and overlong text never reach the AI',()=>{
  const f=fixture(),r=f.start();f.voice.release();r.onend();assert.deepEqual(f.sent,[]);
  const g=fixture(),s=g.start(),long='想'.repeat(601);s.result(long);g.voice.release();s.onend();assert.deepEqual(g.sent,[]);assert.deepEqual(g.drafts,[long]);
});

test('unsupported or failing recognizers leave a reusable idle state',()=>{
  assert.equal(createCompanionVoice().begin(),false);
  class Broken{start(){throw Error('permission');}abort(){}}
  const states=[],v=createCompanionVoice({Recognition:Broken,onState:s=>states.push(s)});assert.equal(v.begin(),false);assert.equal(v.active,false);assert.equal(states.at(-1).phase,'idle');
});
