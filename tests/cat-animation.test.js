const {test}=require('node:test');
const assert=require('node:assert/strict');

async function fixture(seed=27){
  const {createStoryCat}=await import('../story-cat.js');
  let now=0;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32};
  const actor=createStoryCat({random,clock:()=>now});
  function advance(seconds,{moving=false,settled=true,reduced=false}={}){
    const frames=Math.ceil(seconds*60);
    for(let i=0;i<frames;i++){now+=1/60;actor.animate(now,moving,0,settled,1/60,reduced)}
    return actor.root.userData;
  }
  return {actor,advance,time:()=>now};
}

for(const zone of ['head','chin','back'])test(`${zone} uses all three responses before repeating, with distinct poses`,async()=>{
  const {actor,advance}=await fixture();
  const names=[],poses=[];
  for(let i=0;i<9;i++){
    assert.equal(actor.pet(zone),true);
    actor.touch(zone,{x:0,y:0});advance(.8);
    names.push(actor.root.userData.reactionName);
    const pose=[];actor.root.traverse(o=>{pose.push(...o.position.toArray(),o.rotation.x,o.rotation.y,o.rotation.z)});poses.push(pose);
    if(zone==='chin')assert.ok(actor.head.rotation.x<-.32,'all chin responses keep the head raised');
    actor.release();advance(1.8);
  }
  for(let i=0;i<9;i+=3)assert.equal(new Set(names.slice(i,i+3)).size,3);
  for(let i=1;i<names.length;i++)assert.notEqual(names[i],names[i-1]);
  for(let i=0;i<3;i++)for(let j=i+1;j<3;j++){
    const distance=Math.hypot(...poses[i].map((v,k)=>v-poses[j][k]));
    assert.ok(distance>.03,'variants must change the model pose, not just the label');
  }
});

test('a held scratch and same-press reentry keep their response; release fades smoothly',async()=>{
  const {actor,advance}=await fixture();actor.pet('chin');actor.touch('chin',{x:0,y:0});advance(.8);
  const name=actor.root.userData.reactionName;
  for(let i=0;i<180;i++){
    actor.touch('chin',{x:Math.sin(i),y:Math.cos(i)},false);advance(1/60);
    assert.equal(actor.root.userData.reactionName,name);assert.equal(actor.root.userData.petCount,1);
  }
  actor.release();advance(.3);actor.touch('chin',{x:0,y:0},false);advance(.8);
  assert.equal(actor.root.userData.reactionName,name);assert.equal(actor.root.userData.petCount,1);
  const before=actor.head.rotation.x;actor.release();advance(1/60);
  assert.ok(Math.abs(actor.head.rotation.x-before)<.04,'letting go must not snap the head');
  advance(4);assert.ok(actor.root.userData.response<.01);assert.equal(actor.root.userData.contact,false);
});

test('new touches blend between random responses without snapping the head',async()=>{
  const {actor,advance}=await fixture();
  for(const zone of ['head','chin','back'])for(let i=0;i<9;i++){
    actor.release();advance(.5);const before=[actor.head.rotation.x,actor.head.rotation.y,actor.head.rotation.z];
    actor.pet(zone);actor.touch(zone,{x:0,y:0});advance(1/60);
    const after=[actor.head.rotation.x,actor.head.rotation.y,actor.head.rotation.z];
    assert.ok(Math.max(...after.map((v,k)=>Math.abs(v-before[k])))<.08);
    advance(.8);
  }
});

test('quiet idle actions have gaps and cover all five poses; walking and touch interrupt them',async()=>{
  const {actor,advance}=await fixture();advance(2.7);
  assert.equal(actor.root.userData.idleAction,'rest','quiet companionship must not immediately perform an action');
  const starts=[],seen=new Set();let previous='rest',restSince=2.7;
  for(let frame=0;frame<60*150;frame++){
    const state=advance(1/60),time=2.7+(frame+1)/60;
    if(state.idleAction!==previous){
      if(state.idleAction==='rest')restSince=time;
      else{starts.push(state.idleAction);seen.add(state.idleAction);if(starts.length>1)assert.ok(time-restSince>=5.9&&time-restSince<=10.1)}
      previous=state.idleAction;
    }
  }
  assert.equal(starts[0],'yawn');assert.deepEqual([...seen].sort(),['doze','groom','observe','stretch','yawn']);
  assert.equal(new Set(starts.slice(0,5)).size,5);
  // Interrupt an actual active action, rather than merely checking a resting cat.
  while(actor.root.userData.idleAction==='rest')advance(1/60);
  advance(.8);advance(1/60,{moving:true});assert.equal(actor.root.userData.idleAction,'rest');
  advance(20);actor.pet('head');actor.touch('head',{x:0,y:0});advance(1);
  assert.equal(actor.root.userData.idleAction,'rest');assert.equal(actor.root.userData.expression,'content');
});

