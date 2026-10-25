// Pose the SAME demo rig only for a synchronous photograph, then restore every
// transform. No alternate cat, animation state changes or generated artwork.
export const DEMO_PHOTOS=[{pose:'meal',title:'认真吃饭的小猫'},{pose:'roll',title:'在草地上打个滚'},{pose:'sniff',title:'低头闻一朵花'}];
export function withPetPhotoPose(world,pose,render){
  if(!pose)return render();
  const root=world.cat,saved=[],opacities=new Map();root.traverse(o=>saved.push([o,o.position.clone(),o.quaternion.clone(),o.scale.clone(),o.visible]));
  const find=name=>root.getObjectByName(name),body=find('companion-body'),head=find('companion-head');
  try{
    body.position.set(0,0,0);body.rotation.set(0,0,0);head.position.set(0,1.07,.49);head.rotation.set(0,0,0);
    find('companion-torso').rotation.set(0,0,0);find('companion-torso').scale.set(.46,.43,.69);find('companion-chest').scale.set(.37,.38,.30);
    for(const side of [-1,1])for(const part of ['front','back']){
      const hip=find(`hip-${part}-${side}`),paw=find(`paw-${part}-${side}`);hip.position.set(side*.29,.48,part==='front'?.32:-.56);hip.rotation.set(0,0,0);paw.position.set(0,-.33,.045);paw.rotation.set(0,0,0);
    }
    for(const side of [-1,1]){const eye=find(`eye-${side}`);eye.visible=true;eye.scale.y=1;eye.children.forEach(o=>{if(o.material){opacities.set(o.material,o.material.opacity);o.material.opacity=1}});find(`eyelid-${side}`).visible=false}
    find('tongue').visible=false;world.storyCat?.reaction&&(world.storyCat.reaction.visible=false);
    if(pose==='meal'){head.position.y=.85;head.position.z=.65;head.rotation.x=.47;head.rotation.y=-.12}
    if(pose==='sniff'){head.position.y=.94;head.rotation.set(.28,-.28,.08);find('hip-front--1').rotation.x=-.17}
    if(pose==='roll'){
      body.rotation.set(0,-.18,1.34);body.position.set(.58,.55,0);head.rotation.set(-.12,-.15,-.15);
      for(const side of [-1,1])for(const part of ['front','back'])find(`hip-${part}-${side}`).rotation.x=part==='front'?-.65:-.85;
    }
    // The visible coat is bound to these driver joints, not the hidden source
    // spheres. Synchronise both so fur and paws remain attached in the photo.
    root.traverse(o=>{if(!o.name.endsWith('-skin-joint'))return;const source=find(o.name.slice(0,-11));if(source){o.position.copy(source.position);o.quaternion.copy(source.quaternion);o.scale.copy(source.scale)}});
    for(const side of [-1,1])for(const part of ['front','back']){const joint=find(`upper-${part}-${side}-paw-joint`),paw=find(`paw-${part}-${side}`);joint.position.copy(paw.position);joint.quaternion.copy(paw.quaternion);joint.scale.copy(paw.scale)}
    root.updateWorldMatrix(true,true);return render();
  }finally{for(const[o,p,q,s,v]of saved){o.position.copy(p);o.quaternion.copy(q);o.scale.copy(s);o.visible=v}for(const[m,opacity]of opacities)m.opacity=opacity;root.updateWorldMatrix(true,true)}
}
