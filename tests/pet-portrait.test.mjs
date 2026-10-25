import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three/build/three.module.js';
import {petPortraitCamera,capturePetPortrait,captureObjectPortrait,hasPortraitSubject,PORTRAIT_VERSION} from '../pet-portrait.js';
import {createStoryCat} from '../story-cat.js';
import {PET_LOOKS,canWearLook,readPetState} from '../pet-care-state.mjs';
import {readFileSync} from 'node:fs';
import {freezePhotoSubject} from '../pet-snapshot.js';
import {withPetPhotoPose} from '../pet-photo-pose.js';

test('free looks can be worn; member looks require explicit demo membership',()=>{
  for(const look of PET_LOOKS){assert.equal(canWearLook(look,false),!look.premium);assert.equal(canWearLook(look,true),true)}
  assert.equal(canWearLook(PET_LOOKS[2],'true'),false);
  assert.equal(readPetState({getItem:()=>'{"demoMember":"true"}'}).demoMember,false);
  assert.equal(readPetState({getItem:()=>'{"demoMember":true}'}).demoMember,true);
});

test('cat portrait follows its facing direction and frames face, ears and paws',()=>{
  const cat=createStoryCat().root;cat.scale.setScalar(.609375);cat.position.set(10,.15,-1);
  for(const yaw of [0,1.4,3.14,4.7]){
    cat.rotation.y=yaw;cat.updateMatrixWorld(true);const camera=petPortraitCamera(cat);
    for(const point of [[0,0,0],[0,1.85,.49],[-.62,1.1,.49],[.62,1.1,.49]]){
      const p=cat.localToWorld(new T.Vector3(...point)).project(camera);
      assert.ok(Math.abs(p.x)<.9&&Math.abs(p.y)<.9&&p.z<1,'important silhouette stays in portrait');
    }
    const center=cat.localToWorld(new T.Vector3(0,.93,0)).project(camera);
    assert.ok(Math.abs(center.x)<.001&&Math.abs(center.y)<.001);
  }
});

test('failed portrait render restores scene, transforms, target and shared cat geometry',()=>{
  const scene=new T.Scene(),cat=createStoryCat().root;scene.add(new T.Group(),cat,new T.Group());cat.position.set(10,.2,-1);cat.rotation.y=1.2;
  const children=[...scene.children],position=cat.position.clone(),rotation=cat.quaternion.clone(),originalTarget={};let target=originalTarget,disposed=false;
  cat.children[0].getObjectByName('companion-torso').geometry.addEventListener('dispose',()=>disposed=true);
  const renderer={getRenderTarget:()=>target,setRenderTarget:t=>target=t,getClearColor:()=>new T.Color('#234567'),getClearAlpha:()=>1,setClearColor(){},clear(){},render(){throw Error('test failure')}};
  assert.throws(()=>capturePetPortrait({renderer,cat,scene},{studio:true}),/test failure/);
  assert.deepEqual(scene.children,children);assert.ok(cat.position.equals(position));assert.ok(cat.quaternion.equals(rotation));assert.equal(target,originalTarget);assert.equal(disposed,false);
});

test('empty and near-empty readbacks cannot be saved as pet photographs',()=>{
  const p=new Uint8Array(100*100*4);assert.equal(hasPortraitSubject(p),false);
  p[3]=255;assert.equal(hasPortraitSubject(p),false);
  for(let i=0;i<500;i++)p[i*4+3]=255;assert.equal(hasPortraitSubject(p),true);
  assert.equal(PORTRAIT_VERSION,6);
});

test('subject renderer isolates the pet and restores visibility even after empty readback',()=>{
  const cat=new T.Group(),scene=new T.Scene();scene.add(cat);cat.visible=false;const rock=new T.Mesh(new T.BoxGeometry(),new T.MeshBasicMaterial());scene.add(rock);
  let target=null,alpha=1,auto=true;
  const renderer={getRenderTarget:()=>target,setRenderTarget:t=>target=t,getClearColor:()=>new T.Color('#234567'),getClearAlpha:()=>alpha,setClearColor(c,a){alpha=a},clear(){},get autoClear(){return auto},set autoClear(v){auto=v},render(s){assert.ok(s.getObjectByName('pet-photo-snapshot'));assert.ok(!s.children.includes(cat));assert.ok(!s.children.includes(rock));assert.equal(cat.visible,false);assert.equal(alpha,0)},readRenderTargetPixels(){}};
  assert.throws(()=>captureObjectPortrait({renderer,cat,scene},cat,{cat:true}),/subject is missing/);
  assert.equal(cat.parent,scene);assert.equal(cat.visible,false);assert.equal(alpha,1);assert.equal(target,null);assert.equal(auto,true);
});

