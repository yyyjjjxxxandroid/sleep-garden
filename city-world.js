import * as T from './vendor/three/build/three.module.js';
import { OrbitControls } from './vendor/three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from './vendor/three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from './vendor/three/examples/jsm/environments/RoomEnvironment.js';
import { mergeGeometries } from './vendor/three/examples/jsm/utils/BufferGeometryUtils.js';
import { createStoryCat } from './story-cat.js';
import { createCityPerson } from './city-person.js';
import { buildCityScene, cityWalkable, CITY_FLOOR } from './city-scene.js';
import { buildGuangzhouScene, guangzhouWalkable, GUANGZHOU_FLOOR } from './guangzhou-scene.js';
import { buildShenzhenScene, shenzhenWalkable, SHENZHEN_FLOOR } from './shenzhen-scene.js';
import { CITY_VIEWS, CITY_WATERFRONT_FOV } from './city-views.js';
import { CITY_ATMOSPHERES, defaultCityMood } from './city-atmosphere.js';
import { TapGesture, findRoute, clearSegment } from './garden-navigation.mjs';

const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const turn=(object,heading,dt)=>{const difference=Math.atan2(Math.sin(heading-object.rotation.y),Math.cos(heading-object.rotation.y));object.rotation.y+=difference*(1-Math.exp(-dt*10));};
const CITY_NATURE_ASSETS=['CommonTree_1','CommonTree_2','CommonTree_3','CommonTree_5','Flower_3_Group','Flower_4_Group','Bush_Common_Flowers','Grass_Common_Tall','Grass_Wispy_Tall','Rock_Medium_1','Rock_Medium_3'];
let cityNatureTemplatesPromise;
async function loadCityNatureTemplates(){
  if(typeof window==='undefined'||!window.STORY_ASSETS?.models)return null;
  if(cityNatureTemplatesPromise)return cityNatureTemplatesPromise;
  cityNatureTemplatesPromise=(async()=>{
    const bundle=window.STORY_ASSETS,loader=new GLTFLoader(),templates=new Map();
    for(const name of CITY_NATURE_ASSETS){
      const source=bundle.models[name];if(!source)continue;
      const data=typeof structuredClone==='function'?structuredClone(source):JSON.parse(JSON.stringify(source));
      for(const buffer of data.buffers||[])buffer.uri=bundle.files[buffer.uri];
      for(const image of data.images||[]){image.uri=bundle.files[image.uri];image.mimeType='image/webp';}
      const gltf=await loader.parseAsync(JSON.stringify(data),'');templates.set(name,gltf.scene);
    }
    return templates;
  })();
  return cityNatureTemplatesPromise;
}

function detailedNatureAsset(template,height,width=1){
  const model=template.clone(true);model.traverse(object=>{if(!object.isMesh)return;object.geometry=object.geometry.clone();const materials=Array.isArray(object.material)?object.material:[object.material];object.material=materials.map(material=>{const copy=material.clone(),owned=[];copy.roughness=.92;copy.metalness=0;copy.envMapIntensity=.22;for(const key of ['map','normalMap','roughnessMap','metalnessMap','alphaMap','aoMap'])if(copy[key]?.isTexture){copy[key]=copy[key].clone();copy[key].anisotropy=4;if(key==='map')copy[key].colorSpace=T.SRGBColorSpace;owned.push(copy[key]);}copy.userData={...copy.userData,cityTextures:owned};if(/Leaves|Grass|Flowers/i.test(copy.name)){copy.side=T.DoubleSide;copy.alphaTest=Math.max(copy.alphaTest||0,.34);copy.emissive.set('#708366');copy.emissiveIntensity=.025;}return copy;});if(object.material.length===1)object.material=object.material[0];object.castShadow=!/Grass|Flowers/i.test(materials[0]?.name||'');object.receiveShadow=true;});
  const bounds=new T.Box3().setFromObject(model),size=bounds.getSize(new T.Vector3()),scale=height/Math.max(.01,size.y),group=new T.Group();group.add(model);model.scale.setScalar(scale);model.position.y=-bounds.min.y*scale;group.scale.set(width,1,width);group.userData.citySolid=true;return group;
}