test('reduced motion suppresses idle performances, and no pose produces invalid transforms',async()=>{
  const {actor,advance}=await fixture();
  for(let i=0;i<180;i++){
    advance(.5,{reduced:true});assert.equal(actor.root.userData.idleAction,'rest');assert.equal(actor.root.userData.expression,'calm');
    assert.equal(actor.reaction.visible,false);
  }
  for(let i=0;i<360;i++){
    advance(.5);actor.root.traverse(o=>{
      for(const value of [...o.position.toArray(),o.rotation.x,o.rotation.y,o.rotation.z,...o.scale.toArray()])assert.ok(Number.isFinite(value));
    });
  }
});

test('eyes lead the head in both axes, a small deadzone rests, and attention fades',async()=>{
  const {actor,advance}=await fixture(),eye=actor.root.getObjectByName('eye-1');
  actor.look(.8,.8);advance(1/30);
  const eyeTravel=(.025-eye.position.y)/.014,headTravel=actor.head.rotation.x/.18;
  assert.ok(eyeTravel>headTravel&&headTravel>0,'eyes should notice a lower hand before the head follows');
  advance(.7);assert.ok(actor.head.rotation.x>.12);assert.ok(actor.head.rotation.y>.22);
  actor.look(-.8,-.8);advance(.8);assert.ok(actor.head.rotation.x<-.12);assert.ok(eye.position.x<.205);
  actor.look(.04,-.07);advance(1);assert.ok(Math.abs(actor.head.rotation.x)<.005);assert.ok(Math.abs(eye.position.y-.025)<.001);
  const fresh=await fixture(),baseline=await fixture();fresh.actor.look(0,1);fresh.advance(.7);assert.ok(fresh.actor.head.rotation.x>.12);
  fresh.advance(4.5);baseline.advance(5.2);assert.ok(Math.abs(fresh.actor.head.rotation.x-baseline.actor.head.rotation.x)<.01,'a stationary pointer should not hold the gaze forever, including during an idle action');
});

test('content, curious and sleepy faces have distinct eye shapes and coordinated ears',async()=>{
  const {actor,advance,time}=await fixture(),eye=actor.root.getObjectByName('eye-1'),lid=actor.root.getObjectByName('eyelid-1'),ear=actor.root.getObjectByName('ear-1'),cheek=actor.root.getObjectByName('cheek-1');
  const arc=()=>{const p=lid.geometry.attributes.position;const ring=i=>{let y=0;for(let j=0;j<6;j++)y+=p.getY(i*6+j);return y/6};return ring(8)-(ring(0)+ring(16))/2};
  advance(.4);actor.pet('chin');actor.touch('chin',{x:0,y:0});advance(1.2);
  assert.equal(actor.root.userData.expression,'content');assert.ok(arc()>.018,'content eyes must curve upward rather than reuse sleepy eyes');
  assert.ok(lid.visible&&lid.material.opacity>.95);assert.ok(cheek.position.y>-.105,'the cheeks should lift with the smile');
  actor.release();const seen=new Set();let curiousEar,previous='',started=0;
  while(time()<180&&seen.size<2){
    advance(1/60);
    const action=actor.root.userData.idleAction;if(action!==previous){previous=action;started=time()}
    if(action==='observe'&&!seen.has('curious')&&time()-started>1.8){curiousEar=ear.rotation.x;seen.add('curious');assert.ok(eye.scale.y>1.06&&eye.visible&&eye.children[1].material.opacity>.95,'curiosity retains bright open eyes')}
    if(action==='doze'&&!seen.has('sleepy')&&time()-started>3.5){seen.add('sleepy');assert.ok(lid.material.opacity>.98&&arc()<-.015,'sleepy eyes must be low and relaxed');assert.ok(cheek.position.y<-.114);assert.ok(ear.rotation.x>.025,'sleepy ears relax backward')}
  }
  assert.deepEqual([...seen].sort(),['curious','sleepy']);assert.ok(curiousEar<-.04,'curious ears point forward');
});

