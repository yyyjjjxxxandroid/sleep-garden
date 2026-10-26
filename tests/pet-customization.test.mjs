import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PET_PROFILE_KEY,PET_PRESETS,normalizePetProfile,readPetProfile,savePetProfile,validatePetPhoto,paletteFromPixels} from '../pet-photo-profile.mjs';
import {createStoryCat} from '../story-cat.js';
import {freezePhotoSubject} from '../pet-snapshot.js';

test('pet profile only saves validated colors and a bounded local thumbnail',()=>{
  const data=new Map(),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
  const profile={...PET_PRESETS[1],name:'  团团  ',photo:'https://example.com/private.jpg'};
  assert.equal(savePetProfile(storage,profile),true);
  assert.deepEqual(readPetProfile(storage),{...profile,name:'团团',photo:''});
  assert.equal(normalizePetProfile({...profile,base:'red'}),null);
  assert.equal(normalizePetProfile({...profile,pattern:'__proto__'}),null);
  assert.equal(normalizePetProfile({...profile,photo:'data:image/svg+xml,<svg/>'}).photo,'');
  assert.equal(normalizePetProfile({...profile,photo:'data:image/jpeg;base64,'+'a'.repeat(100000)}).photo,'');
  data.set(PET_PROFILE_KEY,'invalid JSON');assert.equal(readPetProfile(storage),null);
  savePetProfile(storage,profile);assert.equal(savePetProfile(storage,null),true);assert.equal(readPetProfile(storage),null);
  assert.equal(savePetProfile({setItem(){throw Error('quota')}},profile),false);
  assert.equal(savePetProfile(null,profile),false);
});

test('photo validation rejects unsupported and oversized images',()=>{
  for(const type of ['image/jpeg','image/png','image/webp'])assert.doesNotThrow(()=>validatePetPhoto({type,size:1024}));
  for(const file of [{type:'image/svg+xml',size:30},{type:'image/heic',size:40},{type:'image/png',size:9*1024*1024},{type:'image/jpeg',size:0}])assert.throws(()=>validatePetPhoto(file));
});

test('palette uses the central coat instead of green or edge scenery',()=>{
  const width=80,height=100,pixels=new Uint8Array(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const center=Math.abs(x-width/2)<20&&Math.abs(y-height/2)<30;
    pixels.set(center?[210,153,91,255]:[20,160,35,255],(y*width+x)*4);
  }
  assert.equal(paletteFromPixels(pixels,width,height).base,'#d2995b');
  assert.throws(()=>paletteFromPixels(new Uint8Array(400),10,10),/毛色/);
});

test('custom coats change the live skinned cat and portrait, then restore original materials exactly',()=>{
  const actor=createStoryCat(),face=actor.root.getObjectByName('kitten-round-face-surface'),hair=actor.root.getObjectByName('kitten-round-face-fur');
  const originalColor=face.material.color.clone(),originalHair=hair.geometry.attributes.color,originalMaterial=hair.material.color.clone();
  const bones=[],transforms=[];actor.root.traverse(o=>{if(o.isBone){bones.push(o);transforms.push(o.matrix.clone())}});
  for(const profile of PET_PRESETS){
    assert.equal(actor.setAppearance(profile).pattern,profile.pattern);
    assert.ok(face.material.vertexColors);assert.ok(face.geometry.attributes.color);assert.ok(hair.geometry.attributes.color!==originalHair);
    const color=face.geometry.attributes.color;
    assert.ok(color.array.some(v=>v<.5),'a real surface color changes, not just metadata');
    const snapshot=freezePhotoSubject(actor.root);
    try{assert.deepEqual(snapshot.root.getObjectByName(face.name).geometry.attributes.color.array,color.array)}finally{snapshot.dispose()}
  }
  bones.forEach((b,i)=>assert.ok(b.matrix.equals(transforms[i]),'changing coat must retain the animation rig'));
  actor.setAppearance(null);
  assert.ok(face.material.color.equals(originalColor));assert.ok(hair.material.color.equals(originalMaterial));
  assert.equal(face.geometry.attributes.color,undefined);assert.equal(hair.geometry.attributes.color,originalHair);assert.equal(actor.root.userData.petAppearance,null);
  actor.setAppearance(PET_PRESETS[1]);actor.animate(1,true,.2,false,.016);assert.equal(actor.root.userData.petAppearance.name,'奶牛猫');
});
