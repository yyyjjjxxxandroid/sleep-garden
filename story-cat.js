import * as T from './vendor/three/build/three.module.js';
import { mergeGeometries } from './vendor/three/examples/jsm/utils/BufferGeometryUtils.js';

// Original storybook character. All parts are real meshes, so the silhouette
// remains consistent when the camera moves around the animal.
export function createStoryCat(){
  const root=new T.Group(),bodyRig=new T.Group();root.add(bodyRig);
  const velvet=color=>new T.MeshPhysicalMaterial({color,roughness:.97,metalness:0,sheen:1,sheenColor:new T.Color('#fff4df'),sheenRoughness:1,envMapIntensity:.35});
  const fur=velvet('#eadfc9'),white=velvet('#fff1da'),patch=velvet('#b9ada0'),pink=velvet('#dcb4af');
  const ink=new T.MeshStandardMaterial({color:'#3b3530',roughness:.3}),noseMat=velvet('#ba8d88');
  const unitSphere=new T.SphereGeometry(1,32,24);
  function ball(parent,mat,x,y,z,sx,sy,sz){const mesh=new T.Mesh(unitSphere,mat);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh}
  ball(bodyRig,fur,0,.63,-.20,.46,.43,.69);
  ball(bodyRig,white,0,.62,.32,.37,.38,.30);
  const head=new T.Group();head.position.set(0,1.07,.49);bodyRig.add(head);
  ball(head,fur,0,0,0,.58,.49,.48);
  ball(head,white,0,-.12,.12,.51,.31,.41);
  // Soft cheek tufts are merged to avoid adding a draw call per strand.
  const tufts=[];const dummy=new T.Object3D();
  for(let side of [-1,1])for(let i=0;i<11;i++){
    const a=-.8+i*.135;dummy.position.set(side*(.47+.035*Math.cos(i*2)),Math.sin(a)*.27-.045,Math.cos(a)*.14);dummy.rotation.set(.2,0,side*(-.28+i*.055));dummy.scale.set(.16,.067,.12);dummy.updateMatrix();tufts.push(new T.SphereGeometry(1,10,8).applyMatrix4(dummy.matrix));
  }
  for(let i=0;i<7;i++){dummy.position.set((i-3)*.09,.40+Math.sin(i)*.014,-.025);dummy.scale.set(.072,.12,.11);dummy.rotation.set(0,0,(i-3)*-.12);dummy.updateMatrix();tufts.push(new T.SphereGeometry(1,10,8).applyMatrix4(dummy.matrix))}
  const tuftMesh=new T.Mesh(mergeGeometries(tufts),fur);tuftMesh.castShadow=true;head.add(tuftMesh);tufts.forEach(g=>g.dispose());
  function earGeometry(){const s=new T.Shape();s.moveTo(-.19,0);s.quadraticCurveTo(-.12,.27,-.01,.42);s.quadraticCurveTo(.045,.47,.08,.36);s.quadraticCurveTo(.17,.17,.20,0);s.quadraticCurveTo(0,-.05,-.19,0);return new T.ExtrudeGeometry(s,{depth:.11,bevelEnabled:true,bevelSegments:5,steps:1,bevelSize:.055,bevelThickness:.055,curveSegments:14})}
  const ears=[];for(const side of [-1,1]){const g=new T.Group();g.position.set(side*.34,.32,-.035);g.rotation.z=side*-.22;const outer=new T.Mesh(earGeometry(),patch);outer.castShadow=true;g.add(outer);const inner=new T.Mesh(earGeometry(),pink);inner.scale.set(.58,.62,.3);inner.position.set(0,.055,.12);g.add(inner);head.add(g);ears.push(g)}
  const eyes=[];for(const side of [-1,1]){const g=new T.Group();g.position.set(side*.205,.025,.443);ball(g,ink,0,0,0,.061,.079,.035);ball(g,new T.MeshBasicMaterial({color:'#fff6df'}),-.016,.025,.028,.016,.02,.008);head.add(g);eyes.push(g);ball(head,pink,side*.35,-.115,.387,.075,.022,.017)}
  for(const side of [-1,1])ball(head,white,side*.104,-.158,.441,.13,.09,.072);
  const nose=new T.Mesh(new T.SphereGeometry(1,16,12),noseMat);nose.scale.set(.052,.036,.027);nose.position.set(0,-.122,.52);head.add(nose);
  const curve=(points,r,material,parent)=>{const o=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),16,r,5,false),material);parent.add(o);return o};
  curve([[0,-.151,.509],[0,-.19,.512],[-.038,-.205,.503]],.005,noseMat,head);curve([[0,-.19,.512],[.038,-.205,.503]],.005,noseMat,head);
  const whisker=new T.MeshBasicMaterial({color:'#a99684',transparent:true,opacity:.7});
  for(const side of [-1,1])for(let i=0;i<3;i++)curve([[side*.22,-.16+i*.025,.455],[side*.40,-.14+i*.04,.47],[side*.63,-.15+i*.065,.42]],.003,whisker,head);
  const legs=[];for(const side of [-1,1])for(const front of [true,false]){const hip=new T.Group();hip.position.set(side*.29,.48,front?.32:-.56);bodyRig.add(hip);ball(hip,fur,0,-.10,0,.16,.25,.17);const foot=ball(hip,white,0,-.33,.045,.17,.13,.21);legs.push({hip,side,front,foot})}
  const tail=new T.Group();tail.position.set(0,.64,-.75);bodyRig.add(tail);
  const path=new T.CatmullRomCurve3([new T.Vector3(0,0,0),new T.Vector3(.10,.05,-.25),new T.Vector3(.24,.35,-.43),new T.Vector3(.22,.68,-.45),new T.Vector3(.02,.86,-.40)]);
  const tg=new T.TubeGeometry(path,40,.17,12,false);const pos=tg.attributes.position;
  // Taper the last quarter to a rounded tip while retaining a plush silhouette.
  for(let i=0;i<pos.count;i++){const t=Math.floor(i/13)/40,c=path.getPointAt(t),scale=.7+.45*Math.sin(Math.PI*t);const v=new T.Vector3().fromBufferAttribute(pos,i).sub(c).multiplyScalar(scale).add(c);pos.setXYZ(i,v.x,v.y,v.z)}tg.computeVertexNormals();const tm=new T.Mesh(tg,patch);tm.castShadow=true;tail.add(tm);const end=path.getPointAt(1);ball(tail,white,end.x,end.y,end.z,.12,.12,.12);
  root.userData.storybook=true;let lastBlink=0;
  function animate(t,moving,wind=0,petting=false){
    const gait=t*5.1,breath=Math.sin(t*1.4)*.008;
    bodyRig.position.y=(moving?Math.sin(gait*2)*.017:breath);bodyRig.rotation.z=moving?Math.sin(gait)*.018:0;
    for(const l of legs){const phase=(l.front?0:Math.PI)+(l.side>0?Math.PI:0);l.hip.rotation.x=moving?Math.sin(gait+phase)*.38:Math.sin(t*.8)*.012;l.hip.position.y=.48+(moving?Math.max(0,Math.cos(gait+phase))*.055:0)}
    head.rotation.y=Math.sin(t*.43)*.055+(petting?.15:0);head.rotation.z=Math.sin(t*.31)*.025;head.position.y=1.07+breath;
    const blinkPhase=t%5.6;const eyelid=blinkPhase<.20?Math.max(.06,Math.abs(blinkPhase-.10)*10):1;eyes.forEach(e=>e.scale.y=eyelid);
    tail.rotation.y=Math.sin(t*.8)*.20;tail.rotation.z=Math.sin(t*.56)*.09;tail.rotation.x=moving?-.12:Math.sin(t*.4)*.035;
    ears.forEach((e,i)=>{e.rotation.z=(i?1:-1)*-.22+Math.sin(t*(i?1.2:1.07)+i)*(.012+wind*.015)});
  }
  return {root,animate,head};
}
