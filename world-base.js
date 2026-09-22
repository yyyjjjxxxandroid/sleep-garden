import * as T from './vendor/three/build/three.module.js';
import { OrbitControls } from './vendor/three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from './vendor/three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries, mergeVertices } from './vendor/three/examples/jsm/utils/BufferGeometryUtils.js';

const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
let seed=527;const rnd=()=>((seed=seed*16807%2147483647)-1)/2147483646;
const mix=(a,b,t)=>a+(b-a)*t;
const noiseGLSL=`float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}float fbm(vec2 p){return .54*noise(p)+.27*noise(p*2.03)+.13*noise(p*4.07)+.06*noise(p*8.11);}`;

export class GardenWorld {
  constructor({svg,scene,state,onExplore}){
    this.state=state;this.host=scene;this.onExplore=onExplore;this.t=0;this.last=0;this.follow=false;this.wind={time:{value:0},strength:{value:.35}};this.materials=[];this.models={};this.animals=[];this.grown=[];
    svg.classList.add('legacy-world');
    this.scene=new T.Scene();this.scene.fog=new T.FogExp2('#c9dcd8',.009);
    this.camera=new T.PerspectiveCamera(44,1,.1,220);
    this.renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.12;
    this.canvas=this.renderer.domElement;this.canvas.className='garden-3d';this.canvas.setAttribute('aria-label','可旋转缩放的三维花园，拖动环绕，双指缩放，轻点小猫靠近');this.canvas.tabIndex=0;scene.prepend(this.canvas);
    this.controls=new OrbitControls(this.camera,this.canvas);Object.assign(this.controls,{enableDamping:true,dampingFactor:.06,minDistance:4,maxDistance:62,maxPolarAngle:Math.PI*.465,minPolarAngle:.22,enablePan:true,screenSpacePanning:false,rotateSpeed:.42,zoomSpeed:.7,panSpeed:.6});
    this.controls.addEventListener('start',()=>{this.follow=false;this.transition=null;onExplore()});
    this.hemi=new T.HemisphereLight('#edf3ed','#829078',2.0);this.scene.add(this.hemi);
    this.sun=new T.DirectionalLight('#fff1d2',2.5);this.sun.position.set(-16,23,9);this.sun.castShadow=true;Object.assign(this.sun.shadow.camera,{left:-24,right:24,top:24,bottom:-24,near:.5,far:75});this.sun.shadow.mapSize.set(1024,1024);this.sun.shadow.bias=-.0004;this.sun.shadow.normalBias=.035;this.sun.shadow.radius=4;this.scene.add(this.sun);
    this.buildTerrain();this.buildSky();this.buildWater();this.buildParticles();this.buildPlots();
    this.home(true);this.resize();this.bindPicking();
    this.status=document.createElement('div');this.status.className='asset-status';this.status.textContent='树木和小猫正在醒来…';scene.append(this.status);
    this.loadAssets().then(()=>{this.status.remove();this.canvas.dataset.ready='true'}).catch(e=>{console.error(e);this.status.textContent='素材载入失败，请刷新重试';this.canvas.dataset.error=e.message});
  }
  groundHeight(x,z){const d=Math.hypot(x,z);return Math.max(0,d-13)*(.025+Math.sin(x*.15)*.013)+Math.max(0,d-18)*Math.sin(z*.11)*.06;}
  mat(color){return new T.MeshStandardMaterial({color,roughness:.95,metalness:0})}
  mesh(g,m,x=0,y=0,z=0){const o=new T.Mesh(g,m);o.position.set(x,y,z);o.receiveShadow=true;this.scene.add(o);return o}
  buildTerrain(){
    const g=new T.PlaneGeometry(180,180,100,100);g.rotateX(-Math.PI/2);const p=g.attributes.position;const colors=[];
    for(let i=0;i<p.count;i++){let x=p.getX(i),z=p.getZ(i);p.setY(i,this.groundHeight(x,z)-.06);const c=new T.Color('#99b496').lerp(new T.Color('#87a588'),.25+.2*Math.sin(x*.3)*Math.cos(z*.24));c.multiplyScalar(.97+rnd()*.06);colors.push(c.r,c.g,c.b)}g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.computeVertexNormals();
    this.terrain=this.mesh(g,new T.MeshStandardMaterial({vertexColors:true,roughness:1}));
    // A broad walkable lawn framed by distant hills, not an isolated floating disk.
    for(let i=0;i<13;i++){const a=i/13*Math.PI*2,dist=68+rnd()*15;const h=this.mesh(new T.SphereGeometry(1,24,12),this.mat(i%2?'#9fb6a4':'#afc2b1'),Math.sin(a)*dist,-2,Math.cos(a)*dist);h.scale.set(19+rnd()*17,7+rnd()*10,20+rnd()*12)}
    this.path=[];for(let i=0;i<28;i++){let z=14-i*.83,x=5+Math.sin(z*.18)*2;this.path.push([x,z])}
  }
  windMaterial(material,height=1,base=0,amp=.12){
    const m=material.clone();m.roughness=.9;m.metalness=0;
    const patch=shader=>{shader.uniforms.gardenTime=this.wind.time;shader.uniforms.gardenWind=this.wind.strength;shader.vertexShader=`uniform float gardenTime;uniform float gardenWind;\n`+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      vec4 gp=vec4(position,1.);
      #ifdef USE_INSTANCING
      gp=instanceMatrix*gp;
      #endif
      vec3 wp=(modelMatrix*gp).xyz;
      float h=clamp((position.y-(${base.toFixed(4)}))/${Math.max(.01,height).toFixed(4)},0.,1.);
      float gust=.55+.23*sin(gardenTime*.61+wp.x*.13+wp.z*.11)+.22*sin(gardenTime*.29+wp.z*.17);
      float sway=sin(gardenTime*1.18+wp.x*.19+wp.z*.28)*gust;
      transformed.x += gardenWind*${amp.toFixed(4)}*h*h*(sway+.17*sin(gardenTime*3.4+wp.x*3.1));
      transformed.z += gardenWind*${(amp*.35).toFixed(4)}*h*h*sin(gardenTime*.92+wp.z*.7);
    `)};m.onBeforeCompile=patch;m.customProgramCacheKey=()=>`garden-${height}-${base}-${amp}`;m.userData.windPatch=patch;return m;
  }
  async parse(name){const b=Uint8Array.from(atob(window.GARDEN_ASSETS[name]),c=>c.charCodeAt(0));return new GLTFLoader().parseAsync(b.buffer,'')}
  async loadAssets(){
    const names=Object.keys(window.GARDEN_ASSETS);await Promise.all(names.map(async n=>{this.models[n]=await this.parse(n)}));
    const palette={leafsGreen:'#859d75',leafsGreenDark:'#748c69',woodBark:'#8d7d67',grass:'#8eaa78',colorPurple:'#b7a6c6',colorRed:'#c998a6',colorYellow:'#ded0a1',dirt:'#b4af9b',stone:'#adb4a5',wood:'#ad9878'};
    for(const[n,gltf]of Object.entries(this.models)){if(n==='cat')continue;gltf.scene.traverse(o=>{if(!o.isMesh)return;o.castShadow=true;o.receiveShadow=true;o.geometry.computeBoundingBox();const box=o.geometry.boundingBox;const remat=m=>{const m2=this.mat(palette[m.name]||'#adb799');m2.name=m.name;const windable=/leaf|grass|color/i.test(m.name)||/flower|bush|grass/.test(n);return windable?this.windMaterial(m2,box.max.y-box.min.y,box.min.y,n.startsWith('tree')?.045:.065):m2};o.material=Array.isArray(o.material)?o.material.map(remat):remat(o.material);const wm=(Array.isArray(o.material)?o.material:[o.material]).find(m=>m.userData.windPatch);if(wm){o.customDepthMaterial=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking});o.customDepthMaterial.onBeforeCompile=wm.userData.windPatch;o.customDepthMaterial.customProgramCacheKey=wm.customProgramCacheKey}})}
    for(const[n,gltf]of Object.entries(this.models)){if(n==='cat')continue;gltf.scene.traverse(o=>{if(!o.isMesh)return;const g=o.geometry.clone();g.deleteAttribute('normal');o.geometry=mergeVertices(g);o.geometry.computeVertexNormals()})}
    this.staticRoots=[];
    const place=(name,x,z,size,angle=rnd()*6.28)=>{const o=this.models[name].scene.clone(true);const box=new T.Box3().setFromObject(o),h=box.max.y-box.min.y,s=size/h;const wrapper=new T.Group();o.scale.setScalar(s);o.position.y=-box.min.y*s;wrapper.add(o);wrapper.position.set(x,this.groundHeight(x,z),z);wrapper.rotation.y=angle;this.scene.add(wrapper);this.staticRoots.push(wrapper);return wrapper};this.place=place;
    // Grove at the edge of the clearing, allowing a complete orbit and a large lawn.
    for(let i=0;i<42;i++){const a=i/42*Math.PI*2,r=19+rnd()*13;let x=Math.cos(a)*r,z=Math.sin(a)*r;place(i%5===0?'tree_pineTallA':i%2?'tree_oak':'tree_detailed',x,z,4.6+rnd()*5.5)}
    [[-12,-4,5.5],[-10,-13,7.5],[12,-9,6.5],[15,3,7.4],[-15,10,6]].forEach(([x,z,s])=>place('tree_oak',x,z,s));
    this.buildWillow(6,-5);
    for(let i=0;i<30;i++){const a=rnd()*Math.PI*2,r=14+rnd()*6;place('plant_bush',Math.cos(a)*r,Math.sin(a)*r,.65+rnd()*.9)}
    const beds=[[-8,-2],[-6,3],[-1,3],[8,1],[10,-6],[-5,9],[2,11]];
    beds.forEach(([x,z],bi)=>{for(let i=0;i<18;i++){const a=rnd()*6.28,r=Math.sqrt(rnd())*1.65;place(['flower_purpleA','flower_redA','flower_yellowA'][(i+bi)%3],x+Math.cos(a)*r,z+Math.sin(a)*r,.26+rnd()*.44)}});
    for(let i=0;i<130;i++){const x=(rnd()-.5)*33,z=(rnd()-.5)*32;if(this.inPond(x,z)||Math.hypot(x-3,z-5)<2.5)continue;place('grass',x,z,.13+rnd()*.3)}
    for(let i=0;i<13;i++){const a=i/13*6.28;place('rock_largeA',-3+Math.cos(a)*5.8,-3+Math.sin(a)*3.9,.23+rnd()*.25)}
    for(const[x,z]of this.path){const o=place('stone_smallFlatA',x,z,.09,Math.sin(z)*.15);o.scale.x=2.2;o.scale.z=1.5}
    [[-5,-3],[-3,-5],[-1,-2]].forEach(([x,z])=>{const o=place('lily_large',x,z,.24);o.position.y=.1});
    place('stump_round',8,5,.7);
    this.batchScenery();this.makeCat();this.updateGrowth(true);
  }
  batchScenery(){
    this.scene.updateMatrixWorld(true);const buckets=new Map();
    for(const root of this.staticRoots)root.traverse(o=>{if(!o.isMesh)return;const key=o.geometry.uuid+':'+(Array.isArray(o.material)?o.material.map(m=>m.uuid).join():o.material.uuid);if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(o)});
    for(const meshes of buckets.values()){const first=meshes[0],batch=new T.InstancedMesh(first.geometry,first.material,meshes.length);batch.castShadow=true;batch.receiveShadow=true;batch.customDepthMaterial=first.customDepthMaterial;meshes.forEach((m,i)=>{batch.setMatrixAt(i,m.matrixWorld);m.visible=false});batch.instanceMatrix.needsUpdate=true;this.scene.add(batch)}
  }
  buildWillow(x,z){
    const trunk=this.mesh(new T.CylinderGeometry(.24,.43,4.3,9),this.mat('#948671'),x,2.1,z);trunk.rotation.z=-.1;trunk.castShadow=true;
    const group=new T.Group();group.position.set(x,4,z);this.scene.add(group);const leaves=[];const twigs=[];const temp=new T.Object3D();
    for(let i=0;i<52;i++){const angle=i*2.39996,r=.6+Math.sqrt(rnd())*3.6,bx=Math.cos(angle)*r,bz=Math.sin(angle)*r,by=1.3-r*.15;const pts=[];const length=1.5+rnd()*2.8;
      for(let j=0;j<9;j++)pts.push(V(bx*j/8,by*Math.sin(j/8*Math.PI*.5)-Math.pow(j/8,3)*length,bz*j/8));
      const curve=new T.CatmullRomCurve3(pts);const tg=new T.TubeGeometry(curve,12,.018,3,false);twigs.push(tg);
      for(let j=3;j<20;j++){const t=j/20,p=curve.getPoint(t);for(let k=0;k<2;k++){temp.position.copy(p).add(V((k?1:-1)*.11,-.04,0));temp.rotation.set(.5+rnd(),rnd()*3, k?.65:-.65);temp.scale.set(.10,.27,.06);temp.updateMatrix();const geo=new T.SphereGeometry(1,4,3).applyMatrix4(temp.matrix);leaves.push(geo)}}
    }
    const leafGeo=mergeGeometries(leaves);leafGeo.translate(0,3.7,0);const twigGeo=mergeGeometries(twigs);twigGeo.translate(0,3.7,0);group.position.y=.3;
    const m=this.windMaterial(this.mat('#96ae7c'),5,-.2,.28),lm=new T.Mesh(leafGeo,m);lm.castShadow=true;group.add(lm);const tm=new T.Mesh(twigGeo,this.windMaterial(this.mat('#8b9871'),5,-.2,.16));group.add(tm);
    const depth=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking});depth.onBeforeCompile=m.userData.windPatch;depth.customProgramCacheKey=m.customProgramCacheKey;lm.customDepthMaterial=depth;
    leaves.forEach(g=>g.dispose());twigs.forEach(g=>g.dispose());
  }
  inPond(x,z){return ((x+3)/6.2)**2+((z+3)/4.5)**2<1}
  buildWater(){
    const g=new T.CircleGeometry(1,96);g.rotateX(-Math.PI/2);g.scale(5.7,1,3.75);
    this.waterMat=new T.ShaderMaterial({uniforms:{time:{value:0},night:{value:0},rain:{value:0},wind:{value:.3}},vertexShader:`varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying vec3 vP;uniform float time,night,rain,wind;${noiseGLSL}void main(){vec2 p=vP.xz;float wave=sin(p.x*7.+p.y*3.+time*.7)*sin(p.y*6.-time*.43);float shimmer=pow(max(0.,wave),8.);float rings=0.;for(int i=0;i<7;i++){vec2 c=vec2(hash(vec2(float(i),1.)),hash(vec2(float(i),2.)))*8.-4.;float age=fract(time*.35+float(i)*.37);rings+=pow(max(0.,1.-abs(length(p-c)-age*1.7)*28.),2.)*(1.-age)*rain;}vec3 color=mix(vec3(.36,.57,.56),vec3(.12,.25,.29),night);color+=shimmer*(.07+wind*.08)+rings*.16;float refl=fbm(p*1.6+vec2(time*.06,0.));color+=refl*.065;gl_FragColor=vec4(color,1.);}`});
    this.water=this.mesh(g,this.waterMat,-3,.035,-3);
  }
  buildSky(){
    this.skyMat=new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{night:{value:0},time:{value:0},rain:{value:0},light:{value:.4}},vertexShader:`varying vec3 d;void main(){d=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying vec3 d;uniform float night,time,rain,light;${noiseGLSL}void main(){vec3 n=normalize(d);float y=max(0.,n.y);vec3 day=mix(vec3(.79,.86,.81),vec3(.55,.72,.75),pow(y,.5));day=mix(day,vec3(.52,.62,.64),rain*.36);vec3 dark=mix(vec3(.10,.18,.22),vec3(.035,.065,.12),pow(y,.4));vec3 c=mix(day,dark,night);float cloud=fbm(n.xz/max(.16,n.y)*1.5+vec2(time*.007,0.));cloud=smoothstep(.51,.75,cloud)*smoothstep(0.,.17,n.y);c=mix(c,mix(vec3(.95,.95,.87),vec3(.14,.22,.27),night),cloud*.6);gl_FragColor=vec4(c,1.);}`});this.sky=new T.Mesh(new T.SphereGeometry(150,32,16),this.skyMat);this.scene.add(this.sky);
    const rbMat=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,uniforms:{alpha:{value:0}},vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying vec2 vUv;uniform float alpha;void main(){vec2 p=(vUv-.5)*2.;float r=length(p);float q=(r-.76)/.085;float edge=smoothstep(0.,.17,q)*(1.-smoothstep(.82,1.,q));vec3 col=mix(vec3(.63,.66,.85),vec3(.92,.67,.66),q);col=mix(col,vec3(.73,.86,.71),exp(-pow((q-.48)*5.,2.))*.8);float a=edge*.23*alpha*smoothstep(-.05,.32,p.y);gl_FragColor=vec4(col,a);}`});
    this.rainbow=new T.Mesh(new T.PlaneGeometry(43,43),rbMat);this.rainbow.position.set(-18,3,-55);this.scene.add(this.rainbow);
    this.auroraMat=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,uniforms:{time:{value:0},alpha:{value:0}},vertexShader:`varying vec2 vUv;uniform float time;void main(){vUv=uv;vec3 p=position;p.z+=sin(p.x*.1+time*.09)*5.+sin(p.x*.23-time*.06)*2.;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,fragmentShader:`varying vec2 vUv;uniform float time,alpha;${noiseGLSL}void main(){vec2 uv=vUv;float base=.14+.11*sin(uv.x*8.+time*.1)+.045*sin(uv.x*23.-time*.08);float h=uv.y-base;float ray=fbm(vec2(uv.x*95.+time*.14,uv.y*1.7-time*.025));float thin=pow(noise(vec2(uv.x*180.+time*.3,1.)),2.);float curtain=smoothstep(-.035,.035,h)*exp(-max(0.,h)*6.5);float edge=smoothstep(0.,.15,uv.x)*(1.-smoothstep(.85,1.,uv.x));vec3 c=mix(vec3(.20,.75,.54),vec3(.43,.30,.65),smoothstep(.03,.5,h));gl_FragColor=vec4(c,curtain*(ray*.66+thin*.18)*edge*alpha*.7);}`});
    this.aurora=new T.Mesh(new T.PlaneGeometry(115,38,80,8),this.auroraMat);this.aurora.position.set(0,23,-54);this.scene.add(this.aurora);
    const stars=[];for(let i=0;i<500;i++){const a=rnd()*6.28,y=.12+rnd()*.85,r=Math.sqrt(1-y*y);stars.push(Math.cos(a)*r*130,y*130,Math.sin(a)*r*130)}this.stars=this.points(stars,'#dfebe7',.18);this.stars.material.transparent=true;
    this.meteorMat=new T.LineBasicMaterial({color:'#e5ede7',transparent:true,opacity:0});this.meteor=new T.Line(new T.BufferGeometry().setFromPoints([V(),V()]),this.meteorMat);this.scene.add(this.meteor);
  }
  points(arr,color,size){const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(arr,3));const mat=new T.PointsMaterial({color,size,transparent:true,depthWrite:false});mat.onBeforeCompile=s=>{s.fragmentShader=s.fragmentShader.replace('vec4 diffuseColor = vec4( diffuse, opacity );','vec4 diffuseColor = vec4( diffuse, opacity ); diffuseColor.a *= smoothstep(0.5,0.05,length(gl_PointCoord-0.5));')};const p=new T.Points(geo,mat);this.scene.add(p);return p}
  buildParticles(){
    this.flyBase=[];for(let i=0;i<38;i++)this.flyBase.push(V((rnd()-.5)*25,.4+rnd()*2.5,(rnd()-.5)*23));this.flies=this.points(this.flyBase.flatMap(p=>p.toArray()),'#e8edb5',.20);
    this.rainBase=[];const arr=[];for(let i=0;i<650;i++){const p=V((rnd()-.5)*55,rnd()*25,(rnd()-.5)*55);this.rainBase.push(p);arr.push(...p.toArray(),p.x,p.y-.27,p.z)}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(arr,3));this.rainLines=new T.LineSegments(g,new T.LineBasicMaterial({color:'#d9e3dd',transparent:true,opacity:.22,depthWrite:false}));this.scene.add(this.rainLines);
    this.butterflies=[];for(let i=0;i<5;i++){const group=new T.Group();const m=new T.MeshBasicMaterial({color:i%2?'#cbb8d1':'#e0d1a9',side:T.DoubleSide});const wings=[];for(let k=0;k<2;k++){const wing=new T.Mesh(new T.CircleGeometry(.1,7),m);wing.position.x=k?.08:-.08;group.add(wing);wings.push(wing)}this.scene.add(group);this.butterflies.push({group,wings,phase:rnd()*6.28})}
  }
  buildPlots(){this.plots=[];for(let i=0;i<3;i++){const soil=this.mesh(new T.CylinderGeometry(.65,.7,.08,24),this.mat('#9d8e72'),-1+i*1.7,.03,7.7);soil.userData.plot=i;this.plots.push(soil)}}
  updateGrowth(force=false){if(!this.place)return;const records=this.state.records.slice(this.state.mode==='session'?-2:-3);const signature=this.state.mode+':'+records.map(r=>r.id||r.date).join(',');if(force||signature!==this.recordSignature){this.recordSignature=signature;this.grown.forEach(x=>this.scene.remove(x));this.grown=[];for(let i=0;i<3;i++){const r=records[i],name=r?.type==='wind'?'flower_purpleA':r?.type==='water'?'plant_bush':'grass';const plant=this.place(name,-1+i*1.7,7.7,1.0,0);plant.userData.record=r;this.grown.push(plant)}}for(let i=0;i<3;i++){const r=records[i];const s=r?(r.complete?1:.48):i===records.length&&this.state.mode==='session'?.1+this.state.elapsed/this.state.duration*.7:.03;this.grown[i].scale.setScalar(s)}}
  makeCat(){
    const gltf=this.models.cat,model=gltf.scene;model.updateMatrixWorld(true);const box=new T.Box3().setFromObject(model);const h=box.max.y-box.min.y;const scale=1.25/h;
    model.scale.setScalar(scale);model.position.y=-box.min.y*scale;model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.material.roughness=.95;o.material.metalness=0;o.material.envMapIntensity=.2}});
    this.cat=new T.Group();this.cat.add(model);this.cat.position.set(3,0,5);this.scene.add(this.cat);this.catModel=model;
    this.catMixer=new T.AnimationMixer(model);const clip=gltf.animations[0];if(clip){this.catAction=this.catMixer.clipAction(clip);this.catAction.play()}
    this.catPath=new T.CatmullRomCurve3([V(3,0,5),V(6,0,3),V(7,0,-1),V(10,0,-5),V(12,0,0),V(10,0,6),V(6,0,9),V(1,0,10),V(-4,0,7),V(-5,0,5),V(0,0,5)],true,'catmullrom',.3);this.catDistance=0;this.pathLength=this.catPath.getLength();
    this.canvas.dataset.catAnimation=clip?.name||'none';this.canvas.dataset.catSource='kenchoo · CC BY 4.0';
  }
  bindPicking(){let down=null;this.canvas.addEventListener('pointerdown',e=>{down=[e.clientX,e.clientY,performance.now()]});this.canvas.addEventListener('pointerup',e=>{if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>8||performance.now()-down[2]>650)return;const r=this.canvas.getBoundingClientRect(),v=new T.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),ray=new T.Raycaster();ray.setFromCamera(v,this.camera);if(this.cat&&ray.intersectObject(this.cat,true).length){document.getElementById('cat').dispatchEvent(new MouseEvent('click'));return}const hit=ray.intersectObjects(this.plots);if(hit.length){const i=hit[0].object.userData.plot;document.querySelectorAll('#plots > g')[i]?.dispatchEvent(new MouseEvent('click'))}});this.canvas.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','0'].includes(e.key)){e.preventDefault();if(e.key==='0')this.home();else if(e.key==='+'||e.key==='-')this.zoomBy(e.key==='+'?1.15:1/1.15);else{const d=this.camera.position.clone().sub(this.controls.target);if(e.key==='ArrowLeft'||e.key==='ArrowRight')d.applyAxisAngle(V(0,1,0),e.key==='ArrowLeft'?.15:-.15);else d.y+=e.key==='ArrowUp'?1:-1;this.camera.position.copy(this.controls.target).add(d)}}})}
  home(immediate=false){this.follow=false;const skyWeather=['rainbow','aurora','meteor'].includes(this.state.weather);const target=skyWeather?V(0,5,-2):V(0,2.4,-1),pos=skyWeather?V(10,12,30):V(10,14,30);if(immediate){this.camera.position.copy(pos);this.controls.target.copy(target);this.controls.update()}else this.transition={pos,target};}
  focus(){this.follow=true;this.transition=null}
  set(){this.home()}
  zoomBy(f){this.transition=null;this.camera.position.sub(this.controls.target).multiplyScalar(1/f).clampLength(4,62).add(this.controls.target);this.controls.update()}
  resize(){const {width,height}=this.host.getBoundingClientRect();this.renderer.setSize(width,height);this.camera.aspect=width/height;this.camera.updateProjectionMatrix()}
  weatherChanged(){this.weatherAt=this.t}
  update(now){
    const dt=this.last?Math.min(.05,(now-this.last)/1000):0;this.last=now;const motion=this.state.reduced?0:1;this.t+=dt*motion;const t=this.t,night=this.state.night?1:0,rain=this.state.weather==='rain'?1:0,light=this.state.light/100;
    this.wind.time.value=t;this.wind.strength.value=this.state.wind/100*motion;this.skyMat.uniforms.time.value=t;for(const[k,v]of Object.entries({night,rain,light}))this.skyMat.uniforms[k].value=mix(this.skyMat.uniforms[k].value,v,.035);
    const n=this.skyMat.uniforms.night.value;this.hemi.intensity=mix(.9+light*1.25,.95,n);this.hemi.color.set(n>.5?'#a4becd':'#edf3ed');this.sun.intensity=mix((.25+light*3.8)*(rain?.55:1),.65,n);this.sun.color.set(n>.5?'#a7c9e5':'#fff0cc');this.scene.fog.color.copy(new T.Color('#c9dcd8').lerp(new T.Color('#263f4b'),n));this.renderer.toneMappingExposure=mix(.93+light*.25,1.05,n);
    this.waterMat.uniforms.time.value=t;this.waterMat.uniforms.night.value=n;this.waterMat.uniforms.rain.value=rain;this.waterMat.uniforms.wind.value=this.state.wind/100;
    this.rainbow.material.uniforms.alpha.value=mix(this.rainbow.material.uniforms.alpha.value,this.state.weather==='rainbow'?1:0,.04);this.auroraMat.uniforms.time.value=t;this.auroraMat.uniforms.alpha.value=mix(this.auroraMat.uniforms.alpha.value,this.state.weather==='aurora'?1:0,.035);this.stars.material.opacity=n*.7;
    this.rainLines.visible=!!rain;const rp=this.rainLines.geometry.attributes.position;for(let i=0;i<this.rainBase.length;i++){const p=this.rainBase[i],y=25-((t*9+p.y)%25),x=p.x+((t*.9+p.y*.05)*this.state.wind/100)%5;rp.setXYZ(i*2,x,y,p.z);rp.setXYZ(i*2+1,x-.05*this.state.wind/100,y-.38,p.z)}rp.needsUpdate=true;
    const fp=this.flies.geometry.attributes.position;this.flies.material.opacity=n*(this.state.fireflies?.7:0);this.flyBase.forEach((p,i)=>fp.setXYZ(i,p.x+Math.sin(t*.31+i)*.6,p.y+Math.sin(t*.42+i*2)*.35,p.z+Math.cos(t*.22+i)*.7));fp.needsUpdate=true;
    this.butterflies.forEach(({group,wings,phase},i)=>{group.visible=n<.5&&!rain;group.position.set(-5+Math.sin(t*.23+phase)*3,1.1+Math.sin(t*.47+phase)*.5,5+Math.cos(t*.19+phase)*4);wings[0].rotation.y=Math.sin(t*12+phase)*1.1;wings[1].rotation.y=-Math.sin(t*12+phase)*1.1;group.rotation.y=t*.2+phase});
    const mt=(t-(this.weatherAt||0))%10;this.meteor.visible=this.state.weather==='meteor'&&mt<1.4;this.meteorMat.opacity=Math.sin(Math.min(1,mt/1.4)*Math.PI)*.8;if(this.meteor.visible){const p=V(-3-mt*20,20-mt*6,-45),tail=p.clone().add(V(5,1.5,0));const a=this.meteor.geometry.attributes.position;a.setXYZ(0,...p.toArray());a.setXYZ(1,...tail.toArray());a.needsUpdate=true}
    if(this.cat){const rest=(t%34)>26||this.follow;const speed=rest?0:.64;this.catDistance+=dt*speed*motion;const u=(this.catDistance/this.pathLength)%1,p=this.catPath.getPointAt(u),dir=this.catPath.getTangentAt(u);this.cat.position.copy(p);this.cat.position.y=this.groundHeight(p.x,p.z);if(!rest)this.cat.rotation.y=Math.atan2(dir.x,dir.z);if(this.catAction)this.catAction.timeScale=rest?.07:.65;this.catMixer.update(dt*motion);this.canvas.dataset.catPosition=`${p.x.toFixed(2)},${p.z.toFixed(2)}`;
      if(this.follow){const target=this.cat.position.clone().add(V(0,.8,0)),offset=V(3.8,2.2,5.2).applyAxisAngle(V(0,1,0),this.cat.rotation.y),pos=target.clone().add(offset);this.camera.position.lerp(pos,.06);this.controls.target.lerp(target,.07)}
    }
    if(this.transition){this.camera.position.lerp(this.transition.pos,.065);this.controls.target.lerp(this.transition.target,.065);if(this.camera.position.distanceTo(this.transition.pos)<.04)this.transition=null}
    this.controls.target.x=T.MathUtils.clamp(this.controls.target.x,-42,42);this.controls.target.z=T.MathUtils.clamp(this.controls.target.z,-42,42);this.controls.target.y=T.MathUtils.clamp(this.controls.target.y,.5,7);this.controls.update();this.updateGrowth();this.beforeRender?.(dt);this.renderer.render(this.scene,this.camera);
    if(now%1000<35){this.canvas.dataset.drawCalls=this.renderer.info.render.calls;this.canvas.dataset.triangles=this.renderer.info.render.triangles;this.canvas.dataset.sunIntensity=this.sun.intensity.toFixed(2);this.canvas.dataset.weather=this.state.weather;const label=document.getElementById('zoomMeter');if(label)label.textContent=(35/this.camera.position.distanceTo(this.controls.target)).toFixed(1)+'×'}
  }
}