// Movement is independent from the camera and audio clocks. Route clearance is
// checked for the entire segment, so actors cannot cut through stones or water.
export class CityCompanions {
  constructor({onMessage=()=>{},reduced=false,walkable=cityWalkable,floor=CITY_FLOOR,start={x:.15,z:6.5},routeBound=44}={}){
    this.onMessage=onMessage;this.reduced=reduced;this.time=0;this.idle=0;this.playing=false;
    this.walkable=walkable;this.floor=floor;this.start=start;this.routeBound=routeBound;
    this.person=createCityPerson();this.kitten=createStoryCat({clock:()=>this.time});
    this.human=this.person.root;this.cat=this.kitten.root;this.cat.scale.setScalar(.38);
    this.human.name='city-person';this.cat.name='city-kitten';
    this.human.position.set(start.x,floor,start.z);this.cat.position.set(start.x-.85,floor,start.z+.5);
    this.human.rotation.y=this.cat.rotation.y=Math.PI;
    this.route=[];this.catRoute=[];this.distance=0;this.catDistance=0;this.followAt=0;this.action=null;this.performed=new Set();
  }
  goTo(point){
    this.resting=false;
    const route=findRoute(this.human.position,point,(x,z)=>this.walkable(x,z,.34),{bound:this.routeBound,step:.45});
    if(!route){this.onMessage('这里暂时走不到，试试可见的步道吧。');return false;}
    this.route=route;this.idle=0;this.action=null;this.performed.clear();this.kitten.release();
    this.onMessage('慢慢走，小猫会跟着你。');return true;
  }
  advance(root,route,speed,dt,radius){
    let remaining=dt*speed,moved=0;
    while(route.length&&remaining>0){
      const target=route[0],dx=target.x-root.position.x,dz=target.z-root.position.z,d=Math.hypot(dx,dz);
      if(d<.015){route.shift();continue;}
      const amount=Math.min(remaining,d),next={x:root.position.x+dx/d*amount,z:root.position.z+dz/d*amount};
      if(!clearSegment(root.position,next,(x,z)=>this.walkable(x,z,radius))){route.length=0;break;}
      root.position.x=next.x;root.position.z=next.z;turn(root,Math.atan2(dx,dz),dt);
      moved+=amount;remaining-=amount;if(amount>=d)route.shift();
    }
    return moved;
  }
  followDestination(){
    const heading=this.human.rotation.y;
    for(const side of [1,-1]){
      const p={x:this.human.position.x+Math.cos(heading)*side*.82-Math.sin(heading)*.50,z:this.human.position.z-Math.sin(heading)*side*.82-Math.cos(heading)*.50};
      if(this.walkable(p.x,p.z,.22))return p;
    }
    return {x:this.human.position.x,z:this.human.position.z};
  }
  rest(){this.resting=true;this.route=[];this.catRoute=[];this.action=null;this.kitten.release();}
  pet(){
    this.resting=false;this.kitten.pet('head');this.action=null;this.onMessage('它眯起眼，轻轻靠了过来。');
  }
  reset(){
    this.resting=false;this.route=[];this.catRoute=[];this.idle=0;this.action=null;this.performed.clear();
    this.human.position.set(this.start.x,this.floor,this.start.z);this.cat.position.set(this.start.x-.85,this.floor,this.start.z+.5);
    this.human.rotation.y=this.cat.rotation.y=Math.PI;this.kitten.release();
  }
  update(dt){
    this.time+=dt;const humanMoved=this.advance(this.human,this.route,1.48,dt,.34),moving=humanMoved>.0001;
    this.distance+=humanMoved;this.idle=moving?0:this.idle+(this.playing?dt:0);
    if(moving){this.action=null;this.performed.clear();}
    const destination=this.followDestination();
    if(!this.resting&&!this.action&&this.time>=this.followAt){
      this.followAt=this.time+.45;
      if(Math.hypot(destination.x-this.cat.position.x,destination.z-this.cat.position.z)>.5){
        this.catRoute=findRoute(this.cat.position,destination,(x,z)=>this.walkable(x,z,.22),{bound:this.routeBound,step:.45})||[];
      }
    }
    let catMoved=this.advance(this.cat,this.catRoute,2.0,dt,.22);this.catDistance+=catMoved;
    const nearby=this.cat.position.distanceTo(this.human.position)<1.5;
    if(this.playing&&!this.resting&&!moving&&!this.action&&nearby&&!this.reduced){
      if(this.idle>12&&!this.performed.has('rub')){this.action={kind:'rub',start:this.time};this.performed.add('rub');this.catRoute=[];this.onMessage('你停下来时，小猫轻轻蹭了蹭你的腿。');}
      else if(this.idle>36&&!this.performed.has('hop')){this.action={kind:'hop',start:this.time};this.performed.add('hop');this.catRoute=[];this.onMessage('它轻轻跳了一下，又回到你身边。');}
    }
    let interaction=null,jump=0;
    if(this.action){
      const age=this.time-this.action.start;
      if(this.action.kind==='rub'){
        const side=V(.46,0,.10).applyAxisAngle(V(0,1,0),this.human.rotation.y);
        const target=this.human.position.clone().add(side),blend=1-Math.exp(-dt*5);
        const next=this.cat.position.clone().lerp(target,blend);
        if(clearSegment(this.cat.position,next,(x,z)=>this.walkable(x,z,.22)))this.cat.position.copy(next);
        turn(this.cat,this.human.rotation.y+.35,dt);interaction={action:'rub',time:age};
        if(age>3.6)this.action=null;
      }else{jump=Math.sin(Math.min(1,age/.85)*Math.PI)*.38;if(age>.85)this.action=null;}
    }
    this.cat.position.y=this.floor+jump;
    this.kitten.setContext({night:false,listening:this.playing,wind:.28});
    this.kitten.animate(this.time,catMoved>.0001,.28,catMoved<.0001,dt,this.reduced,this.catDistance*10,interaction||(catMoved>.0001?{action:'walk',time:0}:null));
    this.person.animate(this.time,moving,dt,this.distance,!!this.action,this.reduced);
    this.moving=moving;this.human.userData.destination=this.route.at(-1)||null;
    this.cat.userData.cityAction=this.action?.kind||(catMoved>.0001?'following':'resting');
  }
}

