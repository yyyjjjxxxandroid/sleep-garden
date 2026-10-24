import * as T from './vendor/three/build/three.module.js';
import { OrbitControls } from './vendor/three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from './vendor/three/examples/jsm/environments/RoomEnvironment.js';
import { mergeGeometries } from './vendor/three/examples/jsm/utils/BufferGeometryUtils.js';
import { createStoryCat } from './story-cat.js';
import { createCityPerson } from './city-person.js';
import { buildCityScene, cityWalkable, CITY_FLOOR } from './city-scene.js';
import { TapGesture, findRoute, clearSegment } from './garden-navigation.mjs';

const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const turn=(object,heading,dt)=>{const difference=Math.atan2(Math.sin(heading-object.rotation.y),Math.cos(heading-object.rotation.y));object.rotation.y+=difference*(1-Math.exp(-dt*10));};

// Movement is independent from the camera and audio clocks. Route clearance is
// checked for the entire segment, so actors cannot cut through stones or water.
export class CityCompanions {
  constructor({onMessage=()=>{},reduced=false}={}){
    this.onMessage=onMessage;this.reduced=reduced;this.time=0;this.idle=0;this.playing=false;
    this.person=createCityPerson();this.kitten=createStoryCat({clock:()=>this.time});
    this.human=this.person.root;this.cat=this.kitten.root;this.cat.scale.setScalar(.38);
    this.human.name='city-person';this.cat.name='city-kitten';
    this.human.position.set(.15,CITY_FLOOR,6.5);this.cat.position.set(-.70,CITY_FLOOR,7.0);
    this.human.rotation.y=this.cat.rotation.y=Math.PI;
    this.route=[];this.catRoute=[];this.distance=0;this.catDistance=0;this.followAt=0;this.action=null;this.performed=new Set();
  }
  goTo(point){
    const route=findRoute(this.human.position,point,(x,z)=>cityWalkable(x,z,.34),{bound:44,step:.45});
    if(!route){this.onMessage('这里暂时走不到，点一下石板路吧。');return false;}
    this.route=route;this.idle=0;this.action=null;this.performed.clear();this.kitten.release();
    this.onMessage('慢慢走，小猫会跟着你。');return true;
  }
  advance(root,route,speed,dt,radius){
    let remaining=dt*speed,moved=0;
    while(route.length&&remaining>0){
      const target=route[0],dx=target.x-root.position.x,dz=target.z-root.position.z,d=Math.hypot(dx,dz);
      if(d<.015){route.shift();continue;}
      const amount=Math.min(remaining,d),next={x:root.position.x+dx/d*amount,z:root.position.z+dz/d*amount};
      if(!clearSegment(root.position,next,(x,z)=>cityWalkable(x,z,radius))){route.length=0;break;}
      root.position.x=next.x;root.position.z=next.z;turn(root,Math.atan2(dx,dz),dt);
      moved+=amount;remaining-=amount;if(amount>=d)route.shift();
    }
    return moved;
  }
  followDestination(){
    const heading=this.human.rotation.y;
    for(const side of [1,-1]){
      const p={x:this.human.position.x+Math.cos(heading)*side*.82-Math.sin(heading)*.50,z:this.human.position.z-Math.sin(heading)*side*.82-Math.cos(heading)*.50};
      if(cityWalkable(p.x,p.z,.22))return p;
    }
    return {x:this.human.position.x,z:this.human.position.z};
  }
  pet(){
    this.kitten.pet('head');this.action=null;this.onMessage('它眯起眼，轻轻靠了过来。');
  }
  reset(){
    this.route=[];this.catRoute=[];this.idle=0;this.action=null;this.performed.clear();
    this.human.position.set(.15,CITY_FLOOR,6.5);this.cat.position.set(-.70,CITY_FLOOR,7.0);
    this.human.rotation.y=this.cat.rotation.y=Math.PI;this.kitten.release();
  }
  update(dt){
    this.time+=dt;const humanMoved=this.advance(this.human,this.route,1.48,dt,.34),moving=humanMoved>.0001;
    this.distance+=humanMoved;this.idle=moving?0:this.idle+(this.playing?dt:0);
    if(moving){this.action=null;this.performed.clear();}
    const destination=this.followDestination();
    if(!this.action&&this.time>=this.followAt){
      this.followAt=this.time+.45;
      if(Math.hypot(destination.x-this.cat.position.x,destination.z-this.cat.position.z)>.5){
        this.catRoute=findRoute(this.cat.position,destination,(x,z)=>cityWalkable(x,z,.22),{bound:44,step:.45})||[];
      }
    }
    let catMoved=this.advance(this.cat,this.catRoute,2.0,dt,.22);this.catDistance+=catMoved;
    const nearby=this.cat.position.distanceTo(this.human.position)<1.5;
    if(this.playing&&!moving&&!this.action&&nearby&&!this.reduced){
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
        if(clearSegment(this.cat.position,next,(x,z)=>cityWalkable(x,z,.22)))this.cat.position.copy(next);
        turn(this.cat,this.human.rotation.y+.35,dt);interaction={action:'rub',time:age};
        if(age>3.6)this.action=null;
      }else{jump=Math.sin(Math.min(1,age/.85)*Math.PI)*.38;if(age>.85)this.action=null;}
    }
    this.cat.position.y=CITY_FLOOR+jump;
    this.kitten.setContext({night:false,listening:this.playing,wind:.28});
    this.kitten.animate(this.time,catMoved>.0001,.28,catMoved<.0001,dt,this.reduced,this.catDistance*10,interaction||(catMoved>.0001?{action:'walk',time:0}:null));
    this.person.animate(this.time,moving,dt,this.distance,!!this.action,this.reduced);
    this.moving=moving;this.human.userData.destination=this.route.at(-1)||null;
    this.cat.userData.cityAction=this.action?.kind||(catMoved>.0001?'following':'resting');
  }
}