test('eyelids close and reopen without empty eyes, snapping or new geometry',async()=>{
  const {actor,advance}=await fixture(),eyes=[-1,1].map(s=>actor.root.getObjectByName(`eye-${s}`)),lids=[-1,1].map(s=>actor.root.getObjectByName(`eyelid-${s}`));
  const geometries=lids.map(e=>e.geometry);advance(.4);actor.pet('chin');actor.touch('chin',{x:0,y:0});
  let previous=lids.map(e=>e.material.opacity),peak=0;
  for(let frame=0;frame<240;frame++){
    if(frame===90)actor.release();advance(1/60);
    eyes.forEach((eye,i)=>{
      const lid=lids[i],pupil=eye.children[0].material.opacity;
      assert.ok(Math.abs(pupil+lid.material.opacity-1)<.00001,'the face must never lose both the eye and the lid');
      assert.ok(Math.abs(lid.material.opacity-previous[i])<.25,'contact and release should fade the eyelids continuously');
      assert.equal(lid.geometry,geometries[i]);previous[i]=lid.material.opacity;peak=Math.max(peak,lid.material.opacity);
      for(const value of lid.geometry.attributes.position.array)assert.ok(Number.isFinite(value));
    });
  }
  assert.ok(peak>.98);assert.ok(eyes.every(e=>e.scale.y>.98&&e.children[1].material.opacity>.98),'release restores the original bright eyes');
});

test('reduced motion holds a static content face without blinking or spontaneous expressions',async()=>{
  const {actor,advance}=await fixture(),eye=actor.root.getObjectByName('eye-1'),lid=actor.root.getObjectByName('eyelid-1'),ear=actor.root.getObjectByName('ear-1');
  actor.pet('chin');actor.touch('chin',{x:0,y:0});advance(.5,{reduced:true});
  const pose=[eye.scale.y,lid.material.opacity,ear.rotation.x,ear.rotation.z];
  for(let i=0;i<12;i++){advance(.5,{reduced:true});assert.deepEqual([eye.scale.y,lid.material.opacity,ear.rotation.x,ear.rotation.z],pose);assert.equal(actor.root.userData.idleAction,'rest')}
  actor.release();advance(4,{reduced:true});assert.equal(eye.scale.y,1);assert.equal(lid.visible,false);
});

test('after petting the cat lingers, sits, lies down and gets up with planted front paws',async()=>{
  const {actor,advance}=await fixture();actor.pet('head');actor.touch('head',{x:.3,y:0});advance(.8);actor.release();
  const phases=new Set();let lowest=Infinity,lastHead=actor.head.position.clone(),lastSit=0,lastLie=0;
  for(let frame=0;frame<60*35;frame++){
    const state=advance(1/60);phases.add(state.companionPhase);
    assert.ok(Math.abs(state.sitWeight-lastSit)<.02&&Math.abs(state.lieWeight-lastLie)<.02,'posture changes must remain continuous');
    assert.ok(actor.head.position.distanceTo(lastHead)<.025,'the head must not jump between standing and resting');
    lastSit=state.sitWeight;lastLie=state.lieWeight;lastHead.copy(actor.head.position);
    if(frame===60)assert.ok(state.sitWeight<.001,'letting go should leave a quiet pause before sitting');
    if(frame===60*5)assert.ok(state.sitWeight>.98&&state.lieWeight<.001);
    if(frame===60*12)assert.ok(state.lieWeight>.98);
    if(frame%15===0){
      actor.root.updateMatrixWorld(true);
      for(const name of ['paw-front--1','paw-front-1'])assert.ok(Math.abs(actor.root.getObjectByName(name).getWorldPosition(lastHead.clone()).y-.13)<.001,'the front paws stay on the same ground');
      actor.root.traverseVisible(o=>{if(o.isMesh){const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++)lowest=Math.min(lowest,lastHead.clone().fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld).y)}});
    }
  }
  assert.ok(lowest>-.015,'the folded legs, chest and curled tail must not sink through the ground');
  for(const phase of ['linger','sitting-down','sitting','lying-down','resting','getting-up','none'])assert.ok(phases.has(phase),phase);
  assert.equal(actor.root.userData.sitWeight,0);assert.equal(actor.root.userData.lieWeight,0);
});

