import * as T from './vendor/three/build/three.module.js';
import {readPetState,savePetState,remember,relationship,PET_LOOKS,canWearLook} from './pet-care-state.mjs';
import {capturePetPortrait,captureObjectPortrait,PORTRAIT_VERSION} from './pet-portrait.js';
import {linen,softBoxGeometry,ceramicBowlGeometry,buildTailoredClothes} from './pet-craft.js';
import {DEMO_PHOTOS} from './pet-photo-pose.js';
import {PET_LAYOUT,overlapsPetProp} from './pet-layout.mjs';
import {findRoute} from './garden-navigation.mjs';
import {PetCustomizer} from './pet-customizer.js';
import {PetVoiceEditor} from './pet-voice-editor.js';

const names={meal:'猫粮',treat:'小鱼零食',water:'清水',box:'纸箱',scratch:'抓板',cushion:'软垫',pet:'摸摸头',chin:'挠下巴',ball:'滚球'};
const outfits={collar:[['none','不佩戴'],['sage','鼠尾草项圈'],['rose','玫瑰项圈']],scarf:[['none','不佩戴'],['cream','奶油围巾'],['blue','雾蓝围巾']],head:[['none','不佩戴'],['flower','小雏菊'],['bow','蝴蝶结'],['rose','小玫瑰']]};
const weatherNames={clear:'晴天',cloudy:'多云',rain:'细雨',rainbow:'彩虹',aurora:'极光',meteor:'流星',snow:'落雪',fog:'薄雾'};
const iconPaths={
 meal:'<path d="M10 31h44l-6 18H16Z" fill="#b7c8a3"/><ellipse cx="32" cy="31" rx="22" ry="7" fill="#d9c5a1"/><g fill="#9b8060"><circle cx="23" cy="29" r="3"/><circle cx="31" cy="33" r="3"/><circle cx="39" cy="29" r="3"/></g><path d="M24 46h16"/>',
 treat:'<path d="M14 32c7-15 25-15 34 0-9 15-27 15-34 0Z" fill="#c7b99c"/><path d="m48 32 10-10v20Z" fill="#b4bba2"/><circle cx="23" cy="29" r="2" fill="#5a6d59"/>',
 water:'<path d="M12 34h40l-5 16H17Z" fill="#b6c6cf"/><ellipse cx="32" cy="34" rx="20" ry="6" fill="#cbe0de"/><path d="M30 10q-12 15 0 17 12-2 0-17Z" fill="#9cbdc4"/>',
 pet:'<path d="m15 29 3-16 13 8 13-8 5 16v13q-15 17-32 0Z" fill="#e4dbc5"/><path d="M23 34q3-4 6 0m7 0q3-4 6 0m-13 7q3 4 6 0"/><path d="M26 9q6-7 12 0"/>',
 chin:'<path d="m15 29 3-16 13 8 13-8 5 16v13q-15 17-32 0Z" fill="#e4dbc5"/><path d="M23 34h5m8 0h5M27 44q5 5 10 0m-8 10h9"/>',
 ball:'<circle cx="33" cy="32" r="20" fill="#bdc8a7"/><path d="M16 25q20 0 33 18M20 47q16-13 17-34M13 34q12 2 14 17"/>',
 box:'<path d="m12 26 20-10 21 10v25l-21 8-20-8Z" fill="#cfb895"/><path d="m12 26 20 9 21-9M32 35v24m-20-33-8-9 20-9 8 8m0 0 10-8 20 10-9 8" fill="#e4ceb0"/>',
 scratch:'<path d="m13 46 15-32 24 9-15 32Z" fill="#c6bba0"/><path d="m25 23 23 8m-27 0 23 8m-27 0 23 8"/>',
 cushion:'<rect x="8" y="18" width="48" height="33" rx="14" fill="#c5c0cc"/><path d="M16 26q16-5 32 0m-32 18q16 5 32 0"/><circle cx="32" cy="34" r="2" fill="#9d9baf"/>',
 album:'<rect x="12" y="9" width="40" height="46" rx="5" fill="#d5d9bf"/><path d="M19 18h26v27H19Z" fill="#f7f3e6"/><path d="m21 39 7-9 6 6 5-8 5 11"/><circle cx="27" cy="25" r="3" fill="#d6bd8f"/>',
 collar:'<ellipse cx="32" cy="32" rx="22" ry="12" fill="none" stroke="#9eaf94" stroke-width="8"/><path d="M32 42v8"/><circle cx="32" cy="51" r="5" fill="#cbb58c"/>',
 scarf:'<path d="M13 17q19 10 38 0v15q-19 12-38 0Zm23 20 11-3 7 21-14 3Z" fill="#c4cfd0"/>',
 head:'<g fill="#e9dfbb"><ellipse cx="32" cy="21" rx="6" ry="11"/><ellipse cx="32" cy="43" rx="6" ry="11"/><ellipse cx="21" cy="32" rx="11" ry="6"/><ellipse cx="43" cy="32" rx="11" ry="6"/></g><circle cx="32" cy="32" r="7" fill="#c8ab73"/>',
 none:'<circle cx="32" cy="32" r="19" fill="none"/><path d="m19 45 26-26"/>'
};
function art(key){return `<svg viewBox="0 0 64 64" fill="none" stroke="#75826d" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[key]||iconPaths.pet}</svg>`}
function element(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n}
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);

