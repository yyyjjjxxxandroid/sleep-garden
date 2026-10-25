import * as T from './vendor/three/build/three.module.js';
import { GardenWorld as BaseWorld } from './world-base.js';
import { GLTFLoader } from './vendor/three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from './vendor/three/examples/jsm/environments/RoomEnvironment.js';
import { createStoryCat } from './story-cat.js';
import { installDetails } from './story-detail.js';
import { installAtmosphere } from './story-atmosphere.js';
import { installGardenContent } from './story-garden-content.js';
import { installGardenOutskirts } from './story-garden-outskirts.js';
import { GardenCompanion } from './garden-companion.js';
import { configureSkyBackground } from './world-sky.js';
import { CityWorld } from './city-world.js';
import { environmentTargets, approach } from './world-environment.js';
import { createSnowfall, updateSnowfall } from './world-weather.js';

const seedModels={fern:'Grass_Common_Tall',bellflower:'Flower_4_Group',waterleaf:'Bush_Common_Flowers'};
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),clamp=T.MathUtils.clamp;
let seed=973;const rand=()=>((seed=seed*16807%2147483647)-1)/2147483646;
const nGLSL=`float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}float fbm(vec2 p){return noise(p)*.56+noise(p*2.03)*.27+noise(p*4.01)*.12+noise(p*8.1)*.05;}\n`;

