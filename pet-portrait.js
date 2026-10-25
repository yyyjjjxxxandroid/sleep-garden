import * as T from './vendor/three/build/three.module.js';
import {withPetPhotoPose} from './pet-photo-pose.js';
import {freezePhotoSubject} from './pet-snapshot.js';

export const PORTRAIT_VERSION=6;
export function petPortraitCamera(cat,aspect=4/5,studio=false){
  const s=cat.scale.x,target=new T.Vector3(0,.93*s,0);
  if(!studio)target.add(cat.position);
  const direction=new T.Vector3(.85,.48,3.9).multiplyScalar(s);
  if(!studio)direction.applyAxisAngle(new T.Vector3(0,1,0),cat.rotation.y);
  const camera=new T.PerspectiveCamera(37,aspect,.03,160);
  camera.position.copy(target).add(direction);camera.lookAt(target);camera.updateMatrixWorld(true);return camera;
}

// Validate a subject-only transparent render, never mistake scenery for the cat.
export function hasPortraitSubject(pixels,width=0,height=0,cat=false){
  let visible=0,body=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i]>100){visible++;if(cat){const row=Math.floor(i/4/width);if(row>height*.12&&row<height*.50)body++}}
  const area=pixels.length/4;
  return cat?visible>area*.10&&body>area*.025:visible>area*.015;
}
function readCanvas(renderer,target,width,height,validate=false){
  const pixels=new Uint8Array(width*height*4);renderer.readRenderTargetPixels(target,0,0,width,height,pixels);
  if(validate&&!hasPortraitSubject(pixels,width,height,validate==='cat'))throw Error('Portrait subject is missing or incomplete');
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d'),data=ctx.createImageData(width,height);
  for(let row=0;row<height;row++)data.data.set(pixels.subarray((height-1-row)*width*4,(height-row)*width*4),row*width*4);
  ctx.putImageData(data,0,0);return canvas;
}
export function captureObjectPortrait(world,subject,{width=240,height=220,cat=false,pose=null}={}){
  const renderer=world.renderer,snapshot=freezePhotoSubject(subject,{softenFur:cat});
  const oldTarget=renderer.getRenderTarget(),color=renderer.getClearColor(new T.Color()),alpha=renderer.getClearAlpha(),auto=renderer.autoClear;
  const target=new T.WebGLRenderTarget(width,height,{depthBuffer:true});target.texture.colorSpace=T.SRGBColorSpace;
  const scene=new T.Scene();scene.environment=world.scene.environment;scene.environmentIntensity=.35;
  scene.add(new T.HemisphereLight('#fffaf0','#a9b4ac',2.5));const light=new T.DirectionalLight('#fff7ed',2.4);light.position.set(-3,5,6);scene.add(light);
  const fill=new T.DirectionalLight('#dbe8e8',.7);fill.position.set(4,2,-3);scene.add(fill);
  try{
    scene.add(snapshot.root);snapshot.root.updateMatrixWorld(true);
    if(pose==='meal'&&world.petCare?.props.meal){const bowl=world.petCare.props.meal.clone(true);bowl.position.set(0,.01,subject.scale.x*1.25);bowl.scale.setScalar(.7);bowl.visible=true;bowl.traverse(o=>o.visible=true);scene.add(bowl)}
    if(pose==='sniff'&&world.grown?.length){const flower=world.grown[0].clone(true);flower.position.set(-.22,.01,subject.scale.x*1.22);flower.scale.setScalar(.24);flower.traverse(o=>o.visible=true);scene.add(flower)}
    let camera;
    if(cat){camera=petPortraitCamera(subject,width/height,true);if(pose==='roll'){camera.zoom=.82;camera.updateProjectionMatrix()}}
    else{
      const bounds=new T.Box3().setFromObject(snapshot.root),center=bounds.getCenter(new T.Vector3()),size=bounds.getSize(new T.Vector3());
      const span=Math.max(size.x,size.z,size.y)*1.6;camera=new T.OrthographicCamera(-span*width/height/2,span*width/height/2,span/2,-span/2,.01,100);
      camera.position.copy(center).add(new T.Vector3(3,2.8,4).multiplyScalar(Math.max(1,size.length())));camera.lookAt(center);camera.updateMatrixWorld(true);
    }
    renderer.autoClear=true;renderer.setClearColor(0,0);renderer.setRenderTarget(target);renderer.clear();renderer.render(scene,camera);
    return readCanvas(renderer,target,width,height,cat?'cat':true);
  }finally{
    renderer.setRenderTarget(oldTarget);renderer.setClearColor(color,alpha);renderer.autoClear=auto;target.dispose();snapshot.dispose();
  }
}
export function capturePetPortrait(world,{studio=false,width=400,height=500,pose=null}={}){
  return withPetPhotoPose(world,pose,()=>renderPetPortrait(world,{studio,width,height,pose}));
}
function renderPetPortrait(world,{studio,width,height,pose}){
  // Capture the pet first. A failed render cannot become an empty-garden memory.
  const pet=captureObjectPortrait(world,world.cat,{width,height,cat:true,pose});
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d');
  if(studio){
    const wash=ctx.createLinearGradient(0,0,0,height);wash.addColorStop(0,'#e8ede5');wash.addColorStop(.7,'#f2f0e5');wash.addColorStop(1,'#dce3d5');ctx.fillStyle=wash;ctx.fillRect(0,0,width,height);
    ctx.fillStyle='#b2bba67a';ctx.beginPath();ctx.ellipse(width*.5,height*.86,width*.28,height*.035,0,0,Math.PI*2);ctx.fill();
  }else{
    const r=world.renderer,old=r.getRenderTarget(),target=new T.WebGLRenderTarget(width,height);target.texture.colorSpace=T.SRGBColorSpace;
    const visible=world.cat.visible;
    try{
      world.cat.visible=false;r.setRenderTarget(target);r.clear();r.render(world.scene,petPortraitCamera(world.cat,width/height));
      const background=readCanvas(r,target,width,height);ctx.filter='blur(4px)';ctx.drawImage(background,-8,-8,width+16,height+16);ctx.filter='none';
      ctx.fillStyle='#f1f2dc24';ctx.fillRect(0,0,width,height);
    }finally{world.cat.visible=visible;r.setRenderTarget(old);target.dispose()}
  }
  ctx.drawImage(pet,0,0);return canvas.toDataURL('image/jpeg',.88);
}
