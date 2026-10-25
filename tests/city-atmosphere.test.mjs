import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three/build/three.module.js';
import {buildGuangzhouScene} from '../guangzhou-scene.js';
import {buildShenzhenScene} from '../shenzhen-scene.js';
import {CityWorld} from '../city-world.js';
import {CITY_VIEWS,CITY_WATERFRONT_FOV} from '../city-views.js';

test('waterfront entrance cameras contain complete landmarks and both companions on wide and phone screens',()=>{
  for(const [id,build,landmark] of [['guangzhou',buildGuangzhouScene,'canton-tower-volumetric-landmark'],['shenzhen',buildShenzhenScene,'pingan-finance-centre-landmark']]){
    const scenery=build(),bounds=new T.Box3().setFromObject(scenery.root.getObjectByName(landmark));
    for(const aspect of [1100/850,390/844,320/568]){
      const camera=new T.PerspectiveCamera(CITY_WATERFRONT_FOV,aspect,.1,220),preset=CITY_VIEWS[id].entrance;
      camera.position.copy(preset.position);camera.lookAt(preset.target);camera.updateMatrixWorld();
      for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
        const p=new T.Vector3(x,y,z).project(camera);
        assert.ok(Math.abs(p.x)<.85&&Math.abs(p.y)<.8&&Math.abs(p.z)<1,`${id} landmark fits at ${aspect}`);
      }
      for(const x of [-1.3,0]){const p=new T.Vector3(x,1,7).project(camera);assert.ok(Math.abs(p.x)<.8&&Math.abs(p.y)<.7,'companions stay in view');}
    }
    scenery.water.dispose();
  }
});

test('switching atmosphere blends sky, fog, water and light together without moving actors',()=>{
  const scenery=buildShenzhenScene(),world=Object.assign(Object.create(CityWorld.prototype),{cityId:'shenzhen',scenery,scene:{fog:new T.Fog('#ffffff')},hemi:new T.HemisphereLight(),sun:new T.DirectionalLight(),renderer:{toneMappingExposure:1}});
  world.setMood('night',true);
  const before=scenery.water.material.uniforms.color.value.clone();world.setMood('dusk');world.updateAtmosphere(.5);
  const middle=scenery.water.material.uniforms.color.value.clone();assert.ok(!before.equals(middle));
  world.updateAtmosphere(1);assert.ok(!middle.equals(scenery.water.material.uniforms.color.value));
  const sky=scenery.root.getObjectByName('infinite-garden-sky');assert.equal(sky.material.depthWrite,false);assert.equal(sky.frustumCulled,false);
  world.hideProceduralNature();assert.equal(scenery.root.getObjectByName('shenzhen-bay-mangrove').visible,true);
  scenery.water.dispose();
});
