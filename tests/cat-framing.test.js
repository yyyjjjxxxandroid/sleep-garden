const {test}=require('node:test');
const assert=require('node:assert/strict');

// Project real mesh vertices using the production camera fit. UI rectangles
// are explicit fixtures; this is not a browser layout or phone verification.
for(const [width,height]of [[320,740],[390,844],[1280,800],[844,620]])for(const yaw of [0,Math.PI/2,-2.3])test(`close-up keeps the whole cat above the dock at ${width}×${height}, heading ${yaw.toFixed(2)}`,async()=>{
  globalThis.window??={};
  const T=await import('../vendor/three/build/three.module.js'),{createStoryCat}=await import('../story-cat.js');await import('../story-world.js');
  let time=0;const actor=createStoryCat({clock:()=>time,random:()=>.5}),cat=actor.root;cat.scale.setScalar(1.06);cat.rotation.y=yaw;cat.position.set(-1.4,.2,2.5);
  const element=(left,top,w,h)=>({getBoundingClientRect:()=>({left,top,width:w,height:h,right:left+w,bottom:top+h})});
  const canvas=element(40,30,width,height),bar=element(60,52,width-40,48),back=element(60,124,104,44),dock=element(60,30+height-210,width-40,194);
  globalThis.document={getElementById:id=>id==='controls'?dock:id==='backFocus'?back:null};
  const camera=new T.PerspectiveCamera(42,width/height,.1,100),controls={target:new T.Vector3()};
  const world=Object.assign(Object.create(window.GardenWorld.prototype),{cat,storyCat:actor,camera,canvas,controls,host:{parentElement:{querySelector:()=>bar}}});
  const first=world.catView();camera.position.copy(first.target).add(first.offset);camera.lookAt(first.target);camera.updateMatrixWorld(true);
  assert.ok(first.target.y-cat.position.y>=.5,'the fit must respect the existing OrbitControls ground limit');
  const advance=seconds=>{for(let i=0;i<Math.ceil(seconds*60);i++){time+=1/60;actor.animate(time,false,0,true,1/60)}};
  let visibleHeight=0;
  const inspect=()=>{
    cat.updateMatrixWorld(true);let minY=Infinity,maxY=-Infinity;
    cat.traverseVisible(mesh=>{
      if(!mesh.isMesh)return;const vertices=mesh.geometry.attributes.position;
      for(let i=0;i<vertices.count;i++){
        const p=new T.Vector3().fromBufferAttribute(vertices,i).applyMatrix4(mesh.matrixWorld).project(camera),x=(p.x+1)*width/2,y=(1-p.y)*height/2;
        assert.ok(x>width*.05&&x<width*.95,'ears, whiskers and tail need side margins');
        assert.ok(y>168-30&&y<height-210-8,'the head and paws must avoid the upper controls and bottom dock');
        minY=Math.min(minY,y);maxY=Math.max(maxY,y);
      }
    });
    visibleHeight=Math.max(visibleHeight,maxY-minY);
    const view=world.catView();assert.ok(view.target.distanceTo(first.target)<1e-8&&view.offset.distanceTo(first.offset)<1e-8,'posture and breathing must not pump the camera');
  };
  advance(.45);inspect();
  for(const zone of ['head','chin','back'])for(let variant=0;variant<3;variant++){
    actor.pet(zone);actor.touch(zone,{x:variant%2?.8:-.8,y:0});advance(1);inspect();actor.release();advance(.6);
  }
  advance(5);inspect();actor.pet('chin');actor.touch('chin',{x:.4,y:0});advance(1);inspect();actor.release();advance(12);inspect();
  assert.ok(visibleHeight>(height-210-138)*.48,'the cat should fill a useful portion of the clear area');
  dock.getBoundingClientRect=()=>({width:0,height:0});
  const quiet=world.catView();assert.ok(quiet.offset.length()<=first.offset.length()+.01,'hiding the dock should make use of the freed room');
});
