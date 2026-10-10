import * as T from './vendor/three/build/three.module.js';
import * as Environment from './garden-environment.js';
import { GardenWorld as BaseWorld } from './world-base.js';
import { GLTFLoader } from './vendor/three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from './vendor/three/examples/jsm/environments/RoomEnvironment.js';
import { mergeGeometries } from './vendor/three/examples/jsm/utils/BufferGeometryUtils.js';
import { createStoryCat } from './story-cat.js';
import { installDetails } from './story-detail.js';
import { installAtmosphere } from './story-atmosphere.js';
import { sculptTrees, installGardenCraft, installPondBank, installShoreLife, installWoodlandRest, woodGrain } from './garden-art.js';

const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),clamp=T.MathUtils.clamp;
let seed=973;const rand=()=>((seed=seed*16807%2147483647)-1)/2147483646;
const nGLSL=`float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}float fbm(vec2 p){return noise(p)*.56+noise(p*2.03)*.27+noise(p*4.01)*.12+noise(p*8.1)*.05;}\n`;

class StoryWorld extends BaseWorld{
  constructor(opts){
    super(opts);
    this.renderer.toneMappingExposure=.96;this.camera.fov=42;this.camera.updateProjectionMatrix();
    this.sun.position.set(-15,24,11);this.scene.fog.density=.014;
    if(this.quality!=='low'){Object.assign(this.sun.shadow.camera,{left:-24,right:24,top:24,bottom:-24,near:.1,far:90});this.sun.shadow.camera.updateProjectionMatrix();this.sun.shadow.normalBias=.035;this.sun.shadow.bias=-.00018;
      const pmrem=new T.PMREMGenerator(this.renderer);this.scene.environment=pmrem.fromScene(new RoomEnvironment(),.08).texture;pmrem.dispose();this.scene.environmentIntensity=.22;}
    this.controls.maxDistance=70;this.controls.minDistance=3.6;this.controls.minPolarAngle=.34;this.controls.maxPolarAngle=Math.PI*.465;
    this.buildNavigation();
  }
  groundHeight(x,z){
    const edge=Math.max(0,Math.hypot(x,z)-8),hill=.018*edge+Math.sin(x*.095+.2)*Math.sin(z*.10)*Math.min(2.1,edge*.095);
    const flowerHill=2.4*Math.exp(-((x-16)**2+(z+12)**2)/150);
    const r=Math.sqrt(((x+2.3)/3.85)**2+((z+2.5)/2.85)**2);
    const hollow=-.85*(1-T.MathUtils.smoothstep(r,.72,1.08));
    return hill+flowerHill+hollow;
  }
  inPond(x,z){return ((x+2.3)/4.45)**2+((z+2.5)/3.30)**2<1}
  inStream(x,z){return z< -4.7&&z> -33&&Math.abs(x-(-2.5+Math.sin(z*.18)*1.2))<.95}
  pathX(z){return 2.6+Math.sin(z*.16)*2.2+(z<-5?(-z-5)*.24:0)}
  buildTerrain(){
    const seg=this.quality==='high'?120:this.quality==='mid'?80:56;
    const geo=new T.PlaneGeometry(170,170,seg,seg);geo.rotateX(-Math.PI/2);const p=geo.attributes.position,colors=[];
    const grass=new T.Color('#90b77c'),dark=new T.Color('#7da570'),sand=new T.Color('#dfcda5');
    for(let i=0;i<p.count;i++){
      const x=p.getX(i),z=p.getZ(i);p.setY(i,this.groundHeight(x,z));const a=.5+.25*Math.sin(x*.3+Math.sin(z*.2))+.2*Math.cos(z*.24-x*.1);const c=grass.clone().lerp(dark,a*.55);
      const pathDist=Math.abs(x-this.pathX(z)),pathBlend=(1-T.MathUtils.smoothstep(pathDist,.5,1.25))*T.MathUtils.smoothstep(28-Math.abs(z),0,4);
      c.lerp(sand,pathBlend*.92);colors.push(c.r,c.g,c.b);
    }geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.computeVertexNormals();
    const lawn=document.createElement('canvas');lawn.width=lawn.height=256;const lc=lawn.getContext('2d');lc.fillStyle='#fffef4';lc.fillRect(0,0,256,256);
    for(let i=0;i<28;i++){const x=(i*71)%256,y=(i*97)%256;lc.fillStyle=i%2?'#7d986b0c':'#fff9df18';lc.beginPath();lc.ellipse(x,y,18+i%4*5,10+i%3*4,i*.8,0,Math.PI*2);lc.fill()}
    const lawnTex=new T.CanvasTexture(lawn);lawnTex.colorSpace=T.SRGBColorSpace;lawnTex.wrapS=lawnTex.wrapT=T.RepeatWrapping;lawnTex.repeat.set(24,24);lawnTex.anisotropy=this.quality==='high'?4:1;
    const mat=new T.MeshStandardMaterial({vertexColors:true,map:lawnTex,roughness:1});mat.onBeforeCompile=s=>{s.vertexShader='varying vec3 gardenP;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ngardenP=position;');s.fragmentShader='varying vec3 gardenP;\n'+nGLSL+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nfloat grain=fbm(gardenP.xz*1.7);diffuseColor.rgb*=.985+grain*.025;')};this.terrain=this.mesh(geo,mat);
    // Layered ridgelines wrap the distant landscape; each is an actual terrain mesh.
    for(let layer=0;layer<(this.quality==='low'?1:3);layer++){
      const g=new T.PlaneGeometry(240,95,this.quality==='high'?70:36,this.quality==='high'?26:14);g.rotateX(-Math.PI/2);const pp=g.attributes.position;
      for(let i=0;i<pp.count;i++){const x=pp.getX(i),z=pp.getZ(i);const h=(Math.sin(x*.023+layer*2)*.5+.5)*10+(Math.sin(x*.058+layer)*.5+.5)*5;pp.setY(i,Math.max(0,Math.sin((z+47.5)/95*Math.PI))*h-2)}g.computeVertexNormals();const o=this.mesh(g,this.mat(['#8faf9b','#9bbbaa','#b3cec0'][layer]),0,0,-103-layer*23);o.receiveShadow=false;
    }
  }
  buildWater(){
    const shape=new T.Shape();const pts=[];
    for(let i=0;i<84;i++){const a=i/84*Math.PI*2,r=1+.055*Math.sin(a*3)+.038*Math.cos(a*5);pts.push(new T.Vector2(Math.cos(a)*3.8*r,-Math.sin(a)*2.8*r))}
    shape.moveTo(pts[0].x,pts[0].y);pts.slice(1).forEach(p=>shape.lineTo(p.x,p.y));shape.closePath();const geo=new T.ShapeGeometry(shape,48);geo.rotateX(-Math.PI/2);
    this.waterMat=new T.ShaderMaterial({uniforms:{time:{value:0},night:{value:0},rain:{value:0},wind:{value:.35}},vertexShader:`varying vec3 vP;varying vec3 vWorld;void main(){vP=position;vWorld=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.);}`,fragmentShader:`varying vec3 vP,vWorld;uniform float time,night,rain,wind;${nGLSL}
    void main(){vec2 p=vWorld.xz;vec3 view=normalize(cameraPosition-vWorld);float fresnel=pow(1.-max(0.,view.y),3.);float ripple=fbm(p*.95+vec2(time*.07,-time*.05));float r=length(vP.xz/vec2(3.8,2.8));vec3 deep=mix(vec3(.24,.47,.46),vec3(.10,.25,.29),night);vec3 sky=mix(vec3(.62,.79,.77),vec3(.21,.37,.44),night);vec3 col=mix(deep,sky,.22+fresnel*.5);col+=ripple*.045;col=mix(col,mix(vec3(.49,.64,.50),vec3(.22,.35,.31),night),smoothstep(.65,1.03,r)*.55);float wave=sin(p.x*4.+p.y*6.+ripple*8.-time*.4);float glint=pow(max(0.,wave),26.)*.05*(.3+wind);col+=glint;float shore=(1.-smoothstep(.009,.028,abs(r-.985-ripple*.013)))*.08;col+=shore;for(int i=0;i<8;i++){float j=float(i);vec2 c=vec2(hash(vec2(j,2.)),hash(vec2(j,7.)))*8.-4.;float age=fract(time*.3+j*.137);float ring=1.-smoothstep(.012,.040,abs(length(vP.xz-c)-age*1.4));col+=rain*ring*(1.-age)*.12;}gl_FragColor=sRGBTransferEOTF(vec4(col,1.));
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`});
    this.water=this.mesh(geo,this.waterMat,-2.3,-.13,-2.5);
    // A narrow stream extends behind the pond into the woods.
    const vertices=[],uv=[],idx=[];for(let i=0;i<=65;i++){const z=-4.7-i*.43,x=-2.5+Math.sin(z*.18)*1.2;const y=this.groundHeight(x,z)+.025;vertices.push(x-.65,y,z,x+.65,y,z);uv.push(0,i/65,1,i/65);if(i<65){const a=i*2;idx.push(a,a+1,a+2,a+1,a+3,a+2)}}const streamGeo=new T.BufferGeometry();streamGeo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));streamGeo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));streamGeo.setIndex(idx);streamGeo.computeVertexNormals();this.mesh(streamGeo,this.waterMat);
    this.rippleRings=[];for(let i=0;i<6;i++){const ring=this.mesh(new T.RingGeometry(.37,.385,48),new T.MeshBasicMaterial({color:'#d9e6cb',transparent:true,opacity:.1,side:T.DoubleSide,depthWrite:false}),-5+rand()*5,-.11,-5+rand()*3);ring.rotation.x=-Math.PI/2;this.rippleRings.push(ring)}
  }
  buildSky(){
    super.buildSky();
    this.skyMat.fragmentShader=`varying vec3 d;uniform float night,time,rain,light;${nGLSL}void main(){vec3 v=normalize(d);float y=max(0.,v.y);vec3 day=mix(vec3(.79,.87,.81),vec3(.42,.66,.76),pow(y,.6));vec3 dusk=mix(vec3(.17,.25,.34),vec3(.025,.045,.105),pow(y,.5));vec3 c=mix(day,dusk,night);c=mix(c,mix(vec3(.59,.67,.67),vec3(.10,.16,.21),night),rain*.42);float cl=fbm(v.xz/max(.18,v.y)*1.2+vec2(time*.003,0.));cl=smoothstep(.56,.77,cl)*smoothstep(0.,.12,v.y);c=mix(c,mix(vec3(.96,.97,.90),vec3(.16,.23,.29),night),cl*.55);gl_FragColor=sRGBTransferEOTF(vec4(c,1.));
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`;this.skyMat.needsUpdate=true;
  }
  addClouds(){
    const texCanvas=document.createElement('canvas');texCanvas.width=256;texCanvas.height=128;const c=texCanvas.getContext('2d');
    for(let i=0;i<25;i++){const x=30+rand()*190,y=48+rand()*28,r=16+rand()*23;const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'rgba(255,255,240,.68)');g.addColorStop(.55,'rgba(255,255,240,.5)');g.addColorStop(1,'rgba(255,255,240,0)');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2)}
    const tex=new T.CanvasTexture(texCanvas);this.clouds=[];for(let i=0;i<8;i++){const mat=new T.SpriteMaterial({map:tex,color:'#fff8e5',transparent:true,opacity:.75,depthWrite:false,fog:true});const cloud=new T.Sprite(mat);cloud.position.set(-45+i*15,23+rand()*9,-65-rand()*12);cloud.scale.set(28+rand()*18,15+rand()*8,1);this.scene.add(cloud);this.clouds.push(cloud)}
  }
  plantPlot(i){
    const x=-.5+i*1.15,z=6.7;
    // 这些地块固定在平坦草坪上，避开池塘岸边、桥梁和蜿蜒小径，
    // 以确保生长中的植物模型不会与场景相交。
    const pondClearance=Math.hypot((x+2.3)/3.8,(z+2.5)/2.8)>1.28;
    const bridgeClearance=Math.hypot(x+2.5,z+12)>4;
    const pathClearance=Math.abs(x-this.pathX(z))>1.5;
    if(!pondClearance||!bridgeClearance||!pathClearance)throw Error('Unsafe plant plot');
    return {x,z,y:this.groundHeight(x,z)};
  }
  buildPlots(){this.plots=[];this.grown=[];this.plotRings=[];for(let i=0;i<3;i++){const {x,z,y}=this.plantPlot(i),soil=this.mesh(new T.CylinderGeometry(.41,.46,.045,40),this.mat('#94ab77'),x,y+.015,z);soil.userData.plot=i;this.plots.push(soil);const ring=this.mesh(new T.RingGeometry(.49,.57,40),new T.MeshBasicMaterial({color:'#ffe6a1',transparent:true,opacity:0,side:T.DoubleSide,depthWrite:false}),x,y+.05,z);ring.rotation.x=-Math.PI/2;this.plotRings.push(ring)}}
  async loadAssets(){
    T.Cache.enabled=true;const bundle=window.STORY_ASSETS,loader=new GLTFLoader();
    const entries=Object.entries(bundle.models);
    await Promise.all(entries.map(async([name,json])=>{const data=typeof structuredClone==='function'?structuredClone(json):JSON.parse(JSON.stringify(json));for(const b of data.buffers||[])b.uri=bundle.files[b.uri];for(const im of data.images||[]){im.uri=bundle.files[im.uri];im.mimeType='image/webp'}this.models[name]=await loader.parseAsync(JSON.stringify(data),'')}));
    const q=this.quality;
    for(const[name,gltf]of Object.entries(this.models)){gltf.scene.traverse(o=>{if(!o.isMesh)return;const m=o.material.clone();m.roughness=.88;m.metalness=0;m.envMapIntensity=.25;if(m.normalScale)m.normalScale.set(.28,.28);if(m.map){m.map.anisotropy=q==='high'?4:1;m.map.colorSpace=T.SRGBColorSpace}m.alphaTest=Math.max(m.alphaTest||0,.32);const foliage=/Leaves|Grass|Flowers/i.test(m.name);o.castShadow=!foliage&&q!=='low';o.receiveShadow=!foliage&&q!=='low';if(foliage){m.side=T.DoubleSide;m.emissive.set('#78955f');m.emissiveIntensity=.045;o.geometry.computeBoundingBox();const b=o.geometry.boundingBox;o.material=this.windMaterial(m,b.max.y-b.min.y,b.min.y,name.startsWith('CommonTree')?.22:.10);if(q==='high'){o.customDepthMaterial=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking,map:m.map,alphaTest:m.alphaTest,side:T.DoubleSide});o.customDepthMaterial.onBeforeCompile=o.material.userData.windPatch;o.customDepthMaterial.customProgramCacheKey=o.material.customProgramCacheKey;}}else o.material=m;})}
    sculptTrees(this);for(const[name,gltf]of Object.entries(this.models))this.rememberTemplate(name,gltf.scene);
    this.staticRoots=[];this.place=(name,x,z,height,angle=rand()*6.28,options={})=>{
      const o=this.cloneShared(name),t=this.templates[name],s=height/t.height,group=new T.Group();o.scale.setScalar(s);o.position.y=-t.minY*s;group.add(o);group.position.set(x,this.groundHeight(x,z)+(options.lift||0),z);group.rotation.y=angle;if(options.width){group.scale.x=options.width;group.scale.z=options.width}this.scene.add(group);if(!options.dynamic)this.staticRoots.push(group);return group;
    };
    this.populateGarden();installPondBank(this);installShoreLife(this);installWoodlandRest(this);this.details=installDetails(this);this.atmosphere=installAtmosphere(this,T);this.batchScenery();this.makeCat();this.updateGrowth(true);this.buildBridge();this.addLilyPads();this.craft=installGardenCraft(this);this.installWaterTouch();
    this.canvas.dataset.artVersion='listening-pond-v10';this.canvas.dataset.assets='Quaternius textured nature · CC0';
  }
  populateGarden(){
    const q=this.quality,groupSize=q==='low'?1:2,flowersPerBed=q==='high'?4:q==='mid'?3:2,bushes=q==='high'?28:q==='mid'?18:10,glbGrass=q==='high'?90:q==='mid'?28:0,lineTrees=q==='high'?18:q==='mid'?12:8;
    const tree=(name,x,z,h,w=1)=>this.place(name,x,z,h,rand()*6.28,{width:w});
    tree('CommonTree_1',5.8,-8.8,5.4,.90);tree('CommonTree_2',-7.4,-6.4,5.0,.92);tree('CommonTree_3',-9,-18,6);tree('CommonTree_5',14,-14,6.3);tree('CommonTree_2',7,-23,6.8);
    // Small groups leave openings towards the bridge, flower slope and woodland.
    const groups=[[-22,-4],[-20,-19],[-13,-31],[0,-36],[19,-30],[29,-14],[27,9],[-22,13]];
    for(let j=0;j<groups.length;j++){const [gx,gz]=groups[j];for(let i=0;i<groupSize;i++){const x=gx+(rand()-.5)*10,z=gz+(rand()-.5)*10;tree(['CommonTree_1','CommonTree_2','CommonTree_3','CommonTree_5'][(j+i)%4],x,z,5.6+rand()*2)}}
    const flowerBeds=[[-7.8,.7,1.15],[-5.8,1.8,1],[-9,-7,1.5],[5,-2.2,1.2],[6,3,1.3],[-4.8,7.5,1.3],[4,7.8,1.3],[15,-12,3.2],[18,-7,2.8],[-9,-21,2]];
    flowerBeds.push([-4.1,5.4,.48],[1.9,5.5,.48],[-7,5.5,1.2],[5.5,5.8,1.2],[-10,-2,1.2],[2,-8,1.2]);
    for(let bi=0;bi<flowerBeds.length;bi++){const [x,z,r]=flowerBeds[bi];for(let i=0;i<Math.min(flowersPerBed,bi<7?7:6);i++){const a=rand()*6.28,rr=Math.sqrt(rand())*r;const px=x+Math.cos(a)*rr,pz=z+Math.sin(a)*rr;if(this.inPond(px,pz))continue;this.place(i%3?'Flower_4_Group':'Flower_3_Group',px,pz,.32+rand()*.17)}}
    for(let i=0;i<lineTrees;i++){const x=-38+i*75/(lineTrees-1),z=-43+Math.sin(i*.8)*5;tree('CommonTree_2',x,z,6+rand()*2,1.1)}
    for(let i=0;i<bushes;i++){const a=rand()*6.28,r=12+rand()*21,x=Math.cos(a)*r,z=Math.sin(a)*r;if(this.inPond(x,z)||this.inStream(x,z)||Math.abs(x-this.pathX(z))<1.4||z>14&&Math.abs(x)<13)continue;this.place('Bush_Common_Flowers',x,z,.6+rand()*.65)}
    // Dense patches, with the lawn and the path deliberately left quiet.
    for(let i=0;i<glbGrass;i++){let x=(rand()-.5)*62,z=(rand()-.5)*62;if(this.inPond(x,z)||this.inStream(x,z)||Math.abs(x-this.pathX(z))<1.2)continue;const centre=Math.hypot(x-1,z-3);if(centre<11&&rand()<.95)continue;if(z>14&&Math.abs(x)<9)continue;this.place(i%3?'Grass_Common_Tall':'Grass_Wispy_Tall',x,z,.18+rand()*.43)}
    [[-8,-5,.6],[-7,0,.4],[-1,-.2,.32],[1,-4,.5],[-5,-7,.5],[-3,-7,.35],[6,-7,.7],[11,6,.55],[-10,6,.9],[14,-13,1.1]].forEach(([x,z,h],i)=>this.place(i%2?'Rock_Medium_1':'Rock_Medium_3',x,z,h));
    // Individual worn stepping stones sit within the dirt trail.
    for(let i=0;i<14;i++){const z=9-i*1.45,x=this.pathX(z);const stone=this.place('Rock_Medium_1',x,z,.13,Math.sin(i)*.2,{width:1.45});stone.scale.y=.7}
    this.addScatteredPetals();
  }
  addScatteredPetals(){
    const geo=new T.SphereGeometry(1,5,3),mat=new T.MeshStandardMaterial({color:'#edddc9',roughness:1});const count=this.quality==='high'?90:this.quality==='mid'?60:40,mesh=new T.InstancedMesh(geo,mat,count),d=new T.Object3D();
    for(let i=0;i<count;i++){const x=(rand()-.5)*30,z=(rand()-.5)*30;d.position.set(x,this.groundHeight(x,z)+.025,z);d.scale.set(.027+rand()*.035,.007,.02+rand()*.04);d.rotation.y=rand()*6.28;d.updateMatrix();mesh.setMatrixAt(i,d.matrix);mesh.setColorAt(i,new T.Color(['#d9d7b3','#d9bcc7','#c4c9d2'][i%3]))}mesh.receiveShadow=false;mesh.frustumCulled=false;this.scene.add(mesh);
  }
  buildBridge(){
    const root=new T.Group(),z=-12,x=-2.5+Math.sin(z*.18)*1.2;root.position.set(x,this.groundHeight(x,z)+.15,z);root.rotation.y=.12;this.scene.add(root);const wood=this.mat('#baa783'),dark=this.mat('#a39377');wood.map=woodGrain();
    for(let i=0;i<12;i++){const b=new T.Mesh(new T.BoxGeometry(.22,.09,1.5),wood);b.position.set((i-5.5)*.23,Math.sin(i/11*Math.PI)*.19,0);b.rotation.z=Math.cos(i/11*Math.PI)*.1;b.castShadow=this.quality!=='low';b.receiveShadow=this.quality!=='low';root.add(b)}
    for(const side of [-1,1]){for(const x of [-1.3,0,1.3]){const p=new T.Mesh(new T.CylinderGeometry(.045,.05,.65,8),dark);p.position.set(x,.37,side*.72);p.castShadow=true;root.add(p)}const c=new T.CatmullRomCurve3([V(-1.4,.65,side*.72),V(0,.77,side*.72),V(1.4,.65,side*.72)]);const rail=new T.Mesh(new T.TubeGeometry(c,18,.03,6,false),dark);root.add(rail)}
  }
  addLilyPads(){
    const leafMat=this.mat('#819d6f'),petal=this.mat('#e9c5c6'),center=this.mat('#dbc995'),parts=new Map([[petal,[]],[center,[]]]);
    for(const[x,z,s]of [[-4,-2.7,.34],[-3.7,-3.2,.25],[-1.5,-3.3,.38],[-.6,-2,.27]]){
      const o=this.mesh(new T.CircleGeometry(s,32,0,Math.PI*1.84),leafMat,x,-.104,z);o.rotation.x=-Math.PI/2;o.rotation.z=rand()*6;
      const g=new T.Group();g.position.set(x,-.066,z);
      for(let i=0;i<7;i++){const a=i/7*Math.PI*2,p=new T.Mesh(new T.SphereGeometry(1,10,6),petal);p.scale.set(.05,.026,.11);p.position.set(Math.sin(a)*.058,.006,Math.cos(a)*.058);p.rotation.set(.20*Math.cos(a),a,.20*Math.sin(a));g.add(p)}
      const c=new T.Mesh(new T.SphereGeometry(.036,10,6),center);c.scale.y=.45;c.position.y=.023;g.add(c);
      g.updateMatrixWorld(true);g.traverse(o=>{if(o.isMesh){parts.get(o.material).push(o.geometry.clone().applyMatrix4(o.matrixWorld));o.geometry.dispose()}});
    }
    for(const[material,geometries]of parts){this.mesh(mergeGeometries(geometries),material);geometries.forEach(g=>g.dispose())}
  }
  makeCat(){
    this.storyCat=createStoryCat();this.cat=this.storyCat.root;this.cat.scale.setScalar(1.06);this.scene.add(this.cat);this.catMixer={update(){}};this.catAction=null;
    this.catPath=new T.CatmullRomCurve3([V(-1.4,0,2.5),V(-.2,0,3),V(.3,0,3.8),V(-.4,0,4.5),V(-1.8,0,4.5),V(-2.7,0,3.7),V(-2.7,0,2.4),V(-2,0,1.8)],true,'catmullrom',.28);this.catDistance=0;this.pathLength=this.catPath.getLength();this.cat.position.copy(this.catPath.getPointAt(0));this.cat.position.y=this.groundHeight(this.cat.position.x,this.cat.position.z);const heading=this.catPath.getTangentAt(0);this.cat.rotation.y=Math.atan2(heading.x,heading.z);const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d'),grad=ctx.createRadialGradient(64,64,8,64,64,64);grad.addColorStop(0,'rgba(20,35,17,.45)');grad.addColorStop(.5,'rgba(20,35,17,.17)');grad.addColorStop(1,'rgba(20,35,17,0)');ctx.fillStyle=grad;ctx.fillRect(0,0,128,128);this.catContact=new T.Mesh(new T.PlaneGeometry(2.3,2.5),new T.MeshBasicMaterial({map:new T.CanvasTexture(c),transparent:true,depthWrite:false,opacity:.62}));this.catContact.rotation.x=-Math.PI/2;this.scene.add(this.catContact);this.canvas.dataset.catSource='Original storybook cat';this.canvas.dataset.catAnimation='articulated walk, breathing, blinking, ears and tail';
  }
  updateGrowth(force=false){
    if(!this.place)return;const records=this.state.records.slice(this.state.mode==='session'?-2:-3),signature=this.state.mode+':'+records.map(r=>r.id||r.date).join(',');
    if(force||signature!==this.recordSignature){this.recordSignature=signature;this.grown.forEach(x=>this.scene.remove(x));this.grown=[];for(let i=0;i<3;i++){const r=records[i],name=r?.type==='wind'?'Flower_4_Group':r?.type==='water'?'Bush_Common_Flowers':'Grass_Common_Tall',plot=this.plantPlot(i);const plant=this.place(name,plot.x,plot.z,.63,0,{dynamic:true});this.grown.push(plant)}}for(let i=0;i<3;i++){const r=records[i];const s=r?(r.growth??(r.complete?1:.72)):i===records.length&&this.state.mode==='session'?.1+Math.min(1,this.state.elapsed/90)*.7:.02;this.grown[i].scale.setScalar(s)}
  }
  home(immediate=false){
    this.stopCatForCamera();this.storyCat?.release();this.follow=false;const weatherSky=['rainbow','aurora','meteor'].includes(this.state.weather),target=weatherSky?V(-1,4,-3):V(-.5,.65,-2.0),pos=weatherSky?V(6,9.5,27):V(4.5,11.3,24);if(immediate){this.camera.position.copy(pos);this.controls.target.copy(target);this.controls.update()}else this.transition={pos,target};this.selectRegion?.('pond');
  }
  buildNavigation(){
    const nav=document.createElement('nav');nav.className='region-nav';nav.setAttribute('aria-label','漫游花园');const regions=[['pond','池畔'],['meadow','花坡'],['woods','林间']];
    regions.forEach(([key,label])=>{const b=document.createElement('button');b.textContent=label;b.dataset.region=key;b.setAttribute('aria-pressed',key==='pond'?'true':'false');b.onclick=()=>{this.stopCatForCamera();this.follow=false;this.onExplore();if(key==='pond')this.home();else this.transition=key==='meadow'?{pos:V(25,12,7),target:V(15,3,-10)}:{pos:V(7,10,-7),target:V(-3,2,-21)};this.selectRegion(key)};nav.append(b)});this.host.parentElement.append(nav);this.selectRegion=key=>{nav.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.region===key)));this.canvas.dataset.region=key};
  }
  handleExploreStart(){return false}
  // Camera commands never change the actor's path distance or world heading.
  stopCatForCamera(){this.catSpeed=0;this.cameraHoldUntil=(this.t||0)+.8}
  catCameraHeld(t){return this.follow||!!this.transition||t<(this.cameraHoldUntil||0)||!!this.gesture?.moved}
  zoomBy(f){this.stopCatForCamera();super.zoomBy(f)}
  focus(){this.stopCatForCamera();this.follow=true;this.transition=null}
  catView(){
    const box=this.canvas.getBoundingClientRect(),width=Math.max(1,box.width),height=Math.max(1,box.height),parent=this.host?.parentElement;
    const rect=element=>{if(!element||element.hidden)return null;const r=element.getBoundingClientRect?.();return r?.width>1&&r.height>1?r:null};
    let top=20,bottom=height-20;
    for(const element of [parent?.querySelector('.topbar'),document.getElementById('backFocus')]){const r=rect(element);if(r)top=Math.max(top,r.bottom-box.top+18)}
    for(const element of ['controls','homeDock','gardenBottom'].map(id=>document.getElementById(id))){const r=rect(element);if(r)bottom=Math.min(bottom,r.top-box.top-24)}
    top=clamp(top,20,height*.4);bottom=clamp(bottom,top+height*.18,height-20);
    const high=1-2*top/height,low=1-2*bottom/height,middle=(high+low)/2,tan=Math.tan(this.camera.fov*Math.PI/360),aspect=width/height;
    const direction=V(1.6,1.3,6.5).normalize(),right=V(0,1,0).cross(direction).normalize(),up=direction.clone().cross(right),scale=this.cat.scale.x;
    // A fixed envelope includes raised ears, chin poses and the curled tail.
    // Breathing and posture changes must not make the close-up zoom in/out.
    const centre=V(0,1.16,-.125).multiplyScalar(scale),corners=[];
    const envelopes=[[[ -.78,.78],[.20,2.32],[0,1.30]],[[-.65,.65],[0,1.15],[-1.05,.80]],[[-.20,.65],[.30,1.85],[-1.50,-.50]],[[-.15,.95],[0,.60],[-1.10,.10]]];
    for(const [xs,ys,zs]of envelopes)for(const x of xs)for(const y of ys)for(const z of zs){const p=V(x,y,z).multiplyScalar(scale).sub(centre);corners.push({x:p.dot(right),y:p.dot(up),z:p.dot(direction)})}
    let distance=3.8;
    for(const p of corners)distance=Math.max(distance,p.z+Math.abs(p.x)/(tan*aspect*.82),(p.y+p.z*tan*high)/(tan*(high-middle)),(-p.y-p.z*tan*low)/(tan*(middle-low)));
    distance*=1.04;
    // Keep OrbitControls' existing ground limit while reserving room above
    // the dock. On short screens fit again after limiting the target height.
    const shift=Math.min(distance*tan*middle,(centre.y-.5)/up.y);
    if(low<0&&high>0)for(const p of corners)distance=Math.max(distance,p.z+(p.y+shift)/(tan*high),p.z+(p.y+shift)/(tan*low));
    const yaw=this.cat.rotation.y,axis=V(0,1,0);
    return {target:this.cat.position.clone().add(centre.addScaledVector(up,-shift).applyAxisAngle(axis,yaw)),offset:direction.multiplyScalar(distance).applyAxisAngle(axis,yaw)};
  }
  pet(zone='head'){return this.storyCat?.pet(zone)||false}
  lookAtPointer(clientX,clientY){
    if(!this.storyCat)return;
    if(!this.follow){this.storyCat.look(0,0);return}
    const box=this.canvas.getBoundingClientRect(),head=this.storyCat.head;
    head.updateWorldMatrix(true,false);
    const centre=head.localToWorld(V(0,0,0)).project(this.camera),top=head.localToWorld(V(0,.49,0)).project(this.camera);
    const x=box.left+(centre.x+1)*box.width/2,y=box.top+(1-centre.y)*box.height/2;
    const radius=Math.max(12,Math.hypot((top.x-centre.x)*box.width/2,(top.y-centre.y)*box.height/2));
    this.storyCat.look((clientX-x)/(radius*2.5),(clientY-y)/(radius*2.5));
  }
  pick(clientX,clientY){
    const r=this.canvas.getBoundingClientRect(),ray=new T.Raycaster();
    ray.setFromCamera(new T.Vector2((clientX-r.left)/r.width*2-1,-(clientY-r.top)/r.height*2+1),this.camera);return ray;
  }
  visibleHit(ray){return ray.intersectObjects(this.scene.children,true).find(h=>{let o=h.object;if(!o.isMesh||o===this.sky||o.material.transparent)return false;while(o){if(!o.visible)return false;o=o.parent}return true})}
  petHit(ray,checkOcclusion=true){
    const hit=this.cat&&ray.intersectObject(this.cat,true).find(h=>{let o=h.object;while(o){if(!o.visible)return false;o=o.parent}return true});
    if(!hit)return null;if(!checkOcclusion)return hit;const visible=this.visibleHit(ray);return !visible||visible.distance>=hit.distance-.02?hit:null;
  }
  contactAt(hit,frame){
    let zone=hit.object.userData.petZone||'back';
    const point=frame?hit.point.clone().applyMatrix4(zone==='head'?frame.head:frame.body):(zone==='head'?this.storyCat.head:this.cat).worldToLocal(hit.point.clone());
    if(zone==='head'&&point.y<-.14&&point.z>.28)zone='chin';
    return {zone,x:point.x/.58,y:zone==='back'?(point.z+.2)/.7:point.y/.49};
  }
  stroke(hit,contact=this.contactAt(hit)){
    const g=this.gesture,acknowledge=contact.zone==='chin'&&!g?.chinAcknowledged;
    if(contact.zone==='chin'&&g&&!g.chin)g.chin={contact,bounds:g.contactBounds,active:true};
    this.petZone=contact.zone;this.storyCat.touch(contact.zone,contact,acknowledge);this.canvas.dataset.contactZone=contact.zone;
    if(acknowledge&&g)g.chinAcknowledged=true;
    const hint=document.getElementById('petHint'),label=this.cat.userData.reactionLabel||(contact.zone==='chin'?'它抬起下巴，靠着你的手':contact.zone==='back'?'它放松身体，尾巴轻轻摆动':'它眯起眼，朝你的手轻轻偏头');
    if(hint.textContent!==label)hint.textContent=label;
  }
  bindPicking(){
    this.activePointers=new Set();this.gesture=null;
    const strokeContact=(g,x,y)=>{
      // A chin scratch remains one action until the hand clearly leaves the
      // cat. Crossing an internal face/body boundary must not select a new pose.
      const chin=g.chin;
      if(chin){
        const b=chin.bounds,pad=chin.active?12:0;
        chin.active=x>=b.min.x-pad&&x<=b.max.x+pad&&y>=b.min.y-pad&&y<=b.max.y+pad;
        return chin.active?{zone:'chin',x:chin.contact.x+(x-g.x)/Math.max(1,b.max.x-b.min.x),y:chin.contact.y-(y-g.y)/Math.max(1,b.max.y-b.min.y)}:null;
      }
      // Pick against the pose at pointer-down. The cat's response must not
      // move its hit regions beneath a held finger or repeatedly restart them.
      for(const p of g.pickPose){p.live.copy(p.object.matrixWorld);p.object.matrixWorld.copy(p.matrix)}
      try{const hit=this.petHit(this.pick(x,y),false);return hit?this.contactAt(hit,g.pickFrame):null}
      finally{for(const p of g.pickPose)p.object.matrixWorld.copy(p.live)}
    };
    const explore=()=>{this.stopCatForCamera();this.storyCat?.release();this.follow=false;this.transition=null;this.onExplore()};
    this.canvas.addEventListener('pointerdown',e=>{
      if(this.replayingOrbitPointer||e.button>0)return;
      this.activePointers.add(e.pointerId);
      if(this.activePointers.size>1){
        const first=this.gesture;this.gesture=null;this.controls.enabled=true;explore();
        if(first?.stroke&&first.pointerType==='touch'){
          this.replayingOrbitPointer=true;
          try{this.canvas.dispatchEvent(new PointerEvent('pointerdown',{pointerId:first.id,pointerType:'touch',clientX:first.x,clientY:first.y,buttons:1,bubbles:true}))}finally{this.replayingOrbitPointer=false}
        }
        return;
      }
      const hit=this.petHit(this.pick(e.clientX,e.clientY));
      this.gesture={id:e.pointerId,pointerType:e.pointerType,x:e.clientX,y:e.clientY,at:performance.now(),stroke:!!hit,wasFocused:this.state.focused,moved:false};
      if(hit){
        this.lookAtPointer(e.clientX,e.clientY);
        const contact=this.contactAt(hit),g=this.gesture;
        this.cat.updateWorldMatrix(true,true);g.pickPose=[];
        this.cat.traverse(object=>g.pickPose.push({object,matrix:object.matrixWorld.clone(),live:object.matrixWorld.clone()}));
        g.pickFrame={head:this.storyCat.head.matrixWorld.clone().invert(),body:this.cat.matrixWorld.clone().invert()};
        const bounds=new T.Box3().setFromObject(this.storyCat.head.parent),box=this.canvas.getBoundingClientRect();
        g.contactBounds=new T.Box2();
        for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
          const p=V(x,y,z).project(this.camera);g.contactBounds.expandByPoint(new T.Vector2(box.left+(p.x+1)*box.width/2,box.top+(1-p.y)*box.height/2));
        }
        this.petZone=contact.zone;this.transition=null;this.controls.enabled=false;this.canvas.setPointerCapture(e.pointerId);this.canvas.dataset.interaction='stroking';
        document.getElementById('cat').dispatchEvent(new CustomEvent('petcontact',{detail:{zone:this.petZone}}));this.stroke(hit);
      }
    },true);
    this.canvas.addEventListener('pointermove',e=>{
      const g=this.gesture;
      if(!g){
        if(e.pointerType!=='mouse'||performance.now()-(this.hoverAt||0)<70)return;this.hoverAt=performance.now();
        const ray=this.pick(e.clientX,e.clientY),cat=this.petHit(ray),visible=cat?null:this.visibleHit(ray),water=visible?.object===this.details?.pond||visible?.object===this.water;
        this.canvas.dataset.interaction=cat?'cat':water?'water':visible?.object.userData.soundControl?'sound':'garden';
        this.lookAtPointer(e.clientX,e.clientY);return;
      }
      if(g.id!==e.pointerId)return;
      const moved=Math.hypot(e.clientX-g.x,e.clientY-g.y)>8;
      if(g.stroke){
        if(moved)g.moved=true;
        this.lookAtPointer(e.clientX,e.clientY);
        const contact=strokeContact(g,e.clientX,e.clientY);
        if(contact)this.stroke(null,contact);else this.storyCat.release();return;
      }
      if(moved&&!g.moved){g.moved=true;explore()}
    },true);
    const release=e=>{this.storyCat?.release();this.activePointers.delete(e.pointerId);if(this.canvas.hasPointerCapture(e.pointerId))this.canvas.releasePointerCapture(e.pointerId);this.controls.enabled=true;this.canvas.dataset.interaction='garden'};
    this.canvas.addEventListener('pointerup',e=>{
      const g=this.gesture;this.gesture=null;release(e);
      if(g?.stroke&&!g.wasFocused&&!g.moved&&performance.now()-g.at<650)document.getElementById('focusButton').click();
      if(!g||g.id!==e.pointerId||g.stroke||g.moved||Math.hypot(e.clientX-g.x,e.clientY-g.y)>8||performance.now()-g.at>650)return;
      const ray=this.pick(e.clientX,e.clientY),hit=this.visibleHit(ray);
      if(hit?.object.userData.soundControl){document.getElementById('soundButton').click();return}
      if(hit?.object===this.water||hit?.object===this.details?.pond){this.touchWater(hit.point);return}
      if(this.plots.includes(hit?.object))document.querySelectorAll('#plots > g')[hit.object.userData.plot]?.dispatchEvent(new MouseEvent('click'));
    },true);
    this.canvas.addEventListener('pointercancel',e=>{this.gesture=null;release(e)},true);
    this.canvas.addEventListener('lostpointercapture',e=>{if(this.gesture?.id===e.pointerId){this.gesture=null;release(e)}},true);
    this.canvas.addEventListener('wheel',explore,{passive:true,capture:true});
    this.canvas.addEventListener('pointerleave',()=>{if(!this.gesture)this.storyCat?.look(0,0)});
    this.canvas.addEventListener('keydown',e=>{
      if(e.key.toLowerCase()==='m'){e.preventDefault();document.getElementById('soundButton').click();return}
      if(e.key.toLowerCase()==='w'){e.preventDefault();if(!this.follow&&this.canvas.dataset.region==='pond')this.touchWater(this.water.position);return}
      if(e.key.toLowerCase()==='c'&&this.state.focused){e.preventDefault();document.getElementById('chinButton').click();return}
      if(e.key==='Enter'||e.key===' '){e.preventDefault();this.petZone='head';document.getElementById('cat').dispatchEvent(new MouseEvent('click'));return}
      if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','0'].includes(e.key))return;
      e.preventDefault();explore();if(e.key==='0')this.home();else if(e.key==='+'||e.key==='-')this.zoomBy(e.key==='+'?1.15:1/1.15);
      else{const d=this.camera.position.clone().sub(this.controls.target);if(e.key==='ArrowLeft'||e.key==='ArrowRight')d.applyAxisAngle(V(0,1,0),e.key==='ArrowLeft'?.15:-.15);else d.y+=e.key==='ArrowUp'?1:-1;this.camera.position.copy(this.controls.target).add(d)}
    });
    this.canvas.setAttribute('aria-label','三维花园：拖动环绕，双指缩放；按住小猫并轻轻滑动，抚摸头顶、下巴或背部；触碰池塘泛起涟漪；轻点收音机调整声音。回车抚摸头顶，C轻挠下巴，W触碰池水，M调整声音。');
  }
  installWaterTouch(){
    this.touchRings=[];this.touchCount=0;this.waterTouchedAt=-100;
    for(let i=0;i<3;i++){
      const material=new T.MeshBasicMaterial({color:'#f7fff3',transparent:true,opacity:0,side:T.DoubleSide,depthWrite:false});
      material.onBeforeCompile=s=>{
        s.vertexShader='varying vec3 touchWorld;\n'+s.vertexShader;
        s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntouchWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
        s.fragmentShader='varying vec3 touchWorld;\n'+s.fragmentShader;
        s.fragmentShader=s.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nvec2 q=(touchWorld.xz+vec2(2.3,2.5))/vec2(3.8,2.8);float a=atan(q.y,q.x);float edge=1.+.055*sin(a*3.)+.038*cos(a*5.);if(length(q)>edge*.99)discard;');
      };
      const ring=new T.Mesh(new T.RingGeometry(.955,1,80),material);
      ring.rotation.x=-Math.PI/2;ring.position.y=-.112;ring.visible=false;this.scene.add(ring);this.touchRings.push(ring);
    }
    const button=document.createElement('button');button.className='water-access';button.textContent='触碰池水';button.setAttribute('aria-label','触碰池水，泛起涟漪');
    button.onclick=()=>this.touchWater(V(-2.3,-.112,-2.5));this.host.parentElement.append(button);
  }
  touchWater(point){
    const now=performance.now()/1000;if(!this.touchRings||now-this.waterTouchedAt<.45)return false;
    this.waterTouchedAt=now;this.catNotice('water',point);this.touchCount++;this.canvas.dataset.waterTouches=String(this.touchCount);
    this.details?.touch?.(point,this.t);
    // The shader clips the rings at the shore, so the origin stays under the touch.
    const x=point.x,z=point.z;
    this.touchRings.forEach(r=>{r.position.set(x,-.112,z);r.visible=true});return true;
  }
  updateWaterTouch(){
    if(!this.touchRings)return;
    const age=performance.now()/1000-this.waterTouchedAt;
    this.touchRings.forEach((r,i)=>{const a=age-i*.16;r.visible=a>=0&&a<2.2;r.scale.setScalar(this.state.reduced?.65:.12+Math.max(0,a)*.80);r.material.opacity=r.visible?(1-a/2.2)*.82:0});
  }
  updateCatContext(){
    if(!this.storyCat||!this.state)return;
    const listening=!!this.state.playing&&Object.values(this.state.mix||{}).some(v=>v>0);
    this.storyCat.setContext({night:this.state.night,listening,wind:this.state.wind/100});
    if(listening&&!this.catListening&&this.craft?.radio){const point=new T.Vector3();this.craft.radio.getWorldPosition(point);this.catNotice('music',point)}
    const rain=this.state.weather==='rain'&&Environment.readEnvironment(this.state,'rainDensity')>0;
    if(rain&&!this.catRain&&this.water)this.catNotice('rain',this.water.position);this.catRain=rain;
    this.catListening=listening;this.catWeather=this.state.weather;
  }
  catNotice(kind,point){
    if(!this.cat||!this.storyCat||this.cat.position.distanceTo(point)>9)return false;
    const local=point.clone().sub(this.cat.position).applyAxisAngle(V(0,1,0),-this.cat.rotation.y);
    return this.storyCat.notice(kind,{x:clamp(Math.atan2(local.x,local.z)/1.4,-1,1),y:clamp(-local.y/4,-.5,.5)});
  }
  weatherVisuals(t){return Environment.weatherVisuals({...this.state,weatherAt:this.weatherAt},t)}
  catResting(t){
    this.updateCatContext();
    if(this.storyCat?.wantsRest(t))return true;
    // Different stretches and pauses avoid the same short clockwork loop.
    let phase=t%134;
    for(const [walk,rest] of [[23,8],[31,11],[18,7],[26,10]]){if(phase<walk+rest)return phase>=walk;phase-=walk+rest}
    return false;
  }
  beforeRender(dt){
    const n=this.skyMat.uniforms.night.value,visual=this.weatherVisuals(this.t),light=this.state.weather==='rain'?visual.cloudLight:this.state.light/100,rain=this.state.weather==='rain',t=this.t;
    this.hemi.intensity=T.MathUtils.lerp(.62+light*.12,.35+visual.nightLight*.45,n);this.hemi.color.set(n>.5?'#aac1d0':'#e4efde');this.hemi.groundColor.set(n>.5?'#435856':'#aaa29a');
    this.sun.intensity=T.MathUtils.lerp((.54+light*1.6)*(rain?.64:1),.25+visual.nightLight*.55,n);this.sun.color.set(n>.5?'#b3cee8':'#fff1d5');this.renderer.toneMappingExposure=T.MathUtils.lerp(.92,.72+visual.nightLight*.36,n);this.scene.fog.color.copy(new T.Color('#c4d8ce').lerp(new T.Color('#283f50'),n));
    if(this.cat)this.cat.userData.turning=0;if(this.catContact){this.catContact.position.copy(this.cat.position);this.catContact.position.y+=.013;this.catContact.rotation.z=-this.cat.rotation.y}if(this.storyCat){this.updateCatContext();const moving=this.catSpeed>.025&&!this.cat.userData.contact;this.storyCat.animate(t,moving,this.state.wind/100,!moving,dt,this.state.reduced,this.catDistance*8);this.canvas.dataset.catPose=this.cat.userData.pose;this.canvas.dataset.catExpression=this.cat.userData.expression;this.canvas.dataset.petCount=String(this.cat.userData.petCount||0);this.canvas.dataset.petting=String(this.cat.userData.petting);this.canvas.dataset.catReaction=this.cat.userData.reactionName||'';this.canvas.dataset.catAction=this.cat.userData.idleAction||'rest';this.canvas.dataset.catRest=this.cat.userData.nightRest?'sleeping':this.cat.userData.companionPhase;this.canvas.dataset.catEnvironment=this.cat.userData.environmentReaction||''}
    if(this.cat&&!this.state.night&&t-(this.lastCatNatureNotice||0)>16){
      const butterfly=this.butterflies?.find(b=>b.group.visible&&b.group.position.distanceTo(this.cat.position)<4);
      if(butterfly&&this.catNotice('butterfly',butterfly.group.position))this.lastCatNatureNotice=t;
    }
    this.details?.update(t,n);this.craft?.update(n,this.catListening);this.updateWaterTouch();
    this.atmosphere?.update(dt,t,n);
    this.clouds?.forEach((c,i)=>{c.material.opacity=(1-n*.7)*.6;c.material.color.set(n>.5?'#718c9f':'#fff8e8');c.position.x+=dt*.045*(.2+this.state.wind/100)});
    this.rippleRings?.forEach((r,i)=>{const f=(t*.09+i*.17)%1;r.scale.setScalar(.4+f*1.8);r.material.opacity=(1-f)*.095});
    const planting=this.state.records.find(r=>r.growth!==undefined&&r.growth<1);
    this.plotRings?.forEach((ring,i)=>{const active=planting&&this.grown[i]?.scale.x===planting.growth;ring.material.opacity=active?(.22+.18*Math.sin(t*8)):0;ring.scale.setScalar(active?1+Math.sin(t*8)*.08:1)});
    // Surface controls stay faint; rendered world diagnostics are DOM-readable.
    this.canvas.dataset.catStyle='storybook';this.canvas.dataset.artVersion='listening-pond-v10';
  }
}
window.GardenEnvironment=Environment;
window.GardenWorld=StoryWorld;
