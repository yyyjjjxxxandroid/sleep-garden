import * as T from './vendor/three/build/three.module.js';
import { grassTuftGeometry } from './garden-botany.js';
import { Reflector } from './vendor/three/examples/jsm/objects/Reflector.js';

// Close-up detail shares the terrain's height field and avoids walking trails.
export function installDetails(w){
  let seed=4837;const rnd=()=>((seed=seed*16807%2147483647)-1)/2147483646;
  const blade=grassTuftGeometry(2);
  const mat=w.windMaterial(new T.MeshStandardMaterial({color:'#ffffff',vertexColors:true,roughness:1,side:T.DoubleSide}),1,0,.06);
  const cap=w.quality==='high'?1000:w.quality==='mid'?650:240;
  const grass=new T.InstancedMesh(blade,mat,cap),d=new T.Object3D();let count=0;
  for(let i=0;i<cap*1.5&&count<cap;i++){
    const x=(rnd()-.5)*55,z=(rnd()-.5)*52;
    if(w.inPond(x,z)||Math.abs(x-w.pathX(z))<.9||w.inStream(x,z))continue;
    const patch=.5+.5*Math.sin(x*.65+Math.cos(z*.5));if(rnd()>.2+patch*.5)continue;
    // Keep the listening lawn open; most tufts belong at the woodland edge.
    if(Math.hypot(x+2,z+2)<11&&rnd()>.18)continue;
    d.position.set(x,w.groundHeight(x,z)+.005,z);d.rotation.set(0,rnd()*6.28,(rnd()-.5)*.18);const h=.065+rnd()*.095;d.scale.set(h*.8,h,h*.8);d.updateMatrix();grass.setMatrixAt(count,d.matrix);grass.setColorAt(count,new T.Color().setRGB(.88+rnd()*.12,.93+rnd()*.07,.84+rnd()*.12));count++;
  }grass.count=count;grass.receiveShadow=false;grass.castShadow=false;grass.frustumCulled=false;grass.userData.skipReflection=true;w.scene.add(grass);

  // Flower beds are authored once in garden-art; a second dense layer used
  // to make the foreground read as uniform rows of plastic stems.

  if(w.quality!=='high'){
    w.canvas.dataset.groundDetail=String(count)+' grass tufts';w.canvas.dataset.pondReflection='shader';
    return {update(){}};
  }

  // Reflect the actual trees and sky, with small two-scale surface distortions.
  const geo=w.water.geometry.clone();geo.rotateX(Math.PI/2);
  const pond=new Reflector(geo,{textureWidth:512,textureHeight:512,multisample:0,clipBias:.003});pond.rotation.x=-Math.PI/2;pond.position.copy(w.water.position);pond.position.y+=.008;
  const u=pond.material.uniforms;u.time={value:0};u.night={value:0};u.wind={value:.35};u.touchClock={value:0};u.touchPoints={value:Array.from({length:3},()=>new T.Vector4(0,0,-100,0))};let touchSlot=0;
  pond.material.vertexShader=`uniform mat4 textureMatrix;varying vec4 vUv;varying vec3 wp;void main(){vUv=textureMatrix*vec4(position,1.);wp=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
  pond.material.fragmentShader=`uniform sampler2D tDiffuse;uniform float time,night,wind,touchClock;uniform vec4 touchPoints[3];varying vec4 vUv;varying vec3 wp;
  vec3 touchWave(vec2 p){vec2 offset=vec2(0.);float light=0.;for(int i=0;i<3;i++){vec4 touch=touchPoints[i];float age=touchClock-touch.z;vec2 d=p-touch.xy;float distance=length(d);float crest=exp(-pow((distance-age*.88)*22.,2.))*exp(-age*.75)*smoothstep(0.,.09,age)*(1.-smoothstep(2.6,3.2,age))*touch.w;offset+=d/max(.01,distance)*crest*.006;light+=crest*.24;}return vec3(offset,light);}
  void main(){vec2 p=wp.xz;vec2 waves=vec2(sin(p.x*3.1+p.y*2.3+time*.7)+sin(p.y*7.-time*.45)*.3,cos(p.y*3.7-p.x+time*.6));vec3 touch=touchWave(p);vec2 uv=vUv.xy/vUv.w+waves*(.0015+wind*.002)+touch.xy;vec3 reflection=texture2D(tDiffuse,uv).rgb;float r=length((p+vec2(2.3,2.5))/vec2(3.8,2.8));float shallow=smoothstep(.55,1.,r);vec3 water=mix(vec3(.20,.43,.42),vec3(.39,.54,.40),shallow);water*=1.-night*.65;float fresnel=pow(1.-max(0.,normalize(cameraPosition-wp).y),2.);vec3 c=mix(water,reflection,.28+fresnel*.34);float ripple=pow(max(0.,sin(p.x*6.+p.y*8.+waves.x*2.-time*.6)),30.);c+=ripple*.022*(1.-night*.6)+touch.z*vec3(.6,.72,.63);gl_FragColor=vec4(c,1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  }`;w.scene.add(pond);
  // Reuse the pond's reflected scene for the adjoining, gently rising stream.
  // World-space projection keeps reflections continuous without another scene render.
  const stream=w.scene.children.find(o=>o.isMesh&&o!==w.water&&o.material===w.waterMat);
  if(stream){
    const sm=pond.material.clone();sm.uniforms.tDiffuse=u.tDiffuse;sm.uniforms.textureMatrix=u.textureMatrix;
    sm.uniforms.time=u.time;sm.uniforms.night=u.night;sm.uniforms.wind=u.wind;sm.uniforms.touchClock=u.touchClock;sm.uniforms.touchPoints=u.touchPoints;
    pond.updateMatrixWorld(true);sm.uniforms.pondInverse={value:pond.matrixWorld.clone().invert()};
    sm.vertexShader=`uniform mat4 textureMatrix,pondInverse;varying vec4 vUv;varying vec3 wp;void main(){vec4 world=modelMatrix*vec4(position,1.);wp=world.xyz;vec4 projected=world;projected.y=${pond.position.y.toFixed(4)};vUv=textureMatrix*pondInverse*projected;gl_Position=projectionMatrix*viewMatrix*world;}`;
    sm.fragmentShader=sm.fragmentShader.replace('float shallow=smoothstep(.55,1.,r);','float shallow=.38;');
    stream.material=sm;stream.renderOrder=2;w.canvas.dataset.streamReflection='shared world-space planar';
  }
  const reflect=pond.onBeforeRender;pond.onBeforeRender=function(...args){
    const hidden=[];w.scene.traverse(o=>{if(o.userData?.skipReflection&&o.visible){o.visible=false;hidden.push(o)}});
    const streamVis=stream?stream.visible:null;if(stream)stream.visible=false;
    try{reflect.apply(this,args)}finally{hidden.forEach(o=>o.visible=true);if(stream)stream.visible=streamVis}
  };
  w.canvas.dataset.groundDetail=String(count)+' grass tufts';w.canvas.dataset.pondReflection='live planar';
  return {pond,touch(point){if(w.state.reduced)return;u.touchPoints.value[touchSlot].set(point.x,point.z,performance.now()/1000,1);touchSlot=(touchSlot+1)%3},update(t,n){u.time.value=t;u.night.value=n;u.wind.value=w.state.wind/100;u.touchClock.value=performance.now()/1000;if(w.state.reduced)u.touchPoints.value.forEach(p=>p.w=0)}};
}
