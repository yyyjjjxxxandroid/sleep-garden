const {test}=require('node:test'),assert=require('node:assert/strict');
async function fixture(){
 globalThis.window??={};await import('../story-world.js');const T=await import('../vendor/three/build/three.module.js');
 const cat=new T.Group(),catPath=new T.CatmullRomCurve3([new T.Vector3(-1,0,2),new T.Vector3(0,0,3),new T.Vector3(1,0,2),new T.Vector3(0,0,1)],true),world=Object.assign(Object.create(window.GardenWorld.prototype),{cat,catPath,pathLength:catPath.getLength(),catDistance:1.12,catSpeed:.64,t:0,state:{weather:'clear'},camera:new T.PerspectiveCamera(),controls:{target:new T.Vector3(),update(){}},catMixer:{update(){}},canvas:{dataset:{}},catResting:()=>false});
 world.updateCatMovement(0,1,0);return world;
}
for(const command of ['focus','home','zoomBy'])test(`${command} changes the camera without moving or turning the cat`,async()=>{
 const world=await fixture(),position=world.cat.position.clone(),heading=world.cat.rotation.y,distance=world.catDistance;
 world[command](command==='zoomBy'?1.15:undefined);
 for(let i=0;i<240;i++){world.t+=1/60;world.updateCatMovement(1/60,1,world.t);if(world.catCameraHeld(world.t)){assert.ok(world.cat.position.distanceTo(position)<1e-10);assert.equal(world.cat.rotation.y,heading);assert.equal(world.catDistance,distance)}}
 if(command==='focus'){assert.equal(world.catSpeed,0);world.home();world.transition=null}
 else world.transition=null;
 world.t+=1;world.updateCatMovement(1/60,1,world.t);assert.ok(world.catSpeed>0,'walking may resume after the view has settled');
 const dir=world.catPath.getTangentAt(world.catDistance/world.pathLength%1);assert.ok(Math.abs(world.cat.rotation.y-Math.atan2(dir.x,dir.z))<1e-9,'walking faces the path, not the camera');
});
test('all region buttons leave the actor in place throughout a camera transition',async()=>{
 const world=await fixture(),nodes=[],nav={append(b){nodes.push(b)},querySelectorAll(){return nodes}};
 globalThis.document={createElement(tag){return tag==='nav'?nav:{dataset:{},setAttribute(){}}}};nav.setAttribute=()=>{};
 world.host={parentElement:{append(){}}};world.onExplore=()=>{};world.buildNavigation();
 for(const button of nodes){
   const position=world.cat.position.clone(),heading=world.cat.rotation.y,distance=world.catDistance;world.catSpeed=.64;button.onclick();
   for(let i=0;i<180;i++){world.t+=1/60;world.updateCatMovement(1/60,1,world.t);assert.ok(world.cat.position.distanceTo(position)<1e-10);assert.equal(world.cat.rotation.y,heading);assert.equal(world.catDistance,distance)}
   world.transition=null;world.t+=1;world.updateCatMovement(1/60,1,world.t);assert.ok(world.catSpeed>0);
 }
});
