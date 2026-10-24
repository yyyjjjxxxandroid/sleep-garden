import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three/build/three.module.js';
import { createCityPerson } from '../city-person.js';
import { buildCityScene, cityWalkable, CITY_FLOOR } from '../city-scene.js';
import { CityCompanions, CityWorld } from '../city-world.js';
import { clearSegment, findRoute } from '../garden-navigation.mjs';

test('the city contains volumetric landmarks, a walkable bridge and water below its deck',()=>{
  const city=buildCityScene({text:false});
  for(const name of ['luoyang-bridge-inscribed-stele','heritage-plaque-and-stone-frame','bridgehead-banyan','stone-bridge-railings','boat-shaped-granite-piers','granite-paving-slabs']){
    const model=city.root.getObjectByName(name);assert.ok(model,name);
    const size=new T.Box3().setFromObject(model).getSize(new T.Vector3());assert.ok(size.x>0&&size.y>0&&size.z>0,`${name} has actual depth`);
  }
  assert.ok(city.walkSurfaces.length>=2);assert.ok(city.water.position.y<CITY_FLOOR-1);
  let sprites=0;city.root.traverse(o=>{if(o.isSprite)sprites++;});assert.equal(sprites,0);
});

test('both sides of the bridge are continuous water rather than nearby marsh platforms',()=>{
  const city=buildCityScene({text:false});city.root.updateMatrixWorld(true);
  for(const side of [-1,1])for(const z of [-8,-19,-34]){
    const ray=new T.Raycaster(new T.Vector3(side*12,10,z),new T.Vector3(0,-1,0));
    const hits=ray.intersectObject(city.root,true);
    assert.equal(hits[0]?.object,city.water,`open tidal water at ${side*12},${z}`);
  }
  city.water.dispose();
});

test('worn paving stays at the actors’ floor and new pagoda plinths are excluded from routes',()=>{
  const city=buildCityScene({text:false});city.root.updateMatrixWorld(true);
  for(const x of [-1.55,-.45,.55,1.55])for(const z of [-5,-9,-16,-24,-32,-38]){
    const ray=new T.Raycaster(new T.Vector3(x,4,z),new T.Vector3(0,-1,0));
    const hit=ray.intersectObjects(city.walkSurfaces,true)[0];
    assert.ok(hit&&Math.abs(hit.point.y-CITY_FLOOR)<.015,`stone supports feet at ${x},${z}`);
  }
  for(const side of [-1,1])assert.equal(cityWalkable(side*5.5,-2.7),false,'stone tower base cannot be walked through');
  assert.ok(city.root.getObjectByName('paired-bridgehead-stone-shelters'));
  city.water.dispose();
});

test('tidal water updates its waves and owns a disposable HDR scene reflection',()=>{
  const city=buildCityScene({text:false}),water=city.water,target=water.getRenderTarget();
  assert.equal(water.material.uniforms.tDiffuse.value,target.texture);
  assert.equal(target.texture.type,T.HalfFloatType,'reflections mix in linear light before tone mapping');
  city.update(14.25);assert.equal(water.material.uniforms.time.value,14.25);
  let disposed=0;target.addEventListener('dispose',()=>disposed++);water.dispose();water.dispose();
  assert.equal(disposed,1,'exiting or rebuilding must release the water reflection once');
});

test('city routes avoid the monument, tree roots, river and bridge railings',()=>{
  for(const p of [[-4.25,2.2],[5.4,1.1],[3.35,-1],[8,5],[4,-15],[2.1,-20],[0,-41]])assert.equal(cityWalkable(...p),false,p.join(','));
  for(const p of [[0,6],[0,-3.5],[0,-4],[0,-20],[1.7,-30]])assert.ok(cityWalkable(...p),p.join(','));
  const start={x:-6.5,z:5.5},end={x:-3.0,z:.4},route=findRoute(start,end,cityWalkable,{bound:44,step:.45});
  assert.ok(route?.length>1,'must go around the stele rather than cut through it');let previous=start;
  for(const point of route){assert.ok(clearSegment(previous,point,cityWalkable));previous=point;}
  assert.ok(clearSegment({x:0,z:7},{x:0,z:-37},cityWalkable),'the plaza and bridge form one continuous route');
});

