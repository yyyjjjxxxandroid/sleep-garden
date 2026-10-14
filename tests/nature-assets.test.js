const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

// Load the shipped geometry through the production asset loader. Node does not
// decode browser image textures; only this fixture omits texture references.
test('original nature geometry survives loading at all quality levels',async()=>{
  globalThis.window??={};
  globalThis.ProgressEvent??=class ProgressEvent{constructor(type,values){this.type=type;Object.assign(this,values)}};
  const T=await import('../vendor/three/build/three.module.js');
  await import('../story-world.js');
  const bundle=JSON.parse(fs.readFileSync(new URL('../assets3d-v2/embedded.json',`file://${__filename}`),'utf8'));
  const names=['CommonTree_1','CommonTree_2','CommonTree_3','CommonTree_5','Flower_3_Group','Flower_4_Group','Grass_Common_Tall','Grass_Wispy_Tall','Bush_Common_Flowers','Rock_Medium_1','Rock_Medium_3'];
  const fixture={files:bundle.files,models:{}};
  const expected=new Map();
  for(const name of names){
    const model=structuredClone(bundle.models[name]);
    expected.set(name,model.meshes.flatMap(m=>m.primitives.map(p=>model.accessors[p.attributes.POSITION].count)).sort((a,b)=>a-b));
    delete model.images;delete model.textures;delete model.samplers;
    for(const material of model.materials||[]){
      for(const key of Object.keys(material))if(key.endsWith('Texture'))delete material[key];
      for(const key of Object.keys(material.pbrMetallicRoughness||{}))if(key.endsWith('Texture'))delete material.pbrMetallicRoughness[key];
    }
    fixture.models[name]=model;
  }
  const previous=window.STORY_ASSETS;
  window.STORY_ASSETS=fixture;
  try{
    for(const quality of ['high','mid','low']){
      const stop=new Error('geometry loaded; stop before creating the browser scene');
      const world=Object.assign(Object.create(window.GardenWorld.prototype),{
        quality,models:{},templates:{},wind:{time:{value:0},strength:{value:.35}},
        populateGarden(){throw stop},
      });
      await assert.rejects(world.loadAssets(),error=>error===stop);
      for(const name of names){
        const template=world.templates[name];
        assert.ok(template.height>0&&Number.isFinite(template.minY),`${quality}: ${name} has valid placement bounds`);
        assert.deepEqual(template.meshes.map(m=>m.geometry.attributes.position.count).sort((a,b)=>a-b),expected.get(name),`${quality}: ${name} must retain the original asset geometry`);
        for(const mesh of template.meshes){
          assert.ok(mesh.material.name,`${name} retains its original material identity`);
          if(/Leaves|Grass|Flowers/i.test(mesh.material.name)){
            assert.equal(mesh.material.side,T.DoubleSide);
            assert.ok(mesh.material.alphaTest>=.32);
            assert.equal(typeof mesh.material.userData.windPatch,'function');
          }
        }
      }
    }
  }finally{window.STORY_ASSETS=previous}
});