export class CityWorld {
  constructor({host,onMessage=()=>{},onView=()=>{},onError=()=>{}}){
    this.host=host;this.onMessage=onMessage;this.onView=onView;this.onError=onError;
    this.active=false;this.last=0;this.time=0;this.frame=0;this.follow=false;this.disposed=false;this.listeners=[];
    this.reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches||false;
    // Keep stone close and tangible; let the town recede into estuary air.
    this.scene=new T.Scene();this.scene.fog=new T.Fog('#8eaaa9',26,163);
    this.camera=new T.PerspectiveCamera(48,1,.1,220);
    this.renderer=new T.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
    this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=.88;
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;
    this.canvas=this.renderer.domElement;this.canvas.className='city-3d-canvas';this.canvas.tabIndex=0;
    this.canvas.setAttribute('aria-label','洛阳桥三维场景。拖动旋转、双指缩放。点击石板路让人物行走，小猫会跟随。方向键旋转，WASD 行走，0 返回全景。');
    host.prepend(this.canvas);
    this.controls=new OrbitControls(this.camera,this.canvas);
    Object.assign(this.controls,{enableDamping:true,dampingFactor:.075,minDistance:3.5,maxDistance:54,minPolarAngle:.25,maxPolarAngle:Math.PI*.475,rotateSpeed:.55,zoomSpeed:.8,panSpeed:.65,screenSpacePanning:false});
    this.controls.addEventListener('start',()=>{this.transition=null;this.follow=false;this.onView('free');});
    const hemi=new T.HemisphereLight('#c1d2d5','#46544c',1.55);this.scene.add(hemi);
    this.sun=new T.DirectionalLight('#f3dec2',1.25);this.sun.position.set(-12,22,9);this.sun.castShadow=true;
    this.sun.shadow.mapSize.set(1024,1024);Object.assign(this.sun.shadow.camera,{left:-20,right:20,top:28,bottom:-27,near:1,far:80});this.sun.shadow.normalBias=.04;this.sun.shadow.bias=-.0002;this.sun.shadow.radius=3;this.scene.add(this.sun);
    const generator=new T.PMREMGenerator(this.renderer),room=new RoomEnvironment();this.environment=generator.fromScene(room,.06);this.scene.environment=this.environment.texture;this.scene.environmentIntensity=.20;generator.dispose();room.dispose();
    this.scenery=buildCityScene();this.scene.add(this.scenery.root);this.batchStonework();
    this.actors=new CityCompanions({onMessage,reduced:this.reduced});this.scene.add(this.actors.human,this.actors.cat);
    this.marker=new T.Mesh(new T.RingGeometry(.25,.31,40),new T.MeshBasicMaterial({color:'#fff1b8',side:T.DoubleSide,transparent:true,opacity:.8,depthWrite:false}));this.marker.rotation.x=-Math.PI/2;this.marker.position.y=CITY_FLOOR+.025;this.marker.visible=false;this.marker.userData.skipWaterReflection=true;this.scene.add(this.marker);
    this.ray=new T.Raycaster();this.pointer=new T.Vector2();this.gesture=new TapGesture();
    this.bindPicking();this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(host);
    this.setView('entrance',true);this.resize();
    this.canvas.dataset.ready='true';this.canvas.dataset.scene='luoyang-bridge-volumetric-3d';
    this.listen(this.canvas,'webglcontextlost',event=>{event.preventDefault();this.deactivate();this.onError('三维画面暂时中断，请返回花园后重新进入。');});
  }
  listen(target,type,fn,options){target.addEventListener(type,fn,options);this.listeners.push(()=>target.removeEventListener(type,fn,options));}
  batchStonework(){
    this.scenery.root.updateMatrixWorld(true);const buckets=new Map();
    this.scenery.root.traverse(o=>{
      if(!o.isMesh||o.isInstancedMesh||!o.material.isMeshStandardMaterial||o.material.transparent)return;
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
    const presets={entrance:{position:V(.5,7.6,23),target:V(0,.5,1.0)},bridge:{position:V(.35,2.8,-.2),target:V(0,.75,-16)},left:{position:V(3.2,2.5,-5.6),target:V(-8,-.15,-22)},right:{position:V(-3.2,2.5,-5.6),target:V(8,-.15,-22)}};
    const preset=presets[view];if(!preset)return;
    this.follow=false;this.transition={...preset};
    if(immediate||this.reduced){this.camera.position.copy(preset.position);this.controls.target.copy(preset.target);this.transition=null;this.controls.update();}
    this.onView(view);
  }
  focusPerson(){this.follow=true;this.transition=null;this.followOffset=V(1.6,3.4,8.3);this.onView('follow');}
  walkBridge(){if(this.goTo({x:0,z:-12})){this.focusPerson();return true;}return false;}
  goTo(point){
    if(!this.actors.goTo(point))return false;
    this.marker.position.set(point.x,CITY_FLOOR+.025,point.z);this.marker.visible=true;return true;
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
      if(parent===this.actors.human){this.focusPerson();this.onMessage('已选中人物。点一下石板路，我们一起走过去。');return;}
      if(parent.userData.citySolid){this.onMessage('点一下石板路，人物和小猫就会走过去。');return;}
      parent=parent.parent;
    }
    if(this.scenery.walkSurfaces.includes(hit.object)||(hit.object.userData.cityStonework&&Math.abs(hit.point.y-CITY_FLOOR)<.12&&cityWalkable(hit.point.x,hit.point.z)))this.goTo(hit.point);
    else this.onMessage('这里是潮水或岸边，试试桥面上的石板路。');
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
    this.actors.update(dt);this.scenery.update(this.reduced?0:this.time);
    if(this.follow){
      const target=this.actors.human.position.clone().add(V(0,1.0,0));
      this.controls.target.lerp(target,1-Math.exp(-dt*3.2));this.camera.position.lerp(target.clone().add(this.followOffset),1-Math.exp(-dt*2.8));
    }
    if(this.transition){
      const blend=1-Math.exp(-dt*2.1);this.camera.position.lerp(this.transition.position,blend);this.controls.target.lerp(this.transition.target,blend);
      if(this.camera.position.distanceTo(this.transition.position)<.03)this.transition=null;
    }
    this.controls.target.x=T.MathUtils.clamp(this.controls.target.x,-18,18);this.controls.target.z=T.MathUtils.clamp(this.controls.target.z,-43,15);this.controls.target.y=T.MathUtils.clamp(this.controls.target.y,-.2,6);
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
