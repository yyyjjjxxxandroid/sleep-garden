const {test}=require('node:test');
const assert=require('node:assert/strict');

test('scaled kitten keeps its supporting paw planted while its body advances',async()=>{
  const T=await import('../vendor/three/build/three.module.js');
  const {createStoryCat}=await import('../story-cat.js');
  let now=0,distance=0;const scale=.609375,speed=.64,dt=1/120;
  const actor=createStoryCat({clock:()=>now,random:()=>.5});actor.root.scale.setScalar(scale);
  const paw=actor.root.getObjectByName('paw-front--1'),point=new T.Vector3(),previous=new T.Vector3();let lastSupporting=false,checked=0;
  for(let frame=0;frame<120*5;frame++){
    now+=dt;distance+=speed*dt;actor.root.position.z=distance;
    const stride=distance*8/scale,cycle=stride%(2*Math.PI);
    actor.animate(now,true,0,false,dt,false,stride,{action:'walk',time:now});actor.root.updateMatrixWorld(true);paw.getWorldPosition(point);
    const supporting=now>2&&cycle>Math.PI+.2&&cycle<2*Math.PI-.2;
    if(supporting&&lastSupporting){assert.ok(point.distanceTo(previous)<.0005,'supporting foot must not slide across the ground');checked++;}
    previous.copy(point);lastSupporting=supporting;
  }
  assert.ok(checked>50);
});

test('terrain and bedding height changes do not trigger walking or advance the gait',async()=>{
  globalThis.window??={};
  const T=await import('../vendor/three/build/three.module.js');await import('../story-world.js');
  const cat=new T.Group();cat.scale.setScalar(.609375);
  const world=Object.assign(Object.create(window.GardenWorld.prototype),{
    cat,catDistance:0,catStride:0,state:{},canvas:{dataset:{}},groundHeight:()=>.3,
    companion:{phase:'idle',update(){}},petCare:{update(){},supportHeight:0,pose:null}
  });
  world.updateCatMovement(1/60,1,0);assert.equal(world.catSpeed,0);assert.equal(world.catStride,0);assert.equal(world.catDistance,0);
  world.companion.update=()=>{cat.position.z+=.1;};
  world.updateCatMovement(1/60,1,1);assert.ok(Math.abs(world.catStride-.1*8/cat.scale.x)<1e-9);
});
