import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createStoryCat} from '../story-cat.js';
import {withPetPhotoPose,DEMO_PHOTOS} from '../pet-photo-pose.js';
import {PET_LAYOUT} from '../pet-layout.mjs';
import {PetCare} from '../pet-care.js';

test('demo photographs pose the identical rig and restore every transform after each capture',()=>{
  const storyCat=createStoryCat(),cat=storyCat.root,world={cat,storyCat};storyCat.animate(2,true,.4,false,.016);
  const original=[];cat.traverse(o=>original.push([o,o.position.clone(),o.quaternion.clone(),o.scale.clone(),o.visible]));const poses=[];
  for(const {pose}of DEMO_PHOTOS){withPetPhotoPose(world,pose,()=>{assert.equal(world.cat,cat);poses.push([storyCat.head.rotation.x,cat.getObjectByName('companion-body').rotation.z]);const source=cat.getObjectByName('upper-front--1'),joint=cat.getObjectByName('upper-front--1-skin-joint');assert.ok(joint.position.equals(source.position))});for(const[o,p,q,s,v]of original){assert.ok(o.position.equals(p));assert.ok(o.quaternion.equals(q));assert.ok(o.scale.equals(s));assert.equal(o.visible,v)}}
  assert.equal(new Set(poses.map(JSON.stringify)).size,3,'eating, rolling and sniffing are distinct');
  assert.throws(()=>withPetPhotoPose(world,'roll',()=>{throw Error('capture failure')}),/capture failure/);
  for(const[o,p,q,s,v]of original){assert.ok(o.position.equals(p));assert.ok(o.quaternion.equals(q));assert.ok(o.scale.equals(s));assert.equal(o.visible,v)}
});

test('wardrobe is cached high-resolution photography without a frame-loop capture',()=>{
  const src=readFileSync(new URL('../pet-care.js',import.meta.url),'utf8'),update=src.slice(src.indexOf('  update(dt){'));
  assert.doesNotMatch(update,/refreshPortrait\(/);assert.match(src,/lookThumbnails\[this.lookIndex\]\?\?=/);assert.match(src,/width:720,height:840,pose:'wardrobe'/);
});

test('the detached cushion is absent from layout, objects, UI and autonomous destinations',()=>{
  assert.equal(PET_LAYOUT.cushion,undefined);const src=readFileSync(new URL('../pet-care.js',import.meta.url),'utf8');assert.doesNotMatch(src,/this\.prop\('cushion'/);assert.doesNotMatch(src,/for\(const key of \['box','scratch','cushion'\]/);
  const care=Object.create(PetCare.prototype);assert.equal(care.command('cushion'),false);
});

test('saved memories join the horizontal gallery with no second vertical list',()=>{
  const src=readFileSync(new URL('../pet-care.js',import.meta.url),'utf8'),memories=src.slice(src.indexOf('  renderMemories(){'),src.indexOf('  inviteUser('));
  assert.match(memories,/card\.append\(text\);gallery\.append\(card\)/);
  assert.doesNotMatch(memories,/this\.body\.append\(card\)/);
});