test('petting a resting cat keeps its posture and renews the quiet stay after release',async()=>{
  const {actor,advance}=await fixture();actor.pet('chin');actor.touch('chin',{x:0,y:0});advance(.8);actor.release();advance(12);
  const lying=actor.root.userData.lieWeight,y=actor.head.position.y;actor.pet('chin');actor.touch('chin',{x:0,y:0});advance(.8);
  assert.equal(actor.root.userData.companionPhase,'touch');assert.ok(actor.root.userData.lieWeight>=lying-.001);
  assert.ok(actor.head.position.y-y<.13,'a resting cat lifts its chin rather than standing up');assert.ok(actor.head.rotation.x<-.32);
  actor.release();advance(1);assert.equal(actor.root.userData.companionPhase,'linger');assert.ok(actor.root.userData.lieWeight>.98);
  advance(12);assert.equal(actor.root.userData.companionPhase,'resting');assert.ok(actor.root.userData.lieWeight>.98);
  advance(.1,{reduced:true});assert.equal(actor.root.userData.companionPhase,'none');assert.equal(actor.root.userData.lieWeight,0);
});

test('accessible single pet actions also lead into quiet companionship',async()=>{
  const {actor,advance}=await fixture();actor.pet('head');advance(6);
  assert.ok(actor.root.userData.sitWeight>.98);advance(7);assert.ok(actor.root.userData.lieWeight>.98);
});

test('nuzzling approaches the hand, holds briefly after release, and settles back',async()=>{
  const {actor,advance}=await fixture();
  for(let i=0;i<3;i++){actor.pet('head');if(actor.root.userData.reactionName==='nuzzle')break;advance(3)}
  assert.equal(actor.root.userData.reactionName,'nuzzle');actor.touch('head',{x:0,y:0});
  advance(.10);const startingZ=actor.head.position.z;assert.equal(actor.root.userData.reactionPhase,'noticing');
  advance(.8);assert.ok(actor.head.position.z>startingZ+.065);assert.equal(actor.root.userData.reactionPhase,'settled');
  const heldZ=actor.head.position.z;actor.release();advance(.12);
  assert.ok(Math.abs(actor.head.position.z-heldZ)<.015,'the cat should linger before drawing away');
  assert.equal(actor.root.userData.reactionPhase,'settling');advance(3.5);
  assert.ok(actor.head.position.z<heldZ-.08&&actor.head.position.z>.33,'the nuzzle releases before settling into a seated posture');
});

test('grooming prepares, raises the paw, licks three times, then lowers to the same ground',async()=>{
  const {actor,advance,time}=await fixture(),paw=actor.root.getObjectByName('paw-front-1'),tongue=actor.root.getObjectByName('tongue');
  while(time()<180&&actor.root.userData.idleAction!=='groom')advance(1/60);
  assert.equal(actor.root.userData.groomPhase,'prepare');const start=time();
  const phases=new Set(),position=()=>{actor.root.updateMatrixWorld(true);return paw.getWorldPosition(actor.head.position.clone())};
  const ground=position();let tongues=0,wasVisible=false,raised=false;
  while(time()-start<6.5){
    advance(1/60);phases.add(actor.root.userData.groomPhase);
    const p=position();raised||=p.y>ground.y+.25&&p.z>ground.z+.25;
    if(tongue.visible&&!wasVisible)tongues++;
    if(tongue.visible){const tip=tongue.getWorldPosition(actor.head.position.clone());assert.ok(tip.distanceTo(p)<.30,'the tongue must reach the raised paw');}
    wasVisible=tongue.visible;
    for(const name of ['paw-front--1','paw-back--1','paw-back-1']){
      const other=actor.root.getObjectByName(name).getWorldPosition(actor.head.position.clone());
      assert.ok(Math.abs(other.y-ground.y)<.005,'the supporting paws must stay planted');
    }
  }
  assert.equal(raised,true);assert.equal(tongues,3);
  for(const phase of ['raise','lick','lower','settle'])assert.ok(phases.has(phase));
  assert.ok(position().distanceTo(ground)<.005);assert.equal(tongue.visible,false);
});

