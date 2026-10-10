const {test}=require('node:test');
const assert=require('node:assert/strict');

// Couple the production rest predicate and actor scheduler with the same
// acceleration/deceleration as World.update. No renderer or browser involved.
for(const focused of [false,true])test(`autonomous actions start promptly and finish while ${focused?'focused':'roaming'}`,async()=>{
  globalThis.window??={};
  const T=await import('../vendor/three/build/three.module.js');
  const {createStoryCat}=await import('../story-cat.js');await import('../story-world.js');
  let time=0,speed=0;
  const actor=createStoryCat({clock:()=>time,random:()=>.5});
  const world=Object.assign(Object.create(window.GardenWorld.prototype),{storyCat:actor});
  const completed=[];let previous='rest',start=0,firstStart=null;
  for(let frame=0;frame<60*134;frame++){
    time+=1/60;const rest=focused||world.catResting(time);
    speed=T.MathUtils.damp(speed,rest?0:.64,5,1/60);if(speed<.005)speed=0;
    actor.animate(time,speed>.025,0,speed<=.025,1/60);
    const name=actor.root.userData.idleAction;
    if(name!==previous){
      if(previous!=='rest')completed.push({name:previous,start,end:time,duration:time-start});
      if(name!=='rest'){firstStart??=time;start=time}
      previous=name;
    }
  }
  assert.ok(firstStart>=3&&firstStart<4,'the first action must not wait for the 23-second roaming leg');
  assert.ok(completed.length>=10,'roaming must not keep resetting the schedule');
  const duration={yawn:3.6,stretch:3.6,groom:5.6,observe:3.6,doze:7};
  for(const action of completed)assert.ok(Math.abs(action.duration-duration[action.name])<.035,`${action.name} must finish its full sequence`);
  assert.equal(new Set(completed.filter(a=>a.start<70).map(a=>a.name)).size,5);
  for(let i=1;i<completed.length;i++){
    const gap=completed[i].start-completed[i-1].end;
    assert.ok(gap>=6&&gap<10.8,'the quiet gap includes the time needed to stop walking');
  }
});

test('roaming yields for companionship and resumes after the complete getting-up motion',async()=>{
  globalThis.window??={};
  const T=await import('../vendor/three/build/three.module.js'),{createStoryCat}=await import('../story-cat.js');await import('../story-world.js');
  let time=0,speed=0;const actor=createStoryCat({clock:()=>time,random:()=>.5}),world=Object.assign(Object.create(window.GardenWorld.prototype),{storyCat:actor});
  actor.pet('head');actor.touch('head',{x:0,y:0});
  for(let i=0;i<60;i++){time+=1/60;actor.animate(time,false,0,true,1/60)}actor.release();
  let resumed=false;
  for(let i=0;i<60*36;i++){
    time+=1/60;speed=T.MathUtils.damp(speed,world.catResting(time)?0:.64,5,1/60);if(speed<.005)speed=0;
    actor.animate(time,speed>.025,0,speed<=.025,1/60);
    if(actor.root.userData.companionPhase!=='none')assert.equal(speed,0,'the cat must not slide along its path while sitting or lying down');
    if(speed>.025){resumed=true;assert.ok(actor.root.userData.sitWeight<.001&&actor.root.userData.lieWeight<.001)}
  }
  assert.equal(resumed,true,'companionship must eventually give locomotion back');
});