test('the hoodie companion has articulated 3D limbs and a stable ground contact',()=>{
  const person=createCityPerson();let bones=0,meshes=0;
  person.root.traverse(o=>{if(o.isBone)bones++;if(o.isMesh){meshes++;assert.ok(o.geometry.attributes.position.count>0);}assert.ok(!o.isSprite);});
  assert.ok(bones>=10);assert.ok(meshes>25);assert.ok(person.root.getObjectByName('brown-hair'));assert.ok(person.root.getObjectByName('hood-down-on-back'));
  let maximum=0;
  for(let i=0;i<120;i++){
    person.animate(i/60,true,1/60,i/60);maximum=Math.max(maximum,Math.abs(person.legs[0].hip.rotation.x));
    person.root.updateMatrixWorld(true);person.root.traverse(o=>assert.ok(o.matrixWorld.elements.every(Number.isFinite)));
  }
  assert.ok(maximum>.3,'legs visibly move when walking');assert.equal(person.root.position.y,0,'gait never translates the world root');
});

test('a character and its kitten walk onto the bridge without entering the estuary',()=>{
  const actors=new CityCompanions();assert.ok(actors.goTo({x:0,z:-10}));
  for(let i=0;i<900;i++){
    actors.update(1/60);
    assert.ok(cityWalkable(actors.human.position.x,actors.human.position.z,.34),'person stays on stone');
    assert.ok(cityWalkable(actors.cat.position.x,actors.cat.position.z,.22),'kitten stays on stone');
  }
  assert.ok(Math.abs(actors.human.position.z+10)<.02);assert.ok(actors.cat.position.distanceTo(actors.human.position)<1.8);
  assert.equal(actors.goTo({x:5,z:-10}),false);assert.equal(actors.human.position.y,CITY_FLOOR);
  assert.equal(actors.cat.userData.model,'rigged-fluffy-kitten');
});

test('camera presets and following do not teleport either actor or replace their route',()=>{
  const actors=new CityCompanions(),world=Object.assign(Object.create(CityWorld.prototype),{actors,camera:new T.PerspectiveCamera(),controls:{target:new T.Vector3(),update(){}},onView(){}});
  actors.goTo({x:0,z:-10});const route=actors.route,person=actors.human.position.clone(),cat=actors.cat.position.clone();
  for(const view of ['entrance','bridge','left','right']){world.setView(view);assert.equal(actors.route,route);assert.ok(actors.human.position.equals(person));assert.ok(actors.cat.position.equals(cat));}
  world.focusPerson();assert.ok(world.follow);assert.ok(actors.human.position.equals(person));assert.ok(actors.cat.position.equals(cat));
});

test('the idle kitten performs one rub and one jump; walking interrupts and rearms them',()=>{
  const actors=new CityCompanions();actors.playing=true;const seen=new Set();let jumped=false;
  for(let i=0;i<2600;i++){actors.update(1/60);if(actors.action)seen.add(actors.action.kind);if(actors.cat.position.y>CITY_FLOOR+.1)jumped=true;}
  assert.ok(seen.has('rub'));assert.ok(seen.has('hop'));assert.ok(jumped);assert.equal(actors.performed.size,2);
  actors.goTo({x:0,z:4});assert.equal(actors.action,null);assert.equal(actors.performed.size,0);
  actors.update(1/60);assert.equal(actors.cat.position.y,CITY_FLOOR);
});

test('pausing companionship freezes its idle trigger time while direct movement stays available',()=>{
  const actors=new CityCompanions();
  for(let i=0;i<900;i++)actors.update(1/60);
  assert.equal(actors.idle,0);assert.equal(actors.action,null);
  actors.playing=true;for(let i=0;i<300;i++)actors.update(1/60);
  const idle=actors.idle;actors.playing=false;
  for(let i=0;i<600;i++)actors.update(1/60);
  assert.equal(actors.idle,idle);assert.equal(actors.action,null);
  const before=actors.human.position.clone();actors.goTo({x:0,z:4});actors.update(.05);
  assert.ok(before.distanceTo(actors.human.position)>.01,'manual walking is independent of the sound session');
});
