import * as T from './vendor/three/build/three.module.js';
import { configureSkyBackground } from './world-sky.js';
import { createCityWater } from './city-water.js';
import { createFacadeMaterial } from './city-facade.js';

export const SHENZHEN_FLOOR=.055;
const obstacles=[{x:0,z:-11.5,hx:1.7,hz:1.05},{x:-4.65,z:-7,hx:1.05,hz:.58},{x:4.65,z:-20,hx:1.05,hz:.58},{x:-4.65,z:-33,hx:1.05,hz:.58}];

// The deck is deliberately narrower than the bay so water and wetland remain
// visible from the opening camera; navigation excludes every piece of furniture.
export function shenzhenWalkable(x,z,radius=.32){
  const plaza=x>-6.45+radius&&x<6.45-radius&&z>-3.8+radius&&z<12-radius;
  const boardwalk=x>-6.45+radius&&x<6.45-radius&&z>=-39+radius&&z<=-3.25-radius;
  if(!plaza&&!boardwalk)return false;
  return !obstacles.some(o=>o.r?Math.hypot(x-o.x,z-o.z)<o.r+radius:Math.abs(x-o.x)<o.hx+radius&&Math.abs(z-o.z)<o.hz+radius);
}

export function buildShenzhenScene(){
  const root=new T.Group();root.name='shenzhen-bay-overcast-walk';
  const wood=new T.MeshStandardMaterial({color:'#8b745b',roughness:.86}),woodLight=new T.MeshStandardMaterial({color:'#bca17d',roughness:.9}),steel=new T.MeshStandardMaterial({color:'#76817c',roughness:.58,metalness:.28}),leaf=new T.MeshStandardMaterial({color:'#526d57',roughness:1}),leafLight=new T.MeshStandardMaterial({color:'#7e9272',roughness:1}),bark=new T.MeshStandardMaterial({color:'#655446',roughness:1}),glass=new T.MeshStandardMaterial({color:'#81908c',roughness:.6,metalness:.08}),facade=createFacadeMaterial({glass:'#6f817e',mullion:'#8d9993',warm:'#c5ad7e'}),stone=new T.MeshStandardMaterial({color:'#91968b',roughness:.92});
  const glow=color=>new T.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.72,roughness:.52});
  const walkSurfaces=[],lights=[],boats=[];const mesh=(g,m,x=0,y=0,z=0,parent=root)=>{const o=new T.Mesh(g,m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;parent.add(o);return o};const box=(w,h,d,m,x=0,y=0,z=0,parent=root)=>mesh(new T.BoxGeometry(w,h,d),m,x,y,z,parent);const walk=(o,name)=>{o.name=name;walkSurfaces.push(o);return o};

  // Shenzhen Bay Park continues inland on the east side. The timber surface is
  // a waterside promenade, while only its west edge needs a safety railing.
  const bayPark=new T.Group();bayPark.name='shenzhen-bay-near-bank-park';root.add(bayPark);
  const bankEarth=new T.MeshStandardMaterial({color:'#58665a',roughness:1}),parkGrass=new T.MeshStandardMaterial({color:'#71836b',roughness:1}),runningPath=new T.MeshStandardMaterial({color:'#80908a',roughness:.92});
  box(49,2.25,58,bankEarth,18,-1.27,-13.2,bayPark).name='shenzhen-waterfront-park-foundation';
  box(10.5,.26,51.5,parkGrass,11.8,-.04,-13.2,bayPark).name='shenzhen-waterfront-park-lawn';
  box(4.4,.16,51.5,runningPath,19.3,.01,-13.2,bayPark).name='shenzhen-bay-greenway';
  box(.30,.52,51.5,stone,-6.44,-.08,-13.2,bayPark).name='shenzhen-bay-retaining-edge';
  for(let z=9;z>-38;z-=5.8){box(3.4,.025,.075,new T.MeshStandardMaterial({color:'#d9d6bd',roughness:.8}),19.3,.105,z,bayPark);box(9.6,.07,.28,stone,11.8,.13,z+.9,bayPark);}
  walk(box(12.9,.46,16.1,wood,0,-.17,4),'shenzhen-bay-arrival-deck');
  walk(box(12.9,.48,36.3,wood,0,-.18,-21.3),'shenzhen-bay-continuous-boardwalk');
  const planks=new T.InstancedMesh(new T.BoxGeometry(1,1,1),woodLight,294),d=new T.Object3D();let count=0;
  for(let row=0;row<42;row++)for(let col=0;col<7;col++){d.position.set(-5.48+col*1.82,.075,11.3-row*1.2);d.scale.set(1.69,.065,1.1);d.rotation.y=((row+col)%3-1)*.006;d.updateMatrix();planks.setMatrixAt(count,d.matrix);planks.setColorAt(count,new T.Color('#c3a37c').lerp(new T.Color('#735c49'),((row*7+col*13)%9)/22));count++;}
  planks.count=count;planks.name='shenzhen-bay-timber-planks';planks.receiveShadow=true;root.add(planks);walkSurfaces.push(planks);

  const warm=glow('#f5d39c'),cyan=glow('#b9d5c6'),guide=glow('#c1d9c6'),railDetails=new T.Group();railDetails.name='shenzhen-quanzhou-detail-rail';root.add(railDetails);
  for(const side of [-1]){
    box(.24,.68,51,steel,side*6.42,.15,-13,railDetails);
    const edge=box(.055,.035,50.4,guide,side*6.18,.16,-13,railDetails);edge.castShadow=false;lights.push(edge.material);
    for(let i=0;i<35;i++){
      const z=10.7-i*1.46;
      box(.24,.12,.24,stone,side*6.08,.15,z,railDetails);
      box(.11,.92,.11,steel,side*6.08,.57,z,railDetails);
      const cap=mesh(new T.CylinderGeometry(.13,.10,.12,8),steel,side*6.08,1.08,z,railDetails);cap.rotation.y=Math.PI/8;
      if(i<34){box(.07,.08,1.46,steel,side*6.08,.96,z-.73,railDetails);box(.045,.045,1.46,steel,side*6.08,.57,z-.73,railDetails);}
      if(i%4===0){const lamp=mesh(new T.SphereGeometry(.12,10,8),i%8?warm:cyan,side*6.08,1.24,z,railDetails);lamp.userData.skipWaterReflection=true;lights.push(lamp.material);}
    }
  }
  const fasteners=new T.InstancedMesh(new T.CylinderGeometry(.035,.035,.018,8),steel,84);let fastener=0;
  for(let row=0;row<42;row++)for(const x of [-5.64,5.64]){d.position.set(x,.145,11.3-row*1.2);d.scale.setScalar(1);d.rotation.set(0,0,0);d.updateMatrix();fasteners.setMatrixAt(fastener++,d.matrix);}fasteners.name='shenzhen-deck-fasteners';root.add(fasteners);
  const parkEdge=new T.Group();parkEdge.name='shenzhen-park-side-seating-edge';root.add(parkEdge);box(.28,.30,51,stone,6.42,.02,-13.2,parkEdge);for(let z=8;z>-37;z-=5.2){box(1.7,.44,1.05,stone,7.45,.16,z,parkEdge);box(1.38,.10,.76,woodLight,7.45,.43,z,parkEdge);}
  const drainage=new T.Group();drainage.name='shenzhen-boardwalk-drainage-detail';root.add(drainage);box(.24,.025,50.7,steel,5.96,.13,-13.1,drainage);
  for(let z=10.8;z>-38;z-=.42){const slot=box(.18,.014,.12,new T.MeshStandardMaterial({color:'#34413d',roughness:.9,metalness:.12}),5.96,.151,z,drainage);slot.castShadow=false;}
  const parkMarkers=new T.Group();parkMarkers.name='shenzhen-bay-park-markers';root.add(parkMarkers);
  for(let z=7;z>-37;z-=7.4){box(.12,1.15,.12,steel,7.1,.63,z,parkMarkers);const marker=box(.56,.34,.07,cyan,7.1,1.15,z,parkMarkers);marker.castShadow=false;lights.push(marker.material);for(const x of [8.7,10.1,11.5]){const planter=mesh(new T.CylinderGeometry(.34,.40,.38,10),stone,x,.18,z+.8,parkMarkers);planter.userData.citySolid=true;}}

  function mangrove(x,z,s=1,parent=root){const g=new T.Group();g.name='shenzhen-bay-mangrove';g.position.set(x,0,z);g.scale.setScalar(s);g.userData.citySolid=true;parent.add(g);for(let k=0;k<5;k++){const a=k*Math.PI*.4+.2;const trunk=mesh(new T.CylinderGeometry(.09,.18,2.75,7),bark,Math.cos(a)*.32,1.38,Math.sin(a)*.32,g);trunk.rotation.z=Math.sin(a)*.22;for(const sign of [-1,1]){const rootCurve=new T.CatmullRomCurve3([new T.Vector3(Math.cos(a)*.25,.55,Math.sin(a)*.25),new T.Vector3(Math.cos(a+sign*.45)*.75,.12,Math.sin(a+sign*.45)*.75),new T.Vector3(Math.cos(a+sign*.5)*1.05,-.05,Math.sin(a+sign*.5)*1.05)]);mesh(new T.TubeGeometry(rootCurve,8,.035,5,false),bark,0,0,0,g);}}const leaves=new T.InstancedMesh(new T.IcosahedronGeometry(1,1),leaf,112);for(let i=0;i<112;i++){const a=i*2.39996,r=Math.sqrt((i*19%109)/109)*2.45;d.position.set(Math.cos(a)*r,3.0+(i%7)*.15,Math.sin(a)*r);d.scale.set(.30+(i%4)*.14,.18+(i%3)*.09,.34+(i%5)*.11);d.rotation.set(0,a,0);d.updateMatrix();leaves.setMatrixAt(i,d.matrix);leaves.setColorAt(i,new T.Color('#45634f').lerp(new T.Color('#91a181'),(i%11)/14));}leaves.name='mangrove-layered-canopy';g.add(leaves);return g;}
  // The two entrance trees frame the path; wetland clusters sit beyond the rail
  // and create a Shenzhen-specific middle ground before the skyline.
  mangrove(9.3,4.2,.92);mangrove(13.2,-4.8,.8);mangrove(9.8,-17,.7);mangrove(13.8,-30,.65);
  const wetland=new T.Group();wetland.name='shenzhen-bay-mangrove-wetland';root.add(wetland);
  for(const [x,z,s] of [[-10,3,.72],[10,-1,.64],[-12,-13,.68],[11,-21,.58],[-15,-31,.55],[14,-36,.48]]){mesh(new T.CylinderGeometry(2.4*s,2.8*s,.32,14),new T.MeshStandardMaterial({color:'#667660',roughness:1}),x,-.93,z,wetland);mangrove(x,z,s,wetland);for(let i=0;i<7;i++){const a=i*.9,r=1.5*s;const shoot=mesh(new T.CylinderGeometry(.018,.035,.7+(i%3)*.18,5),leafLight,x+Math.cos(a)*r,-.48,z+Math.sin(a)*r,wetland);shoot.rotation.z=(i%2?1:-1)*.12;}}

  const furniture=new T.Group();furniture.name='shenzhen-bay-waterfront-furniture';root.add(furniture);
  const bench=(x,z,rotation=0)=>{const g=new T.Group();g.name='shenzhen-bay-slat-bench';g.position.set(x,0,z);g.rotation.y=rotation;furniture.add(g);for(let i=0;i<5;i++)box(1.72,.06,.075,woodLight,0,.52,-.15+i*.09,g);for(let i=0;i<3;i++)box(1.72,.06,.06,woodLight,0,.72+i*.13,.24,g);for(const side of [-1,1]){const frame=new T.CatmullRomCurve3([new T.Vector3(side*.65,.08,-.12),new T.Vector3(side*.65,.43,-.04),new T.Vector3(side*.65,.65,.22),new T.Vector3(side*.65,.99,.25)]);mesh(new T.TubeGeometry(frame,12,.035,6,false),steel,0,0,0,g);box(.34,.045,.045,steel,side*.65,.76,.04,g);}};
  bench(-4.65,-7,0);bench(4.65,-20,Math.PI);bench(-4.65,-33,0);

  // A luminous viewing frame supplies a human-scale focal point halfway down the
  // boardwalk, while staying open enough to reveal water and skyline through it.
  const pavilion=new T.Group();pavilion.name='shenzhen-bay-viewing-frame';pavilion.position.set(0,0,-11.5);pavilion.userData.citySolid=true;root.add(pavilion);box(3.45,.18,2.15,steel,0,.10,0,pavilion);for(const x of [-1.38,1.38]){box(.14,2.55,.14,steel,x,1.3,0,pavilion);const lamp=mesh(new T.SphereGeometry(.12,10,8),cyan,x,2.18,0,pavilion);lights.push(lamp.material);}box(3.0,.12,.18,steel,0,2.52,0,pavilion);const frame=mesh(new T.TorusGeometry(1.02,.055,6,28,Math.PI),cyan,0,2.46,.02,pavilion);frame.rotation.y=Math.PI/2;lights.push(frame.material);

  // Keep the coast readable through haze: water, flood wall, promenade,
  // planted belt and road form a clear section before the first building.
  const oppositeShore=new T.Group();oppositeShore.name='shenzhen-bay-distant-shore';root.add(oppositeShore);
  const shoreEarth=new T.MeshStandardMaterial({color:'#59655b',roughness:1}),shoreGreen=new T.MeshStandardMaterial({color:'#718269',roughness:1}),shorePaving=new T.MeshStandardMaterial({color:'#a3a397',roughness:.94}),asphalt=new T.MeshStandardMaterial({color:'#555e5b',roughness:.96});
  box(136,1.9,58,shoreEarth,0,-.94,-105,oppositeShore).name='shenzhen-solid-city-bank';
  box(136,1.42,1.45,stone,0,-.52,-75.8,oppositeShore).name='shenzhen-bay-flood-wall';
  box(132,.20,4.2,shorePaving,0,.04,-78.4,oppositeShore).name='shenzhen-waterfront-promenade';
  box(132,.30,8.8,shoreGreen,0,-.04,-84.8,oppositeShore).name='shenzhen-waterfront-greenbelt';
  box(132,.16,5.6,asphalt,0,.02,-92.0,oppositeShore).name='shenzhen-shoreline-road';
  const roadLine=new T.MeshStandardMaterial({color:'#d7d0aa',roughness:.8});for(const x of [-1,1])box(.08,.014,5.2,roadLine,x*15,.11,-92,oppositeShore);for(let x=-58;x<60;x+=5.4)box(2.7,.014,.08,roadLine,x,.11,-92,oppositeShore);
  const shoreTrees=new T.Group();shoreTrees.name='shenzhen-procedural-shore-trees';oppositeShore.add(shoreTrees);
  for(let i=0;i<38;i++){const x=-60+i*3.2,z=-82.2-(i%3)*.72;box(.10,.75,.10,bark,x,.36,z,shoreTrees);const crown=mesh(new T.IcosahedronGeometry(.38+(i%3)*.09,2),leafLight,x,1.02,z,shoreTrees);crown.scale.set(1,.72,1);crown.castShadow=false;}
  for(let i=0;i<24;i++){const x=-58+i*5.0;box(.08,.82,.08,steel,x,.44,-78.4,oppositeShore);const lamp=mesh(new T.SphereGeometry(.10,8,6),warm,x,.91,-78.4,oppositeShore);lamp.castShadow=false;lights.push(lamp.material);}

  // Ping An Financial Centre remains the anchor, but the skyline now has layered
  // silhouettes, podiums and setbacks rather than a wall of identical boxes.
  const pingan=new T.Group();pingan.name='pingan-finance-centre-landmark';pingan.position.set(5,.16,-99);pingan.scale.y=.72;root.add(pingan);box(7.2,.42,6.8,stone,0,.05,0,pingan).name='pingan-landed-podium';for(const [y,h,r1,r2] of [[12,24,2.15,1.45],[31,16,1.45,.85],[45,13,.85,.34]])mesh(new T.CylinderGeometry(r2,r1,h,4),glass,0,y,0,pingan).rotation.y=Math.PI/4;mesh(new T.CylinderGeometry(.08,.16,18,8),steel,0,60,0,pingan);mesh(new T.ConeGeometry(.07,8,8),cyan,0,73,0,pingan);for(let i=0;i<23;i++){const y=2+i*2.45,band=mesh(new T.BoxGeometry(2*Math.max(.22,1-i/30),.075,2*Math.max(.22,1-i/30)),i%4?cyan:warm,0,y,0,pingan);band.rotation.y=Math.PI/4;lights.push(band.material);}
  const skyline=new T.Group();skyline.name='shenzhen-bay-lit-skyline';root.add(skyline);
  for(let i=0;i<37;i++){const x=-58+i*3.25,z=-98-(i%4)*2.1,h=4+(i*17%11),w=1.25+(i%4)*.48;if(Math.abs(x-5)<7)continue;const g=new T.Group();g.name='shenzhen-landed-building';g.position.set(x,.16,z);skyline.add(g);if(i%5===0){for(let tier=0;tier<3;tier++)box(w*(1-tier*.16),h/3-.08,w*.75,facade,0,h/6+tier*h/3,0,g);}else if(i%7===0){const body=mesh(new T.CylinderGeometry(w*.34,w*.52,h,8),facade,0,h/2,0,g);body.rotation.y=Math.PI/8;}else box(w,h,w*.72,facade,0,h/2,0,g);box(w*1.55,.36,w*1.35,stone,0,.02,0,g);for(const side of [-1,1])box(.055,h*.90,.07,steel,side*w*.43,h*.48,w*.37+.04,g);if(i%4===0){box(w*.76,.22,w*.52,steel,0,h+.11,0,g);mesh(new T.CylinderGeometry(.025,.04,.85,6),steel,0,h+.55,0,g);}for(let f=0;f<Math.floor(h/1.65);f++){const window=box(w*.52,.055,.028,(f+i)%4?cyan:warm,0,.65+f*1.48,w*.37+.02,g);window.castShadow=false;lights.push(window.material);}}

  const ferry=new T.Group();ferry.name='shenzhen-bay-electric-ferry';ferry.position.set(-15,-1.03,-31);ferry.userData.cityAnimated=true;root.add(ferry);box(2.2,.20,5.9,new T.MeshStandardMaterial({color:'#e7e7dc',roughness:.45,metalness:.12}),0,0,0,ferry);box(1.45,.72,3,glass,0,.46,-.1,ferry);for(let i=0;i<10;i++){const window=box(.18,.17,.02,warm,-.94+(i%2)*1.88,.49,-1.05+Math.floor(i/2)*.43,ferry);lights.push(window.material);}boats.push(ferry);

  const water=createCityWater();water.name='shenzhen-bay-water-with-reflections';water.material.uniforms.color.value.set('#55766c');root.add(water);
  const reflections=new T.Group();reflections.name='shenzhen-bay-broken-light-reflections';root.add(reflections);for(let i=0;i<96;i++){const side=i%2?-1:1,x=side*(7.1+(i*11%18)*.62),z=8-(i*13%74),length=.22+(i%8)*.13,material=glow(i%5===0?'#e8c895':'#b9d1bf');material.transparent=true;material.opacity=.07+(i%4)*.018;const line=box(.035+(i%3)*.018,.009,length,material,x,-1.155,z,reflections);line.userData.skipWaterReflection=true;lights.push(material);}

  const skyMat=new T.ShaderMaterial({side:T.BackSide,depthWrite:false,depthTest:false,uniforms:{time:{value:0}},vertexShader:'varying vec3 d;void main(){d=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec3 d;uniform float time;float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}void main(){vec3 direction=normalize(d);float h=clamp(direction.y,0.,1.);vec3 c=mix(vec3(.67,.70,.64),vec3(.35,.42,.41),pow(h,.62));float opening=pow(max(0.,dot(direction,normalize(vec3(-.72,.22,.3)))),10.);c+=vec3(.11,.085,.045)*opening;float cloud=noise(direction.xz/max(.16,direction.y+.28)*2.2+time*.0005);c=mix(c,vec3(.76,.76,.69),smoothstep(.44,.79,cloud)*.42);gl_FragColor=vec4(c,1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'});const sky=new T.Mesh(new T.SphereGeometry(100,32,16),skyMat);configureSkyBackground(sky);root.add(sky);
  return {root,walkSurfaces,water,update(time){water.material.uniforms.time.value=time;skyMat.uniforms.time.value=time;lights.forEach((m,i)=>m.emissiveIntensity=.48+.10*Math.sin(time*.72+i*.51));boats.forEach((boat,i)=>{boat.position.y=-1.03+Math.sin(time*.62+i)*.035;boat.position.x+=Math.sin(time*.11+i)*.0015;boat.rotation.z=Math.sin(time*.39+i)*.01;});}};
}
