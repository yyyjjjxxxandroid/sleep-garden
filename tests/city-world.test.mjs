import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three/build/three.module.js';
import { createCityPerson } from '../city-person.js';
import { buildCityScene, cityWalkable, CITY_FLOOR } from '../city-scene.js';
import { CityCompanions, CityWorld } from '../city-world.js';
import { buildGuangzhouScene, guangzhouWalkable } from '../guangzhou-scene.js';
import { buildShenzhenScene, shenzhenWalkable } from '../shenzhen-scene.js';
import { clearSegment, findRoute } from '../garden-navigation.mjs';

test('the city contains volumetric landmarks, a walkable bridge and water below its deck',()=>{
  const city=buildCityScene({text:false});
  for(const name of ['luoyang-bridge-inscribed-stele','heritage-plaque-and-stone-frame','bridgehead-banyan','stone-bridge-railings','boat-shaped-granite-piers','granite-paving-slabs','luoyang-bridge-connected-northern-bank','northern-stone-bridge-landing','northern-village-approach-path']){
    const model=city.root.getObjectByName(name);assert.ok(model,name);
    const size=new T.Box3().setFromObject(model).getSize(new T.Vector3());assert.ok(size.x>0&&size.y>0&&size.z>0,`${name} has actual depth`);
  }
  assert.ok(city.walkSurfaces.length>=2);assert.ok(city.water.position.y<CITY_FLOOR-1);
  let sprites=0;city.root.traverse(o=>{if(o.isSprite)sprites++;});assert.equal(sprites,0);
});

test('Guangzhou provides its own Pearl River scene and keeps companions on the promenade',()=>{
  const city=buildGuangzhouScene();
  for(const name of ['canton-tower-volumetric-landmark','canton-tower-twisting-lattice','pearl-river-lit-skyline','pearl-river-near-bank-architecture','pearl-river-near-bank-park','pearl-river-near-bank-foundation','pearl-river-city-side-greenbelt','pearl-river-city-side-greenway','pearl-river-near-bank-retaining-wall','pearl-river-solid-city-bank','pearl-river-flood-wall','pearl-river-opposite-promenade','pearl-river-opposite-greenbelt','pearl-river-opposite-road','pearl-river-interlocking-stone-paving','pearl-river-aged-paving-details','pearl-river-quanzhou-detail-rail','pearl-river-city-side-planter-edge','pearl-river-tactile-guidance-strip','pearl-river-city-side-lamps','pearl-river-procedural-shore-trees','pearl-river-street-furniture','pearl-river-glowing-lookout','pearl-river-broken-light-reflections'])assert.ok(city.root.getObjectByName(name),name);
  const tower=city.root.getObjectByName('canton-tower-volumetric-landmark'),building=city.root.getObjectByName('guangzhou-landed-building'),podium=city.root.getObjectByName('guangzhou-landed-podium-building');assert.ok(tower.position.y>=0&&tower.position.z<-70,'the Canton Tower stands on the opposite bank');assert.ok(building.position.y>0&&podium.position.y>0,'both skyline layers stand above the bank');
  assert.ok(guangzhouWalkable(0,7));assert.ok(guangzhouWalkable(0,-19));assert.equal(guangzhouWalkable(0,-10.4),false,'the pavilion is not walkable');assert.equal(guangzhouWalkable(-6.8,-6.1),false,'the ticket kiosk is not walkable');assert.equal(guangzhouWalkable(11,-19),false,'the river edge is not walkable');
  city.water.dispose();
});

