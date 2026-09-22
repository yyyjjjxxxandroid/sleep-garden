import * as T from './vendor/three/build/three.module.js';
import { Reflector } from './vendor/three/examples/jsm/objects/Reflector.js';

// Close-up detail shares the terrain's height field and avoids walking trails.
export function installDetails(w){
  let seed=4837;const rnd=()=>((seed=seed*16807%2147483647)-1)/2147483646;
  const blade=new T.BufferGeometry();blade.setAttribute('position',new T.Float32BufferAttribute([-.028,0,0,.028,0,0,-.019,.48,.05,.019,.48,.05,0,1,.18],3));blade.setIndex([0,1,2,1,3,2,2,3,4]);blade.computeVertexNormals();
  const mat=w.windMaterial(new T.MeshStandardMaterial({color:'#e1e8c7',roughness:.9,side:T.DoubleSide}),1,0,.16);
  const grass=new T.InstancedMesh(blade,mat,24000),d=new T.Object3D();let count=0;
  for(let i=0;i<32000&&count<24000;i++){
    const x=(rnd()-.5)*55,z=(rnd()-.5)*52;
    if(w.inPond(x,z)||Math.abs(x-w.pathX(z))<.9||Math.abs(x-(-2.5+Math.sin(z*.18)*1.2))<.85&&z< -6)continue;
    const patch=.5+.5*Math.sin(x*.65+Math.cos(z*.5));if(rnd()> .45+patch*.5)continue;
    d.position.set(x,w.groundHeight(x,z)+.005,z);d.rotation.set(0,rnd()*6.28,(rnd()-.5)*.18);const h=.07+rnd()*.15;d.scale.set(.3+rnd()*.45,h,.45);d.updateMatrix();grass.setMatrixAt(count,d.matrix);grass.setColorAt(count,new T.Color().setHSL(.205+rnd()*.035,.24+rnd()*.16,.40+rnd()*.16));count++;
  }grass.count=count;grass.receiveShadow=true;w.scene.add(grass);

  // Curved, rounded petals rather than angular flower cards in the foreground.
  const pg=new T.SphereGeometry(1,10,6),petals=new T.InstancedMesh(pg,new T.MeshStandardMaterial({color:'#fff9e9',roughness:.82,side:T.DoubleSide}),2400);
  const centers=new T.InstancedMesh(new T.SphereGeometry(1,10,6),new T.MeshStandardMaterial({color:'#c8a35a',roughness:.9}),300);
  const stems=new T.InstancedMesh(new T.CylinderGeometry(.011,.016,1,5),new T.MeshStandardMaterial({color:'#5e7951',roughness:1}),300);
  const clusters=[[-7,2],[-6,4],[-8,7],[7,6],[5,10],[14,-10]];let flower=0;
  for(let i=0;i<240;i++){
    const [cx,cz]=clusters[i%clusters.length],a=rnd()*6.28,r=Math.sqrt(rnd())*2,x=cx+Math.cos(a)*r,z=cz+Math.sin(a)*r;
    if(w.inPond(x,z))continue;const ground=w.groundHeight(x,z),h=.25+rnd()*.35,y=ground+h,tilt=(rnd()-.5)*.3;
    d.position.set(x,ground+h*.5,z);d.rotation.set(0,0,tilt);d.scale.set(1,h,1);d.updateMatrix();stems.setMatrixAt(flower,d.matrix);
    const col=new T.Color(['#eee7cf','#d7b7c2','#c5bed3','#e3c799'][i%4]);
    for(let k=0;k<8;k++){const angle=k*Math.PI/4;d.position.set(x+Math.cos(angle)*.078,y,z+Math.sin(angle)*.078);d.rotation.set(0,-angle,tilt);d.scale.set(.083,.016,.033);d.updateMatrix();petals.setMatrixAt(flower*8+k,d.matrix);petals.setColorAt(flower*8+k,col)}
    d.position.set(x,y+.012,z);d.rotation.set(0,0,0);d.scale.set(.045,.024,.045);d.updateMatrix();centers.setMatrixAt(flower,d.matrix);flower++;
  }petals.count=flower*8;centers.count=stems.count=flower;[petals,centers,stems].forEach(m=>{m.receiveShadow=true;w.scene.add(m)});

  // Reflect the actual trees and sky, with small two-scale surface distortions.
  const geo=w.water.geometry.clone();geo.rotateX(Math.PI/2);
  const pond=new Reflector(geo,{textureWidth:512,textureHeight:512,multisample:0,clipBias:.003});pond.rotation.x=-Math.PI/2;pond.position.copy(w.water.position);pond.position.y+=.008;
  const u=pond.material.uniforms;u.time={value:0};u.night={value:0};u.wind={value:.35};
  pond.material.vertexShader=`uniform mat4 textureMatrix;varying vec4 vUv;varying vec3 wp;void main(){vUv=textureMatrix*vec4(position,1.);wp=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
  pond.material.fragmentShader=`uniform sampler2D tDiffuse;uniform float time,night,wind;varying vec4 vUv;varying vec3 wp;void main(){vec2 p=wp.xz;vec2 waves=vec2(sin(p.x*3.1+p.y*2.3+time*.7)+sin(p.y*7.-time*.45)*.3,cos(p.y*3.7-p.x+time*.6));vec2 uv=vUv.xy/vUv.w+waves*(.0015+wind*.002);vec3 reflection=texture2D(tDiffuse,uv).rgb;float r=length((p+vec2(3.5))/vec2(5.5,3.7));float shallow=smoothstep(.55,1.,r);vec3 water=mix(vec3(.13,.29,.25),vec3(.31,.39,.25),shallow);water*=1.-night*.65;float fresnel=pow(1.-max(0.,normalize(cameraPosition-wp).y),2.);vec3 c=mix(water,reflection,.32+fresnel*.38);float ripple=pow(max(0.,sin(p.x*6.+p.y*8.+waves.x*2.-time*.6)),30.);c+=ripple*.022*(1.-night*.6);gl_FragColor=vec4(c,1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  }`;w.scene.add(pond);
  // Reuse the pond's reflected scene for the adjoining, gently rising stream.
  // World-space projection keeps reflections continuous without another scene render.
  const stream=w.scene.children.find(o=>o.isMesh&&o!==w.water&&o.material===w.waterMat);
  if(stream){
    const sm=pond.material.clone();sm.uniforms.tDiffuse=u.tDiffuse;sm.uniforms.textureMatrix=u.textureMatrix;
    sm.uniforms.time=u.time;sm.uniforms.night=u.night;sm.uniforms.wind=u.wind;
    pond.updateMatrixWorld(true);sm.uniforms.pondInverse={value:pond.matrixWorld.clone().invert()};
    sm.vertexShader=`uniform mat4 textureMatrix,pondInverse;varying vec4 vUv;varying vec3 wp;void main(){vec4 world=modelMatrix*vec4(position,1.);wp=world.xyz;vec4 projected=world;projected.y=${pond.position.y.toFixed(4)};vUv=textureMatrix*pondInverse*projected;gl_Position=projectionMatrix*viewMatrix*world;}`;
    sm.fragmentShader=sm.fragmentShader.replace('float shallow=smoothstep(.55,1.,r);','float shallow=.38;');
    stream.material=sm;stream.renderOrder=2;w.canvas.dataset.streamReflection='shared world-space planar';
    const reflect=pond.onBeforeRender;pond.onBeforeRender=function(...args){const visible=stream.visible;stream.visible=false;try{reflect.apply(this,args)}finally{stream.visible=visible}};
  }
  // Broken, partially buried stone shoreline; gaps remain for reeds and flowers.
  for(let i=0;i<48;i++){if(i%7===0)continue;const a=i/48*Math.PI*2,x=-3.5+Math.cos(a)*5.72,z=-3.5+Math.sin(a)*3.94;const rock=w.place(i%2?'Rock_Medium_1':'Rock_Medium_3',x,z,.13+rnd()*.20,rnd()*6,{width:1.2});rock.position.y-=.07}
  w.canvas.dataset.groundDetail=String(count)+' grass blades';w.canvas.dataset.pondReflection='live planar';
  return {update(t,n){u.time.value=t;u.night.value=n;u.wind.value=w.state.wind/100;}};
}
