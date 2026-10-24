import * as T from './vendor/three/build/three.module.js';
import {approach} from './world-environment.js';

// Snow has a separate particle field: no rain streaks, splashes, or new audio.
export function createSnowfall(quality='mid',groundHeight=()=>0){
  const count=quality==='low'?240:quality==='high'?720:460;
  const positions=new Float32Array(count*3),sizes=new Float32Array(count),base=[];
  const hash=n=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x)};
  for(let i=0;i<count;i++){
    const x=(hash(i+1)-.5)*56,z=(hash(i+991)-.5)*56;
    base.push({x,z,y:hash(i+23)*24,speed:.55+hash(i+67)*.6,ground:groundHeight(x,z)});
    positions.set([x,base[i].ground+base[i].y,z],i*3);sizes[i]=.65+hash(i+310)*.65;
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(positions,3));geometry.setAttribute('flakeSize',new T.BufferAttribute(sizes,1));
  const material=new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{opacity:{value:0},night:{value:0}},vertexShader:`attribute float flakeSize;void main(){vec4 p=modelViewMatrix*vec4(position,1.);gl_PointSize=clamp(flakeSize*105./max(1.,-p.z),1.3,6.);gl_Position=projectionMatrix*p;}`,fragmentShader:`uniform float opacity,night;void main(){float a=1.-smoothstep(.12,.5,length(gl_PointCoord-.5));gl_FragColor=vec4(mix(vec3(.97,.99,1.),vec3(.80,.89,1.),night*.45),a*opacity);}`});
  const points=new T.Points(geometry,material);points.name='garden-snowfall';points.visible=false;points.frustumCulled=false;points.userData.base=base;points.userData.groundHeight=groundHeight;
  return points;
}

export function updateSnowfall(points,dt,time,{snow=0,night=0},wind=0,reduced=false,centre){
  const opacity=approach(points.material.uniforms.opacity.value,snow,dt);
  points.material.uniforms.opacity.value=opacity;points.material.uniforms.night.value=night;
  points.visible=opacity>.01;
  if(!points.visible)return;
  // Keep a bounded foreground field around the camera when the user pans or
  // zooms away from the central lawn. Snow must not vanish outside one plot.
  if(centre){
    points.position.set(centre.x,0,centre.z);
    const last=points.userData.groundCentre;
    if(!last||Math.hypot(centre.x-last.x,centre.z-last.z)>2){
      points.userData.base.forEach(p=>{p.ground=points.userData.groundHeight(p.x+centre.x,p.z+centre.z)});
      points.userData.groundCentre={x:centre.x,z:centre.z};
    }
  }
  const positions=points.geometry.attributes.position;
  points.userData.base.forEach((p,i)=>{
    const travel=reduced?0:time;
    positions.setXYZ(i,p.x+Math.sin(travel*.22+i)*.65+Math.sin(travel*.09+i*.7)*wind*1.6,p.ground+24-((travel*p.speed+p.y)%24),p.z+Math.cos(travel*.16+i)*.45);
  });positions.needsUpdate=true;
}