test('touching during grooming safely returns the raised paw and interrupts licking',async()=>{
  const {actor,advance,time}=await fixture(),paw=actor.root.getObjectByName('paw-front-1'),tongue=actor.root.getObjectByName('tongue');
  while(time()<180&&actor.root.userData.idleAction!=='groom')advance(1/60);
  advance(1.5);actor.pet('chin');actor.touch('chin',{x:0,y:0});advance(.6);
  actor.root.updateMatrixWorld(true);assert.equal(actor.root.userData.idleAction,'rest');assert.equal(tongue.visible,false);
  assert.ok(paw.getWorldPosition(actor.head.position.clone()).y<.17);assert.ok(actor.head.rotation.x<-.32);
});

for(const zone of ['head','chin'])test(`${zone} follows the touched side for every random response`,async()=>{
  const left=await fixture(),right=await fixture();
  for(let i=0;i<9;i++){
    for(const [f,x]of [[left,-.65],[right,.65]]){f.actor.pet(zone);f.actor.touch(zone,{x,y:0});f.advance(.85)}
    assert.equal(left.actor.root.userData.reactionName,right.actor.root.userData.reactionName);
    assert.ok(left.actor.head.position.x<-.03&&right.actor.head.position.x>.03,'both cheeks must lean toward the hand');
    assert.ok(left.actor.head.rotation.y<.06&&right.actor.head.rotation.y>.14,'randomized poses must not reverse the requested turn');
    for(const f of [left,right]){f.actor.release();f.advance(2)}
  }
});

test('crossing cheeks in one press follows smoothly without rerolling the response',async()=>{
  const {actor,advance}=await fixture();actor.pet('head');actor.touch('head',{x:-.75,y:0});advance(.8);
  const name=actor.root.userData.reactionName;let last=actor.head.rotation.y;
  for(let i=0;i<=90;i++){
    actor.touch('head',{x:-.75+1.5*i/90,y:0},false);advance(1/60);
    assert.ok(Math.abs(actor.head.rotation.y-last)<.025);last=actor.head.rotation.y;
    assert.equal(actor.root.userData.reactionName,name);assert.equal(actor.root.userData.petCount,1);
  }
  assert.ok(actor.head.position.x>.03);actor.release();const x=actor.head.position.x;advance(.12);
  assert.ok(Math.abs(actor.head.position.x-x)<.015);
});

test('a deliberate back stroke moves the body before the tail, with planted paws',async()=>{
  const {actor,advance,time}=await fixture();actor.pet('back');actor.touch('back',{x:.35,y:.8});advance(.8);
  actor.root.updateMatrixWorld(true);const names=['paw-front--1','paw-front-1','paw-back--1','paw-back-1'];
  const points=names.map(n=>actor.root.getObjectByName(n).getWorldPosition(actor.head.position.clone()));
  for(let i=0;i<20;i++){actor.touch('back',{x:.35,y:.8+(i%2?.01:-.01)},false);advance(1/60)}
  assert.equal(actor.root.userData.backStrokeCount||0,0,'stationary jitter must not accumulate into a stroke');
  actor.touch('back',{x:.35,y:.6},false);const started=time();let bodyPeak=0,tailPeak=0,bodyPeakAt=0,tailPeakAt=0;
  for(let i=0;i<100;i++){
    actor.touch('back',{x:.35,y:.6-Math.min(1,i/60)},false);advance(1/60);
    const data=actor.root.userData;
    if(data.backStroke>bodyPeak){bodyPeak=data.backStroke;bodyPeakAt=time()-started}
    if(data.tailStroke>tailPeak){tailPeak=data.tailStroke;tailPeakAt=time()-started}
    actor.root.updateMatrixWorld(true);
    names.forEach((name,k)=>assert.ok(actor.root.getObjectByName(name).getWorldPosition(actor.head.position.clone()).distanceTo(points[k])<.005,'the supporting feet cannot slide or float as the body follows a stroke'));
  }
  assert.equal(actor.root.userData.backStrokeCount,1,'one continuous stroke must not keep restarting the wave');
  assert.ok(bodyPeak>.8&&tailPeak>.8&&tailPeakAt>bodyPeakAt+.15);
  actor.touch('back',{x:.35,y:.7},false);advance(.1);actor.touch('back',{x:.35,y:.3},false);advance(.2);
  assert.equal(actor.root.userData.backStrokeCount,2,'moving back toward the shoulders lets a new stroke begin');
  actor.release();assert.equal(actor.wantsRest(time()),true,'the body and tail must finish before roaming resumes');
  advance(3);assert.ok(actor.root.userData.backStroke<.01&&actor.root.userData.tailStroke<.01);
});