export class PetCare{
  constructor(world){
    this.w=world;this.services=world.petServices;
    if(!this.services)return;
    try{this.storage=localStorage}catch{}
    this.data=readPetState(this.storage);this.data.visits++;this.save();
    this.elapsed=0;this.nextAutonomy=12;this.job=null;this.props={};this.idleIndex=0;this.pendingMemory=null;this.cooldown=0;
    this.buildProps();this.buildClothes();this.applyOutfit(this.data.outfit);this.buildUI();
    this.customizer=new PetCustomizer(this);
    this.voice=new PetVoiceEditor(this);
    world.canvas.dataset.petLife='ready';
  }
  save(){const ok=savePetState(this.storage,this.data);if(!ok&&!this.storageWarned){this.storageWarned=true;this.services.toast('本次互动可以继续，浏览器暂时无法保存回忆。')}return ok}
  mat(color){return new T.MeshStandardMaterial({color,roughness:.87})}
  mesh(parent,geo,mat,pos=[0,0,0]){const o=new T.Mesh(geo,mat);o.position.set(...pos);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o}
  rounded(parent,mat,pos,size){const m=this.mesh(parent,new T.SphereGeometry(1,24,16),mat,pos);m.scale.set(...size);return m}
  findSpot(x,z,r=.9){
    for(let ring=0;ring<12;ring++)for(let j=0;j<(ring?16:1);j++){
      const a=j/16*Math.PI*2,p={x:x+Math.cos(a)*ring*.42,z:z+Math.sin(a)*ring*.42};
      if(!this.w.companion.walkable(p.x,p.z))continue;
      if(![0,1,2,3,4,5,6,7].every(k=>this.w.companion.walkable(p.x+Math.cos(k*Math.PI/4)*r,p.z+Math.sin(k*Math.PI/4)*r)))continue;
      if(overlapsPetProp(p.x,p.z,r,this.props))continue;
      if(this.sceneryBounds?.some(b=>p.x>b.min.x-r-.15&&p.x<b.max.x+r+.15&&p.z>b.min.z-r-.15&&p.z<b.max.z+r+.15))continue;
      if(this.w.plots.some(o=>Math.hypot(p.x-o.position.x,p.z-o.position.z)<2+r))continue;
      if(this.w.companion.routeTo(p))return p;
    }
    return null;
  }
  prop(key,x,z,r=1){const layout=PET_LAYOUT[key];if(layout)({x,z,r}=layout);const p=this.findSpot(x,z,r);if(!p)return null;const g=new T.Group();g.name=`pet-${key}`;g.position.set(p.x,this.w.groundHeight(p.x,p.z)+.025,p.z);g.userData={petProp:key,radius:r};this.w.scene.add(g);this.props[key]=g;return g}
  buildProps(){
    this.w.cozyContent?.root.updateMatrixWorld(true);
    this.sceneryBounds=(this.w.cozyContent?.root.children||[]).filter(o=>o.isGroup).map(o=>new T.Box3().setFromObject(o));
    const cardboard=this.mat('#c9ad88'),edge=this.mat('#e2cfac'),cloth=linen('#a9b8a3'),cream=linen('#ece5d2');
    const nook=this.prop('nook');
    if(nook){
      // Open-front wooden shelter, with an unobstructed entrance and soft bed.
      const wood=this.mat('#b4a17f'),roof=this.mat('#83947d');
      this.mesh(nook,softBoxGeometry(2.1,.13,1.9),wood,[0,.065,0]);
      for(const s of [-1,1]){
        this.mesh(nook,new T.BoxGeometry(.1,1.15,1.75),wood,[s*.96,.66,-.03]);
        const panel=this.mesh(nook,softBoxGeometry(1.35,.12,2.15,.035),roof,[s*.51,1.56,-.02]);panel.rotation.z=s*-.35;
        for(let i=0;i<7;i++){const rib=this.mesh(panel,softBoxGeometry(1.28,.016,.025,.007),this.mat('#96a48c'),[0,.064,-.91+i*.30]);rib.receiveShadow=false}
        for(let i=0;i<6;i++)this.mesh(nook,softBoxGeometry(.018,.022,1.7,.006),edge,[s*1.015,.24+i*.16,-.03]);
        this.mesh(nook,softBoxGeometry(.14,1.22,.15,.045),edge,[s*.94,.72,.79]);
      }
      this.mesh(nook,new T.BoxGeometry(1.9,1.15,.1),wood,[0,.66,-.87]);
      for(let i=0;i<5;i++)this.mesh(nook,new T.BoxGeometry(1.94,.022,.015),edge,[0,.28+i*.19,-.81]);
      this.rounded(nook,cloth,[0,.20,.10],[.80,.13,.69]);
      this.rounded(nook,cream,[0,.27,.14],[.66,.065,.53]);
      const plaque=this.mesh(nook,new T.SphereGeometry(1,20,12),edge,[0,1.49,1.07]);plaque.scale.set(.25,.19,.035);
      this.rounded(nook,wood,[0,1.46,1.11],[.074,.06,.012]);for(const s of [-1,1])this.rounded(nook,wood,[s*.08,1.55,1.11],[.027,.032,.012]);
    }
    const box=this.prop('box',5.7,7.4,.85);
    if(box){
      this.mesh(box,softBoxGeometry(1.45,.08,1.55,.025),cardboard,[0,.04,0]);
      for(const s of [-1,1])this.mesh(box,new T.BoxGeometry(.055,.54,1.55),cardboard,[s*.72,.30,0]);
      this.mesh(box,new T.BoxGeometry(1.45,.54,.055),cardboard,[0,.30,-.75]);
      // Low open doorway, instead of a solid front wall through the incoming legs.
      for(const side of [-1,1])this.mesh(box,new T.BoxGeometry(.20,.16,.055),cardboard,[side*.625,.12,.75]);
      for(const s of [-1,1]){const flap=this.mesh(box,new T.BoxGeometry(.42,.04,1.45),edge,[s*.9,.52,0]);flap.rotation.z=-s*.25}
      this.mesh(box,new T.BoxGeometry(.22,.015,1.4),edge,[0,.09,0]);
      this.rounded(box,cream,[0,.095,0],[.59,.025,.61]);
      const ramp=new T.BufferGeometry();ramp.setAttribute('position',new T.Float32BufferAttribute([-.51,0,1.13,.51,0,1.13,-.51,.08,.73,.51,0,1.13,.51,.08,.73,-.51,.08,.73],3));ramp.computeVertexNormals();this.mesh(box,ramp,cardboard);
    }
    const scratch=this.prop('scratch',7.6,6,.8);
    if(scratch){
      const pad=this.mesh(scratch,softBoxGeometry(.85,.08,1.45,.035),edge,[0,.045,0]);pad.rotation.x=-.06;
      for(let i=0;i<24;i++){const z=(i/23-.5)*1.35,rib=this.mesh(scratch,new T.CylinderGeometry(.012,.012,.75,6),cardboard,[0,.095+z*.06,z]);rib.rotation.z=Math.PI/2}
    }
    for(const [key,x,z,color] of [['meal',2.3,5.1,'#a8baa0'],['water',3.9,4.5,'#a9bdc4']]){
      const g=this.prop(key,x,z,.46);if(!g)continue;
      const ceramic=new T.MeshPhysicalMaterial({color,roughness:.32,clearcoat:.5,clearcoatRoughness:.25});
      this.mesh(g,ceramicBowlGeometry(),ceramic);
      this.mesh(g,new T.TorusGeometry(.372,.016,10,48),this.mat('#f0e9d6'),[0,.225,0]).rotation.x=Math.PI/2;
      this.mesh(g,new T.CylinderGeometry(.30,.31,.025,32),edge,[0,.02,0]);
      const mark=this.mat('#edf0e2');for(const s of [-1,1])this.rounded(g,mark,[s*.045,.15,.378],[.017,.02,.006]);this.rounded(g,mark,[0,.11,.365],[.037,.027,.008]);
      const contents=new T.Group();contents.position.y=.17;g.add(contents);g.userData.contents=contents;
      if(key==='water'){this.mesh(contents,new T.CircleGeometry(.32,32),new T.MeshPhysicalMaterial({color:'#afd6d8',roughness:.15,metalness:.15,transparent:true,opacity:.8}),[0,0,0]).rotation.x=-Math.PI/2}
      else for(let i=0;i<18;i++){const a=i*2.4,r=.07+Math.sqrt(i/18)*.21;this.rounded(contents,this.mat(i%2?'#9c7c56':'#b7996d'),[Math.sin(a)*r,0,Math.cos(a)*r],[.045,.027,.038])}
      contents.visible=key==='water';
    }
    this.ball=new T.Group();this.ball.visible=false;this.w.scene.add(this.ball);
    this.mesh(this.ball,new T.SphereGeometry(.20,24,16),cloth);
    for(let i=0;i<3;i++){const seam=this.mesh(this.ball,new T.TorusGeometry(.202,.009,6,32),cream);seam.rotation.set(i*.9,i*.7,0)}
    this.treat=new T.Group();this.treat.visible=false;this.w.scene.add(this.treat);
    this.rounded(this.treat,this.mat('#c2a178'),[0,.035,0],[.18,.04,.085]);this.mesh(this.treat,new T.ConeGeometry(.09,.12,3),edge,[-.16,.04,0]).rotation.z=Math.PI/2;
    // Navigation respects the solid back and side walls; the front stays open.
    for(const [key,halfX,halfZ]of [['nook',.96,.87],['box',.72,.75]]){
      const g=this.props[key];if(!g)continue;
      for(let i=0;i<=6;i++){const u=i/6;for(const side of [-1,1])this.w.walkObstacles.push({x:g.position.x+side*halfX,z:g.position.z-halfZ+2*halfZ*u,radius:.025});this.w.walkObstacles.push({x:g.position.x-halfX+2*halfX*u,z:g.position.z-halfZ,radius:.025})}
    }
    this.w.canvas.dataset.petLayout=JSON.stringify(Object.fromEntries(Object.entries(this.props).map(([k,g])=>[k,{x:g.position.x,z:g.position.z}])));
  }
  buildClothes(){
    buildTailoredClothes(this);
  }
  applyOutfit(o){
    this.collar.visible=o.collar!=='none';this.collarBand.material.color.set(o.collar==='rose'?'#bf9da0':'#90a38c');
    this.scarf.visible=o.scarf!=='none';this.scarfBand.material.color.set(o.scarf==='blue'?'#9eb7be':'#ded6b9');
    this.hair.visible=o.head!=='none';this.flower.visible=o.head==='flower';this.bow.visible=o.head==='bow';this.rose.visible=o.head==='rose';
    this.w.canvas.dataset.petOutfit=JSON.stringify(o);
  }
  buildUI(){
    const {app}=this.services;app.classList.add('pet-life-enabled');
    this.launcher=element('button','pet-launcher round');this.launcher.hidden=this.w.state.mode!=='session';this.launcher.id='petLauncher';this.launcher.setAttribute('aria-label','小猫：喂养、陪玩、装扮与回忆');this.launcher.innerHTML=art('pet');this.launcher.onclick=()=>this.open('home');app.append(this.launcher);
    document.getElementById('recenter').addEventListener('click',()=>app.classList.remove('pet-interacting'));
    this.invite=element('button','pet-invite');this.invite.hidden=true;this.invite.onclick=()=>{this.invite.hidden=true;this.open(this.inviteMode||'play')};app.append(this.invite);
    this.overlay=element('div','overlay');this.overlay.id='petCareOverlay';this.overlay.hidden=true;
    const sheet=element('section','sheet');sheet.setAttribute('role','dialog');sheet.setAttribute('aria-modal','true');sheet.setAttribute('aria-labelledby','petCareTitle');this.overlay.append(sheet);
    this.handle=element('button','pet-handle');this.handle.setAttribute('aria-label','展开宠物面板');this.handle.setAttribute('aria-expanded','false');sheet.append(this.handle);
    const head=element('div','pet-sheet-head');this.title=element('h2',null,'照顾小猫');this.title.id='petCareTitle';const close=element('button',null,'×');close.setAttribute('aria-label','关闭宠物面板');close.onclick=()=>this.services.closeModal();head.append(this.title,close);sheet.append(head);
    this.body=element('div','pet-care-body');sheet.append(this.body);this.footer=element('div','pet-outfit-footer');sheet.append(this.footer);app.append(this.overlay);
    this.overlay.onclick=e=>{if(e.target===this.overlay)this.services.closeModal()};
    const expand=value=>{this.overlay.classList.toggle('pet-expanded',value);this.handle.setAttribute('aria-expanded',String(value));this.handle.setAttribute('aria-label',value?'收起宠物面板':'展开宠物面板')};
    let y=0,dragged=false;this.handle.onpointerdown=e=>{y=e.clientY;dragged=false;this.handle.setPointerCapture(e.pointerId)};this.handle.onpointerup=e=>{const dy=e.clientY-y;dragged=Math.abs(dy)>20;if(dy< -35)expand(true);if(dy>45){if(this.overlay.classList.contains('pet-expanded'))expand(false);else this.services.closeModal()}};this.handle.onclick=()=>{if(!dragged)expand(!this.overlay.classList.contains('pet-expanded'))};
    new MutationObserver(()=>{if(this.overlay.hidden){this.customizer?.leave();this.voice?.leave();this.applyOutfit(this.data.outfit);this.draft=null;this.services.app.classList.remove('pet-sheet-open');this.portraitImage=null}}).observe(this.overlay,{attributes:true,attributeFilter:['hidden']});
    const positionInvite=()=>{let top=app.clientHeight-100;for(const id of ['homeDock','controls','gardenBottom']){const e=document.getElementById(id);if(e.getClientRects().length&&!e.closest('[hidden]'))top=Math.min(top,e.getBoundingClientRect().top-app.getBoundingClientRect().top)}app.style.setProperty('--pet-invite-bottom',`${app.clientHeight-top+12}px`)};
    const ro=new ResizeObserver(positionInvite);['homeDock','controls','gardenBottom'].forEach(id=>ro.observe(document.getElementById(id)));ro.observe(app);
  }
  open(page){
    if(this.w.state.mode!=='session')return;
    this.customizer.leave();
    this.voice.leave();if(page==='voice')this.voice.enter();
    if(page==='customize'){this.cancel();this.customizer.enter()}
    if(this.photoCacheVersion!==PORTRAIT_VERSION){this.lookThumbnails=[];this.demoPhotos={};this.legacyPortrait=null;this.photoCacheVersion=PORTRAIT_VERSION}
    if(page==='memories'){delete this.launcher.dataset.unread;this.legacyPortrait=null}
    this.page=page;this.invite.hidden=true;this.overlay.classList.remove('pet-expanded');this.handle.setAttribute('aria-expanded','false');
    this.overlay.classList.toggle('pet-dressing',page==='dress');this.portraitImage=null;
    this.overlay.classList.toggle('pet-customizing',page==='customize');
    this.overlay.classList.toggle('pet-voicing',page==='voice');
    this.overlay.classList.toggle('pet-hub',page==='home');
    if(page==='dress'){this.cancel();this.lookIndex=Math.max(0,PET_LOOKS.findIndex(l=>Object.keys(l.outfit).every(k=>l.outfit[k]===this.data.outfit[k])));this.draft={...PET_LOOKS[this.lookIndex].outfit};this.services.app.classList.add('pet-interacting');this.applyOutfit(this.draft)}
    this.render();this.body.scrollTop=0;this.services.modal('petCareOverlay');this.services.app.classList.add('pet-sheet-open');
  }
  objectThumbnail(key){
    this.objectThumbnails??={};if(this.objectThumbnails[key])return this.objectThumbnails[key];
    const subject=this.props[key]||(key==='ball'?this.ball:key==='treat'?this.treat:null);if(!subject)return '';
    const contents=subject.userData.contents,visible=contents?.visible;
    try{if(contents)contents.visible=true;return this.objectThumbnails[key]=captureObjectPortrait(this.w,subject).toDataURL('image/png')}catch{return ''}finally{if(contents)contents.visible=visible}
  }
  card(grid,key,title,sub,fn,selected=false){
    const b=element('button','pet-card'),visual=element('span','pet-card-visual'),thumb=this.page!=='home'&&this.objectThumbnail(key);
    if(thumb){const img=element('img');img.src=thumb;img.alt='';visual.append(img)}else visual.innerHTML=art(key);
    b.dataset.kind=key;b.append(visual,element('strong',null,title),element('small',null,sub||''));b.onclick=fn;if(selected!==null)b.setAttribute('aria-pressed',String(selected));grid.append(b);return b;
  }
  render(){
    this.body.replaceChildren();this.footer.replaceChildren();this.title.textContent={home:this.customizer.saved?this.customizer.saved.name+'的日常':'小猫的日常',feed:'小猫的餐桌',play:'陪它玩一会',dress:'小猫衣橱',memories:'共同回忆',customize:'我的小猫',voice:'它的声音'}[this.page];
    if(this.page!=='home'){const back=element('button','pet-panel-back','‹ 小猫');back.onclick=()=>{this.applyOutfit(this.data.outfit);this.open('home')};this.body.append(back)}
    const status=element('div','pet-status');status.append(element('i'),element('span',null,relationship(this.data.care)),element('span',null,`${this.data.memories.length} 张回忆`));this.body.append(status);
    if(this.page==='home'){
      const grid=element('div','pet-card-grid pet-hub-grid');
      for(const [page,title,ico]of [['feed','喂养','meal'],['play','陪玩','ball'],['dress','装扮','collar'],['memories','回忆','album']])this.card(grid,ico,title,'',()=>this.open(page),null);
      const custom=element('button','pet-custom-entry');custom.id='petCustomizeEntry';custom.append(element('span',null,'用照片定制我的小猫'),element('small',null,'毛色、花纹与名字 · 演示版'),element('b',null,'›'));custom.onclick=()=>this.open('customize');this.body.append(custom);
      const voice=element('button','pet-custom-entry pet-voice-entry');voice.id='petVoiceEntry';voice.append(element('span',null,'录下宠物的声音'),element('small',null,this.voice.saved?'已使用它的叫声 · 可试听或重录':'让摸摸小猫时的叫声，也属于它'),element('b',null,'›'));voice.onclick=()=>this.open('voice');this.body.append(voice);
      this.body.append(grid);
      return;
    }
    if(this.page==='memories'){this.renderMemories();return}
    if(this.page==='dress'){this.renderWardrobe();return}
    if(this.page==='customize'){this.customizer.render();return}
    if(this.page==='voice'){this.voice.render();return}
    const grid=element('div','pet-card-grid');this.body.append(grid);
    if(this.page==='feed'){
      for(const key of ['meal','treat','water'])this.card(grid,key,names[key],key==='meal'?'放进食碗':key==='treat'?'递给小猫':'添满水碗',()=>this.command(key),null);
      this.body.append(element('p','pet-note',this.data.lastFeed?`上次喂食 ${new Date(this.data.lastFeed).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})}`:'食碗和水碗就在小猫的活动区。'));
      const preferred=Object.entries(this.data.foods).filter(([k])=>k!=='water').sort((a,b)=>b[1]-a[1])[0];
      if(preferred?.[1]>=3)this.body.append(element('p','pet-note',`你们最常分享的是${names[preferred[0]]}。`));
    }else{
      for(const [key,sub]of [['pet','轻轻顺毛'],['chin','舒服地眯眼'],['ball','滚到草地上']])this.card(grid,key,names[key],sub,()=>this.command(key),null);
      this.body.append(element('h3','pet-care-label','它也会自己玩'));
      const props=element('div','pet-card-grid');this.body.append(props);
      for(const key of ['box','scratch']){const b=this.card(props,key,names[key],this.data.used.includes(key)?'它已经用过':'已放在花园',()=>this.command(key),null);b.disabled=!this.props[key]}
    }
  }
  renderWardrobe(){
    const look=PET_LOOKS[this.lookIndex],unlocked=canWearLook(look,this.data.demoMember),wearing=Object.keys(look.outfit).every(k=>look.outfit[k]===this.data.outfit[k]);
    const stage=element('div','pet-fitting-stage');stage.tabIndex=0;stage.setAttribute('aria-label','小猫试衣间，左右滑动切换装扮');
    const label=element('div','pet-look-label');label.append(element('small',null,look.premium?'会员时装':'经典'),element('strong',null,look.name));stage.append(label);
    this.portraitImage=element('img','pet-fitting-cat');this.portraitImage.alt=look.name+' · 小猫试穿';this.portraitImage.draggable=false;stage.append(this.portraitImage);
    for(const [step,text]of [[-1,'‹'],[1,'›']]){const b=element('button','pet-look-arrow '+(step<0?'previous':'next'),text);b.setAttribute('aria-label',step<0?'上一套装扮':'下一套装扮');b.onclick=()=>this.selectLook(this.lookIndex+step);stage.append(b)}
    let down=null;stage.onpointerdown=e=>{if(e.target.closest('button'))return;down={x:e.clientX,y:e.clientY};stage.setPointerCapture(e.pointerId)};stage.onpointerup=e=>{if(!down)return;const dx=e.clientX-down.x,dy=e.clientY-down.y;down=null;if(Math.abs(dx)>40&&Math.abs(dx)>Math.abs(dy)*1.3)this.selectLook(this.lookIndex+(dx>0?1:-1))};stage.onpointercancel=()=>down=null;
    stage.onkeydown=e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();this.selectLook(this.lookIndex+(e.key==='ArrowRight'?1:-1))}};
    const state=element('span','pet-look-state',wearing?'穿戴中':unlocked?'试穿中':'会员专属');stage.append(state);this.body.append(stage);
    const strip=element('div','pet-look-strip');strip.setAttribute('aria-label','选择整套装扮');
    this.lookThumbnails??=[];
    PET_LOOKS.forEach((item,i)=>{const b=element('button','pet-look-thumb');b.setAttribute('aria-label',item.name);b.setAttribute('aria-pressed',String(i===this.lookIndex));if(this.lookThumbnails[i]){const img=element('img');img.src=this.lookThumbnails[i];img.alt='';b.append(img)}else b.innerHTML=art('pet');b.append(element('span',null,item.name));if(item.premium&&!this.data.demoMember)b.append(element('small',null,'会员'));b.onclick=()=>this.selectLook(i);strip.append(b)});this.body.append(strip);
    const confirm=element('button','pet-save-outfit',wearing?'穿戴中':unlocked?'穿上这套':'开通会员解锁');confirm.disabled=wearing;confirm.onclick=()=>{if(!canWearLook(PET_LOOKS[this.lookIndex],this.data.demoMember)){this.showMembership();return}this.data.outfit={...this.draft};this.save();this.services.closeModal();this.queueMemory('outfit','第一次穿上新装扮')};this.footer.append(confirm);
    this.refreshPortrait();
    strip.children[this.lookIndex]?.scrollIntoView({block:'nearest',inline:'center',behavior:'instant'});
  }
  selectLook(index){this.lookIndex=(index+PET_LOOKS.length)%PET_LOOKS.length;this.draft={...PET_LOOKS[this.lookIndex].outfit};this.applyOutfit(this.draft);this.render()}
  refreshPortrait(){
    if(!this.portraitImage)return;this.lookThumbnails??=[];
    try{const photo=this.lookThumbnails[this.lookIndex]??=capturePetPortrait(this.w,{studio:true,width:720,height:840,pose:'wardrobe'});this.portraitImage.src=photo;const thumb=this.body.querySelectorAll('.pet-look-thumb')[this.lookIndex];if(thumb&&!thumb.querySelector('img')){const img=element('img');img.src=photo;img.alt='';thumb.querySelector('svg')?.replaceWith(img)}}catch{this.portraitImage.alt='小猫预览暂不可用'}
  }
  showMembership(){
    this.footer.replaceChildren();const box=element('div','pet-member-box');box.append(element('strong',null,'花园会员'),element('p',null,'解锁全部会员装扮，可随时换装。'),element('small',null,'本次为 Demo 演示，不支付、不订阅。'));
    const yes=element('button','pet-save-outfit','体验会员并解锁');yes.onclick=()=>{this.data.demoMember=true;this.save();this.render()};const no=element('button','pet-member-cancel','继续试穿');no.onclick=()=>this.render();box.append(yes,no);this.footer.append(box);
  }
  renderMemories(){
    const shot=element('button','pet-memory-shot','留一张此刻');shot.onclick=()=>{this.services.closeModal();this.queueMemory(`photo-${Date.now()}`,'一起待在花园的此刻')};this.body.append(shot);
    const gallery=element('div','pet-demo-gallery'),pending=[];this.body.append(gallery);this.demoPhotos??={};
    for(const sample of DEMO_PHOTOS){
      const card=element('article','pet-memory'),img=element('img');img.alt=sample.title;card.append(img);const caption=element('div');caption.append(element('strong',null,sample.title),element('small','pet-photo-note','Demo 互动示意'));card.append(caption);gallery.append(card);
      const show=()=>{if(this.page!=='memories'||!img.isConnected)return;try{img.src=this.demoPhotos[sample.pose]??=capturePetPortrait(this.w,{width:480,height:600,pose:sample.pose})}catch{img.remove();caption.append(element('span','pet-photo-note','照片暂未拍好'))}};
      if(this.demoPhotos[sample.pose])img.src=this.demoPhotos[sample.pose];else pending.push(show);
    }
    const next=()=>{const draw=pending.shift();if(draw){draw();if(pending.length)requestAnimationFrame(next)}};if(pending.length)requestAnimationFrame(next);
    for(const m of this.data.memories){
      const card=element('article','pet-memory'),legacy=m.portraitVersion!==PORTRAIT_VERSION;
      let photo=m.image;
      if(legacy){try{this.legacyPortrait??=capturePetPortrait(this.w);photo=this.legacyPortrait}catch{photo=''}}
      if(photo?.startsWith('data:image/')){const img=element('img');img.src=photo;img.alt=legacy?'当前小猫补拍，历史记录保留':m.title+' · 小猫近照';card.append(img)}
      else{const retry=element('button','pet-memory-shot','重拍小猫');retry.onclick=()=>{this.legacyPortrait=null;this.render()};card.append(retry)}
      const text=element('div');text.append(element('strong',null,m.title),element('p',null,`${new Date(m.at).toLocaleDateString('zh-CN')} · ${m.weather} · ${m.music}`));
      if(legacy&&photo)text.append(element('small','pet-photo-note','当前小猫补拍 · 原记录保留'));
      card.append(text);gallery.append(card);
    }
  }
  inviteUser(text,page='play'){this.launcher.title=text;this.launcher.dataset.notice='true';this.inviteMode=page;this.inviteUntil=this.elapsed+7}
  cancel(){this.job=null;this.w.cat.userData.careAction=null;this.w.companion.stop();this.ball.visible=false;this.treat.visible=false;this.nextAutonomy=this.elapsed+25}
  command(kind,automatic=false){
    if(kind==='cushion')return false;
    if(!automatic&&['meal','treat'].includes(kind)&&this.elapsed<this.cooldown){this.services.toast('刚吃过，先陪它玩一会吧。');return false}
    if(!automatic)this.services.closeModal(false);
    this.cancel();
    this.w.storyCat.release();
    if(!automatic)this.services.app.classList.add('pet-interacting');
    if(kind==='pet'||kind==='chin'){
      this.w.focus();this.w.pet(kind==='chin'?'chin':'head');this.services.petAudio?.();this.data.care++;this.save();this.queueMemory('touch','第一次靠近你的手');return true;
    }
    let point,lookTarget;
    if(kind==='ball'){
      const start=this.w.cat.position.clone();
      for(let i=0;i<16;i++){const a=this.w.cat.rotation.y+(i%2?1:-1)*Math.ceil(i/2)*Math.PI/8;const p={x:start.x+Math.sin(a)*2.2,z:start.z+Math.cos(a)*2.2};if([.2,.4,.6,.8,1].every(f=>this.w.companion.walkable(start.x+(p.x-start.x)*f,start.z+(p.z-start.z)*f))&&this.w.companion.routeTo(p)){point=p;break}}
      if(point){this.ball.position.copy(start);this.ball.position.y+=.2;this.ball.visible=true;this.ballFrom=start;this.ballTo=V(point.x,this.w.groundHeight(point.x,point.z)+.2,point.z);this.ballAge=0;lookTarget={...point};const direction=V(point.x-start.x,0,point.z-start.z).normalize();point={x:point.x-direction.x*.72,z:point.z-direction.z*.72}}
    }else if(kind==='treat'){
      const a=this.w.cat.rotation.y;const p={x:this.w.cat.position.x+Math.sin(a)*.25,z:this.w.cat.position.z+Math.cos(a)*.25};point=this.w.companion.walkable(p.x,p.z)?p:{x:this.w.cat.position.x,z:this.w.cat.position.z};lookTarget={x:point.x+Math.sin(a)*.6,z:point.z+Math.cos(a)*.6};this.treat.position.set(lookTarget.x,this.w.groundHeight(lookTarget.x,lookTarget.z)+.02,lookTarget.z);this.treat.visible=true;
    }else{
      const prop=this.props[kind];if(prop){lookTarget=prop.position;const inset=['box','cushion','nook'].includes(kind),offset=inset?0:kind==='scratch'?1.10:.80;point={x:prop.position.x,z:prop.position.z+offset};if(kind==='nook')lookTarget={x:point.x,z:point.z+2};if(kind==='box')lookTarget={x:point.x,z:point.z-2}}
    }
    let route=point&&this.w.companion.routeTo(point);
    if(route&&kind==='box'){
      const entrance={x:point.x,z:point.z+1.45},walkable=(x,z)=>this.w.companion.walkable(x,z);
      const outside=findRoute(this.w.cat.position,entrance,walkable),inside=findRoute(entrance,point,walkable);
      route=outside&&inside?[...outside,...inside]:null;
    }
    if(!route){if(!automatic)this.services.toast('这边有点挤，换一块附近的草地再试试。');this.ball.visible=this.treat.visible=false;return false}
    if(kind==='meal'||kind==='water'){this.props[kind].userData.contents.visible=true;this.props[kind].userData.contents.children.forEach(o=>o.visible=true)}
    this.w.companion.begin(route,null);this.w.companion.showMarker=false;if(this.w.companion.marker)this.w.companion.marker.visible=false;
    this.job={kind,stage:'approach',time:0,total:0,automatic,point,lookTarget,duration:{meal:6,water:5,treat:4,ball:5,box:10,scratch:7,cushion:15,nook:15}[kind],route:this.w.companion.route};
    if(!automatic)this.focusActivity(point);
    return true;
  }
  focusActivity(point){
    const cat=this.w.cat.position,target=V((cat.x+point.x)/2,.55,(cat.z+point.z)/2);
    const delta=this.w.camera.position.clone().sub(this.w.controls.target).normalize().multiplyScalar(7.5);delta.y=Math.max(3.3,delta.y);
    this.w.follow=false;this.w.transition={target,pos:target.clone().add(delta)};
    const controls=document.getElementById('controls');if(!controls.hidden&&!controls.classList.contains('is-collapsed'))document.getElementById('dockToggle').click();
  }
  complete(job){
    const k=job.kind;
    if(['meal','treat','water'].includes(k)){this.data.foods[k]++;if(k!=='water'){this.data.lastFeed=Date.now();this.cooldown=this.elapsed+12}}
    if(this.props[k]&&!this.data.used.includes(k)&&['box','scratch','cushion'].includes(k))this.data.used.push(k);
    this.data.care++;this.save();
    const events={meal:'你给它的第一碗饭',treat:'一起分享的小鱼零食',water:'今天也有清凉的水',ball:'第一次在草地上滚球',box:'它找到了喜欢的纸箱',scratch:'在花园里伸伸爪子',cushion:'音乐里的一场小憩',nook:'在自己的小窝里睡着了'};
    this.queueMemory(k,events[k]);
    if(!job.automatic)this.services.toast({meal:'吃饱了，它舔了舔嘴。',water:'喝好水，继续慢慢待着。',treat:'小鱼零食吃完啦。',ball:'它轻轻拨了拨球。',box:'这只纸箱，刚刚好。',scratch:'伸展完，爪子也舒服了。',cushion:'它在软垫上安心趴下了。',nook:'它回到自己的小窝休息了。'}[k]);
    this.treat.visible=false;this.job=null;this.w.companion.stop();this.nextAutonomy=this.elapsed+25;
  }
  queueMemory(key,title){if(this.data.firsts.includes(key)||this.pendingMemory)return;this.pendingMemory={key,title,at:this.elapsed+.8}}
  captureMemory(){
    const event=this.pendingMemory;this.pendingMemory=null;
    let image;try{image=capturePetPortrait(this.w)}catch{
      if((event.retries||0)<2)this.pendingMemory={...event,retries:(event.retries||0)+1,at:this.elapsed+1};
      else this.services.toast('小猫照片未拍好，可以在回忆中再拍一张。');return;
    }
    const s=this.w.state,m=remember(this.data,event,{weather:weatherNames[s.weather]||'花园',music:s.playing&&s.mix.music>0?'疗愈氛围音乐':s.playing?'自然声陪伴':'安静的花园',image,portraitVersion:PORTRAIT_VERSION});
    if(m){this.save();this.launcher.dataset.unread='true';this.launcher.setAttribute('aria-label','小猫：有新的共同回忆')}
  }
  update(dt){
    if(!this.services)return;
    this.launcher.hidden=this.w.state.mode!=='session';
    if(this.launcher.hidden&&!this.overlay.hidden)this.services.closeModal(false);
    // Advance only with the visible scene; background tabs and city trips pause naturally.
    this.elapsed+=Math.min(dt,.1);
    if(this.inviteUntil&&this.elapsed>this.inviteUntil){this.invite.hidden=true;delete this.launcher.dataset.notice}
    if(!this.greeted&&this.elapsed>3){this.greeted=true;this.w.storyCat.notice('welcome',{x:.5,y:0});this.inviteUser(this.data.visits>1?'它认出了回来的你':'小猫想认识你','feed')}
    if(this.pendingMemory&&this.elapsed>=this.pendingMemory.at)this.captureMemory();
    if(this.ball.visible&&this.ballAge<1.5){this.ballAge+=dt;const u=T.MathUtils.smoothstep(this.ballAge,0,1.5);this.ball.position.lerpVectors(this.ballFrom,this.ballTo,u);this.ball.position.y=this.w.groundHeight(this.ball.position.x,this.ball.position.z)+.2;this.ball.rotation.x-=dt*4*(1-u);this.ball.rotation.z+=dt*3*(1-u)}
    const j=this.job,c=this.w.companion;
    if(j&&j.stage!=='approach'&&c.phase!=='idle'){this.cancel();return}
    if(j){
      j.total+=dt;
      if(j.total>42||this.w.cat.userData.contact||(j.stage==='approach'&&c.route!==j.route)){this.cancel();return}
      if(j.stage==='approach'&&!c.route.length){
        if(Math.hypot(this.w.cat.position.x-j.point.x,this.w.cat.position.z-j.point.z)>.45){this.cancel();return}
        j.stage='align';j.time=0;c.stop();
      }
      if(j.stage==='align'||j.stage==='acting'){
        c.elapsed=0;this.w.catSpeed=0;this.w.catMoving=false;
        const dx=j.lookTarget.x-this.w.cat.position.x,dz=j.lookTarget.z-this.w.cat.position.z;
        const diff=Math.atan2(Math.sin(Math.atan2(dx,dz)-this.w.cat.rotation.y),Math.cos(Math.atan2(dx,dz)-this.w.cat.rotation.y));
        if(Math.hypot(dx,dz)>.05)this.w.cat.rotation.y+=diff*(1-Math.exp(-dt*7));
        if(j.stage==='align'){
          if(Math.abs(diff)<.035&&(this.w.cat.userData.sitWeight||0)<.02&&(this.w.cat.userData.lieWeight||0)<.02){j.stage='acting';j.time=0}
          return;
        }
        j.time+=dt;
        if(j.kind==='ball'){this.ball.position.x=this.ballTo.x+Math.sin(j.time*2)*.055;this.ball.rotation.z+=dt*.7}
        if(j.kind==='meal'){const contents=this.props.meal.userData.contents;contents.children.forEach((m,i)=>m.visible=i/contents.children.length>j.time/j.duration*.9)}
        if(j.time>=j.duration)this.complete(j);
      }
    }else if(this.elapsed>this.nextAutonomy&&!this.w.state.reduced&&!c.quiet&&c.phase==='idle'&&!this.w.follow&&!document.querySelector('.overlay:not([hidden]),.companion-overlay:not([hidden])')&&!this.w.gesture&&!this.w.cat.userData.contact&&!this.w.cat.userData.petting){
      this.nextAutonomy=this.elapsed+25;
      const choices=this.w.state.night||this.w.state.playing?['nook','box','scratch']:['box','scratch','nook'];
      this.command(choices[this.idleIndex++%choices.length],true);
    }
    this.w.canvas.dataset.petActivity=this.job?`${this.job.kind}:${this.job.stage}`:'free';
    this.w.canvas.dataset.petCareCount=String(this.data.care);
  }
  get supportHeight(){
    // Bedding remains solid after the action ends; only leave its height when walking out.
    let height=0;for(const [key,top]of [['box',.12],['nook',.34]]){const p=this.props[key]?.position;if(!p)continue;const cat=this.w.cat.position,d=Math.hypot(cat.x-p.x,cat.z-p.z);
      const lift=key==='box'?Math.max(0,p.y+top-(this.w.groundHeight?.(cat.x,cat.z)||0)):top;
      height=Math.max(height,lift*(1-T.MathUtils.smoothstep(d,key==='box'?1.10:.45,key==='box'?1.65:1.05)))}return height;
  }
  get pose(){
    const j=this.job;if(!j||j.stage==='approach')return null;
    if(j.stage==='align')return {action:'align',time:0,duration:0};
    const pose={action:j.kind==='nook'?'cushion':j.kind,time:j.time,duration:j.duration};
    if(j.kind==='scratch')pose.board=this.props.scratch.position;
    return pose;
  }
  pick(ray){const hit=ray.intersectObjects(Object.values(this.props),true)[0];if(!hit)return false;let g=hit.object;while(g&&!g.userData.petProp)g=g.parent;return g?this.command(g.userData.petProp):false}
}