test('Shenzhen provides a distinct bay boardwalk with mangroves and a skyline landmark',()=>{
  const city=buildShenzhenScene();
  for(const name of ['shenzhen-bay-timber-planks','shenzhen-quanzhou-detail-rail','shenzhen-deck-fasteners','shenzhen-boardwalk-cross-inlays','shenzhen-bay-near-bank-park','shenzhen-waterfront-promenade-foundation','shenzhen-near-bank-promenade','shenzhen-quanzhou-style-reed-and-rock-edge','shenzhen-near-bank-pergolas-and-seating','shenzhen-waterfront-rescue-and-mooring-details','shenzhen-bay-retaining-edge','shenzhen-promenade-edge','shenzhen-boardwalk-drainage-detail','shenzhen-bay-viewing-frame','shenzhen-solid-city-bank','shenzhen-bay-flood-wall','shenzhen-waterfront-promenade','shenzhen-waterfront-greenbelt','shenzhen-shoreline-road','shenzhen-procedural-shore-trees','shenzhen-layered-inland-greenbelt','shenzhen-varied-waterfront-buildings','shenzhen-spring-bamboo-landmark','shenzhen-spring-bamboo-podium','shenzhen-spring-bamboo-vertical-ribs','shenzhen-bay-lit-skyline','shenzhen-bay-floating-leaves-and-duckweed'])assert.ok(city.root.getObjectByName(name),name);
  const tower=city.root.getObjectByName('shenzhen-spring-bamboo-landmark'),building=city.root.getObjectByName('shenzhen-landed-building');assert.ok(tower.position.y>=0&&tower.position.z<-90,'the tower stands on the rear bank');assert.ok(building.position.y>=0&&building.position.z<-90,'the skyline stands behind the shoreline');
  assert.ok(shenzhenWalkable(0,7));assert.ok(shenzhenWalkable(0,-19));assert.equal(shenzhenWalkable(0,-11.5),false,'the viewing frame is not walkable');assert.equal(shenzhenWalkable(-4.65,-7),false,'the near bench is not walkable');assert.equal(shenzhenWalkable(11,-19),false,'the bay edge is not walkable');
  city.water.dispose();
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

test('moored boats retain their local meshes when static stonework is batched',()=>{
  const scenery=buildCityScene({text:false}),scene=new T.Scene();scene.add(scenery.root);
  const world=Object.assign(Object.create(CityWorld.prototype),{scenery,scene});world.batchStonework();
  const boat=scenery.root.getObjectByName('moored-estuary-fishing-boats').children[0];
  boat.traverse(o=>{if(o.isMesh)assert.ok(o.visible,'rocking hull and planks must not freeze into a static batch');});
  scenery.update(2);const y=boat.position.y;scenery.update(8);
  assert.notEqual(boat.position.y,y);assert.ok(Math.abs(boat.rotation.z)<.01,'moored motion remains small');
  scenery.water.dispose();
});

test('city routes avoid the monument, tree roots, river and bridge railings',()=>{
  for(const p of [[-4.25,2.2],[5.4,1.1],[3.35,-1],[8,5],[4,-15],[2.1,-20],[0,-66]])assert.equal(cityWalkable(...p),false,p.join(','));
  for(const p of [[0,6],[0,-3.5],[0,-4],[0,-20],[1.7,-30]])assert.ok(cityWalkable(...p),p.join(','));
  const start={x:-6.5,z:9.5},end={x:-3.0,z:.4},route=findRoute(start,end,cityWalkable,{bound:44,step:.45});
  assert.ok(route?.length>1,'must go around the stele rather than cut through it');let previous=start;
  for(const point of route){assert.ok(clearSegment(previous,point,cityWalkable));previous=point;}
  assert.ok(clearSegment({x:0,z:7},{x:0,z:-37},cityWalkable),'the plaza and bridge form one continuous route');
  assert.ok(clearSegment({x:0,z:-37},{x:0,z:-43},cityWalkable),'the bridge continues onto its northern landing');
  assert.ok(findRoute({x:0,z:-37},{x:0,z:-62},cityWalkable,{bound:70,step:.45})?.length,'the northern path remains walkable into the village');
});

test('entrance plaza is supported by land and routes avoid the stone portico and raised tree bed',()=>{
  const city=buildCityScene({text:false});city.root.updateMatrixWorld(true);
  const foundation=city.root.getObjectByName('solid-bridgehead-land-foundation'),bounds=new T.Box3().setFromObject(foundation);
  assert.ok(bounds.max.y<0&&bounds.max.y>-.15,'land meets the terrace immediately below paving');
  assert.ok(bounds.min.y<city.water.position.y-2,'earth extends well below the tidal surface');
  for(const p of [new T.Vector3(0,-.7,11.8),new T.Vector3(7.8,-.7,5),new T.Vector3(-7.8,-.7,5)])assert.ok(bounds.containsPoint(p),'all plaza edges have solid support');
  for(const name of ['reference-red-brick-entrance-hall','reference-four-column-stone-portico','reference-octagonal-banyan-planter','entrance-quay-retaining-walls'])assert.ok(city.root.getObjectByName(name));
  assert.equal(cityWalkable(-6.55,6),false);assert.equal(cityWalkable(4,1.1),false);
  const route=findRoute({x:-6.5,z:9.5},{x:0,z:-12},cityWalkable,{bound:44,step:.45});assert.ok(route?.length);
  let previous={x:-6.5,z:9.5};for(const point of route){assert.ok(clearSegment(previous,point,cityWalkable));previous=point;}
  city.water.dispose();
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
  for(const view of ['entrance','courtyard','bridge','left','right']){world.setView(view);assert.equal(actors.route,route);assert.ok(actors.human.position.equals(person));assert.ok(actors.cat.position.equals(cat));}
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
