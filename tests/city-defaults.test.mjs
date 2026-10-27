import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from '../vendor/three/build/three.module.js';
import {defaultCityMood} from '../city-atmosphere.js';
import {buildGuangzhouScene,guangzhouWalkable} from '../guangzhou-scene.js';
import {buildShenzhenScene,shenzhenWalkable} from '../shenzhen-scene.js';
import {buildCityScene,cityWalkable} from '../city-scene.js';
import {clearSegment,findRoute} from '../garden-navigation.mjs';
import {CityWorld} from '../city-world.js';

test('Guangzhou and Shenzhen both open at dusk',()=>{
  assert.equal(defaultCityMood('guangzhou'),'dusk');
  assert.equal(defaultCityMood('shenzhen'),'dusk');
  assert.match(readFileSync(new URL('../city-experience.js',import.meta.url),'utf8'),/guangzhou:'dusk',shenzhen:'dusk'/);
  const scenery=buildShenzhenScene(),sky=scenery.root.getObjectByName('infinite-garden-sky');
  assert.equal(sky.material.uniforms.horizon.value.getHexString(),'e1ae88');
  scenery.water.dispose();
});

test('Shenzhen boardwalk turns onto a supported promenade connection',()=>{
  const scenery=buildShenzhenScene(),connector=scenery.root.getObjectByName('shenzhen-boardwalk-promenade-connector');
  assert.ok(connector&&scenery.walkSurfaces.includes(connector));
  assert.ok(scenery.root.getObjectByName('shenzhen-turning-platform-planks'));
  const arrival=scenery.root.getObjectByName('shenzhen-bay-arrival-deck');
  const boardwalk=scenery.root.getObjectByName('shenzhen-bay-continuous-boardwalk');
  const arrivalBounds=new T.Box3().setFromObject(arrival),boardwalkBounds=new T.Box3().setFromObject(boardwalk);
  assert.ok(arrivalBounds.min.z>=boardwalkBounds.max.z-.01,'arrival and long boardwalk plates must not overlap');
  assert.ok(clearSegment(new T.Vector3(0,0,-37),new T.Vector3(8.8,0,-37),shenzhenWalkable));
  scenery.water.dispose();
});

test('All city routes have a walkable terminal connection',()=>{
  const guangzhou=buildGuangzhouScene(),quanzhou=buildCityScene();
  assert.ok(guangzhou.root.getObjectByName('pearl-river-promenade-turning-plaza'));
  assert.ok(guangzhouWalkable(10,-37));
  assert.ok(quanzhou.root.getObjectByName('northern-landing-garden'));
  assert.ok(cityWalkable(0,-44));
  guangzhou.water.dispose();
  quanzhou.water.dispose();
});

test('City walk destinations land on the visible terminal platforms',()=>{
  const source=readFileSync(new URL('../city-world.js',import.meta.url),'utf8');
  assert.match(source,/destination:\{x:8\.0,z:-36\.7\}/);
  assert.match(source,/destination:\{x:10\.1,z:-37\.2\}/);
  assert.ok(findRoute({x:0,z:7},{x:10.1,z:-37.2},(x,z)=>guangzhouWalkable(x,z,.34),{bound:58,step:.45}));
  assert.ok(findRoute({x:0,z:7},{x:8.0,z:-36.7},(x,z)=>shenzhenWalkable(x,z,.34),{bound:58,step:.45}));
  assert.match(source,/routeBound:city==='quanzhou'\?70:58/);
  assert.equal(typeof CityWorld,'function');
});
