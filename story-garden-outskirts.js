// The landscape beyond the intimate garden: a readable boundary, country
// approach and a quiet wetland continuation. Built from shared low-poly forms.

export function installGardenOutskirts(world,T){
  if(!world?.scene||!world?.place)throw new Error('installGardenOutskirts requires a loaded garden world');
  const root=new T.Group();root.name='garden-outskirts';world.scene.add(root);
  const shadows=world.quality!=='low';
  const mat=(color,options={})=>new T.MeshStandardMaterial({color,roughness:options.roughness??.96,metalness:0,transparent:!!options.transparent,opacity:options.opacity??1,depthWrite:options.depthWrite??true});
  const wood=mat('#8b7358'),woodLight=mat('#b19a76'),stone=mat('#969a86'),sand=mat('#c7b792'),hay=mat('#c8a85d');
  const add=(parent,geometry,material,x,y,z,name='')=>{const mesh=new T.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.name=name;mesh.castShadow=shadows;mesh.receiveShadow=shadows;parent.add(mesh);return mesh};

  // A winding country lane continues beyond the current entrance.
  const lanePoints=[];
  for(let i=0;i<=24;i++){
    const z=18+i*2.15,x=4.6+Math.sin(z*.105)*3.5;
    lanePoints.push({x,z,y:world.groundHeight(x,z)+.028});
  }
  const laneVertices=[],laneIndices=[];
  lanePoints.forEach((p,i)=>{
    const previous=lanePoints[Math.max(0,i-1)],next=lanePoints[Math.min(lanePoints.length-1,i+1)],dx=next.x-previous.x,dz=next.z-previous.z,length=Math.hypot(dx,dz)||1,nx=-dz/length,nz=dx/length,width=1.25+(i%5===0?.16:0);
    laneVertices.push(p.x+nx*width,p.y,p.z+nz*width,p.x-nx*width,p.y,p.z-nz*width);
    if(i<lanePoints.length-1){const a=i*2;laneIndices.push(a,a+1,a+2,a+1,a+3,a+2)}
  });
  const laneGeometry=new T.BufferGeometry();laneGeometry.setAttribute('position',new T.Float32BufferAttribute(laneVertices,3));laneGeometry.setIndex(laneIndices);laneGeometry.computeVertexNormals();
  const lane=add(root,laneGeometry,sand,0,0,0,'country-lane');lane.castShadow=false;

  // Broken stone-and-timber boundaries frame the garden but leave sightline gaps.
  const boundary=new T.Group();boundary.name='garden-boundary';root.add(boundary);
  const stoneGeometry=new T.BoxGeometry(1.05,.38,.48),postGeometry=new T.CylinderGeometry(.055,.075,.82,7),railGeometry=new T.BoxGeometry(1.85,.085,.10);
  const addStoneRun=(startX,startZ,count,dx,dz)=>{for(let i=0;i<count;i++){
    if(i%7===3)continue;const x=startX+i*dx,z=startZ+i*dz,y=world.groundHeight(x,z);
    const block=add(boundary,stoneGeometry,stone,x,y+.19,z);block.rotation.y=Math.atan2(dx,dz)+(i%2?.025:-.025);
  }};
  addStoneRun(-31,27,20,1.45,0);addStoneRun(5,27,19,1.45,0);
  const fenceRuns=[[-34,22,0,-1.6,10],[-34,4,0,-1.6,9],[34,22,0,-1.6,10],[34,4,0,-1.6,9]];
  for(const[x,z,dx,dz,count]of fenceRuns){
    for(let i=0;i<count;i++){
      const px=x+i*dx,pz=z+i*dz,y=world.groundHeight(px,pz);add(boundary,postGeometry,wood,px,y+.41,pz);
      if(i<count-1){const nx=px+dx*.5,nz=pz+dz*.5,rail=add(boundary,railGeometry,woodLight,nx,y+.48,nz);rail.scale.x=Math.hypot(dx,dz)/1.85;rail.rotation.y=Math.atan2(dz,dx)}
    }
  }

  // A small mailbox and handcart make the outer approach feel inhabited.
  const mailbox=new T.Group();mailbox.name='country-mailbox';const mbx=11,mbz=31;mailbox.position.set(mbx,world.groundHeight(mbx,mbz),mbz);mailbox.rotation.y=-.22;root.add(mailbox);
  add(mailbox,new T.CylinderGeometry(.07,.09,1.6,7),wood,0,.8,0);add(mailbox,new T.BoxGeometry(.75,.50,.55),woodLight,0,1.55,0);add(mailbox,new T.CylinderGeometry(.28,.28,.75,10,1,false,0,Math.PI),woodLight,0,1.80,0).rotation.z=Math.PI/2;
  const cart=new T.Group();cart.name='flower-handcart';const cx=-10,cz=36;cart.position.set(cx,world.groundHeight(cx,cz),cz);cart.rotation.y=.18;root.add(cart);
  add(cart,new T.BoxGeometry(1.8,.55,1.05),woodLight,0,.72,0);for(const side of [-1,1])add(cart,new T.TorusGeometry(.48,.075,7,14),wood,-.62,.45,side*.58).rotation.y=Math.PI/2;
  for(const side of [-1,1]){const handle=add(cart,new T.CylinderGeometry(.035,.045,1.6,6),wood,1.35,.72,side*.34);handle.rotation.z=Math.PI/2}
  for(const x of [-.62,-.2,.2,.62]){const bloom=add(cart,new T.SphereGeometry(.17,7,5),x<0?mat('#d7b6bd'):mat('#ded09b'),x,1.15,(x%2)*.2);bloom.scale.y=.65}
  for(const[x,z,s]of [[-17,42,1],[16,45,.9],[24,35,.82]]){
    const bale=add(root,new T.CylinderGeometry(.72,.72,1.25,10),hay,x,world.groundHeight(x,z)+.72*s,z,'hay-bale');bale.rotation.z=Math.PI/2;bale.scale.setScalar(s);
  }

  // Continue the existing stream into a wider, reed-lined wetland outside the forest.
  const wetlandPoints=[];
  for(let i=0;i<=24;i++){
    const t=i/24,z=-34-t*25,x=world.streamX(-34)-t*19+Math.sin(t*Math.PI)*2.2;
    wetlandPoints.push({x,z,y:world.groundHeight(x,z)+.035,width:.72+t*1.28});
  }
  const wetVertices=[],wetIndices=[];
  wetlandPoints.forEach((p,i)=>{
    const previous=wetlandPoints[Math.max(0,i-1)],next=wetlandPoints[Math.min(wetlandPoints.length-1,i+1)],dx=next.x-previous.x,dz=next.z-previous.z,length=Math.hypot(dx,dz)||1,nx=-dz/length,nz=dx/length;
    wetVertices.push(p.x+nx*p.width,p.y,p.z+nz*p.width,p.x-nx*p.width,p.y,p.z-nz*p.width);
    if(i<wetlandPoints.length-1){const a=i*2;wetIndices.push(a,a+1,a+2,a+1,a+3,a+2)}
  });
  const wetGeometry=new T.BufferGeometry();wetGeometry.setAttribute('position',new T.Float32BufferAttribute(wetVertices,3));wetGeometry.setIndex(wetIndices);wetGeometry.computeVertexNormals();
  const wetland=add(root,wetGeometry,world.waterMat,0,0,0,'outer-wetland');wetland.castShadow=false;
  const bridge=new T.Group();bridge.name='wetland-footbridge';const bridgePoint=wetlandPoints[11];bridge.position.set(bridgePoint.x,bridgePoint.y+.12,bridgePoint.z);bridge.rotation.y=-.63;root.add(bridge);
  for(let i=0;i<10;i++)add(bridge,new T.BoxGeometry(.28,.10,3.1),woodLight,(i-4.5)*.29,Math.sin(i/9*Math.PI)*.12,0);
  for(const side of [-1,1])for(const x of [-1.25,1.25])add(bridge,new T.CylinderGeometry(.035,.05,.66,7),wood,x,.36,side*1.48);

  // Existing batched nature assets populate both sides without new material languages.
  const plant=(name,x,z,height,angle=0)=>world.place(name,x,z,height,angle);
  const fields=[[-10,34,8],[-7,43,10],[16,34,9],[19,43,11]];
  for(let f=0;f<fields.length;f++){
    const[cx0,cz0,count]=fields[f];for(let i=0;i<count;i++){
      const row=Math.floor(i/4),column=i%4,x=cx0+column*1.25+(row%2)*.45,z=cz0+row*1.25;
      plant((i+f)%3?'Flower_4_Group':'Flower_3_Group',x,z,.48+(i%3)*.08,i*.5);
    }
  }
  for(let i=0;i<38;i++){
    const t=i/37,p=wetlandPoints[Math.round(t*24)],side=i%2?1:-1,x=p.x+side*(p.width+.55+(i%3)*.28),z=p.z+(i%4-.5)*.42;
    plant(i%5?'Grass_Common_Tall':'Bush_Common_Flowers',x,z,.55+(i%4)*.10,i);
  }

  world.walkObstacles?.push({x:mbx,z:mbz,radius:.7},{x:cx,z:cz,radius:1.3},{x:bridgePoint.x,z:bridgePoint.z,radius:1.8});
  return {root,lane,boundary,mailbox,cart,wetland,bridge};
}
