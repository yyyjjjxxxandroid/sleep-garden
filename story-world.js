import * as T from './vendor/three/build/three.module.js';
import { GardenWorld as BaseWorld } from './world-base.js';
import { GLTFLoader } from './vendor/three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from './vendor/three/examples/jsm/environments/RoomEnvironment.js';
import { createStoryCat } from './story-cat.js';
import { installDetails } from './story-detail.js';
import { installAtmosphere } from './story-atmosphere.js';

const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),clamp=T.MathUtils.clamp;
let seed=973;const rand=()=>((seed=seed*16807%2147483647)-1)/2147483646;
const nGLSL=`float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}float fbm(vec2 p){return noise(p)*.56+noise(p*2.03)*.27+noise(p*4.01)*.12+noise(p*8.1)*.05;}\n`;

class StoryWorld extends BaseWorld{
  constructor(opts){
    super(opts);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));this.renderer.toneMappingExposure=1.02;
    this.sun.shadow.mapSize.set(2048,2048);Object.assign(this.sun.shadow.camera,{left:-24,right:24,top:24,bottom:-24,near:.1,far:90});this.sun.shadow.camera.updateProjectionMatrix();this.sun.shadow.normalBias=.035;this.sun.shadow.bias=-.00018;
    this.sun.position.set(-15,24,11);this.scene.fog.density=.007;
    const pmrem=new T.PMREMGenerator(this.renderer);this.scene.environment=pmrem.fromScene(new RoomEnvironment(),.08).texture;pmrem.dispose();this.scene.environmentIntensity=.22;
    this.controls.maxDistance=70;this.controls.minDistance=3.6;this.controls.minPolarAngle=.34;this.controls.maxPolarAngle=Math.PI*.465;
    this.buildNavigation();
  }
  groundHeight(x,z){
    const edge=Math.max(0,Math.hypot(x,z)-8),hill=.018*edge+Math.sin(x*.095+.2)*Math.sin(z*.10)*Math.min(2.1,edge*.095);
    const flowerHill=2.4*Math.exp(-((x-16)**2+(z+12)**2)/150);
    const r=Math.sqrt(((x+3.5)/5.6)**2+((z+3.5)/3.8)**2);
    const hollow=-.85*(1-T.MathUtils.smoothstep(r,.72,1.08));
    return hill+flowerHill+hollow;
  }
  inPond(x,z){return ((x+3.5)/6.4)**2+((z+3.5)/4.35)**2<1}
  pathX(z){return 2.6+Math.sin(z*.16)*2.2+(z<-5?(-z-5)*.24:0)}
  buildTerrain(){
    const geo=new T.PlaneGeometry(170,170,180,180);geo.rotateX(-Math.PI/2);const p=geo.attributes.position,colors=[];
    const grass=new T.Color('#91ad77'),dark=new T.Color('#76956a'),sand=new T.Color('#cab998');
    for(let i=0;i<p.count;i++){
      const x=p.getX(i),z=p.getZ(i);p.setY(i,this.groundHeight(x,z));const a=.5+.25*Math.sin(x*.3+Math.sin(z*.2))+.2*Math.cos(z*.24-x*.1);const c=grass.clone().lerp(dark,a*.55);
      const pathDist=Math.abs(x-this.pathX(z)),pathBlend=(1-T.MathUtils.smoothstep(pathDist,.5,1.25))*T.MathUtils.smoothstep(28-Math.abs(z),0,4);
      c.lerp(sand,pathBlend*.82);const shore=Math.sqrt(((x+3.5)/5.6)**2+((z+3.5)/3.8)**2);c.lerp(new T.Color('#b0b38c'),(1-T.MathUtils.smoothstep(Math.abs(shore-1),.03,.19))*.7);colors.push(c.r,c.g,c.b);
    }geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.computeVertexNormals();
    const mat=new T.MeshStandardMaterial({vertexColors:true,roughness:1});mat.onBeforeCompile=s=>{s.vertexShader='varying vec3 gardenP;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ngardenP=position;');s.fragmentShader='varying vec3 gardenP;\n'+nGLSL+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nfloat grain=fbm(gardenP.xz*4.);diffuseColor.rgb*=.90+grain*.19;')};this.terrain=this.mesh(geo,mat);
    // Layered ridgelines wrap the distant landscape; each is an actual terrain mesh.
    for(let layer=0;layer<3;layer++){
      const g=new T.PlaneGeometry(240,95,70,26);g.rotateX(-Math.PI/2);const pp=g.attributes.position;
      for(let i=0;i<pp.count;i++){const x=pp.getX(i),z=pp.getZ(i);const h=(Math.sin(x*.023+layer*2)*.5+.5)*10+(Math.sin(x*.058+layer)*.5+.5)*5;pp.setY(i,Math.max(0,Math.sin((z+47.5)/95*Math.PI))*h-2)}g.computeVertexNormals();const o=this.mesh(g,this.mat(['#8faf9b','#9bbbaa','#b3cec0'][layer]),0,0,-103-layer*23);o.receiveShadow=false;
    }
  }
  buildWater(){
    const shape=new T.Shape();const pts=[];
    for(let i=0;i<84;i++){const a=i/84*Math.PI*2,r=1+.055*Math.sin(a*3)+.038*Math.cos(a*5);pts.push(new T.Vector2(Math.cos(a)*5.5*r,Math.sin(a)*3.7*r))}
    shape.moveTo(pts[0].x,pts[0].y);pts.slice(1).forEach(p=>shape.lineTo(p.x,p.y));shape.closePath();const geo=new T.ShapeGeometry(shape,48);geo.rotateX(-Math.PI/2);
    this.waterMat=new T.ShaderMaterial({uniforms:{time:{value:0},night:{value:0},rain:{value:0},wind:{value:.35}},vertexShader:`varying vec3 vP;varying vec3 vWorld;void main(){vP=position;vWorld=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.);}`,fragmentShader:`varying vec3 vP,vWorld;uniform float time,night,rain,wind;${nGLSL}
    void main(){vec2 p=vWorld.xz;vec3 view=normalize(cameraPosition-vWorld);float fresnel=pow(1.-max(0.,view.y),3.);float ripple=fbm(p*.95+vec2(time*.07,-time*.05));float r=length(vP.xz/vec2(5.5,3.7));vec3 deep=mix(vec3(.24,.47,.46),vec3(.10,.25,.29),night);vec3 sky=mix(vec3(.62,.79,.77),vec3(.21,.37,.44),night);vec3 col=mix(deep,sky,.22+fresnel*.5);col+=ripple*.045;col=mix(col,mix(vec3(.49,.64,.50),vec3(.22,.35,.31),night),smoothstep(.65,1.03,r)*.55);float wave=sin(p.x*4.+p.y*6.+ripple*8.-time*.4);float glint=pow(max(0.,wave),26.)*.05*(.3+wind);col+=glint;float shore=(1.-smoothstep(.009,.028,abs(r-.985-ripple*.013)))*.08;col+=shore;for(int i=0;i<8;i++){float j=float(i);vec2 c=vec2(hash(vec2(j,2.)),hash(vec2(j,7.)))*8.-4.;float age=fract(time*.3+j*.137);float ring=1.-smoothstep(.012,.040,abs(length(vP.xz-c)-age*1.4));col+=rain*ring*(1.-age)*.12;}gl_FragColor=vec4(col,1.);}`});
    this.water=this.mesh(geo,this.waterMat,-3.5,-.13,-3.5);
    // A narrow stream extends behind the pond into the woods.
    const vertices=[],uv=[],idx=[];for(let i=0;i<=65;i++){const z=-6-i*.43,x=-2.5+Math.sin(z*.18)*1.2;const y=this.groundHeight(x,z)+.025;vertices.push(x-.65,y,z,x+.65,y,z);uv.push(0,i/65,1,i/65);if(i<65){const a=i*2;idx.push(a,a+1,a+2,a+1,a+3,a+2)}}const streamGeo=new T.BufferGeometry();streamGeo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));streamGeo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));streamGeo.setIndex(idx);streamGeo.computeVertexNormals();this.mesh(streamGeo,this.waterMat);
    this.rippleRings=[];for(let i=0;i<6;i++){const ring=this.mesh(new T.RingGeometry(.37,.385,48),new T.MeshBasicMaterial({color:'#d9e6cb',transparent:true,opacity:.1,side:T.DoubleSide,depthWrite:false}),-5+rand()*5,-.11,-5+rand()*3);ring.rotation.x=-Math.PI/2;this.rippleRings.push(ring)}
  }
  buildSky(){
    super.buildSky();
    this.skyMat.fragmentShader=`varying vec3 d;uniform float night,time,rain,light;${nGLSL}void main(){vec3 v=normalize(d);float y=max(0.,v.y);vec3 day=mix(vec3(.79,.87,.81),vec3(.42,.66,.76),pow(y,.6));vec3 dusk=mix(vec3(.17,.25,.34),vec3(.025,.045,.105),pow(y,.5));vec3 c=mix(day,dusk,night);c=mix(c,mix(vec3(.59,.67,.67),vec3(.10,.16,.21),night),rain*.42);float cl=fbm(v.xz/max(.18,v.y)*1.2+vec2(time*.003,0.));cl=smoothstep(.56,.77,cl)*smoothstep(0.,.12,v.y);c=mix(c,mix(vec3(.96,.97,.90),vec3(.16,.23,.29),night),cl*.55);gl_FragColor=vec4(c,1.);}`;this.skyMat.needsUpdate=true;
  }
  addClouds(){
    const texCanvas=document.createElement('canvas');texCanvas.width=256;texCanvas.height=128;const c=texCanvas.getContext('2d');
    for(let i=0;i<25;i++){const x=30+rand()*190,y=48+rand()*28,r=16+rand()*23;const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'rgba(255,255,240,.68)');g.addColorStop(.55,'rgba(255,255,240,.5)');g.addColorStop(1,'rgba(255,255,240,0)');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2)}
    const tex=new T.CanvasTexture(texCanvas);this.clouds=[];for(let i=0;i<8;i++){const mat=new T.SpriteMaterial({map:tex,color:'#fff8e5',transparent:true,opacity:.75,depthWrite:false,fog:true});const cloud=new T.Sprite(mat);cloud.position.set(-45+i*15,23+rand()*9,-65-rand()*12);cloud.scale.set(28+rand()*18,15+rand()*8,1);this.scene.add(cloud);this.clouds.push(cloud)}
  }
  buildPlots(){this.plots=[];this.grown=[];for(let i=0;i<3;i++){const x=-.5+i*1.15,z=6.7,y=this.groundHeight(x,z);const soil=this.mesh(new T.CylinderGeometry(.41,.46,.045,40),this.mat('#a29072'),x,y+.015,z);soil.userData.plot=i;this.plots.push(soil)}}
  async loadAssets(){
    T.Cache.enabled=true;const bundle=window.STORY_ASSETS,loader=new GLTFLoader();
    const entries=Object.entries(bundle.models);
    await Promise.all(entries.map(async([name,json])=>{const data=JSON.parse(JSON.stringify(json));for(const b of data.buffers||[])b.uri=bundle.files[b.uri];for(const im of data.images||[]){im.uri=bundle.files[im.uri];im.mimeType='image/webp'}this.models[name]=await loader.parseAsync(JSON.stringify(data),'')}));
    for(const[name,gltf]of Object.entries(this.models)){gltf.scene.traverse(o=>{if(!o.isMesh)return;o.castShadow=true;o.receiveShadow=true;const m=o.material.clone();m.roughness=.88;m.metalness=0;m.envMapIntensity=.25;if(m.normalScale)m.normalScale.set(.28,.28);if(m.map){m.map.anisotropy=4;m.map.colorSpace=T.SRGBColorSpace}m.alphaTest=Math.max(m.alphaTest||0,.32);const foliage=/Leaves|Grass|Flowers/i.test(m.name);if(foliage){m.side=T.DoubleSide;m.shadowSide=T.DoubleSide;m.emissive.set('#78955f');m.emissiveIntensity=.045;o.geometry.computeBoundingBox();const b=o.geometry.boundingBox;o.material=this.windMaterial(m,b.max.y-b.min.y,b.min.y,name.startsWith('CommonTree')?.22:.10);o.customDepthMaterial=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking,map:m.map,alphaTest:m.alphaTest,side:T.DoubleSide});o.customDepthMaterial.onBeforeCompile=o.material.userData.windPatch;o.customDepthMaterial.customProgramCacheKey=o.material.customProgramCacheKey;}else o.material=m;})}
    this.staticRoots=[];this.place=(name,x,z,height,angle=rand()*6.28,options={})=>{
      const o=this.models[name].scene.clone(true),box=new T.Box3().setFromObject(o),s=height/(box.max.y-box.min.y),group=new T.Group();o.scale.setScalar(s);o.position.y=-box.min.y*s;group.add(o);group.position.set(x,this.groundHeight(x,z)+(options.lift||0),z);group.rotation.y=angle;if(options.width){group.scale.x=options.width;group.scale.z=options.width}this.scene.add(group);if(!options.dynamic)this.staticRoots.push(group);return group;
    };
    this.populateGarden();this.details=installDetails(this);this.atmosphere=installAtmosphere(this,T);this.batchScenery();this.makeCat();this.updateGrowth(true);this.buildBridge();this.addLilyPads();
    this.canvas.dataset.artVersion='storybook-v2';this.canvas.dataset.assets='Quaternius textured nature · CC0';
  }
  populateGarden(){
    const tree=(name,x,z,h,w=1)=>this.place(name,x,z,h,rand()*6.28,{width:w});
    tree('CommonTree_1',9,-4,9,1.12);tree('CommonTree_2',-11,-6,8,1.12);tree('CommonTree_3',-7,-17,9);tree('CommonTree_5',15,-14,9);tree('CommonTree_2',9,-22,10);
    // Small groups leave openings towards the bridge, flower slope and woodland.
    const groups=[[-22,-4],[-20,-19],[-13,-31],[0,-36],[19,-30],[29,-14],[27,9],[-22,13]];
    for(let j=0;j<groups.length;j++){const [gx,gz]=groups[j];for(let i=0;i<4;i++){const x=gx+(rand()-.5)*10,z=gz+(rand()-.5)*10;tree(['CommonTree_1','CommonTree_2','CommonTree_3','CommonTree_5'][(j+i)%4],x,z,7+rand()*7)}}
    const flowerBeds=[[-8,2,2.3],[-5,3,2],[-8,-8,2.3],[7,0,2.2],[9,5,2.8],[-5,10,2.4],[5,11,2.5],[15,-12,4.3],[18,-7,3.3],[-9,-21,3]];
    flowerBeds.push([-7,7,2.5],[7,8,2.4],[-10,-2,2],[2,-8,2]);
    for(let bi=0;bi<flowerBeds.length;bi++){const [x,z,r]=flowerBeds[bi];for(let i=0;i<30;i++){const a=rand()*6.28,rr=Math.sqrt(rand())*r;const px=x+Math.cos(a)*rr,pz=z+Math.sin(a)*rr;if(this.inPond(px,pz))continue;this.place(i%3?'Flower_4_Group':'Flower_3_Group',px,pz,.48+rand()*.52)}}
    for(let i=0;i<26;i++){const x=-38+i*3,z=-43+Math.sin(i*.8)*5;tree('CommonTree_2',x,z,9+rand()*4,1.2)}
    for(let i=0;i<35;i++){const a=rand()*6.28,r=12+rand()*21,x=Math.cos(a)*r,z=Math.sin(a)*r;if(z>14&&Math.abs(x)<13)continue;this.place('Bush_Common_Flowers',x,z,.6+rand()*.65)}
    // Dense patches, with the lawn and the path deliberately left quiet.
    for(let i=0;i<650;i++){let x=(rand()-.5)*62,z=(rand()-.5)*62;if(this.inPond(x,z)||Math.abs(x-this.pathX(z))<1.2)continue;const centre=Math.hypot(x-1,z-3);if(centre<5.8&&rand()<.9)continue;if(z>14&&Math.abs(x)<9)continue;this.place(i%3?'Grass_Common_Tall':'Grass_Wispy_Tall',x,z,.18+rand()*.43)}
    [[-8,-5,.6],[-7,0,.4],[-1,-.2,.32],[1,-4,.5],[-5,-7,.5],[-3,-7,.35],[6,-7,.7],[11,6,.55],[-10,6,.9],[14,-13,1.1]].forEach(([x,z,h],i)=>this.place(i%2?'Rock_Medium_1':'Rock_Medium_3',x,z,h));
    // Individual worn stepping stones sit within the dirt trail.
    for(let i=0;i<19;i++){const z=12-i*1.15,x=this.pathX(z);const stone=this.place('Rock_Medium_1',x,z,.13,Math.sin(i)*.2,{width:1.45});stone.scale.y=.7}
    this.addScatteredPetals();
  }
  addScatteredPetals(){
    const geo=new T.SphereGeometry(1,5,3),mat=new T.MeshStandardMaterial({color:'#edddc9',roughness:1});const count=340,mesh=new T.InstancedMesh(geo,mat,count),d=new T.Object3D();
    for(let i=0;i<count;i++){const x=(rand()-.5)*30,z=(rand()-.5)*30;d.position.set(x,this.groundHeight(x,z)+.025,z);d.scale.set(.027+rand()*.035,.007,.02+rand()*.04);d.rotation.y=rand()*6.28;d.updateMatrix();mesh.setMatrixAt(i,d.matrix);mesh.setColorAt(i,new T.Color(['#d9d7b3','#d9bcc7','#c4c9d2'][i%3]))}mesh.receiveShadow=true;this.scene.add(mesh);
  }
  buildBridge(){
    const root=new T.Group();root.position.set(-2.5,this.groundHeight(-2.5,-12)+.15,-12);root.rotation.y=-.15;this.scene.add(root);const wood=this.mat('#baa783'),dark=this.mat('#a39377');
    for(let i=0;i<12;i++){const b=new T.Mesh(new T.BoxGeometry(.22,.09,1.5),wood);b.position.set((i-5.5)*.23,Math.sin(i/11*Math.PI)*.19,0);b.rotation.z=Math.cos(i/11*Math.PI)*.1;b.castShadow=true;b.receiveShadow=true;root.add(b)}
    for(const side of [-1,1]){for(const x of [-1.3,0,1.3]){const p=new T.Mesh(new T.CylinderGeometry(.045,.05,.65,8),dark);p.position.set(x,.37,side*.72);p.castShadow=true;root.add(p)}const c=new T.CatmullRomCurve3([V(-1.4,.65,side*.72),V(0,.77,side*.72),V(1.4,.65,side*.72)]);const rail=new T.Mesh(new T.TubeGeometry(c,18,.03,6,false),dark);root.add(rail)}
  }
  addLilyPads(){
    const leafMat=this.mat('#819d6f'),petal=this.mat('#e9c5c6');
    for(const[x,z,s]of [[-6,-4,.32],[-5,-4.5,.24],[-2,-5,.35],[-1,-3,.26]]){const o=this.mesh(new T.CircleGeometry(s,32,0,Math.PI*1.84),leafMat,x,-.104,z);o.rotation.x=-Math.PI/2;o.rotation.z=rand()*6;const stem=this.mesh(new T.SphereGeometry(1,12,8),petal,x,-.07,z);stem.scale.set(.12,.08,.12)}
  }
  makeCat(){
    this.storyCat=createStoryCat();this.cat=this.storyCat.root;this.cat.scale.setScalar(.65);this.scene.add(this.cat);this.catMixer={update(){}};this.catAction=null;
    this.catPath=new T.CatmullRomCurve3([V(1.7,0,4.4),V(4,0,3.2),V(5.3,0,1.5),V(7,0,3),V(6,0,6.6),V(3,0,8),V(-1.3,0,7.6),V(-2,0,5.2)],true,'catmullrom',.28);this.catDistance=0;this.pathLength=this.catPath.getLength();this.canvas.dataset.catSource='Original storybook cat';this.canvas.dataset.catAnimation='articulated walk, breathing, blinking, ears and tail';
  }
  updateGrowth(force=false){
    if(!this.place)return;const records=this.state.records.slice(this.state.mode==='session'?-2:-3),signature=this.state.mode+':'+records.map(r=>r.id||r.date).join(',');
    if(force||signature!==this.recordSignature){this.recordSignature=signature;this.grown.forEach(x=>this.scene.remove(x));this.grown=[];for(let i=0;i<3;i++){const r=records[i],name=r?.type==='wind'?'Flower_4_Group':r?.type==='water'?'Bush_Common_Flowers':'Grass_Common_Tall';const plant=this.place(name,-.5+i*1.15,6.7,.63,0,{dynamic:true});this.grown.push(plant)}}for(let i=0;i<3;i++){const r=records[i];const s=r?(r.complete?1:.48):i===records.length&&this.state.mode==='session'?.1+Math.min(1,this.state.elapsed/90)*.7:.02;this.grown[i].scale.setScalar(s)}
  }
  home(immediate=false){
    this.follow=false;const weatherSky=['rainbow','aurora','meteor'].includes(this.state.weather),target=weatherSky?V(-1,4,-3):V(-1,2,-1.5),pos=weatherSky?V(6,9.5,27):V(6,12,29);if(immediate){this.camera.position.copy(pos);this.controls.target.copy(target);this.controls.update()}else this.transition={pos,target};this.selectRegion?.('pond');
  }
  buildNavigation(){
    const nav=document.createElement('nav');nav.className='region-nav';nav.setAttribute('aria-label','漫游花园');const regions=[['pond','池畔'],['meadow','花坡'],['woods','林间']];
    regions.forEach(([key,label])=>{const b=document.createElement('button');b.textContent=label;b.dataset.region=key;b.setAttribute('aria-pressed',key==='pond'?'true':'false');b.onclick=()=>{this.follow=false;this.onExplore();if(key==='pond')this.home();else this.transition=key==='meadow'?{pos:V(25,12,7),target:V(15,3,-10)}:{pos:V(7,10,-7),target:V(-3,2,-21)};this.selectRegion(key)};nav.append(b)});this.host.parentElement.append(nav);this.selectRegion=key=>{nav.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.region===key)));this.canvas.dataset.region=key};
  }
  beforeRender(dt){
    const n=this.skyMat.uniforms.night.value,light=this.state.light/100,rain=this.state.weather==='rain',t=this.t;
    this.hemi.intensity=T.MathUtils.lerp(1.1+light*.35,.68,n);this.hemi.color.set(n>.5?'#aac1d0':'#e9f2ed');this.hemi.groundColor.set(n>.5?'#435856':'#a1b282');
    this.sun.intensity=T.MathUtils.lerp((.22+light*2.7)*(rain?.52:1),.55,n);this.sun.color.set(n>.5?'#b3cee8':'#fff0d0');this.renderer.toneMappingExposure=T.MathUtils.lerp(1.02,1.0,n);this.scene.fog.color.copy(new T.Color('#c5dcd3').lerp(new T.Color('#283f50'),n));
    if(this.storyCat)this.storyCat.animate(t,!(this.follow||t%34>26),this.state.wind/100,this.follow);
    this.details?.update(t,n);
    this.atmosphere?.update(dt,t,n);
    this.clouds?.forEach((c,i)=>{c.material.opacity=(1-n*.7)*.6;c.material.color.set(n>.5?'#718c9f':'#fff8e8');c.position.x+=dt*.045*(.2+this.state.wind/100)});
    this.rippleRings?.forEach((r,i)=>{const f=(t*.09+i*.17)%1;r.scale.setScalar(.4+f*1.8);r.material.opacity=(1-f)*.095});
    // Surface controls stay faint; rendered world diagnostics are DOM-readable.
    this.canvas.dataset.catStyle='storybook';this.canvas.dataset.artVersion='storybook-v2';
  }
}
window.GardenWorld=StoryWorld;