class StoryWorld extends BaseWorld{
  constructor(opts){
    super(opts);
    this.renderer.toneMappingExposure=1.02;
    this.sun.position.set(-15,24,11);this.scene.fog.density=.007;
    if(this.quality!=='low'){Object.assign(this.sun.shadow.camera,{left:-24,right:24,top:24,bottom:-24,near:.1,far:90});this.sun.shadow.camera.updateProjectionMatrix();this.sun.shadow.normalBias=.035;this.sun.shadow.bias=-.00018;
      const pmrem=new T.PMREMGenerator(this.renderer);this.scene.environment=pmrem.fromScene(new RoomEnvironment(),.08).texture;pmrem.dispose();this.scene.environmentIntensity=.22;}
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
  streamX(z){return -2.5+Math.sin(z*.18)*1.2}
  streamSlope(z){return Math.cos(z*.18)*.216}
  onStream(x,z,margin=0){return z<=-6&&z>=-34&&Math.abs(x-this.streamX(z))<.65+margin}
  bridgeCentre(){const z=-12;return {x:this.streamX(z),z}}
  clearForScenery(x,z,margin=0){
    const pond=((x+3.5)/(6.4+margin))**2+((z+3.5)/(4.35+margin))**2>1;
    const bridge=this.bridgeCentre();
    return pond&&!this.onStream(x,z,margin)&&Math.hypot(x-bridge.x,z-bridge.z)>1.9+margin;
  }
  buildTerrain(){
    this.snowCover={value:0};
    const seg=this.quality==='high'?120:this.quality==='mid'?80:56;
    const geo=new T.PlaneGeometry(170,170,seg,seg);geo.rotateX(-Math.PI/2);const p=geo.attributes.position,colors=[];
    const grass=new T.Color('#91ad77'),dark=new T.Color('#76956a'),sand=new T.Color('#cab998');
    for(let i=0;i<p.count;i++){
      const x=p.getX(i),z=p.getZ(i);p.setY(i,this.groundHeight(x,z));const a=.5+.25*Math.sin(x*.3+Math.sin(z*.2))+.2*Math.cos(z*.24-x*.1);const c=grass.clone().lerp(dark,a*.55);
      const pathDist=Math.abs(x-this.pathX(z)),pathBlend=(1-T.MathUtils.smoothstep(pathDist,.5,1.25))*T.MathUtils.smoothstep(28-Math.abs(z),0,4);
      c.lerp(sand,pathBlend*.82);const shore=Math.sqrt(((x+3.5)/5.6)**2+((z+3.5)/3.8)**2);c.lerp(new T.Color('#b0b38c'),(1-T.MathUtils.smoothstep(Math.abs(shore-1),.03,.19))*.7);colors.push(c.r,c.g,c.b);
    }geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.computeVertexNormals();
    const mat=new T.MeshStandardMaterial({vertexColors:true,roughness:1});mat.onBeforeCompile=s=>{s.uniforms.gardenSnow=this.snowCover;s.vertexShader='varying vec3 gardenP;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ngardenP=position;');s.fragmentShader='uniform float gardenSnow;varying vec3 gardenP;\n'+nGLSL+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nfloat grain=fbm(gardenP.xz*4.);diffuseColor.rgb*=.90+grain*.19;float snowPatch=smoothstep(.23,.68,fbm(gardenP.xz*.75));diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.85,.90,.92),gardenSnow*(.55+.45*snowPatch));')};this.terrain=this.mesh(geo,mat);
  }
  buildWater(){
    const shape=new T.Shape();const pts=[];
    for(let i=0;i<84;i++){const a=i/84*Math.PI*2,r=1+.055*Math.sin(a*3)+.038*Math.cos(a*5);pts.push(new T.Vector2(Math.cos(a)*5.5*r,Math.sin(a)*3.7*r))}
    shape.moveTo(pts[0].x,pts[0].y);pts.slice(1).forEach(p=>shape.lineTo(p.x,p.y));shape.closePath();const geo=new T.ShapeGeometry(shape,48);geo.rotateX(-Math.PI/2);
    this.waterMat=new T.ShaderMaterial({uniforms:{time:{value:0},night:{value:0},rain:{value:0},wind:{value:.35}},vertexShader:`varying vec3 vP;varying vec3 vWorld;void main(){vP=position;vWorld=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.);}`,fragmentShader:`varying vec3 vP,vWorld;uniform float time,night,rain,wind;${nGLSL}
    void main(){vec2 p=vWorld.xz;vec3 view=normalize(cameraPosition-vWorld);float fresnel=pow(1.-max(0.,view.y),3.);float ripple=fbm(p*.95+vec2(time*.07,-time*.05));float r=length(vP.xz/vec2(5.5,3.7));vec3 deep=mix(vec3(.24,.47,.46),vec3(.10,.25,.29),night);vec3 sky=mix(vec3(.62,.79,.77),vec3(.21,.37,.44),night);vec3 col=mix(deep,sky,.22+fresnel*.5);col+=ripple*.045;col=mix(col,mix(vec3(.49,.64,.50),vec3(.22,.35,.31),night),smoothstep(.65,1.03,r)*.55);float wave=sin(p.x*4.+p.y*6.+ripple*8.-time*.4);float glint=pow(max(0.,wave),26.)*.05*(.3+wind);col+=glint;float shore=(1.-smoothstep(.009,.028,abs(r-.985-ripple*.013)))*.08;col+=shore;for(int i=0;i<8;i++){float j=float(i);vec2 c=vec2(hash(vec2(j,2.)),hash(vec2(j,7.)))*8.-4.;float age=fract(time*.3+j*.137);float ring=1.-smoothstep(.012,.040,abs(length(vP.xz-c)-age*1.4));col+=rain*ring*(1.-age)*.12;}gl_FragColor=vec4(col,1.);}`});
    this.water=this.mesh(geo,this.waterMat,-3.5,-.13,-3.5);
    // 一条窄溪从池塘后方延伸至林间。
    const vertices=[],uv=[],idx=[];for(let i=0;i<=65;i++){const z=-6-i*.43,x=this.streamX(z);const y=this.groundHeight(x,z)+.025;vertices.push(x-.65,y,z,x+.65,y,z);uv.push(0,i/65,1,i/65);if(i<65){const a=i*2;idx.push(a,a+1,a+2,a+1,a+3,a+2)}}const streamGeo=new T.BufferGeometry();streamGeo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));streamGeo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));streamGeo.setIndex(idx);streamGeo.computeVertexNormals();this.mesh(streamGeo,this.waterMat);
    this.rippleRings=[];for(let i=0;i<6;i++){const ring=this.mesh(new T.RingGeometry(.37,.385,48),new T.MeshBasicMaterial({color:'#d9e6cb',transparent:true,opacity:.1,side:T.DoubleSide,depthWrite:false}),-5+rand()*5,-.11,-5+rand()*3);ring.rotation.x=-Math.PI/2;this.rippleRings.push(ring)}
  }
  buildSky(){
    super.buildSky();
    configureSkyBackground(this.sky);
    this.skyMat.uniforms.warmth={value:0};this.skyMat.uniforms.cloudCover={value:0};
    this.skyMat.uniforms.dawn={value:0};this.skyMat.uniforms.noon={value:0};this.skyMat.uniforms.deepNight={value:0};
    this.skyMat.fragmentShader=`varying vec3 d;uniform float night,time,rain,light,warmth,cloudCover,dawn,noon,deepNight;${nGLSL}void main(){vec3 v=normalize(d);float y=max(0.,v.y);vec3 day=mix(vec3(.79,.87,.81),mix(vec3(.42,.66,.76),vec3(.34,.63,.83),noon*(1.-cloudCover)),pow(y,.6));vec3 dusk=mix(vec3(.17,.25,.34),vec3(.025,.045,.105),pow(y,.5))*(1.-deepNight*.18);vec3 c=mix(day,dusk,night);c=mix(c,vec3(.94,.59,.38),warmth*exp(-y*3.5)*.72);c=mix(c,vec3(.84,.62,.70),dawn*exp(-y*4.)*.32);c=mix(c,mix(vec3(.59,.67,.67),vec3(.10,.16,.21),night),cloudCover*.48);float cl=fbm(v.xz/max(.18,v.y)*1.2+vec2(time*.003,0.));cl=smoothstep(mix(.56,.26,cloudCover),.77,cl)*smoothstep(0.,.12,v.y);c=mix(c,mix(vec3(.96,.97,.90),vec3(.16,.23,.29),night),cl*(.55+cloudCover*.25));gl_FragColor=vec4(c,1.);}`;this.skyMat.needsUpdate=true;
  }
  addClouds(){
    const texCanvas=document.createElement('canvas');texCanvas.width=256;texCanvas.height=128;const c=texCanvas.getContext('2d');
    for(let i=0;i<25;i++){const x=30+rand()*190,y=48+rand()*28,r=16+rand()*23;const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'rgba(255,255,240,.68)');g.addColorStop(.55,'rgba(255,255,240,.5)');g.addColorStop(1,'rgba(255,255,240,0)');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2)}
    const tex=new T.CanvasTexture(texCanvas);this.clouds=[];for(let i=0;i<8;i++){const mat=new T.SpriteMaterial({map:tex,color:'#fff8e5',transparent:true,opacity:.75,depthWrite:false,fog:true});const cloud=new T.Sprite(mat);cloud.position.set(-45+i*15,23+rand()*9,-65-rand()*12);cloud.scale.set(28+rand()*18,15+rand()*8,1);this.scene.add(cloud);this.clouds.push(cloud)}
  }
  buildParticles(){
    super.buildParticles();this.snowfall=createSnowfall(this.quality,(x,z)=>this.groundHeight(x,z));this.scene.add(this.snowfall);
  }
  plantPlot(i){
    const x=-.5+(i%3)*1.15,z=6.7+Math.floor(i/3)*1.7;
    // 这些地块固定在平坦草坪上，避开池塘岸边、桥梁和蜿蜒小径，
    // 以确保生长中的植物模型不会与场景相交。
    const pondClearance=Math.hypot((x+3.5)/5.6,(z+3.5)/3.8)>1.28;
    const bridge=this.bridgeCentre(),bridgeClearance=Math.hypot(x-bridge.x,z-bridge.z)>4;
    const pathClearance=Math.abs(x-this.pathX(z))>1.5;
    if(!pondClearance||!bridgeClearance||!pathClearance)throw Error('Unsafe plant plot');
    return {x,z,y:this.groundHeight(x,z)};
  }
  buildPlots(){this.plots=[];this.grown=[];this.plotRings=[];for(let i=0;i<6;i++){const {x,z,y}=this.plantPlot(i),soil=this.mesh(new T.CylinderGeometry(.41,.46,.045,40),this.mat('#a29072'),x,y+.015,z);soil.userData.plot=i;this.plots.push(soil);const ring=this.mesh(new T.RingGeometry(.49,.57,40),new T.MeshBasicMaterial({color:'#ffe6a1',transparent:true,opacity:0,side:T.DoubleSide,depthWrite:false}),x,y+.05,z);ring.rotation.x=-Math.PI/2;this.plotRings.push(ring);this.walkObstacles.push({x,z,radius:.48})}this.canvas.dataset.plotCount=String(this.plots.length)}
  plantSeed(seed='fern',plotIndex=this.plots.length-1){
    if(!this.plots.length)return false;
    const i=Math.max(0,Math.min(this.plots.length-1,plotIndex));
    this.state.sessionSeed=seed;this.state.seedPlanted=true;this.state.seedPlotIndex=i;
    this.updateGrowth(true);this.showSeedFeedback(this.plots[i]);
    this.follow=false;this.transition={pos:V(5,9,22),target:V(.6,.4,7.5)};this.selectRegion?.('garden');
    this.canvas.dataset.seed=`${seed}:${i}`;return true;
  }
  clearSeedFeedback(){
    if(!this.seedFeedback)return;
    this.seedFeedback.removeFromParent();
    this.seedFeedback.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
    this.seedFeedback=null;
  }
  showSeedFeedback(plot){
    this.clearSeedFeedback();
    const root=new T.Group(),y=plot.position.y+.12;
    const seed=new T.Mesh(new T.SphereGeometry(.11,12,8),this.mat('#e6c778'));seed.position.y=.08;root.add(seed);
    const ring=new T.Mesh(new T.RingGeometry(.28,.34,32),new T.MeshBasicMaterial({color:'#f8e8a8',transparent:true,opacity:.8,side:T.DoubleSide,depthWrite:false}));ring.rotation.x=-Math.PI/2;root.add(ring);
    const glow=new T.Mesh(new T.SphereGeometry(.24,16,8),new T.MeshBasicMaterial({color:'#fff0b5',transparent:true,opacity:.12,depthWrite:false}));root.add(glow);
    root.position.set(plot.position.x,y,plot.position.z);root.userData.age=0;this.scene.add(root);this.seedFeedback=root;
  }
  registerFlower(x,z,height=.65,radius=.4){
    // Picking proxies stay outside the scene, so they add no rendering or shadow cost.
    this.flowerHitGeometry??=new T.CylinderGeometry(1,1,1,10);
    this.flowerHitMaterial??=new T.MeshBasicMaterial();
    const hit=new T.Mesh(this.flowerHitGeometry,this.flowerHitMaterial);
    hit.position.set(x,this.groundHeight(x,z),z);
    hit.geometry=this.flowerHitGeometry;hit.scale.set(radius,height,radius);
    // Lift the geometry, while retaining ground-level position for approach planning.
    if(!this.flowerHitGeometry.userData.lifted){this.flowerHitGeometry.translate(0,.5,0);this.flowerHitGeometry.userData.lifted=true;}
    hit.userData={flower:true,approachRadius:radius+.45,instances:[]};hit.updateMatrixWorld(true);
    const transform=new T.Matrix4(),matrix=new T.Matrix4(),rotation=new T.Matrix4();
    hit.userData.sway=angle=>{
      transform.makeTranslation(x,hit.position.y,z).multiply(rotation.makeRotationZ(angle)).multiply(matrix.makeTranslation(-x,-hit.position.y,-z));
      for(const instance of hit.userData.instances){matrix.multiplyMatrices(transform,instance.base);instance.mesh.setMatrixAt(instance.index,matrix);instance.mesh.instanceMatrix.needsUpdate=true;}
    };
    this.flowerTargets.push(hit);return hit;
  }
  async loadAssets(){
    T.Cache.enabled=true;const bundle=window.STORY_ASSETS,loader=new GLTFLoader();
    const entries=Object.entries(bundle.models);
    await Promise.all(entries.map(async([name,json])=>{const data=typeof structuredClone==='function'?structuredClone(json):JSON.parse(JSON.stringify(json));for(const b of data.buffers||[])b.uri=bundle.files[b.uri];for(const im of data.images||[]){im.uri=bundle.files[im.uri];im.mimeType='image/webp'}this.models[name]=await loader.parseAsync(JSON.stringify(data),'')}));
    const q=this.quality;
    for(const[name,gltf]of Object.entries(this.models)){gltf.scene.traverse(o=>{if(!o.isMesh)return;const m=o.material.clone();m.roughness=.88;m.metalness=0;m.envMapIntensity=.25;if(m.normalScale)m.normalScale.set(.28,.28);if(m.map){m.map.anisotropy=q==='high'?4:1;m.map.colorSpace=T.SRGBColorSpace}m.alphaTest=Math.max(m.alphaTest||0,.32);const foliage=/Leaves|Grass|Flowers/i.test(m.name);o.castShadow=!foliage&&q!=='low';o.receiveShadow=!foliage&&q!=='low';if(foliage){m.side=T.DoubleSide;m.emissive.set('#78955f');m.emissiveIntensity=.045;o.geometry.computeBoundingBox();const b=o.geometry.boundingBox;o.material=this.windMaterial(m,b.max.y-b.min.y,b.min.y,name.startsWith('CommonTree')?.22:.10);if(q==='high'){o.customDepthMaterial=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking,map:m.map,alphaTest:m.alphaTest,side:T.DoubleSide});o.customDepthMaterial.onBeforeCompile=o.material.userData.windPatch;o.customDepthMaterial.customProgramCacheKey=o.material.customProgramCacheKey;}}else o.material=m;});this.rememberTemplate(name,gltf.scene)}
    this.staticRoots=[];this.place=(name,x,z,height,angle=rand()*6.28,options={})=>{
      const o=this.cloneShared(name),t=this.templates[name],s=height/t.height,group=new T.Group();o.scale.setScalar(s);o.position.y=-t.minY*s;group.add(o);group.position.set(x,this.groundHeight(x,z)+(options.lift||0),z);group.rotation.y=angle;if(options.width){group.scale.x=options.width;group.scale.z=options.width}this.scene.add(group);if(/^CommonTree/.test(name))this.walkObstacles.push({x,z,radius:Math.max(.38,height*.06)});else if(/^Rock/.test(name)&&height>.22)this.walkObstacles.push({x,z,radius:Math.max(.22,height*.65)});else if(/^Bush/.test(name)&&!options.dynamic)this.walkObstacles.push({x,z,radius:height*.4});if(!options.dynamic)this.staticRoots.push(group);return group;
    };
    this.populateGarden();this.details=installDetails(this);this.atmosphere=installAtmosphere(this,T);this.cozyContent=installGardenContent(this,T);this.outskirts=installGardenOutskirts(this,T);this.batchScenery();this.makeCat();this.updateGrowth(true);this.buildBridge();this.addLilyPads();
    this.canvas.dataset.artVersion='storybook-v2';this.canvas.dataset.assets='Quaternius textured nature · CC0';
  }
  populateGarden(){
    const q=this.quality,groupSize=q==='high'?4:q==='mid'?3:2,flowersPerBed=q==='high'?16:q==='mid'?9:5,bushes=q==='high'?28:q==='mid'?18:10,glbGrass=q==='high'?90:q==='mid'?28:0,lineTrees=q==='high'?26:q==='mid'?16:8;
    const tree=(name,x,z,h,w=1)=>this.place(name,x,z,h,rand()*6.28,{width:w});
    tree('CommonTree_1',9,-4,9,1.12);tree('CommonTree_2',-11,-6,8,1.12);tree('CommonTree_3',-7,-17,9);tree('CommonTree_5',15,-14,9);tree('CommonTree_2',9,-22,10);
    // 小型植物组为小桥、花坡和树林方向留出视线开口。
    const groups=[[-22,-4],[-20,-19],[-13,-31],[0,-36],[19,-30],[29,-14],[27,9],[-22,13]];
    for(let j=0;j<groups.length;j++){const [gx,gz]=groups[j];for(let i=0;i<groupSize;i++){const x=gx+(rand()-.5)*10,z=gz+(rand()-.5)*10;if(!this.clearForScenery(x,z,1.6))continue;tree(['CommonTree_1','CommonTree_2','CommonTree_3','CommonTree_5'][(j+i)%4],x,z,7+rand()*7)}}
    const flowerBeds=[[-8,2,2.3],[-5,3,2],[-8,-8,2.3],[7,0,2.2],[9,5,2.8],[-5,10,2.4],[5,11,2.5],[15,-12,4.3],[18,-7,3.3],[-9,-21,3]];
    flowerBeds.push([-7,7,2.5],[7,8,2.4],[-10,-2,2],[2,-8,2]);
    for(let bi=0;bi<flowerBeds.length;bi++){const [x,z,r]=flowerBeds[bi];for(let i=0;i<flowersPerBed;i++){const a=rand()*6.28,rr=Math.sqrt(rand())*r;const px=x+Math.cos(a)*rr,pz=z+Math.sin(a)*rr;if(!this.clearForScenery(px,pz,.4))continue;const height=.48+rand()*.52,flower=this.place(i%3?'Flower_4_Group':'Flower_3_Group',px,pz,height),hit=this.registerFlower(px,pz,height,.36);flower.traverse(o=>{if(o.isMesh)o.userData.flowerTarget=hit})}}
    for(let i=0;i<lineTrees;i++){const x=-38+(lineTrees>1?i*(75/(lineTrees-1)):0),z=-43+Math.sin(i*.8)*5;tree('CommonTree_2',x,z,9+rand()*4,1.2)}
    for(let i=0;i<bushes;i++){const a=rand()*6.28,r=12+rand()*21,x=Math.cos(a)*r,z=Math.sin(a)*r;if((z>14&&Math.abs(x)<13)||!this.clearForScenery(x,z,.8))continue;this.place('Bush_Common_Flowers',x,z,.6+rand()*.65)}
    // 以密集植被丰富边缘，并刻意保留草坪与小径的留白。
    for(let i=0;i<glbGrass;i++){let x=(rand()-.5)*62,z=(rand()-.5)*62;if(!this.clearForScenery(x,z,.3)||Math.abs(x-this.pathX(z))<1.2)continue;const centre=Math.hypot(x-1,z-3);if(centre<5.8&&rand()<.9)continue;if(z>14&&Math.abs(x)<9)continue;this.place(i%3?'Grass_Common_Tall':'Grass_Wispy_Tall',x,z,.18+rand()*.43)}
    [[-8,-5,.6],[-7,0,.4],[-1,-.2,.32],[1,-4,.5],[-5,-7,.5],[-3,-7,.35],[6,-7,.7],[11,6,.55],[-10,6,.9],[14,-13,1.1]].forEach(([x,z,h],i)=>this.place(i%2?'Rock_Medium_1':'Rock_Medium_3',x,z,h));
    // 单独摆放的磨损踏石嵌在土路中。
    for(let i=0;i<19;i++){const z=12-i*1.15,x=this.pathX(z);const stone=this.place('Rock_Medium_1',x,z,.13,Math.sin(i)*.2,{width:1.45});stone.scale.y=.7}
    this.addScatteredPetals();
  }
  addScatteredPetals(){
    const geo=new T.SphereGeometry(1,5,3),mat=new T.MeshStandardMaterial({color:'#edddc9',roughness:1});const count=this.quality==='high'?180:this.quality==='mid'?80:40,mesh=new T.InstancedMesh(geo,mat,count),d=new T.Object3D();
    for(let i=0;i<count;i++){const x=(rand()-.5)*30,z=(rand()-.5)*30;d.position.set(x,this.groundHeight(x,z)+.025,z);d.scale.set(.027+rand()*.035,.007,.02+rand()*.04);d.rotation.y=rand()*6.28;d.updateMatrix();mesh.setMatrixAt(i,d.matrix);mesh.setColorAt(i,new T.Color(['#d9d7b3','#d9bcc7','#c4c9d2'][i%3]))}mesh.receiveShadow=false;mesh.frustumCulled=false;this.scene.add(mesh);
  }
  buildBridge(){
    const {x,z}=this.bridgeCentre(),root=new T.Group();root.position.set(x,this.groundHeight(x,z)+.15,z);root.rotation.y=Math.atan(this.streamSlope(z));root.name='garden-bridge';this.scene.add(root);const wood=this.mat('#baa783'),dark=this.mat('#a39377');
    for(let i=0;i<12;i++){const b=new T.Mesh(new T.BoxGeometry(.22,.09,1.5),wood);b.position.set((i-5.5)*.23,Math.sin(i/11*Math.PI)*.19,0);b.rotation.z=Math.cos(i/11*Math.PI)*.1;b.castShadow=this.quality!=='low';b.receiveShadow=this.quality!=='low';root.add(b)}
    for(const side of [-1,1]){for(const x of [-1.3,0,1.3]){const p=new T.Mesh(new T.CylinderGeometry(.045,.05,.65,8),dark);p.position.set(x,.37,side*.72);p.castShadow=true;root.add(p)}const c=new T.CatmullRomCurve3([V(-1.4,.65,side*.72),V(0,.77,side*.72),V(1.4,.65,side*.72)]);const rail=new T.Mesh(new T.TubeGeometry(c,18,.03,6,false),dark);root.add(rail)}
  }
  addLilyPads(){
    const leafMat=this.mat('#819d6f'),petal=this.mat('#e9c5c6');
    for(const[x,z,s]of [[-6,-4,.32],[-5,-4.5,.24],[-2,-5,.35],[-1,-3,.26]]){const o=this.mesh(new T.CircleGeometry(s,32,0,Math.PI*1.84),leafMat,x,-.104,z);o.rotation.x=-Math.PI/2;o.rotation.z=rand()*6;const stem=this.mesh(new T.SphereGeometry(1,12,8),petal,x,-.07,z);stem.scale.set(.12,.08,.12)}
  }
  makeCat(){
    this.storyCat=createStoryCat();this.cat=this.storyCat.root;this.cat.scale.setScalar(.609375);this.scene.add(this.cat);this.catMixer={update(){}};this.catAction=null;
    this.catPath=new T.CatmullRomCurve3([V(1.7,0,4.4),V(4,0,3.2),V(5.3,0,1.5),V(7,0,3),V(6,0,6.6),V(3,0,8),V(-1.3,0,7.6),V(-2,0,5.2)],true,'catmullrom',.28);this.catDistance=0;this.pathLength=this.catPath.getLength();this.cat.position.copy(this.catPath.getPointAt(0));this.cat.position.y=this.groundHeight(this.cat.position.x,this.cat.position.z);const heading=this.catPath.getTangentAt(0);this.cat.rotation.y=Math.atan2(heading.x,heading.z);const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d'),grad=ctx.createRadialGradient(64,64,8,64,64,64);grad.addColorStop(0,'rgba(20,35,17,.45)');grad.addColorStop(.5,'rgba(20,35,17,.17)');grad.addColorStop(1,'rgba(20,35,17,0)');ctx.fillStyle=grad;ctx.fillRect(0,0,128,128);this.catContact=new T.Mesh(new T.PlaneGeometry(2.3,2.5),new T.MeshBasicMaterial({map:new T.CanvasTexture(c),transparent:true,depthWrite:false,opacity:.62}));this.catContact.rotation.x=-Math.PI/2;this.scene.add(this.catContact);this.companion=new GardenCompanion(this);this.companion.stop();this.canvas.dataset.catSource='Original storybook cat';this.canvas.dataset.catAnimation='articulated walk, breathing, blinking, ears and tail';
  }
  updateGrowth(force=false){
    if(!this.place)return;
    const count=this.plots.length,records=this.state.records.slice(this.state.mode==='session'?-(count-1):-count),liveIndex=this.state.mode==='session'&&this.state.seedPlanted?(this.state.seedPlotIndex??count-1):-1;
    const signature=[this.state.mode,liveIndex,this.state.sessionSeed,records.map(r=>r.id||r.date).join(',')].join(':');
    if(force||signature!==this.recordSignature){
      if(this.companion?.flower&&this.grown.includes(this.companion.flower))this.companion.stop();
      this.recordSignature=signature;this.grown.forEach(x=>this.scene.remove(x));this.grown=[];
      this.plots.forEach((plot,i)=>{
        const r=records[i],live=i===liveIndex,seed=this.state.sessionSeed, name=live?(seedModels[seed]||seedModels.fern):seedModels[r?.type]|| (r?.type==='wind'?'Flower_4_Group':r?.type==='water'?'Bush_Common_Flowers':'Grass_Common_Tall');
        const plant=this.place(name,plot.position.x,plot.position.z,.75,0,{dynamic:true});
        plant.userData={plot:i,record:r,seed:live?seed:null,flower:true,approachRadius:.88,sway:angle=>{plant.rotation.z=angle;}};this.grown.push(plant);
      });
    }
    this.grown.forEach((plant,i)=>{const r=records[i],live=i===liveIndex,size=r?(r.plantSize??(r.complete?1:.72)):live?.12+Math.min(1,this.state.elapsed/90)*.88:0;plant.visible=!!r||live;plant.scale.setScalar(size);});
  }
  inviteToRecord(record){const plant=this.grown.find(p=>p.userData.record===record);return plant?this.companion.visit(plant):false;}
  home(immediate=false){
    this.stopCatForCamera();this.storyCat?.release();this.controls.minDistance=3.6;this.follow=false;const weatherSky=['rainbow','aurora','meteor'].includes(this.state.weather),target=weatherSky?V(-1,4,-3):V(-1,2,-1.5),pos=weatherSky?V(6,9.5,27):V(6,12,29);if(immediate){this.camera.position.copy(pos);this.controls.target.copy(target);this.controls.update()}else this.transition={pos,target};this.selectRegion?.('pond');
  }
  buildNavigation(){
    const nav=document.createElement('nav');nav.className='region-nav';nav.setAttribute('aria-label','漫游花园');const regions=[['pond','池畔'],['entrance','花廊'],['meadow','花坡亭'],['cottage','猫屋'],['grove','萤火林'],['moon','月光园'],['garden','小花园'],['country','乡间'],['wetland','湿地']];
    const views={entrance:{pos:V(11,6,25),target:V(5,1,15)},meadow:{pos:V(27,9,5),target:V(17,2,-8.5)},cottage:{pos:V(-3,7,2),target:V(-12,1.4,-13)},grove:{pos:V(-12,7,16),target:V(-22,1,4)},moon:{pos:V(9,8,-16),target:V(1,2,-31)},garden:{pos:V(5,9,22),target:V(.6,.4,7.5)},country:{pos:V(18,10,55),target:V(3,1,40)},wetland:{pos:V(-32,20,-25),target:V(-14,1,-48)}};
    regions.forEach(([key,label])=>{const b=document.createElement('button');b.textContent=label;b.dataset.region=key;b.setAttribute('aria-pressed',key==='pond'?'true':'false');b.onclick=()=>{this.stopCatForCamera();this.follow=false;this.onExplore();if(key==='pond')this.home();else this.transition=views[key];this.selectRegion(key)};nav.append(b)});this.host.parentElement.append(nav);this.selectRegion=key=>{nav.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.region===key)));this.canvas.dataset.region=key};
  }
  handleExploreStart(){return false}
  // Camera commands never change the actor's path distance or world heading.
  stopCatForCamera(){this.catSpeed=0;this.cameraHoldUntil=(this.t||0)+.8}
  catCameraHeld(t){return this.follow||!!this.transition||t<(this.cameraHoldUntil||0)||!!this.gesture?.moved}
  zoomBy(f){this.stopCatForCamera();super.zoomBy(f)}
  focus(){this.companion?.stop();this.stopCatForCamera();this.controls.minDistance=3.6*(this.cat?.scale.x||.609375)/1.06;this.follow=true;this.transition=null;if(this.scene&&this.renderer)this.chooseCatFocusView()}
  chooseCatFocusView(){
    this.scene.updateMatrixWorld(true);
    let best=null,bestScore=-Infinity;
    // Look through several possible close-up sight lines. Keep the existing
    // garden geometry and path; pick a clear camera instead of drawing through
    // flowers that happen to be in front of the actor at this stop.
    for(const [angle,elevation]of [[0,1.3],[0,3.8],[-.5,3.8],[.5,3.8],[0,6],[-.8,5],[.8,5]]){
      const direction=V(1.6,elevation,6.5).applyAxisAngle(V(0,1,0),angle);this.catFocusDirection=direction;
      const view=this.catView(),origin=view.target.clone().add(view.offset);let score=0;
      for(const [height,weight]of [[1.35,3],[.9,2],[.35,1]]){
        const target=this.cat.position.clone().add(V(0,height*this.cat.scale.x,0)),distance=origin.distanceTo(target),ray=new T.Raycaster(origin,target.sub(origin).normalize(),.05,distance-.02);ray.camera=this.camera;
        const blocked=ray.intersectObjects(this.scene.children,true).some(hit=>{
          let o=hit.object;if(!o.isMesh||o===this.sky||o.material.transparent||o.material.visible===false)return false;
          while(o){if(o===this.cat||!o.visible)return false;o=o.parent}return true;
        });
        if(!blocked)score+=weight;
      }
      if(score>bestScore){bestScore=score;best=direction.clone()}
      if(score===6)break;
    }
    this.catFocusDirection=best;
  }
  catView(){
    const box=this.canvas.getBoundingClientRect(),width=Math.max(1,box.width),height=Math.max(1,box.height),parent=this.host?.parentElement;
    const rect=element=>{if(!element||element.hidden)return null;const r=element.getBoundingClientRect?.();return r?.width>1&&r.height>1?r:null};
    let top=20,bottom=height-20;
    for(const element of [parent?.querySelector('.topbar'),document.getElementById('backFocus')]){const r=rect(element);if(r)top=Math.max(top,r.bottom-box.top+18)}
    for(const element of ['controls','homeDock','gardenBottom'].map(id=>document.getElementById(id))){const r=rect(element);if(r)bottom=Math.min(bottom,r.top-box.top-24)}
    top=clamp(top,20,height*.4);bottom=clamp(bottom,top+height*.18,height-20);
    const high=1-2*top/height,low=1-2*bottom/height,middle=(high+low)/2,tan=Math.tan(this.camera.fov*Math.PI/360),aspect=width/height;
    const direction=(this.catFocusDirection||V(1.6,1.3,6.5)).clone().normalize(),right=V(0,1,0).cross(direction).normalize(),up=direction.clone().cross(right),scale=this.cat.scale.x;
    // A fixed envelope includes raised ears, chin poses and the curled tail.
    // Breathing and posture changes must not make the close-up zoom in/out.
    const centre=V(0,1.16,-.125).multiplyScalar(scale),corners=[];
    const envelopes=[[[ -.78,.78],[.20,2.32],[0,1.30]],[[-.65,.65],[0,1.15],[-1.05,.80]],[[-.20,.65],[.30,1.85],[-1.50,-.50]],[[-.15,.95],[0,.60],[-1.10,.10]]];
    for(const [xs,ys,zs]of envelopes)for(const x of xs)for(const y of ys)for(const z of zs){const p=V(x,y,z).multiplyScalar(scale).sub(centre);corners.push({x:p.dot(right),y:p.dot(up),z:p.dot(direction)})}
    let distance=3.8*scale/1.06;
    for(const p of corners)distance=Math.max(distance,p.z+Math.abs(p.x)/(tan*aspect*.82),(p.y+p.z*tan*high)/(tan*(high-middle)),(-p.y-p.z*tan*low)/(tan*(middle-low)));
    distance*=1.04;
    // Keep OrbitControls' existing ground limit while reserving room above
    // the dock. On short screens fit again after limiting the target height.
    const shift=Math.min(distance*tan*middle,(centre.y-.500001)/up.y);
    if(low<0&&high>0)for(const p of corners)distance=Math.max(distance,p.z+(p.y+shift)/(tan*high),p.z+(p.y+shift)/(tan*low));
    const yaw=this.cat.rotation.y,axis=V(0,1,0);
    return {target:this.cat.position.clone().add(centre.addScaledVector(up,-shift).applyAxisAngle(axis,yaw)),offset:direction.multiplyScalar(distance).applyAxisAngle(axis,yaw)};
  }
  pet(zone='head'){this.companion?.stop();return this.storyCat?.pet(zone)||false}
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
  visibleHit(ray){return ray.intersectObjects(this.scene.children,true).find(h=>{let o=h.object;if(!o.isMesh||o===this.sky||o.material.transparent||o.material.visible===false)return false;while(o){if(!o.visible)return false;o=o.parent}return true})}
  petHit(ray,checkOcclusion=true){
    const hit=this.cat&&ray.intersectObject(this.cat,true).find(h=>{let o=h.object;while(o){if(!o.visible)return false;o=o.parent}return true});
    if(!hit)return null;if(!checkOcclusion)return hit;const visible=this.visibleHit(ray);return !visible||visible.distance>=hit.distance-.02?hit:null;
  }
  contactAt(hit,frame){
    if(hit.catContact)return hit.catContact;
    let zone=hit.object.userData.petZone||'back';
    const point=frame?hit.point.clone().applyMatrix4(zone==='head'?frame.head:frame.body):(zone==='head'?this.storyCat.head:this.cat).worldToLocal(hit.point.clone());
    if(zone==='head'&&point.y<-.14&&point.z>.28)zone='chin';
    return {zone,x:point.x/.58,y:zone==='back'?(point.z+.2)/.7:point.y/.49};
  }
  stroke(hit,contact=this.contactAt(hit)){
    this.companion?.stop();
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
      for(const p of g.pickPose){
        p.live.copy(p.object.matrixWorld);p.object.matrixWorld.copy(p.matrix);
        if(p.inverse){p.liveInverse.copy(p.object.bindMatrixInverse);p.object.bindMatrixInverse.copy(p.inverse);p.object.boundingSphere=null;p.object.boundingBox=null}
      }
      try{const hit=this.petHit(this.pick(x,y),false);return hit?this.contactAt(hit,g.pickFrame):null}
      finally{for(const p of g.pickPose){p.object.matrixWorld.copy(p.live);if(p.inverse){p.object.bindMatrixInverse.copy(p.liveInverse);p.object.boundingSphere=null;p.object.boundingBox=null}}}
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
        this.cat.traverse(object=>g.pickPose.push({object,matrix:object.matrixWorld.clone(),live:object.matrixWorld.clone(),inverse:object.isSkinnedMesh?object.bindMatrixInverse.clone():null,liveInverse:object.isSkinnedMesh?object.bindMatrixInverse.clone():null}));
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
        const cat=this.petHit(this.pick(e.clientX,e.clientY));
        this.canvas.dataset.interaction=cat?'cat':'garden';
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
      if(!g.moved)e.stopImmediatePropagation();
    },true);
    const release=e=>{this.storyCat?.release();this.activePointers.delete(e.pointerId);if(this.canvas.hasPointerCapture(e.pointerId))this.canvas.releasePointerCapture(e.pointerId);this.controls.enabled=true;this.canvas.dataset.interaction='garden'};
    this.canvas.addEventListener('pointerup',e=>{
      const g=this.gesture;this.gesture=null;release(e);
      if(g?.stroke&&!g.wasFocused&&!g.moved&&performance.now()-g.at<650)document.getElementById('focusButton').click();
      if(!g||g.id!==e.pointerId||g.stroke||g.moved||Math.hypot(e.clientX-g.x,e.clientY-g.y)>8||performance.now()-g.at>650)return;
      this.pickDestination(e.clientX,e.clientY);
    },true);
    this.canvas.addEventListener('pointercancel',e=>{this.gesture=null;release(e)},true);
    this.canvas.addEventListener('lostpointercapture',e=>{if(this.gesture?.id===e.pointerId){this.gesture=null;release(e)}},true);
    this.canvas.addEventListener('wheel',()=>{this.gesture=null;explore()},{passive:true,capture:true});
    this.canvas.addEventListener('pointerleave',()=>{if(!this.gesture)this.storyCat?.look(0,0)});
    this.canvas.addEventListener('keydown',e=>{
      if(e.key.toLowerCase()==='c'&&this.state.focused){e.preventDefault();document.getElementById('chinButton').click();return}
      if(e.key==='Enter'||e.key===' '){e.preventDefault();this.petZone='head';document.getElementById('cat').dispatchEvent(new MouseEvent('click'));return}
      if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','0'].includes(e.key))return;
      e.preventDefault();explore();if(e.key==='0')this.home();else if(e.key==='+'||e.key==='-')this.zoomBy(e.key==='+'?1.15:1/1.15);
      else{const d=this.camera.position.clone().sub(this.controls.target);if(e.key==='ArrowLeft'||e.key==='ArrowRight')d.applyAxisAngle(V(0,1,0),e.key==='ArrowLeft'?.15:-.15);else d.y+=e.key==='ArrowUp'?1:-1;this.camera.position.copy(this.controls.target).add(d)}
    });
    this.canvas.setAttribute('aria-label','三维花园：点击草地点选目的地，点击花朵让小猫咬一咬或蹭一蹭；拖动环绕，双指缩放；按住小猫并轻轻滑动，抚摸头顶、下巴或背部。回车抚摸头顶，C轻挠下巴。');
  }
  pickDestination(x,y){
    if(!this.companion||document.querySelector('.overlay:not([hidden])'))return;
    this.scene.updateMatrixWorld(true);
    const ray=this.pick(x,y),visible=this.visibleHit(ray);
    const roots=[...this.plots,...this.grown.filter(p=>p.visible),...this.flowerTargets];
    for(const hit of ray.intersectObjects(roots,true)){
      let root=hit.object;while(root.parent&&!roots.includes(root))root=root.parent;
      // Flower proxies include a little air around petals; reject scenery in front.
      if(visible&&visible.distance<hit.distance-.45&&!this.plots.includes(visible.object)&&!this.grown.some(p=>p===visible.object||p.getObjectById(visible.object.id))&&visible.object!==this.terrain)continue;
      if(root.userData.plot!==undefined){
        const index=root.userData.plot,plant=this.grown[index];
        if(plant?.userData.record)document.querySelectorAll('#plots > g')[index]?.dispatchEvent(new MouseEvent('click'));
        else if(plant?.visible)this.companion.visit(plant);
        else this.companion.goTo({x:root.position.x,z:root.position.z-.95});
        return;
      }
      if(root.userData.flower){this.companion.visit(root);return;}
    }
    if(visible?.object===this.terrain)this.companion.goTo(visible.point);
  }
  updateCatMovement(dt,motion,t){
    if(!this.companion)return super.updateCatMovement(dt,motion,t);
    const before=this.cat.position.clone(),c=this.companion;
    const travelling=c.phase==='walking'||c.phase==='roaming';
    // Wait for paws to return to the ground before translating a seated cat.
    const recovering=travelling&&((this.cat.userData.sitWeight||0)>.02||(this.cat.userData.lieWeight||0)>.02);
    c.update(dt,!!this.cat.userData.contact||!!this.gesture||!!this.transition||t<(this.cameraHoldUntil||0)||recovering);
    const distance=before.distanceTo(this.cat.position);this.catSpeed=dt?distance/dt:0;this.catDistance+=distance;
    this.canvas.dataset.catPosition=`${this.cat.position.x.toFixed(2)},${this.cat.position.z.toFixed(2)}`;
  }
  updateCatContext(){
    if(!this.storyCat||!this.state)return;
    const listening=!!this.state.playing&&Object.values(this.state.mix||{}).some(v=>v>0);
    this.storyCat.setContext({night:this.state.night,listening,wind:this.state.wind/100});
    if(listening&&!this.catListening)this.storyCat.notice('music',{x:0,y:-.15});
    const rain=this.state.weather==='rain';
    if(rain&&!this.catRain&&this.water)this.catNotice('rain',this.water.position);this.catRain=rain;
    this.catListening=listening;this.catWeather=this.state.weather;
  }
  catNotice(kind,point){
    if(!this.cat||!this.storyCat||this.cat.position.distanceTo(point)>9)return false;
    const local=point.clone().sub(this.cat.position).applyAxisAngle(V(0,1,0),-this.cat.rotation.y);
    return this.storyCat.notice(kind,{x:clamp(Math.atan2(local.x,local.z)/1.4,-1,1),y:clamp(-local.y/4,-.5,.5)});
  }
  catResting(t){
    this.updateCatContext();
    if(this.storyCat?.wantsRest(t))return true;
    // Different stretches and pauses avoid the same short clockwork loop.
    let phase=t%134;
    for(const [walk,rest] of [[23,8],[31,11],[18,7],[26,10]]){if(phase<walk+rest)return phase>=walk;phase-=walk+rest}
    return false;
  }
  beforeRender(dt){
    const n=this.skyMat.uniforms.night.value,light=this.skyMat.uniforms.light.value,t=this.t,targets=environmentTargets(this.state);
    const u=this.skyMat.uniforms;u.warmth.value=approach(u.warmth.value,targets.warmth,dt);u.cloudCover.value=approach(u.cloudCover.value,targets.cloud,dt);
    for(const key of ['dawn','noon','deepNight'])u[key].value=approach(u[key].value,targets[key],dt);
    const warm=u.warmth.value,cloud=u.cloudCover.value,deep=u.deepNight.value;
    this.hemi.intensity=T.MathUtils.lerp(1.1+light*.35,.68*(1-deep*.28),n);this.hemi.color.set('#e9f2ed').lerp(new T.Color('#aac1d0'),n);this.hemi.groundColor.set('#a1b282').lerp(new T.Color('#435856'),n);
    this.sun.intensity=T.MathUtils.lerp((.22+light*2.7)*(1-cloud*.72),.55*(1-deep*.45),n);this.sun.color.set('#fff0d0').lerp(new T.Color('#fff7e9'),u.noon.value).lerp(new T.Color('#ffc18b'),warm).lerp(new T.Color('#b3cee8'),n);this.renderer.toneMappingExposure=T.MathUtils.lerp(1.02,1.0,n);this.scene.fog.color.set('#c5dcd3').lerp(new T.Color('#d9b5a0'),warm*.4).lerp(new T.Color('#283f50'),n);
    this.scene.environmentIntensity=this.state.localSky?T.MathUtils.lerp(.22,.10,n)*(1-deep*.2):.22;
    this.scene.fog.density=approach(this.scene.fog.density,.007+targets.fog*.018,dt);
    if(this.snowCover)this.snowCover.value=approach(this.snowCover.value,targets.snow*.85,dt*.5);
    if(this.snowfall)updateSnowfall(this.snowfall,dt,t,{snow:targets.snow,night:n},this.state.wind/100,this.state.reduced,this.camera?.position);
    const sunY=this.state.localSky?T.MathUtils.lerp(5+targets.altitude*23,24,n):24;
    this.sun.position.x=approach(this.sun.position.x,this.state.localSky?T.MathUtils.lerp(targets.sunX,-15,n):-15,dt);this.sun.position.y=approach(this.sun.position.y,sunY,dt);
    if(this.cat)this.cat.userData.turning=0;if(this.catContact){this.catContact.position.copy(this.cat.position);this.catContact.position.y+=.013;this.catContact.rotation.z=-this.cat.rotation.y}if(this.storyCat){this.updateCatContext();const moving=this.catSpeed>.025&&!this.cat.userData.contact;this.storyCat.animate(t,moving,this.state.wind/100,!moving,dt,this.state.reduced,this.catDistance*8,this.companion?.pose||(['walking','roaming'].includes(this.companion?.phase)?{action:'walk',time:0}:null));this.canvas.dataset.catPose=this.cat.userData.pose;this.canvas.dataset.catExpression=this.cat.userData.expression;this.canvas.dataset.petCount=String(this.cat.userData.petCount||0);this.canvas.dataset.petting=String(this.cat.userData.petting);this.canvas.dataset.catReaction=this.cat.userData.reactionName||'';this.canvas.dataset.catAction=this.cat.userData.idleAction||'rest';this.canvas.dataset.catRest=this.cat.userData.nightRest?'sleeping':this.cat.userData.companionPhase;this.canvas.dataset.catEnvironment=this.cat.userData.environmentReaction||''}
    if(this.cat&&!this.state.night&&t-(this.lastCatNatureNotice||0)>16){
      const butterfly=this.butterflies?.find(b=>b.group.visible&&b.group.position.distanceTo(this.cat.position)<4);
      if(butterfly&&this.catNotice('butterfly',butterfly.group.position))this.lastCatNatureNotice=t;
    }
    if(this.seedFeedback){const f=this.seedFeedback;f.userData.age+=dt;const age=f.userData.age;if(!this.state.reduced){f.scale.setScalar(1+Math.sin(age*5)*.12+Math.min(age,.8)*.4);f.children[1].rotation.z+=dt*1.8;}f.children[1].material.opacity=Math.max(0,.8-age*.22);f.children[2].material.opacity=Math.max(0,.12-age*.035);if(age>4)this.clearSeedFeedback();}
    this.details?.update(t,n);
    this.atmosphere?.update(dt,t,n);
    this.cozyContent?.update(t,n);
    this.clouds?.forEach((c,i)=>{c.material.opacity=(1-n*.7)*.6;c.material.color.set('#fff8e8').lerp(new T.Color('#718c9f'),n);c.position.x+=dt*.045*(.2+this.state.wind/100)});
    this.rippleRings?.forEach((r,i)=>{const f=(t*.09+i*.17)%1;r.scale.setScalar(.4+f*1.8);r.material.opacity=(1-f)*.095});
    const planting=this.state.records.find(r=>r.growth!==undefined&&r.growth<1);
    this.plotRings?.forEach((ring,i)=>{const active=planting&&this.grown[i]?.scale.x===planting.growth;ring.material.opacity=active?(.22+.18*Math.sin(t*8)):0;ring.scale.setScalar(active?1+Math.sin(t*8)*.08:1)});
    // 表层控制保持轻盈；渲染世界的诊断信息可由 DOM 读取。
    this.canvas.dataset.catStyle='rigged-fluffy-kitten';this.canvas.dataset.artVersion='groomed-coat-v2';
    this.canvas.dataset.skyMode='infinite-background';
    this.canvas.dataset.catSource='3D skinned kitten';this.canvas.dataset.catAnimation='continuous skeletal poses';
    if(this.catContact){this.catContact.scale.set(this.cat.scale.x*.92,this.cat.scale.x*.98,1);this.catContact.material.opacity=.52}
  }
}
window.GARDEN_PLOT_COUNT=6;
window.GardenWorld=StoryWorld;
window.CityWorld=CityWorld;