export class CityWorld {
  constructor({host,onMessage=()=>{},onView=()=>{},onError=()=>{},city='quanzhou'}){
    this.host=host;this.onMessage=onMessage;this.onView=onView;this.onError=onError;
    // 默认镜头以滨水步道为前景，让人物、小猫和城市地标同时进入画面。
    // 旧镜头从停车带后方俯拍，首屏会被大块空地占掉，地标也容易被截在屏幕边缘。
    this.cityId=city;this.city=city==='shenzhen'?{build:buildShenzhenScene,walkable:shenzhenWalkable,floor:SHENZHEN_FLOOR,start:{x:0,z:7},destination:{x:0,z:-19},bounds:{x:32,zMin:-116,zMax:15},presets:CITY_VIEWS.shenzhen}:city==='guangzhou'?{build:buildGuangzhouScene,walkable:guangzhouWalkable,floor:GUANGZHOU_FLOOR,start:{x:0,z:7},destination:{x:0,z:-19},bounds:{x:34,zMin:-96,zMax:15},presets:CITY_VIEWS.guangzhou}:{build:buildCityScene,walkable:cityWalkable,floor:CITY_FLOOR,start:{x:.15,z:6.5},destination:{x:0,z:-12},bounds:{x:18,zMin:-68,zMax:15},presets:null};
    this.active=false;this.last=0;this.time=0;this.frame=0;this.follow=false;this.disposed=false;this.listeners=[];
    this.reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches||false;
    // Keep stone close and tangible; let the town recede into estuary air.
    this.scene=new T.Scene();this.scene.fog=new T.Fog('#8eaaa9',26,163);
    if(city==='guangzhou'){this.scene.fog=new T.Fog('#a7b1a6',52,188);this.scene.background=new T.Color('#c2c7bb');}
    if(city==='shenzhen'){this.scene.fog=new T.Fog('#aab5aa',52,192);this.scene.background=new T.Color('#c4cabd');}
    this.camera=new T.PerspectiveCamera(city==='quanzhou'?48:CITY_WATERFRONT_FOV,1,.1,220);
    this.renderer=new T.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
    this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=.88;
    if(city==='guangzhou'||city==='shenzhen')this.renderer.toneMappingExposure=1.02;
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;
    this.canvas=this.renderer.domElement;this.canvas.className='city-3d-canvas';this.canvas.tabIndex=0;
    this.canvas.setAttribute('aria-label',(city==='guangzhou'?'广州珠江边':city==='shenzhen'?'深圳湾':'洛阳桥')+'三维场景。拖动旋转、双指缩放。点击步道让人物行走，小猫会跟随。方向键旋转，WASD 行走，0 返回全景。');
    host.prepend(this.canvas);
    this.controls=new OrbitControls(this.camera,this.canvas);
    Object.assign(this.controls,{enableDamping:true,dampingFactor:.075,minDistance:3.5,maxDistance:54,minPolarAngle:.25,maxPolarAngle:Math.PI*.475,rotateSpeed:.55,zoomSpeed:.8,panSpeed:.65,screenSpacePanning:false});
    if(city==='guangzhou'||city==='shenzhen')this.controls.maxDistance=124;
    this.controls.addEventListener('start',()=>{this.transition=null;this.follow=false;this.onView('free');});
    const hemi=this.hemi=new T.HemisphereLight('#c1d2d5','#46544c',1.55);this.scene.add(hemi);
    this.sun=new T.DirectionalLight('#f3dec2',1.25);this.sun.position.set(-12,22,9);this.sun.castShadow=true;
    if(city==='guangzhou'){hemi.color.set('#e4e6d8');hemi.groundColor.set('#7b826f');hemi.intensity=1.62;this.sun.color.set('#f7e8cb');this.sun.intensity=1.12;this.sun.position.set(-12,24,11);}
    if(city==='shenzhen'){hemi.color.set('#e5e8dc');hemi.groundColor.set('#747f70');hemi.intensity=1.66;this.sun.color.set('#f8e7c8');this.sun.intensity=1.08;this.sun.position.set(-14,23,10);}
    this.sun.shadow.mapSize.set(1024,1024);Object.assign(this.sun.shadow.camera,{left:-20,right:20,top:28,bottom:-27,near:1,far:80});this.sun.shadow.normalBias=.04;this.sun.shadow.bias=-.0002;this.sun.shadow.radius=3;this.scene.add(this.sun);
    const generator=new T.PMREMGenerator(this.renderer),room=new RoomEnvironment();this.environment=generator.fromScene(room,.06);this.scene.environment=this.environment.texture;this.scene.environmentIntensity=city==='quanzhou'?.20:.34;generator.dispose();room.dispose();
    this.scenery=this.city.build();this.scene.add(this.scenery.root);this.setMood(defaultCityMood(city),true);this.hideProceduralNature();this.batchStonework();this.installDetailedNature();
    this.actors=new CityCompanions({onMessage,reduced:this.reduced,walkable:this.city.walkable,floor:this.city.floor,start:this.city.start,routeBound:city==='quanzhou'?70:44});this.scene.add(this.actors.human,this.actors.cat);
    this.marker=new T.Mesh(new T.RingGeometry(.25,.31,40),new T.MeshBasicMaterial({color:'#fff1b8',side:T.DoubleSide,transparent:true,opacity:.8,depthWrite:false}));this.marker.rotation.x=-Math.PI/2;this.marker.position.y=this.city.floor+.025;this.marker.visible=false;this.marker.userData.skipWaterReflection=true;this.scene.add(this.marker);
    this.ray=new T.Raycaster();this.pointer=new T.Vector2();this.gesture=new TapGesture();
    this.bindPicking();this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(host);
    this.setView('entrance',true);this.resize();
    this.canvas.dataset.ready='true';this.canvas.dataset.scene=city==='guangzhou'?'guangzhou-pearl-river-volumetric-3d':city==='shenzhen'?'shenzhen-bay-volumetric-3d':'luoyang-bridge-volumetric-3d';
    this.listen(this.canvas,'webglcontextlost',event=>{event.preventDefault();this.deactivate();this.onError('三维画面暂时中断，请返回花园后重新进入。');});
  }
  setMood(mood,immediate=false){
    if(!CITY_ATMOSPHERES[mood])return;
    this.mood=mood;this.atmosphere=CITY_ATMOSPHERES[mood];
    this.atmosphereColors=Object.fromEntries(['top','horizon','fog','water','sky','ground','sun'].map(key=>[key,new T.Color(this.atmosphere[key])]));
    if(immediate||this.reduced)this.updateAtmosphere(1);
  }
  updateAtmosphere(blend){
    if(!this.atmosphere)return;
    const p=this.atmosphere,c=this.atmosphereColors,sky=this.scenery.root.getObjectByName('infinite-garden-sky');
    sky.material.uniforms.top.value.lerp(c.top,blend);sky.material.uniforms.horizon.value.lerp(c.horizon,blend);
    this.scene.fog.color.lerp(c.fog,blend);this.scenery.water.material.uniforms.color.value.lerp(c.water,blend);
    this.scene.fog.near=T.MathUtils.lerp(this.scene.fog.near,p.fogNear,blend);this.scene.fog.far=T.MathUtils.lerp(this.scene.fog.far,p.fogFar,blend);
    this.hemi.color.lerp(c.sky,blend);this.hemi.groundColor.lerp(c.ground,blend);this.sun.color.lerp(c.sun,blend);
    this.hemi.intensity=T.MathUtils.lerp(this.hemi.intensity,p.hemi,blend);this.sun.intensity=T.MathUtils.lerp(this.sun.intensity,p.key,blend);
    this.renderer.toneMappingExposure=T.MathUtils.lerp(this.renderer.toneMappingExposure,p.exposure,blend);
  }
  listen(target,type,fn,options){target.addEventListener(type,fn,options);this.listeners.push(()=>target.removeEventListener(type,fn,options));}
  hideProceduralNature(){
    if(this.cityId==='quanzhou')return;
    const hidden=new Set(['pearl-river-banyan']);
    this.scenery.root.traverse(object=>{if(hidden.has(object.name))object.traverse(child=>{child.visible=false;});});
  }
  async installDetailedNature(){
    if(this.cityId==='quanzhou')return;
    try{
      const templates=await loadCityNatureTemplates();if(this.disposed||!templates?.size)return;
      const group=new T.Group();group.name=`${this.cityId}-textured-nature`;this.scenery.root.add(group);
      const place=(name,x,z,height,angle=0,width=1,y=0)=>{const template=templates.get(name);if(!template)return;const asset=detailedNatureAsset(template,height,width);asset.name=`${this.cityId}-${name.toLowerCase()}`;asset.position.set(x,y,z);asset.rotation.y=angle;group.add(asset);};
      // Guangzhou and Shenzhen use their own low, continuous waterfront
      // planting. Generic trees and flower clusters read as isolated props here.
      const rocks=[];
      rocks.forEach(([x,z,h],index)=>place(index%2?'Rock_Medium_3':'Rock_Medium_1',x,z,h,index*1.13,1.15));
      if(this.cityId==='shenzhen'){
        for(let i=0;i<12;i++){
          const z=6-i*3.8,x=9.28+(i%3)*.18;
          place(i%2?'Grass_Wispy_Tall':'Grass_Common_Tall',x,z,.42+(i%4)*.07,i*.83,.72+(i%3)*.08);
          if(i%3===0)place('Grass_Common_Tall',x-.26,z+.62,.30,i*.47,.68);
        }
      }
      this.canvas.dataset.nature='textured-quaternius';
    }catch(error){console.warn('Detailed city nature could not be loaded.',error);this.canvas.dataset.nature='procedural-fallback';}
  }
  batchStonework(){
    this.scenery.root.updateMatrixWorld(true);const buckets=new Map();
    this.scenery.root.traverse(o=>{
      if(!o.isMesh||!o.visible||o.isInstancedMesh||!o.material.isMeshStandardMaterial||o.material.transparent)return;
      // Moored boats rock as groups. Their local meshes must retain transforms.
      for(let p=o;p;p=p.parent)if(p.userData.cityAnimated)return;
      const key=o.material.uuid;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(o);
    });
    this.hiddenStonework=[];
    for(const objects of buckets.values()){
      if(objects.length<3)continue;
      const parts=objects.map(o=>{const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(o.matrixWorld);return g;});
      const geometry=mergeGeometries(parts);parts.forEach(g=>g.dispose());if(!geometry)continue;
      const batch=new T.Mesh(geometry,objects[0].material);batch.name='batched-city-stonework';batch.userData.cityStonework=true;batch.castShadow=batch.receiveShadow=true;
      this.scene.add(batch);objects.forEach(o=>{o.visible=false;this.hiddenStonework.push(o);});
    }
  }
  resize(){
    const {width,height}=this.host.getBoundingClientRect();if(!width||!height)return;
    this.renderer.setSize(width,height,false);this.camera.aspect=width/height;this.camera.updateProjectionMatrix();
  }
  setView(view,immediate=false){
    const presets=this.city?.presets||{entrance:{position:V(.5,7.6,23),target:V(0,.5,1.0)},courtyard:{position:V(11,8,19),target:V(-5,2.1,5)},bridge:{position:V(.35,2.8,-.2),target:V(0,.75,-16)},left:{position:V(3.2,2.5,-5.6),target:V(-8,-.15,-22)},right:{position:V(-3.2,2.5,-5.6),target:V(8,-.15,-22)}};
    const preset=presets[view];if(!preset)return;
    this.follow=false;this.transition={...preset};
    if(immediate||this.reduced){this.camera.position.copy(preset.position);this.controls.target.copy(preset.target);this.transition=null;this.controls.update();}
    this.onView(view);
  }
  focusPerson(){this.follow=true;this.transition=null;this.followOffset=V(1.6,3.4,8.3);this.onView('follow');}
  walkBridge(){if(this.goTo(this.city.destination)){this.focusPerson();return true;}return false;}
  goTo(point){
    if(!this.actors.goTo(point))return false;
    this.marker.position.set(point.x,this.city.floor+.025,point.z);this.marker.visible=true;return true;
  }
  bindPicking(){
    this.listen(this.canvas,'pointerdown',e=>this.gesture.down(e,performance.now()));
    this.listen(this.canvas,'pointermove',e=>this.gesture.move(e));
    this.listen(this.canvas,'pointercancel',e=>this.gesture.cancel(e.pointerId));
    this.listen(this.canvas,'lostpointercapture',e=>this.gesture.cancel(e.pointerId));
    this.listen(this.canvas,'pointerup',e=>{if(this.gesture.up(e,performance.now()))this.pick(e.clientX,e.clientY);});
    this.listen(this.canvas,'keydown',e=>{
      const key=e.key.toLowerCase();
      if(['w','a','s','d'].includes(key)){
        e.preventDefault();const p=this.actors.human.position;this.goTo({x:p.x+(key==='a'?-1:key==='d'?1:0),z:p.z+(key==='w'?-1:key==='s'?1:0)});return;
      }
      if(!['arrowleft','arrowright','arrowup','arrowdown','+','-','0'].includes(key))return;e.preventDefault();
      if(key==='0'){this.setView('entrance');return;}
      this.transition=null;this.follow=false;const d=this.camera.position.clone().sub(this.controls.target);
      if(key==='+'||key==='-')d.multiplyScalar(key==='+'?.86:1.16).clampLength(3.5,54);
      else if(key==='arrowleft'||key==='arrowright')d.applyAxisAngle(V(0,1,0),key==='arrowleft'?.15:-.15);
      else d.y+=key==='arrowup'?1:-1;
      this.camera.position.copy(this.controls.target).add(d);this.controls.update();this.onView('free');
    });
  }
  pick(clientX,clientY){
    const box=this.canvas.getBoundingClientRect();this.pointer.set((clientX-box.left)/box.width*2-1,-(clientY-box.top)/box.height*2+1);
    this.scene.updateMatrixWorld(true);this.ray.setFromCamera(this.pointer,this.camera);
    const hits=this.ray.intersectObjects(this.scene.children,true).filter(h=>h.object!==this.marker&&h.object.visible&&h.object.name!=='infinite-garden-sky');
    const hit=hits[0];if(!hit)return;
    let parent=hit.object;
    while(parent){
      if(parent===this.actors.cat){this.actors.pet();return;}
      if(parent===this.actors.human){this.focusPerson();this.onMessage('已选中人物。点一下步道，我们一起走过去。');return;}
      if(parent.userData.citySolid){this.onMessage('点一下步道，人物和小猫就会走过去。');return;}
      parent=parent.parent;
    }
    if(this.scenery.walkSurfaces.includes(hit.object)||(hit.object.userData.cityStonework&&Math.abs(hit.point.y-this.city.floor)<.12&&this.city.walkable(hit.point.x,hit.point.z)))this.goTo(hit.point);
    else this.onMessage('这里是水面或岸边，试试可见的步道。');
  }
  activate(){if(this.active||this.disposed)return;this.active=true;this.last=0;this.resize();this.frame=requestAnimationFrame(now=>this.update(now));}
  deactivate(){this.active=false;cancelAnimationFrame(this.frame);this.frame=0;this.last=0;this.gesture?.active.clear();if(this.gesture)this.gesture.tap=null;}
  setPlaying(value){this.actors.playing=value;}
  reset(){this.actors.reset();this.marker.visible=false;this.setView('entrance');}
  update(now){
    if(!this.active||this.disposed)return;
    this.frame=requestAnimationFrame(t=>this.update(t));
    if(document.hidden){this.last=now;return;}
    const dt=this.last?Math.min(.05,(now-this.last)/1000):0;this.last=now;this.time+=dt;
    this.updateAtmosphere(this.reduced?1:1-Math.exp(-dt*2));
    this.actors.update(dt);this.scenery.update(this.reduced?0:this.time);
    if(this.follow){
      const target=this.actors.human.position.clone().add(V(0,1.0,0));
      this.controls.target.lerp(target,1-Math.exp(-dt*3.2));this.camera.position.lerp(target.clone().add(this.followOffset),1-Math.exp(-dt*2.8));
    }
    if(this.transition){
      const blend=1-Math.exp(-dt*2.1);this.camera.position.lerp(this.transition.position,blend);this.controls.target.lerp(this.transition.target,blend);
      if(this.camera.position.distanceTo(this.transition.position)<.03)this.transition=null;
    }
    this.controls.target.x=T.MathUtils.clamp(this.controls.target.x,-this.city.bounds.x,this.city.bounds.x);this.controls.target.z=T.MathUtils.clamp(this.controls.target.z,this.city.bounds.zMin,this.city.bounds.zMax);this.controls.target.y=T.MathUtils.clamp(this.controls.target.y,-.2,this.cityId==='quanzhou'?6:45);
    this.controls.update();this.marker.visible=this.actors.route.length>0;this.marker.material.opacity=.5+Math.sin(this.time*3)*.2;
    this.renderer.render(this.scene,this.camera);
    this.canvas.dataset.personPosition=`${this.actors.human.position.x.toFixed(2)},${this.actors.human.position.z.toFixed(2)}`;
    this.canvas.dataset.catPosition=`${this.actors.cat.position.x.toFixed(2)},${this.actors.cat.position.z.toFixed(2)}`;
    this.canvas.dataset.personPose=this.actors.human.userData.pose;this.canvas.dataset.catAction=this.actors.cat.userData.cityAction;
    this.canvas.dataset.drawCalls=String(this.renderer.info.render.calls);this.canvas.dataset.triangles=String(this.renderer.info.render.triangles);
  }
  dispose(){
    if(this.disposed)return;this.deactivate();this.disposed=true;this.resizeObserver.disconnect();this.controls.dispose();this.listeners.forEach(remove=>remove());
    const geometries=new Set(),materials=new Set(),textures=new Set();
    // The kitten undercoat DataTexture is shared with the garden; only dispose
    // city-owned inscriptions and granite relief, not shared material inputs.
    this.scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[]){materials.add(m);for(const value of Object.values(m))if(value?.isCanvasTexture)textures.add(value);for(const texture of m.userData?.cityTextures||[])textures.add(texture);}});
    this.scenery.water.dispose();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());this.environment.dispose();this.renderer.dispose();this.canvas.remove();
  }
}