test('a floating-face image fails the full-cat check even with many opaque pixels',()=>{
  const pixels=new Uint8Array(100*100*4);
  for(let y=55;y<85;y++)for(let x=20;x<80;x++)pixels[(y*100+x)*4+3]=255;
  assert.equal(hasPortraitSubject(pixels,100,100,true),false);
  for(let y=15;y<50;y++)for(let x=30;x<70;x++)pixels[(y*100+x)*4+3]=255;
  assert.equal(hasPortraitSubject(pixels,100,100,true),true);
});

test('frozen photos retain the same complete deformed coat without GPU skeletons',()=>{
  const storyCat=createStoryCat(),cat=storyCat.root,world={cat,storyCat};const scene=new T.Scene();scene.add(cat);cat.scale.setScalar(.609375);cat.position.set(11,.2,-4);cat.rotation.y=1.7;
  for(const pose of ['wardrobe','meal','roll','sniff'])withPetPhotoPose(world,pose,()=>{
    const frozen=freezePhotoSubject(cat);frozen.root.updateMatrixWorld(true);
    try{
      assert.equal(cat.parent,scene,'live actor stays in the world');
      for(const name of ['kitten-round-face-surface','kitten-round-face-fur','companion-torso-surface','companion-torso-fur','upper-front--1-surface','upper-back-1-fur']){
        const mesh=frozen.root.getObjectByName(name),source=cat.getObjectByName(name);assert.ok(mesh,name);assert.ok(!mesh.isSkinnedMesh);assert.notEqual(mesh.material,source.material);assert.equal(mesh.geometry.attributes.skinIndex,undefined);
        const original=new T.Vector3(),baked=new T.Vector3(),inverse=cat.matrixWorld.clone().invert();
        for(const index of [0,Math.floor(mesh.geometry.attributes.position.count/2)]){
          source.getVertexPosition(index,original).applyMatrix4(source.matrixWorld).applyMatrix4(inverse).multiply(cat.scale);
          baked.fromBufferAttribute(mesh.geometry.attributes.position,index).applyMatrix4(mesh.matrixWorld);
          assert.ok(original.distanceTo(baked)<.00001,`${pose}: baked ${name} matches the live rig`);
        }
      }
    }finally{frozen.dispose()}
  });
});

test('hub layout overrides three-column cards and launcher respects hidden state',()=>{
  const css=readFileSync(new URL('../pet-care.css',import.meta.url),'utf8');
  assert.match(css,/\.pet-card-grid\.pet-hub-grid\{grid-template-columns:repeat\(2,/);
  assert.match(css,/\.pet-launcher\[hidden\]\{display:none!important\}/);
  const js=readFileSync(new URL('../story-cat.js',import.meta.url),'utf8');assert.doesNotMatch(js,/const whisker\s*=/);
  assert.doesNotMatch(readFileSync(new URL('../pet-care.js',import.meta.url),'utf8'),/看看猫窝|查看猫窝/);
});

test('portrait fur is shorter and matte without modifying the live cat or solid body',()=>{
  const cat=createStoryCat().root,fur=cat.getObjectByName('kitten-round-face-fur'),before=fur.geometry.attributes.position.array.slice(),sheen=fur.material.sheen;
  const full=freezePhotoSubject(cat),soft=freezePhotoSubject(cat,{softenFur:true});
  try{
    const a=full.root.getObjectByName(fur.name),b=soft.root.getObjectByName(fur.name),span=mesh=>new T.Vector3().fromBufferAttribute(mesh.geometry.attributes.position,7).distanceTo(new T.Vector3().fromBufferAttribute(mesh.geometry.attributes.position,0));
    assert.ok(Math.abs(span(b)/span(a)-.48)<.0001);assert.equal(b.material.sheen,.25);
    assert.deepEqual(soft.root.getObjectByName('companion-torso-surface').geometry.attributes.position.array,full.root.getObjectByName('companion-torso-surface').geometry.attributes.position.array);
    assert.deepEqual(fur.geometry.attributes.position.array,before);assert.equal(fur.material.sheen,sheen);
  }finally{full.dispose();soft.dispose()}
});
