import test from 'node:test';
import assert from 'node:assert/strict';
import {renderProfile,AdaptiveResolution,updateRenderBudget} from '../render-performance.js';

test('portrait and landscape phones use a bounded GPU budget without realtime shadow passes',()=>{
  for(const [width,height]of [[390,844],[844,390]]){
    const profile=renderProfile({touch:true,width,height,dpr:3});
    assert.equal(profile.mobile,true);assert.equal(profile.pixelRatio,1);
    assert.equal(profile.shadows,false);assert.equal(profile.antialias,false);
    assert.equal(profile.reflectionSize,256);assert.equal(profile.reflectionInterval,100);
  }
  assert.equal(renderProfile({touch:true,width:1280,height:1024}).mobile,false);
  const desktop=renderProfile({dpr:2});
  assert.equal(desktop.shadows,true);assert.equal(desktop.antialias,true);assert.equal(desktop.pixelRatio,1.5);
  assert.equal(renderProfile({cores:2}).quality,'low');
  assert.equal(renderProfile({memory:2}).shadows,false);
  assert.equal(renderProfile({reduced:true}).shadows,false);
});

function feed(controller,interval,seconds,start=1){
  let now=start;controller.sample(now);
  for(let i=0;i<seconds*1000/interval;i++){now+=interval;controller.sample(now)}
  return now;
}
test('sustained slow frames reduce resolution within bounds, even at two FPS',()=>{
  for(const interval of [33.333,500]){
    const controller=new AdaptiveResolution(renderProfile({touch:true,width:390,height:844,dpr:3}));
    feed(controller,interval,20);
    assert.equal(controller.ratio,.65);
  }
});
test('resolution recovery is gradual and does not react to single stutters or background tabs',()=>{
  const controller=new AdaptiveResolution(renderProfile({dpr:2}));
  let now=feed(controller,33.333,5);
  assert.ok(controller.ratio<controller.max);
  const lower=controller.ratio;controller.reset();
  now=feed(controller,16.667,4,now);assert.equal(controller.ratio,lower);
  now=feed(controller,16.667,7,now);assert.ok(controller.ratio>lower);
  feed(controller,16.667,80,now);assert.equal(controller.ratio,controller.max);
  controller.sample(200000);assert.equal(controller.slow,0);assert.equal(controller.ratio,controller.max);
  const fresh=new AdaptiveResolution(renderProfile());
  feed(fresh,16.667,3);fresh.sample(99999);feed(fresh,16.667,2,99999);
  assert.equal(fresh.ratio,fresh.max);
});
test('shadow refresh is throttled independently of full speed scene rendering',()=>{
  const calls=[],world={renderProfile:renderProfile(),adaptiveResolution:{sample:()=>null},
    canvas:{dataset:{}},renderer:{shadowMap:{enabled:true,needsUpdate:false},setPixelRatio:r=>calls.push(r)}};
  updateRenderBudget(world,100);assert.equal(world.renderer.shadowMap.needsUpdate,true);
  world.renderer.shadowMap.needsUpdate=false;updateRenderBudget(world,120);assert.equal(world.renderer.shadowMap.needsUpdate,false);
  updateRenderBudget(world,151);assert.equal(world.renderer.shadowMap.needsUpdate,true);
  world.adaptiveResolution.sample=()=>.85;updateRenderBudget(world,170);
  assert.deepEqual(calls,[.85]);assert.equal(world.canvas.dataset.pixelRatio,'0.85');
});
