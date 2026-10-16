import * as T from './vendor/three/build/three.module.js';
import { mergeGeometries } from './vendor/three/examples/jsm/utils/BufferGeometryUtils.js';
import { installCatCoat } from './story-cat-coat.js';

// Reference-led plush kitten, driven by continuous articulated poses. Touch
// remains independent of the audio/session clock and camera navigation.
export function createStoryCat({random=Math.random,clock=()=>performance.now()/1000}={}){
  const root=new T.Group(),bodyRig=new T.Bone();root.add(bodyRig);bodyRig.name='companion-body';
  const velvet=color=>new T.MeshPhysicalMaterial({color,roughness:.97,metalness:0,sheen:1,sheenColor:new T.Color('#fff4df'),sheenRoughness:1,envMapIntensity:.35});
  const fur=velvet('#fff4e6'),white=velvet('#fff7ee'),patch=velvet('#f9efdf'),pink=velvet('#e9b5af');
  const ink=new T.MeshStandardMaterial({color:'#3b3530',roughness:.3}),noseMat=velvet('#ba8d88');
  const unitSphere=new T.SphereGeometry(1,32,24);
  function ball(parent,mat,x,y,z,sx,sy,sz){const mesh=new T.Mesh(unitSphere,mat);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh}
  const torso=ball(bodyRig,fur,0,.63,-.20,.46,.43,.69);torso.name='companion-torso';
  const chest=ball(bodyRig,white,0,.62,.32,.37,.38,.30);chest.name='companion-chest';
  chest.geometry=unitSphere.clone();
  {const p=chest.geometry.attributes.position;for(let i=0;i<p.count;i++){const y=p.getY(i),upper=T.MathUtils.smoothstep(y,0,1);p.setY(i,y+upper*.23);p.setZ(i,p.getZ(i)+upper*.12)}chest.geometry.computeVertexNormals()}
  const head=new T.Bone();head.name='companion-head';head.position.set(0,1.07,.49);bodyRig.add(head);
  const face=ball(head,fur,0,0,0,.58,.51,.48);face.name='kitten-round-face';
  // One continuous cheek volume keeps the round silhouette, without stacked
  // white muzzle spheres or the previous large clay-like cheek tufts.
  face.geometry=new T.SphereGeometry(1,64,48);
  const fp=face.geometry.attributes.position;
  for(let i=0;i<fp.count;i++){
    const x=fp.getX(i),y=fp.getY(i),z=fp.getZ(i);
    fp.setX(i,x*(1+.075*Math.exp(-(((y+.27)/.42)**2))));
    if(z>0){const muzzle=.08*Math.exp(-(x*x/.15+(y+.31)*(y+.31)/.055));fp.setZ(i,z*(1-.035*Math.max(0,-y))+muzzle)}
  }
  face.geometry.computeVertexNormals();
  // Soft cheek tufts are merged to avoid adding a draw call per strand.
  const tufts=[];const dummy=new T.Object3D();
  for(let side of [-1,1])for(let i=0;i<11;i++){
    const a=-.8+i*.135;dummy.position.set(side*(.47+.035*Math.cos(i*2)),Math.sin(a)*.27-.045,Math.cos(a)*.14);dummy.rotation.set(.2,0,side*(-.28+i*.055));dummy.scale.set(.16,.067,.12);dummy.updateMatrix();tufts.push(new T.SphereGeometry(1,10,8).applyMatrix4(dummy.matrix));
  }
  for(let i=0;i<7;i++){dummy.position.set((i-3)*.09,.40+Math.sin(i)*.014,-.025);dummy.scale.set(.072,.12,.11);dummy.rotation.set(0,0,(i-3)*-.12);dummy.updateMatrix();tufts.push(new T.SphereGeometry(1,10,8).applyMatrix4(dummy.matrix))}
  const tuftMesh=new T.Mesh(mergeGeometries(tufts),fur);tuftMesh.visible=false;head.add(tuftMesh);tufts.forEach(g=>g.dispose());
  function earGeometry(){const s=new T.Shape();s.moveTo(-.19,0);s.quadraticCurveTo(-.12,.27,-.01,.42);s.quadraticCurveTo(.045,.47,.08,.36);s.quadraticCurveTo(.17,.17,.20,0);s.quadraticCurveTo(0,-.05,-.19,0);const g=new T.ExtrudeGeometry(s,{depth:.035,bevelEnabled:true,bevelSegments:5,steps:1,bevelSize:.025,bevelThickness:.018,curveSegments:14});const p=g.attributes.position;for(let i=0;i<p.count;i++){const h=T.MathUtils.clamp(p.getY(i)/.45,0,1);p.setZ(i,(p.getZ(i)-.0175)*(1-.8*h)-.065*h*h)}g.computeVertexNormals();return g}
  const ears=[];for(const side of [-1,1]){const g=new T.Bone();g.name=`ear-${side}`;g.position.set(side*.34,.32,-.035);g.rotation.z=side*-.22;const outer=new T.Mesh(earGeometry(),patch);outer.name=`kitten-ear-coat-${side}`;outer.castShadow=true;g.add(outer);const inner=new T.Mesh(earGeometry(),pink);inner.scale.set(.58,.62,.3);inner.position.set(0,.055,.12);g.add(inner);head.add(g);ears.push(g)}
  ears.forEach(ear=>{ear.scale.y=.82;const inner=ear.children[1];inner.position.z=.024;inner.scale.z=.22});
  const eyes=[],cheeks=[];for(const side of [-1,1]){
    const g=new T.Group();g.name=`eye-${side}`;g.position.set(side*.205,.025,.443);
    const pupilInk=new T.MeshPhysicalMaterial({color:'#3c302a',roughness:.27,clearcoat:.55,clearcoatRoughness:.16,envMapIntensity:.45,transparent:true,depthWrite:false});
    ball(g,pupilInk,0,.012,.029,.111,.132,.062);
    ball(g,new T.MeshBasicMaterial({color:'#fff8e9',transparent:true,opacity:.85,depthWrite:false}),-.037,.060,.088,.020,.026,.006);
    const rim=new T.MeshStandardMaterial({color:'#bf9e8b',roughness:.6,transparent:true,depthWrite:false});
    ball(g,rim,0,-.002,-.009,.158,.181,.055);
    const iris=new T.MeshPhysicalMaterial({color:'#88705b',roughness:.42,clearcoat:.25,transparent:true,depthWrite:false});
    ball(g,iris,0,-.01,.003,.148,.171,.060);
    ball(g,new T.MeshBasicMaterial({color:'#dce7ed',transparent:true,depthWrite:false}),.048,-.067,.078,.007,.010,.004);
    // Match the walking sprite's face proportions, not the large close-up
    // portrait eyes. Bake the smaller shape into the geometry transforms so
    // the existing eye-opening animation retains its normalized 0..1 range.
    for(const part of g.children){part.scale.multiply(new T.Vector3(.75,.75,.72));part.position.multiply(new T.Vector3(.75,.75,.72));part.castShadow=false}
    // Fit the thin eye layers to the curved face instead of projecting a
    // stack of spherical buttons beyond the side silhouette.
    for(const part of g.children){
      part.geometry=part.geometry.clone();const p=part.geometry.attributes.position;
      for(let i=0;i<p.count;i++){
        const x=p.getX(i)*part.scale.x+part.position.x,y=p.getY(i)*part.scale.y+part.position.y;
        const faceZ=.48*Math.sqrt(Math.max(.01,1-((side*.205+x)/.58)**2-((.025+y)/.51)**2));
        const z=faceZ-.443+.008+(p.getZ(i)*part.scale.z+part.position.z)*.30;
        p.setZ(i,(z-part.position.z)/part.scale.z);
      }part.geometry.computeVertexNormals();
    }
    g.userData.referenceScale=.75;
    head.add(g);eyes.push(g);
    const blush=new T.MeshStandardMaterial({color:'#eac0b6',roughness:1,transparent:true,opacity:.38,depthWrite:false});
    const cheek=ball(head,blush,side*.35,-.115,.387,.075,.022,.017);cheek.name=`cheek-${side}`;cheeks.push(cheek);
  }
  const nose=new T.Mesh(new T.SphereGeometry(1,16,12),noseMat);nose.scale.set(.046,.032,.023);nose.position.set(0,-.122,.55);head.add(nose);
  const curve=(points,r,material,parent)=>{const o=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),16,r,5,false),material);parent.add(o);return o};
  curve([[0,-.151,.544],[0,-.19,.536],[-.038,-.205,.523]],.004,noseMat,head);curve([[0,-.19,.536],[.038,-.205,.523]],.004,noseMat,head);
  const whisker=new T.MeshBasicMaterial({color:'#a99684',transparent:true,opacity:.7});
  for(const side of [-1,1])for(let i=0;i<3;i++)curve([[side*.22,-.16+i*.025,.455],[side*.40,-.14+i*.04,.47],[side*.63,-.15+i*.065,.42]],.003,whisker,head);
  const legs=[];for(const side of [-1,1])for(const front of [true,false]){const hip=new T.Bone();hip.name=`hip-${front?'front':'back'}-${side}`;hip.position.set(side*.29,.48,front?.32:-.56);bodyRig.add(hip);const upper=ball(hip,fur,0,-.10,0,.16,.25,.17);upper.name=`upper-${front?'front':'back'}-${side}`;const foot=ball(hip,white,0,-.33,.045,.17,.13,.21);foot.name=`paw-${front?'front':'back'}-${side}`;legs.push({hip,side,front,foot,upper})}
  const tail=new T.Bone();tail.name='companion-tail';tail.position.set(0,.64,-.75);bodyRig.add(tail);
  const path=new T.CatmullRomCurve3([new T.Vector3(0,0,0),new T.Vector3(.10,.05,-.25),new T.Vector3(.24,.35,-.43),new T.Vector3(.22,.68,-.45),new T.Vector3(.02,.86,-.40)]);
  const segments=40,sides=12,ringSize=sides+1,ringVertices=(segments+1)*ringSize;
  const tg=new T.BufferGeometry(),pos=new T.Float32BufferAttribute(new Float32Array((ringVertices+2)*3),3),indices=[];
  tg.setAttribute('position',pos);tg.userData.tailSegments=segments;tg.userData.tailSides=sides;
  for(let row=1;row<=segments;row++)for(let j=1;j<=sides;j++){
    const a=(row-1)*ringSize+j-1,b=row*ringSize+j-1,c=b+1,d=a+1;indices.push(a,b,d,b,c,d);
  }
  // Both ends are sealed, including the root hidden inside the rump.
  for(let j=0;j<sides;j++)indices.push(ringVertices,j,j+1,ringVertices+1,segments*ringSize+j+1,segments*ringSize+j);
  tg.setIndex(indices);const tm=new T.Mesh(tg,patch);tm.name='companion-tail-surface';tm.castShadow=true;tail.add(tm);
  const tailTip=ball(tail,white,0,0,0,.12,.12,.12);tailTip.name='companion-tail-tip';
  const samples=Array.from({length:segments+1},(_,i)=>({standing:path.getPointAt(i/segments),centre:new T.Vector3(),tangent:new T.Vector3()}));
  const normal=new T.Vector3(),binormal=new T.Vector3(),transport=new T.Quaternion(),socket=new T.Vector3();
  function shapeTail(){
    // Keep the original standing curve and thickness; sealed ends and a
    // transported frame prevent holes and inverted rings during body motion.
    for(const s of samples)s.centre.copy(s.standing);
    samples.forEach((s,i)=>s.tangent.subVectors(samples[Math.min(segments,i+1)].centre,samples[Math.max(0,i-1)].centre).normalize());
    normal.set(0,1,0).addScaledVector(samples[0].tangent,-samples[0].tangent.y).normalize();
    for(let i=0;i<=segments;i++){
      const s=samples[i];if(i){transport.setFromUnitVectors(samples[i-1].tangent,s.tangent);normal.applyQuaternion(transport)}
      normal.addScaledVector(s.tangent,-normal.dot(s.tangent)).normalize();binormal.crossVectors(s.tangent,normal).normalize();
      const radius=.17*(.7+.45*Math.sin(Math.PI*i/segments));
      for(let j=0;j<=sides;j++){
        const angle=j/sides*Math.PI*2,n=-Math.cos(angle)*radius,b=Math.sin(angle)*radius;
        pos.setXYZ(i*ringSize+j,s.centre.x+n*normal.x+b*binormal.x,s.centre.y+n*normal.y+b*binormal.y,s.centre.z+n*normal.z+b*binormal.z);
      }
    }
    const start=samples[0].centre,end=samples[segments].centre;pos.setXYZ(ringVertices,start.x,start.y,start.z);pos.setXYZ(ringVertices+1,end.x,end.y,end.z);
    pos.needsUpdate=true;tg.computeVertexNormals();tg.computeBoundingSphere();tailTip.position.copy(samples[segments].centre);
  }
  shapeTail();
  const sleepEyes=[];
  for(const side of [-1,1]){
    const lidInk=ink.clone();lidInk.transparent=true;lidInk.depthWrite=false;
    const e=curve([[side*.205-.104,.014,.478],[side*.205,-.019,.501],[side*.205+.104,.014,.478]],.007,lidInk,head);
    e.name=`eyelid-${side}`;e.visible=false;
    // Deform these existing small tubes, rather than allocating eye geometry
    // every frame. Content arches upward; sleepy eyes retain a soft low arc.
    e.userData.restVertices=e.geometry.attributes.position.array.slice();sleepEyes.push(e);
  }
  const mouth=ball(head,ink,0,-.225,.515,.033,.007,.008);mouth.visible=false;
  const tongue=ball(head,pink,0,-.238,.528,.025,.027,.010);tongue.name='tongue';tongue.visible=false;tongue.raycast=()=>{};
  // Two small, short-lived blossoms acknowledge a chin scratch in the scene.
  // The sustained response is the pose; the blossoms never loop while held.
  const reaction=new T.Group();root.add(reaction);reaction.visible=false;
  const flower=new T.Shape();
  for(let i=0;i<=60;i++){const a=i/60*Math.PI*2,r=.090+.023*Math.cos(a*5),x=Math.cos(a)*r,y=Math.sin(a)*r;i?flower.lineTo(x,y):flower.moveTo(x,y)}
  const flowerGeo=new T.ShapeGeometry(flower),flowerMat=new T.MeshBasicMaterial({color:'#efc178',toneMapped:false,transparent:true,opacity:0,depthWrite:false,side:T.DoubleSide});
  for(const side of [-1,1]){const f=new T.Mesh(flowerGeo,flowerMat);f.position.set(side*.78,1.62,.70);f.raycast=()=>{};reaction.add(f)}
  head.traverse(o=>o.userData.petZone='head');bodyRig.traverse(o=>o.userData.petZone??='back');
  const coat=installCatCoat(root,[{mesh:face,count:10500,length:.075,groom:'face'},{mesh:torso,count:6200,length:.065},
    {mesh:chest,count:2400,length:.045},...ears.map(e=>({mesh:e.children[0],count:750,length:.032,groom:'ear'})),
    ...legs.map(l=>({mesh:l.upper,count:3900,length:.024,paw:l.foot,groom:'leg'})),
    {mesh:tm,count:3200,length:.065,groom:'tail'},{mesh:tailTip,count:450,length:.046,groom:'tail'}]);
  root.userData.storybook=true;
  const responses={
    head:[['nuzzle','它眯起眼，额头轻轻靠向你的手'],['tilt','它歪过脑袋，一只眼睛懒懒地眯着'],['bow','它低下头，让你顺着额头摸一摸']],
    chin:[['lift','它仰起下巴，安静地靠着你的手'],['cheek','它抬起下巴，偏过脸颊蹭了蹭'],['bliss','它仰起头，耳朵和尾巴都放松下来']],
    back:[['stretch','它向前伸伸爪子，舒服地舒展开'],['arch','它轻轻拱起背，顺着你的手放松'],['tail','它回头看看你，尾巴慢慢卷起来']]
  };
  const bags=new Map(),lastChoices=new Map();
  function draw(key,count,first){
    let bag=bags.get(key);
    if(!bag?.length){
      bag=Array.from({length:count},(_,i)=>i);
      for(let i=bag.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[bag[i],bag[j]]=[bag[j],bag[i]]}
      if(first!==undefined){const i=bag.indexOf(first);[bag[0],bag[i]]=[bag[i],bag[0]]}
      else if(bag[0]===lastChoices.get(key))[bag[0],bag[1]]=[bag[1],bag[0]];
      bags.set(key,bag);
    }
    const choice=bag.shift();lastChoices.set(key,choice);return choice;
  }
  let context={night:false,listening:false,wind:0},nightSince=null,wakingFromNight=false,listeningSince=null,listeningSettled=false,noticeAt=-100,noticeKind='',noticeX=0,noticeY=0;
  let petAt=-100,petCount=0,lastPetAt=-100,zone='head',held=false,response=0,chinBlend=0,chinAt=-100,walkBlend=0;
  let actionAt=-100,releasedAt=-100,releasedResponse=0,earResponse=0,tailResponse=0,groomPaw=0,groomLick=0,lastLookAt=-100;
  let approachBlend=0,cheekBlend=0,pressBlend=0;
  let faceComfort=0,faceDrowsy=0,faceAlert=0;const eyeOpenness=[1,1];
  let companionAt=null,restSit=0,restLie=0,restBaseSit=0,restBaseLie=0;
  let touchSide=0,backAnchorY=0,backLowY=0,backTriggered=false,backStrokeAt=-100,bodyStroke=0,tailStroke=0;
  let flavor=-1,side=1,poseSide=1,firstIdle=true,idleKind='',idleStart=0,idleDuration=0,nextIdle=null,restUntil=0,motionReduced=false;
  const idleNames=['yawn','stretch','groom','observe','doze'],idleWeights=Object.fromEntries(idleNames.map(n=>[n,0]));
  const responseWeights=Object.fromEntries(Object.values(responses).flat().map(([name])=>[name,0]));
  const contact=new T.Vector2(),hand=new T.Vector2(),gaze=new T.Vector2(),eyeGaze=new T.Vector2(),lookTarget=new T.Vector2(),attention=new T.Vector2();
  const washingPaw=new T.Vector3(0,-.33,.10);
  const ease=(age,start,end)=>T.MathUtils.smoothstep(age,start,end);
  const envelope=(age,start,rise,fall,end)=>ease(age,start,rise)*(1-ease(age,fall,end));
  function choose(where){
    flavor=draw(where,3);side=random()<.5?-1:1;
    root.userData.reactionName=responses[where][flavor][0];root.userData.reactionLabel=responses[where][flavor][1];
  }
  function pet(where='head'){
    if(!responses[where])where='head';
    const now=clock();if(now-lastPetAt<.45)return false;
    lastPetAt=petAt=actionAt=now;releasedAt=-100;touchSide=0;backTriggered=false;backStrokeAt=-100;if(where==='chin')chinAt=now;zone=where;choose(where);idleKind='';contact.set(0,0);companionAt=now+1.2;restBaseSit=restSit;restBaseLie=restLie;root.userData.petCount=++petCount;root.userData.petZone=where;return true;
  }
  function touch(where,point,acknowledge=true){
    if(!responses[where])where='head';
    const continuing=held&&where===zone,x=T.MathUtils.clamp(point.x,-1,1),y=T.MathUtils.clamp(point.y,-1,1);
    // The hand owns direction. Keep a small central deadzone so gentle jitter
    // cannot swap sides; randomized expressions never turn away from the hand.
    if(Math.abs(x)>.16)touchSide=Math.sign(x);
    if(where==='back'){
      if(!continuing){backAnchorY=backLowY=y;backTriggered=false}
      else{
        if(y-backLowY>.10){backAnchorY=backLowY=y;backTriggered=false}
        else backLowY=Math.min(backLowY,y);
        if(backAnchorY-y>.14&&!backTriggered){backStrokeAt=clock();backTriggered=true;root.userData.backStrokeCount=(root.userData.backStrokeCount||0)+1}
      }
    }
    if(acknowledge&&where==='chin'&&(!held||zone!=='chin'))chinAt=clock();
    if(where!==zone||flavor<0){actionAt=clock();choose(where)}
    held=true;idleKind='';root.userData.contact=true;zone=where;contact.set(x,y);root.userData.petZone=where;
  }
  function release(){
    if(held){releasedAt=clock();releasedResponse=response;petAt=releasedAt-1.2;companionAt=releasedAt;restBaseSit=restSit;restBaseLie=restLie}
    held=false;root.userData.contact=false;
  }
  function look(x,y){
    const axis=v=>Math.sign(v)*Math.max(0,(Math.min(1,Math.abs(v))-.10)/.90);
    lookTarget.set(axis(x),axis(y));lastLookAt=clock();
  }
  function setContext(next={}){
    const now=clock();
    if(next.night&&!context.night){nightSince=now;wakingFromNight=false}
    if(!next.night&&context.night){nightSince=null;wakingFromNight=true;if(companionAt!==null&&restLie>.1)companionAt=now-27.5}
    if(next.listening&&!context.listening){listeningSince=now;listeningSettled=false}
    if(!next.listening){listeningSince=null;listeningSettled=false}
    context={night:!!next.night,listening:!!next.listening,wind:T.MathUtils.clamp(next.wind||0,0,1)};
  }
  function notice(kind,point={x:0,y:0}){
    if(held||restLie>.65||motionReduced||clock()-noticeAt<4||context.night||idleKind==='groom'||idleKind==='stretch')return false;
    idleKind='';nextIdle=null;
    noticeAt=clock();noticeKind=kind;noticeX=T.MathUtils.clamp(point.x,-1,1);noticeY=T.MathUtils.clamp(point.y,-1,1);root.userData.environmentReaction=kind;return true;
  }
  // Locomotion yields when an action is due and until its recovery finishes.
  // Walking must not reset the schedule or cut off a raised paw mid-action.
  function wantsRest(t){return !motionReduced&&(context.night||clock()-noticeAt<3.6||response>.15||clock()-backStrokeAt<1.5||companionAt!==null||restSit>.01||restLie>.01||!held&&(!!idleKind||t<restUntil||nextIdle!==null&&t>=nextIdle))}
  function animate(t,moving,wind=0,settled=false,dt=.016,reduced=false,stride=t*5.1){
    const now=clock(),age=now-petAt;motionReduced=reduced;
    const actionAge=now-actionAt,releaseAge=now-releasedAt;
    const wanted=held?.9:releasedAt>=actionAt?releasedResponse*(1-ease(releaseAge,.18,1.05)):age<2.8?Math.exp(-Math.max(0,age-1.1)*1.9):0;
    response=reduced?wanted:T.MathUtils.lerp(response,wanted,1-Math.exp(-dt*(wanted>response?20:5)));
    chinBlend=reduced?(zone==='chin'?1:0):T.MathUtils.damp(chinBlend,zone==='chin'?1:0,9,dt);
    const chinLift=response*chinBlend;
    earResponse=reduced?response:T.MathUtils.damp(earResponse,response,8,dt);
    tailResponse=reduced?response:T.MathUtils.damp(tailResponse,response,3.6,dt);
    const notice=reduced?0:envelope(actionAge,0,.07,.13,.30)*response;
    approachBlend=reduced?1:T.MathUtils.damp(approachBlend,ease(actionAge,.04,.46),12,dt);
    cheekBlend=reduced?1:T.MathUtils.damp(cheekBlend,ease(actionAge,.16,.70),12,dt);
    pressBlend=reduced?0:T.MathUtils.damp(pressBlend,envelope(actionAge,.30,.60,.85,1.25),12,dt);
    const approach=approachBlend,cheekTurn=cheekBlend,nuzzlePress=pressBlend;
    const strokeAge=now-backStrokeAt;
    bodyStroke=reduced?0:T.MathUtils.damp(bodyStroke,envelope(strokeAge,0,.14,.36,.90),12,dt);
    tailStroke=reduced?0:T.MathUtils.damp(tailStroke,envelope(strokeAge,.20,.42,.76,1.30),10,dt);
    // A fresh touch chooses once, but the old pose blends out instead of
    // snapping when another response is chosen before it has fully faded.
    for(const name in responseWeights){const target=name===root.userData.reactionName?response:0;responseWeights[name]=reduced?target:T.MathUtils.damp(responseWeights[name],target,12,dt)}
    const direction=touchSide||side;
    poseSide=reduced?direction:T.MathUtils.damp(poseSide,direction,9,dt);
    const {nuzzle,tilt,bow,stretch:backStretch,arch,tail:tailCurl}=responseWeights,cheek=responseWeights.cheek*chinBlend,bliss=responseWeights.bliss*chinBlend;
    if(!reduced&&!held&&companionAt===null){
      if(context.night&&nightSince!==null&&now-nightSince>=5){companionAt=now;restBaseSit=restSit;restBaseLie=restLie;idleKind=''}
      else if(context.listening&&!listeningSettled&&listeningSince!==null&&now-listeningSince>14&&!moving){companionAt=now;restBaseSit=restSit;restBaseLie=restLie;listeningSettled=true}
    }
    const companionAge=companionAt===null?0:now-companionAt;
    if(reduced){companionAt=null;restSit=restLie=restBaseSit=restBaseLie=0}
    else if(held){
      // Petting a seated or resting cat keeps that posture. A new release
      // starts from this pose, rather than making it stand and sit repeatedly.
      companionAt=null;restBaseSit=restSit;restBaseLie=restLie;
    }
    else if(companionAt!==null){
      const sitTarget=T.MathUtils.lerp(restBaseSit,1,ease(companionAge,2.2,4.1))*(context.night?1:1-ease(companionAge,30,32.5));
      const lieTarget=T.MathUtils.lerp(restBaseLie,1,ease(companionAge,7.5,10))*(context.night?1:1-ease(companionAge,27.5,30));
      restSit=T.MathUtils.damp(restSit,sitTarget,8,dt);restLie=T.MathUtils.damp(restLie,lieTarget,8,dt);
      if(!context.night&&companionAge>33.5&&restSit<.001&&restLie<.001){companionAt=null;restSit=restLie=0;wakingFromNight=false;restUntil=t+.35}
    }
    const seated=restSit*(1-restLie),lying=restLie;
    const glance=(context.night?0:lying)*envelope((companionAge-12)%11,1,1.7,2.5,3.3);
    if(nextIdle===null)nextIdle=t+3;
    const interrupted=context.night||now-noticeAt<3.6||held||response>.15||reduced||companionAt!==null||restSit>.01||restLie>.01||moving&&!!idleKind;
    if(interrupted){idleKind='';nextIdle=t+3;restUntil=0}
    else{
      if(idleKind&&t-idleStart>=idleDuration){idleKind='';restUntil=t+.35;nextIdle=t+6+random()*4}
      if(!idleKind&&!moving&&settled&&t>=nextIdle){idleKind=idleNames[draw('idle',5,firstIdle?0:undefined)];firstIdle=false;idleStart=t;idleDuration=idleKind==='doze'?7:idleKind==='groom'?5.6:3.6}
    }
    const idleAge=t-idleStart;
    for(const name of idleNames){const target=idleKind!==name?0:name==='groom'?envelope(idleAge,0,.65,4.15,5.6):Math.sin(Math.PI*T.MathUtils.clamp(idleAge/idleDuration,0,1))**2;idleWeights[name]=reduced?0:T.MathUtils.damp(idleWeights[name],target,12,dt)}
    const pawTarget=idleKind==='groom'?envelope(idleAge,.35,1.10,3.85,4.75):0;
    let lickTarget=0;
    if(idleKind==='groom')for(let i=0;i<3;i++)lickTarget+=envelope(idleAge,1.35+i*.72,1.44+i*.72,1.52+i*.72,1.66+i*.72);
    groomPaw=reduced?0:T.MathUtils.damp(groomPaw,pawTarget,12,dt);groomLick=reduced?0:T.MathUtils.damp(groomLick,lickTarget,24,dt);
    const {yawn,stretch,groom,observe,doze}=idleWeights;
    const noticeWeight=reduced||held||context.night?0:envelope(now-noticeAt,0,.35,2.4,3.6);
    attention.copy(lookTarget).multiplyScalar(1-ease(now-lastLookAt,2.5,4.5));
    attention.x=T.MathUtils.lerp(attention.x,noticeX,noticeWeight);attention.y=T.MathUtils.lerp(attention.y,noticeY,noticeWeight);
    eyeGaze.lerp(attention,reduced?1:1-Math.exp(-dt*16));
    gaze.lerp(eyeGaze,reduced?1:1-Math.exp(-dt*4.5));
    const watching=settled?(1-response*.9)*(1-Math.max(groom,doze,yawn)):0;
    hand.lerp(contact,reduced?1:1-Math.exp(-dt*13));
    const turn=root.userData.turning||0;walkBlend=reduced?0:T.MathUtils.lerp(walkBlend,moving?1:turn*.35,1-Math.exp(-dt*8));
    const gait=turn>.05?t*5.1:stride,walk=walkBlend,breath=reduced?0:Math.sin(t*1.4)*.008;
    const back=zone==='back';
    bodyRig.position.set(back?response*hand.x*.014:0,walk*Math.sin(gait*2)*.017+breath+arch*.045-stretch*.025+bodyStroke*.035-lying*.26,response*(back?.025:0)+bodyStroke*.025);bodyRig.rotation.z=walk*Math.sin(gait)*.018;
    torso.rotation.x=-seated*.55;torso.scale.y=.43-lying*.10;chest.scale.y=.38-lying*.08;
    // The planted half of each step stays level; the other half lifts and
    // travels forward. Counter-rotate the paw so it never tips onto its toe.
    for(const l of legs){
      const phase=(l.front?0:Math.PI)+(l.side>0?Math.PI:0),step=gait+phase;
      const washing=l.front&&l.side===1?groomPaw:0;
      const angle=walk*Math.sin(step)*.30-washing*.8+(l.front?-lying*1.05:-seated*.90-lying*1.30),lift=walk*Math.max(0,Math.sin(step))**2*.09;
      const reaching=l.front?(stretch+backStretch):0;
      l.hip.rotation.x=angle;l.hip.position.x=l.side*(.29+(l.front?0:seated*.025))-washing*.06;l.hip.position.y=.48+washing*.16-reaching*.06+(l.front?lying*.04:-seated*.18+lying*.06);l.hip.position.z=(l.front?.32:-.56)+washing*.10+(l.front?0:seated*.14);
      const cycle=((step%(Math.PI*2))+Math.PI*2)%(Math.PI*2);
      // Hermite swing shares the stance velocity at both ends, avoiding the
      // old zero-speed swing / constant-speed stance discontinuity.
      const u=cycle/Math.PI;
      const travel=(cycle<Math.PI?-1-2*u+12*u*u-8*u*u*u:1-2*(u-1))*Math.PI/16;
      const y=.15+lift-bodyRig.position.y-l.hip.position.y,z=.045+walk*travel+reaching*.14-bodyRig.position.z+(l.front?lying*.22:-seated*.04+lying*.10);
      l.foot.position.set(-bodyRig.position.x,y*Math.cos(angle)+z*Math.sin(angle),-y*Math.sin(angle)+z*Math.cos(angle));
      if(washing>.001)l.foot.position.lerp(washingPaw,washing);
      // A small toe-down relaxation in the airborne half returns to level
      // with zero angular velocity at contact. The continuous wrist blends it.
      l.foot.rotation.x=-angle+walk*Math.max(0,Math.sin(step))**2*.10;
    }
    const lean=response*(zone==='head'?.05:zone==='chin'?.02:.012),chin=zone==='chin';
    head.position.set(lean*hand.x+poseSide*(tilt*.04+nuzzle*.025*approach)+response*hand.x*(back?.012:.045)+groom*.06,1.07+breath+chinLift*.085+bliss*.025+nuzzle*.025*approach-bow*.065-groom*.22-doze*.04-(stretch+backStretch)*.09+seated*.12-lying*.10,.49+lean*.5+chinLift*.075+nuzzle*(.105*approach+.025*nuzzlePress)-groom*.06+(stretch+backStretch)*.10-seated*.12+lying*.07);
    head.rotation.y=(settled?.10:0)+watching*gaze.x*.20+response*hand.x*(chin?.10:.24)+poseSide*(nuzzle*.15*approach+cheek*.14*cheekTurn+tailCurl*.18)+groom*.18+observe*poseSide*.16;
    head.rotation.z=(reduced?0:Math.sin(t*.31)*.014)-response*hand.x*(chin?.065:.11)+poseSide*(tilt*.20+nuzzle*.075*approach+cheek*.11*cheekTurn+bliss*.065+observe*.18)-groom*.14;
    head.rotation.x=watching*gaze.y*.18+noticeWeight*(noticeKind==='music'?-.055:.035)+response*.055+notice*.025-chinLift*.54-bliss*.025+bow*.18+response*hand.y*(chin?.008:.035)-yawn*.14+groom*.34+groomLick*.04+doze*.06+(stretch+backStretch)*.12+lying*.035-glance*.04;
    const comfortable=ease(response,.10,.70)*(reduced?1:ease(actionAge,.08,.32)),drowsy=Math.max(doze,yawn*.95,groom*.85,lying*(.90-glance*.65)*(1-response)),alert=Math.max(observe,watching*eyeGaze.length()*.18,glance*.35);
    faceComfort=reduced?comfortable:T.MathUtils.damp(faceComfort,comfortable,9,dt);
    faceDrowsy=reduced?0:T.MathUtils.damp(faceDrowsy,drowsy,6,dt);
    faceAlert=reduced?alert:T.MathUtils.damp(faceAlert,alert,8,dt);
    const blink=t%5.6,blinkOpen=reduced?1:blink<.20?Math.max(.06,Math.abs(blink-.10)*10):1;
    eyes.forEach((e,i)=>{
      const eyeSide=i?1:-1,farEye=(1-eyeSide*poseSide)/2;
      // A tilted response leaves the far eye half open. Crossing cheeks blends
      // this asymmetry instead of abruptly swapping which eye is visible.
      const closure=Math.max(faceComfort*(1-ease(tilt,.15,.75)*farEye*.60),ease(faceDrowsy,.12,.70));
      eyeOpenness[i]=reduced?1-closure:T.MathUtils.damp(eyeOpenness[i],1-closure,18,dt);
      const open=T.MathUtils.clamp(eyeOpenness[i]*blinkOpen,0,1),lidBlend=1-ease(open,.18,.55);
      // Large glassy eyes must not squash into black pancakes. Hand off to
      // the closed eyelid earlier while preserving the eyeball's volume.
      e.visible=lidBlend<.999;e.scale.y=Math.max(.70,open)*(1+faceAlert*.10);
      e.position.x=eyeSide*.205+watching*eyeGaze.x*.017;e.position.y=.025-watching*eyeGaze.y*.014-faceDrowsy*.009;
      e.rotation.set(watching*eyeGaze.y*.04,watching*eyeGaze.x*.055,0);
      e.children[0].material.opacity=1-lidBlend;e.children[1].material.opacity=(1-lidBlend)*ease(open,.20,.55);
      for(let j=2;j<e.children.length;j++)e.children[j].material.opacity=(1-lidBlend)*(j===4?ease(open,.20,.55):1);
      const lid=sleepEyes[i],vertices=lid.geometry.attributes.position,rest=lid.userData.restVertices;
      lid.visible=lidBlend>.001;lid.material.opacity=lidBlend;
      lid.position.set(e.position.x-eyeSide*.205,e.position.y-.025,0);
      const arch=.060*faceComfort+.010*faceDrowsy;
      if(lid.userData.arch!==arch){
        for(let v=0;v<vertices.count;v++){const u=T.MathUtils.clamp((rest[v*3]-eyeSide*.205)/.104,-1,1);vertices.setY(v,rest[v*3+1]+arch*(1-u*u))}
        vertices.needsUpdate=true;lid.geometry.computeVertexNormals();lid.geometry.computeBoundingSphere();lid.userData.arch=arch;
      }
      cheeks[i].position.y=-.115+faceComfort*.012;cheeks[i].scale.y=.022+faceComfort*.004;
    });
    mouth.visible=yawn>.10||groomLick>.12;mouth.scale.y=.007+yawn*.049+groomLick*.014;
    tongue.visible=!reduced&&groomLick>.12;tongue.position.set(0,-.225-groomLick*.025,.528+groomLick*.020);tongue.scale.y=.015+groomLick*.018;
    // Attach the root inside the torso in every posture, including its seated
    // rotation and lying squash; do not leave it at a fixed standing height.
    tail.position.copy(socket.set(0,(.64-.63)/.43,(-.75+.20)/.69).multiply(torso.scale).applyEuler(torso.rotation).add(torso.position));
    tail.rotation.y=((reduced?0:Math.sin(t*.8)*.13)+tailResponse*.18+poseSide*(tailCurl*.22+tailStroke*.18))*(1-lying*.75);
    tail.rotation.z=reduced?0:Math.sin(t*.56)*.045*(1-lying*.8);tail.rotation.x=(-walk*.10+tailResponse*(back?-.08:0)-arch*.10-stretch*.10-bliss*.045-tailStroke*.15)*(1-lying*.8);
    ears.forEach((e,i)=>{const earSide=i?1:-1;e.rotation.z=-earSide*.22+(reduced?0:Math.sin(t*(i?1.2:1.07)+i)*(.012+wind*.015))+earSide*earResponse*.04+earSide*(bliss*.035-faceAlert*.05-faceDrowsy*.07)-earSide*notice*.035-earSide*noticeWeight*.05+earSide*context.wind*.025;e.rotation.x=-earResponse*.045-chinLift*.065-faceAlert*.08+faceDrowsy*.065-notice*.09-watching*gaze.y*.025});
    const reactionAge=now-chinAt,p=T.MathUtils.clamp(reactionAge/1.2,0,1);
    reaction.visible=!reduced&&reactionAge>=0&&reactionAge<1.2&&response>.10;
    flowerMat.opacity=Math.sin(p*Math.PI)*.85;
    reaction.children.forEach((f,i)=>{f.scale.setScalar(.55+T.MathUtils.smoothstep(p,0,.32)*.45);f.position.y=1.62+p*.13;f.rotation.z=(i?1:-1)*p*.35});
    root.userData.pose=moving?'walking':'resting';root.userData.petting=held||age<2.8;root.userData.contact=held;root.userData.response=response;root.userData.chinResponse=chinLift;root.userData.idleAction=idleKind||'rest';root.userData.expression=response>.24?'content':yawn>.10?'yawning':groom>.30?'grooming':stretch>.30?'stretching':observe>.30?'curious':faceDrowsy>.35?'sleepy':glance>.35?'curious':'calm';
    root.userData.reactionPhase=response<.02?'rest':releasedAt>=actionAt&&!held?'settling':actionAge<.16?'noticing':actionAge<.70?'approaching':'settled';
    root.userData.groomPhase=idleKind!=='groom'?'none':idleAge<.35?'prepare':idleAge<1.35?'raise':idleAge<3.55?'lick':idleAge<4.75?'lower':'settle';
    root.userData.touchSide=touchSide;root.userData.backStroke=bodyStroke;root.userData.tailStroke=tailStroke;
    root.userData.companionPhase=held?'touch':companionAt===null?'none':companionAge<2.2?'linger':companionAge<4.5?'sitting-down':companionAge<7.5?'sitting':companionAge<10.5?'lying-down':companionAge<27.5||context.night?'resting':'getting-up';
    root.userData.nightRest=context.night&&restLie>.65;root.userData.noticeWeight=noticeWeight;root.userData.listening=context.listening;
    root.userData.sitWeight=restSit;root.userData.lieWeight=restLie;
    // Rendering can use the same gesture/schedule state with a sprite skin.
    // Timings remain owned by this actor, including release and recovery.
    root.userData.spriteState={actionAge,companionAge,idleAge,idleDuration,noticeAge:now-noticeAt,wind,looking:eyeGaze.length()>.12,waking:wakingFromNight&&restLie>.01&&companionAge>=27.5};
    coat.update();
  }
  return {root,head,reaction,animate,pet,touch,release,look,wantsRest,setContext,notice};
}
