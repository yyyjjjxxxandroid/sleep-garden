import * as T from './vendor/three/build/three.module.js';

// Original, fully volumetric companion. +Z is forward; joints drive both
// walking and the small response to the kitten without changing world position.
export function createCityPerson(){
  const root=new T.Group();root.name='white-hoodie-companion';
  root.userData.model='original-3d-hoodie-person';
  const rig=new T.Bone();rig.name='person-body';root.add(rig);
  const cloth=new T.MeshPhysicalMaterial({color:'#f1eee1',roughness:.94,sheen:.55,sheenColor:new T.Color('#fff7df')});
  const rib=new T.MeshStandardMaterial({color:'#d7d9ce',roughness:1});
  const skin=new T.MeshStandardMaterial({color:'#edc4a4',roughness:.85});
  const hair=new T.MeshStandardMaterial({color:'#655047',roughness:.92});
  const hairLight=new T.MeshStandardMaterial({color:'#776051',roughness:.94});
  const pants=new T.MeshStandardMaterial({color:'#655f55',roughness:1});
  const shoes=new T.MeshStandardMaterial({color:'#f0eadb',roughness:.88});
  const sole=new T.MeshStandardMaterial({color:'#b4b0a0',roughness:1});
  const ink=new T.MeshStandardMaterial({color:'#423d35',roughness:.75});
  const sphere=new T.SphereGeometry(1,24,18);
  const ball=(parent,material,x,y,z,sx,sy,sz)=>{const mesh=new T.Mesh(sphere,material);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh};
  const capsule=(parent,material,r,length,x,y,z)=>{const mesh=new T.Mesh(new T.CapsuleGeometry(r,length,6,16),material);mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh};
  const torso=ball(rig,cloth,0,1.21,0,.35,.43,.235);torso.name='hoodie-torso';
  const hem=ball(rig,rib,0,.88,0,.335,.075,.235);hem.name='hoodie-ribbed-hem';
  const hood=ball(rig,cloth,0,1.49,-.205,.31,.24,.19);hood.name='hood-down-on-back';
  const hoodLining=ball(rig,rib,0,1.66,-.07,.245,.065,.195);hoodLining.name='hood-opening';
  ball(rig,cloth,0,1.65,-.04,.20,.055,.155);
  const neck=ball(rig,skin,0,1.69,.015,.105,.13,.105);neck.name='neck';
  // The pocket and drawstrings are actual meshes, so the hoodie reads from
  // front, side and back instead of being a textured image facing the camera.
  const pocket=ball(rig,cloth,0,1.06,.217,.22,.105,.045);pocket.name='kangaroo-pocket';
  for(const side of [-1,1]){
    capsule(rig,rib,.012,.22,side*.095,1.43,.23);
    ball(rig,shoes,side*.095,1.30,.23,.018,.026,.018);
  }
  const head=new T.Bone();head.name='person-head';head.position.set(0,1.98,.01);rig.add(head);
  ball(head,skin,0,0,0,.335,.36,.31);
  for(const side of [-1,1])ball(head,skin,side*.326,-.03,.005,.058,.085,.05);
  const cap=ball(head,hair,0,.12,-.045,.355,.30,.32);cap.name='brown-hair';
  ball(head,hair,0,.04,-.19,.34,.29,.18);
  for(let i=0;i<9;i++){
    const x=(i-4)*.072,lock=ball(head,i%3===0?hairLight:hair,x,.195-Math.abs(x)*.29,.215,.10,.14,.085);
    lock.rotation.z=-.30+i*.065;
  }
  for(const side of [-1,1]){
    ball(head,hair,side*.293,.04,.055,.063,.20,.14);
    const eye=ball(head,ink,side*.112,-.035,.298,.024,.036,.012);eye.name=`person-eye-${side}`;
    ball(head,new T.MeshBasicMaterial({color:'#fff8e8'}),side*.112-.006,-.023,.31,.006,.009,.004);
    ball(head,new T.MeshStandardMaterial({color:'#d9a694',roughness:1}),side*.19,-.115,.251,.055,.022,.009);
  }
  ball(head,skin,0,-.082,.308,.036,.045,.036);
  const smile=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3([new T.Vector3(-.042,-.16,.28),new T.Vector3(0,-.172,.291),new T.Vector3(.042,-.16,.28)]),12,.006,5,false),hair);
  head.add(smile);
  const arms=[],legs=[];
  for(const side of [-1,1]){
    const shoulder=new T.Bone();shoulder.name=`person-shoulder-${side}`;shoulder.position.set(side*.35,1.48,0);rig.add(shoulder);
    capsule(shoulder,cloth,.137,.21,side*.055,-.18,0);
    const elbow=new T.Bone();elbow.name=`person-elbow-${side}`;elbow.position.set(side*.06,-.35,0);shoulder.add(elbow);
    capsule(elbow,cloth,.12,.18,0,-.12,0);
    capsule(elbow,rib,.108,.035,0,-.267,0);
    ball(elbow,skin,0,-.335,.018,.085,.108,.073);
    arms.push({shoulder,elbow,side});
    const hip=new T.Bone();hip.name=`person-hip-${side}`;hip.position.set(side*.15,.88,0);rig.add(hip);
    capsule(hip,pants,.135,.20,0,-.18,0);
    const knee=new T.Bone();knee.name=`person-knee-${side}`;knee.position.set(0,-.38,0);hip.add(knee);
    capsule(knee,pants,.112,.20,0,-.17,0);
    ball(knee,sole,0,-.425,.065,.135,.045,.225);
    ball(knee,shoes,0,-.37,.075,.13,.085,.215);
    legs.push({hip,knee,side});
  }
  let blend=0;
  function animate(time,moving,dt=.016,stride=0,responding=false,reduced=false){
    blend=T.MathUtils.damp(blend,moving?1:0,9,dt);
    const phase=stride*5.4,breathe=reduced?0:Math.sin(time*1.7)*.008;
    rig.position.y=breathe+Math.abs(Math.sin(phase))*blend*.027;
    rig.rotation.z=Math.sin(phase)*blend*.018;
    torso.scale.y=.43+breathe*.24;
    for(const {hip,knee,side} of legs){
      const gait=Math.sin(phase+(side>0?Math.PI:0));
      hip.rotation.x=gait*.46*blend;
      knee.rotation.x=Math.max(0,-gait)*.55*blend;
    }
    for(const {shoulder,elbow,side} of arms){
      shoulder.rotation.x=-Math.sin(phase+(side>0?Math.PI:0))*.35*blend+(responding&&side>0?-.28:0);
      shoulder.rotation.z=side*(.07+(reduced?0:Math.sin(time*.8)*.012));
      elbow.rotation.x=-.08-(responding&&side>0?.55:0);
    }
    head.rotation.x=T.MathUtils.damp(head.rotation.x,responding?.25:0,5,dt);
    head.rotation.y=T.MathUtils.damp(head.rotation.y,responding?-.20:(reduced?0:Math.sin(time*.24)*.035),5,dt);
    root.userData.pose=moving?'walking':responding?'watching-kitten':'standing';
  }
  return {root,rig,head,arms,legs,animate};
}
