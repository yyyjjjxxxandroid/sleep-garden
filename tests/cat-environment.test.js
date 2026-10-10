const {test}=require('node:test'),assert=require('node:assert/strict');
async function fixture(){const {createStoryCat}=await import('../story-cat.js');let time=0;const actor=createStoryCat({clock:()=>time,random:()=>.5});return {actor,advance(seconds){for(let i=0;i<Math.ceil(seconds*30);i++){time+=1/30;actor.animate(time,false,0,true,1/30)}return actor.root.userData}}}
test('night prioritizes sleep, stays asleep, accepts gentle touch and rises smoothly at dawn',async()=>{
  const {actor,advance}=await fixture();actor.setContext({night:true});assert.equal(actor.wantsRest(0),true);
  advance(4);assert.equal(actor.root.userData.lieWeight,0);advance(13);assert.ok(actor.root.userData.lieWeight>.98);assert.equal(actor.root.userData.nightRest,true);
  advance(120);assert.ok(actor.root.userData.lieWeight>.98);assert.equal(actor.root.userData.idleAction,'rest');assert.equal(actor.notice('water',{x:1,y:0}),false);
  actor.pet('chin');actor.touch('chin',{x:.2,y:0});advance(1);assert.ok(actor.root.userData.lieWeight>.98);assert.equal(actor.root.userData.contact,true);actor.release();advance(35);assert.ok(actor.root.userData.lieWeight>.98);
  const head=actor.head.position.clone();actor.setContext({night:false});advance(1/30);assert.ok(actor.head.position.distanceTo(head)<.02);advance(8);assert.equal(actor.root.userData.lieWeight,0);assert.equal(actor.root.userData.nightRest,false);
});
test('music and nearby nature get a directional response without changing session or mix',async()=>{
  const {actor,advance}=await fixture();const state={night:false,listening:true,wind:.6,mix:{rain:0,water:35},playing:false,elapsed:37},before=structuredClone(state);
  actor.setContext(state);assert.equal(actor.notice('music',{x:.8,y:-.2}),true);advance(1);assert.ok(actor.root.userData.noticeWeight>.9);assert.ok(actor.head.rotation.y>.1);
  advance(4);assert.equal(actor.notice('water',{x:-.8,y:.2}),true);advance(1);assert.ok(actor.head.rotation.y<-.05);assert.equal(actor.root.userData.environmentReaction,'water');
  advance(18);assert.ok(actor.root.userData.sitWeight>.9,'listening eventually settles into a quiet companionship pose');assert.deepEqual(state,before);
});
test('touch and reduced motion take priority over autonomous environmental responses',async()=>{
  const {actor,advance}=await fixture();actor.pet('head');actor.touch('head',{x:0,y:0});assert.equal(actor.notice('water',{x:1,y:0}),false);advance(1);assert.equal(actor.root.userData.environmentReaction,undefined);actor.release();actor.setContext({night:true});actor.animate(2,false,0,true,1/30,true);assert.equal(actor.root.userData.lieWeight,0);assert.equal(actor.wantsRest(2),false);assert.equal(actor.notice('music'),false);
});

test('production world triggers music and water responses, but silence and night take precedence',async()=>{
 globalThis.window??={};await import('../story-world.js');const T=await import('../vendor/three/build/three.module.js'),{actor,advance}=await fixture(),state={playing:true,mix:{water:0,rain:0},night:false,weather:'clear',wind:35},radio=new T.Group();radio.position.set(3,0,1);radio.updateMatrixWorld(true);
 const world=Object.assign(Object.create(window.GardenWorld.prototype),{state,storyCat:actor,cat:actor.root,craft:{radio},water:{position:new T.Vector3(0,0,2)}});
 world.updateCatContext();assert.equal(actor.root.userData.environmentReaction,undefined,'a silent session must not make the cat listen to imaginary music');state.mix.water=20;world.updateCatContext();assert.equal(actor.root.userData.environmentReaction,'music');advance(5);assert.equal(world.catNotice('water',new T.Vector3(-2,0,1)),true);assert.equal(actor.root.userData.environmentReaction,'water');advance(5);assert.equal(world.catNotice('water',new T.Vector3(30,0,1)),false,'distant events should not attract the cat');state.night=true;world.updateCatContext();assert.equal(world.catNotice('water',new T.Vector3(1,0,1)),false);assert.deepEqual(state.mix,{water:20,rain:0});
});

