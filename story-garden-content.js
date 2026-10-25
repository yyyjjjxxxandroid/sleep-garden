// Cozy, storybook-scale landmarks for the existing Quaternius garden.
// Everything is assembled from simple geometry so it shares the world's soft,
// low-poly language and stays inexpensive on mobile GPUs.

const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,value));

export function installGardenContent(world,T){
  if(!world?.scene||!world?.mat)throw new Error('installGardenContent requires a loaded garden world');
  const root=new T.Group();root.name='cozy-garden-content';world.scene.add(root);
  const quality=world.quality||'mid',shadows=quality!=='low';
  const material=(color,options={})=>{
    const m=new T.MeshStandardMaterial({color,roughness:options.roughness??.92,metalness:0});
    if(options.emissive){m.emissive=new T.Color(options.emissive);m.emissiveIntensity=0}
    return m;
  };
  const wood=material('#8d765d'),woodLight=material('#b7a17d'),woodDark=material('#665746');
  const plaster=material('#d8cdae'),roof=material('#735f4f'),stone=material('#8c9586');
  const cushion=material('#c8aa9e'),linen=material('#d8d4bd');
  const glowMaterials=[],lamps=[];
  const glow=material('#f4d798',{emissive:'#ffc56d',roughness:.7});glowMaterials.push(glow);
  const haloMaterial=new T.MeshBasicMaterial({color:'#ffc978',transparent:true,opacity:0,depthWrite:false,blending:T.AdditiveBlending});
  const add=(parent,geometry,mat,x,y,z,name='')=>{
    const mesh=new T.Mesh(geometry,mat);mesh.position.set(x,y,z);mesh.name=name;
    mesh.castShadow=shadows;mesh.receiveShadow=shadows;parent.add(mesh);return mesh;
  };

  function makeLantern(x,z,height=.78,withLight=false){
    const group=new T.Group();group.position.set(x,world.groundHeight(x,z),z);group.name='garden-lantern';root.add(group);
    add(group,new T.CylinderGeometry(.045,.06,height,7),woodDark,0,height/2,0);
    add(group,new T.BoxGeometry(.24,.30,.24),glow,0,height+.03,0);
    const halo=add(group,new T.SphereGeometry(.42,8,6),haloMaterial,0,height+.03,0);halo.castShadow=false;halo.receiveShadow=false;
    add(group,new T.CylinderGeometry(.18,.18,.055,4),woodDark,0,height+.21,0).rotation.y=Math.PI/4;
    if(withLight&&quality!=='low'){
      const light=new T.PointLight('#ffc878',0,quality==='high'?6.2:4.8,2);light.position.set(x,world.groundHeight(x,z)+height+.08,z);world.scene.add(light);lamps.push(light);
    }
    return group;
  }

  function makeBirdhouse(x,z,rotation=0){
    const group=new T.Group();group.position.set(x,world.groundHeight(x,z),z);group.rotation.y=rotation;group.name='garden-birdhouse';root.add(group);
    add(group,new T.CylinderGeometry(.055,.08,1.8,7),woodDark,0,.9,0);
    add(group,new T.BoxGeometry(.64,.58,.52),woodLight,0,1.78,0);
    const littleRoof=add(group,new T.CylinderGeometry(.08,.58,.42,4),roof,0,2.22,0);littleRoof.rotation.y=Math.PI/4;
    add(group,new T.CylinderGeometry(.10,.10,.05,12),woodDark,0,1.82,.285).rotation.x=Math.PI/2;
    add(group,new T.CylinderGeometry(.025,.025,.30,6),wood,0,1.57,.38).rotation.x=Math.PI/2;
    return group;
  }

  function makeCairn(x,z,scale=1){
    const group=new T.Group();group.position.set(x,world.groundHeight(x,z),z);group.name='garden-cairn';root.add(group);
    [[.48,.18,.36,0],[.36,.17,.28,.29],[.25,.14,.21,.52],[.15,.11,.14,.72]].forEach(([sx,sy,sz,y],i)=>{
      const rock=add(group,new T.SphereGeometry(1,7,5),stone,(i%2?-.04:.04)*scale,y*scale,0);rock.scale.set(sx*scale,sy*scale,sz*scale);rock.rotation.y=i*.7;
    });
    return group;
  }

  // A tiny cat cottage sits behind the pond, framed by the existing woodland.
  const house=new T.Group();house.name='cat-cottage';
  const hx=-12,hz=-13;house.position.set(hx,world.groundHeight(hx,hz),hz);house.rotation.y=-.10;root.add(house);
  add(house,new T.BoxGeometry(5.3,.26,4.0),stone,0,.13,0);
  add(house,new T.BoxGeometry(4.7,2.25,3.45),plaster,0,1.34,0);
  add(house,new T.BoxGeometry(2.8,.10,4.25),roof,-1.18,2.83,0).rotation.z=-.61;
  add(house,new T.BoxGeometry(2.8,.10,4.25),roof,1.18,2.83,0).rotation.z=.61;
  // Exposed timber keeps the procedural house in the same chunky, illustrated language as the trees.
  for(const x of [-2.17,0,2.17])add(house,new T.BoxGeometry(.13,2.28,.09),wood,x,1.36,1.79);
  add(house,new T.BoxGeometry(4.52,.13,.09),wood,0,.38,1.79);
  add(house,new T.BoxGeometry(4.52,.13,.09),wood,0,2.42,1.79);
  add(house,new T.BoxGeometry(1.08,1.55,.08),woodDark,0,1.02,1.77,'cat-cottage-door');
  const doorGlow=material('#f2d69b',{emissive:'#ffbd65'});glowMaterials.push(doorGlow);
  add(house,new T.BoxGeometry(.62,.66,.055),doorGlow,0,1.38,1.825);
  for(const side of [-1,1]){
    add(house,new T.BoxGeometry(.92,.78,.06),doorGlow,side*1.48,1.52,1.79);
    add(house,new T.BoxGeometry(.07,.82,.08),wood,side*1.48,1.52,1.84);
    add(house,new T.BoxGeometry(.96,.07,.08),wood,side*1.48,1.52,1.84);
  }
  // The side window is visible in the default portrait camera.
  add(house,new T.BoxGeometry(.06,.92,1.18),doorGlow,2.38,1.48,-.25);
  add(house,new T.BoxGeometry(.09,1.0,.08),wood,2.42,1.48,-.25);
  add(house,new T.BoxGeometry(.09,.08,1.26),wood,2.42,1.48,-.25);
  add(house,new T.BoxGeometry(.48,1.15,.48),woodDark,-1.35,3.25,-.45,'cat-cottage-chimney');
  add(house,new T.BoxGeometry(5.0,.12,.72),woodLight,0,.42,2.03);
  for(const x of [-2.18,2.18])add(house,new T.CylinderGeometry(.06,.07,.66,7),wood,x,.72,2.24);
  const sign=add(house,new T.BoxGeometry(1.55,.42,.08),woodLight,0,2.34,1.86,'cat-cottage-sign');
  sign.rotation.z=-.025;
  // Paw mark, deliberately icon-like rather than text that would blur in 3D.
  const paw=material('#75614e');
  add(house,new T.SphereGeometry(.11,10,7),paw,0,2.32,1.92).scale.set(1.25,.9,.35);
  for(const x of [-.18,-.06,.08,.20])add(house,new T.SphereGeometry(.045,8,6),paw,x,2.47-Math.abs(x)*.2,1.92).scale.set(1,.9,.3);
  const flowerBox=add(house,new T.BoxGeometry(1.25,.22,.28),woodLight,1.48,.96,1.92);
  for(const x of [-.42,-.14,.15,.42]){
    const bloom=add(house,new T.SphereGeometry(.11,7,5),x<0?cushion:linen,1.48+x,1.18,2.0);bloom.scale.y=.72;
  }

  // Pond-side reading bench: one recognisable lived-in vignette, not decoration everywhere.
  const bench=new T.Group();bench.name='pond-resting-corner';
  const bx=4.7,bz=-5.9;bench.position.set(bx,world.groundHeight(bx,bz),bz);bench.rotation.y=-.42;root.add(bench);
  add(bench,new T.BoxGeometry(2.55,.18,.72),woodLight,0,.63,0);
  add(bench,new T.BoxGeometry(2.55,.85,.14),wood,0,1.03,-.32).rotation.x=-.12;
  for(const x of [-1.02,1.02])for(const z of [-.24,.24])add(bench,new T.CylinderGeometry(.055,.07,.62,7),woodDark,x,.31,z);
  add(bench,new T.BoxGeometry(.74,.17,.52),cushion,-.55,.80,-.02).rotation.y=.06;
  const blanket=add(bench,new T.BoxGeometry(.62,.045,.78),linen,.52,.77,.11);blanket.rotation.y=-.14;blanket.rotation.z=.035;

  // South entrance: a flowered timber arch makes the large map feel intentional from its first step.
  const entrance=new T.Group();entrance.name='garden-entrance-arch';
  const ex=world.pathX?.(15)??5,ez=15;entrance.position.set(ex,world.groundHeight(ex,ez),ez);root.add(entrance);
  for(const x of [-1.55,1.55]){
    add(entrance,new T.CylinderGeometry(.11,.15,2.9,8),wood,x,1.45,0);
    add(entrance,new T.CylinderGeometry(.19,.21,.22,8),stone,x,.11,0);
  }
  add(entrance,new T.BoxGeometry(3.6,.22,.30),woodLight,0,2.72,0);
  add(entrance,new T.BoxGeometry(3.0,.12,.22),wood,0,3.02,0).rotation.z=.025;
  for(const x of [-1.35,-.85,-.35,.2,.72,1.24]){
    const leaf=add(entrance,new T.SphereGeometry(.25,7,5),x%1>.4?linen:roof,x,2.83+Math.sin(x*3)*.13,.05);leaf.scale.set(1.15,.65,.7);
  }
  makeLantern(ex-1.95,ez-.25,.66,false);makeLantern(ex+1.95,ez-.25,.66,false);

  // East flower hill: an open hexagonal pavilion stays airy among the existing flower beds.
  const pavilion=new T.Group();pavilion.name='flower-hill-pavilion';
  const px=17,pz=-8.5;pavilion.position.set(px,world.groundHeight(px,pz),pz);root.add(pavilion);
  add(pavilion,new T.CylinderGeometry(2.5,2.7,.26,10),stone,0,.13,0);
  for(let i=0;i<6;i++){
    const a=i/6*Math.PI*2,x=Math.sin(a)*2,z=Math.cos(a)*2;
    add(pavilion,new T.CylinderGeometry(.075,.10,2.7,7),wood,x,1.48,z);
  }
  add(pavilion,new T.CylinderGeometry(.35,2.75,1.25,6),roof,0,3.22,0).rotation.y=Math.PI/6;
  add(pavilion,new T.CylinderGeometry(.10,.13,.45,8),woodDark,0,4.03,0);
  add(pavilion,new T.SphereGeometry(.16,8,6),glow,0,2.52,0);
  const table=add(pavilion,new T.CylinderGeometry(.72,.78,.12,12),woodLight,0,.82,0);
  add(pavilion,new T.CylinderGeometry(.12,.16,.72,8),woodDark,0,.42,0);
  for(const a of [0,Math.PI*2/3,Math.PI*4/3]){
    const seat=add(pavilion,new T.BoxGeometry(.72,.14,.38),woodLight,Math.sin(a)*1.25,.55,Math.cos(a)*1.25);seat.rotation.y=a;
  }

  // West secret grove: stump seats, mushrooms and fireflies form a quieter discovery zone.
  const grove=new T.Group();grove.name='firefly-grove';
  const gx=-22,gz=4;grove.position.set(gx,world.groundHeight(gx,gz),gz);root.add(grove);
  for(let i=0;i<7;i++){
    const a=i/7*Math.PI*2,r=2.0+(i%2)*.28;
    const stump=add(grove,new T.CylinderGeometry(.38,.48,.46,9),woodDark,Math.sin(a)*r,.23,Math.cos(a)*r);
    add(grove,new T.CylinderGeometry(.36,.36,.045,12),woodLight,stump.position.x,.48,stump.position.z);
  }
  for(let i=0;i<18;i++){
    const a=i*2.399,r=.7+(i%6)*.48,x=Math.sin(a)*r,z=Math.cos(a)*r;
    add(grove,new T.CylinderGeometry(.025,.04,.20+(i%3)*.06,6),linen,x,.11,z);
    const cap=add(grove,new T.ConeGeometry(.13+(i%2)*.035,.12,7),i%3?cushion:roof,x,.27+(i%3)*.03,z);cap.rotation.x=Math.PI;
  }

  // A quiet patch of pale flowers; the oversized stone ring has been removed.
  const moonGarden=new T.Group();moonGarden.name='moon-garden';
  const mx=1,mz=-31;moonGarden.position.set(mx,world.groundHeight(mx,mz),mz);root.add(moonGarden);
  for(let i=0;i<11;i++){
    const a=i/11*Math.PI*2,r=3.2+(i%2)*.55;
    const flower=add(moonGarden,new T.SphereGeometry(.13,7,5),linen,Math.sin(a)*r,.35+(i%3)*.08,Math.cos(a)*r);flower.scale.set(1,.52,1);
  }

  // Distributed lived-in vignettes fill the broad lawn without introducing more buildings.
  const teaNook=new T.Group();teaNook.name='meadow-tea-nook';
  const tx=-15,tz=12;teaNook.position.set(tx,world.groundHeight(tx,tz),tz);teaNook.rotation.y=.18;root.add(teaNook);
  const rug=add(teaNook,new T.BoxGeometry(3.2,.035,2.2),cushion,0,.025,0);rug.rotation.y=.08;
  add(teaNook,new T.CylinderGeometry(.62,.72,.34,10),woodLight,0,.19,0);
  add(teaNook,new T.CylinderGeometry(.14,.18,.24,10),linen,-.22,.48,.02);
  add(teaNook,new T.TorusGeometry(.10,.025,5,10,Math.PI*1.45),wood,-.05,.51,.04).rotation.x=Math.PI/2;
  for(const [x,z,a]of [[-1.0,.50,.1],[.95,.45,-.1],[-.72,-.65,-.05],[.72,-.62,.08]]){
    const pillow=add(teaNook,new T.BoxGeometry(.68,.16,.55),x<0?linen:cushion,x,.13,z);pillow.rotation.y=a;
  }
  makeLantern(tx-1.9,tz+.5,.55,false);makeLantern(tx+1.8,tz-.4,.55,false);

  const birdBath=new T.Group();birdBath.name='bird-bath-garden';
  const qx=14,qz=12;birdBath.position.set(qx,world.groundHeight(qx,qz),qz);root.add(birdBath);
  add(birdBath,new T.CylinderGeometry(.34,.48,.72,10),stone,0,.36,0);
  add(birdBath,new T.CylinderGeometry(1.12,.72,.22,14),stone,0,.78,0);
  const bathWater=material('#789f9b',{roughness:.45});
  add(birdBath,new T.CylinderGeometry(.91,.91,.035,16),bathWater,0,.91,0);
  for(let i=0;i<9;i++){
    const a=i/9*Math.PI*2,r=1.6+(i%2)*.38;
    const bloom=add(birdBath,new T.SphereGeometry(.14,7,5),i%2?linen:cushion,Math.sin(a)*r,.28+(i%3)*.04,Math.cos(a)*r);bloom.scale.set(1,.55,1);
  }
  makeLantern(qx-2.1,qz-.6,.58,false);

  const swing=new T.Group();swing.name='woodland-swing';
  const sx=25,sz=5;swing.position.set(sx,world.groundHeight(sx,sz),sz);root.add(swing);
  for(const x of [-1.45,1.45]){
    const leg=add(swing,new T.CylinderGeometry(.09,.13,3.5,8),wood,x,1.65,0);leg.rotation.z=x<0?-.18:.18;
  }
  add(swing,new T.CylinderGeometry(.11,.13,3.35,8),wood,0,3.14,0).rotation.z=Math.PI/2;
  for(const x of [-.72,.72])add(swing,new T.CylinderGeometry(.018,.018,2.0,5),linen,x,2.05,0);
  add(swing,new T.BoxGeometry(1.75,.16,.55),woodLight,0,1.07,0);
  makeLantern(sx-2.0,sz+.8,.60,false);makeLantern(sx+2.0,sz+.8,.60,false);

  const well=new T.Group();well.name='woodland-wishing-well';
  const wx=-21,wz=-18;well.position.set(wx,world.groundHeight(wx,wz),wz);root.add(well);
  for(let i=0;i<14;i++){
    const a=i/14*Math.PI*2;
    const block=add(well,new T.BoxGeometry(.72,.42,.34),stone,Math.sin(a)*1.05,.25,Math.cos(a)*1.05);block.rotation.y=a;
  }
  for(const x of [-1.18,1.18])add(well,new T.CylinderGeometry(.08,.11,2.55,8),wood,x,1.48,0);
  add(well,new T.BoxGeometry(2.8,.16,.24),woodLight,0,2.64,0);
  const wellRoof=add(well,new T.CylinderGeometry(.18,1.85,.72,4),roof,0,3.02,0);wellRoof.rotation.y=Math.PI/4;
  add(well,new T.CylinderGeometry(.07,.07,2.25,8),woodDark,0,1.55,0).rotation.z=Math.PI/2;
  makeLantern(wx+2.0,wz+1.2,.62,false);

  // Taller accents and low fences make the midground readable from the default overview.
  const birdhouses=[[-17,6,.25],[-8,15,-.35],[12,7,.18],[21,-4,-.2],[-14,-18,.4]];
  birdhouses.forEach(args=>makeBirdhouse(...args));
  [[-18,-1,.9],[13,-4,.85],[19,9,.75],[-7,-16,.8],[24,-13,.85]].forEach(args=>makeCairn(...args));
  const fenceLines=[[-18,9,5.5,.05],[11,16,6,-.08],[21,-16,5.5,.15],[-16,-23,5,-.12]];
  for(const[cx,cz,length,angle]of fenceLines){
    const fence=new T.Group();fence.name='garden-low-fence';fence.position.set(cx,world.groundHeight(cx,cz),cz);fence.rotation.y=angle;root.add(fence);
    const posts=Math.floor(length/1.15)+1;
    for(let i=0;i<posts;i++){
      const x=-length/2+i*(length/(posts-1));add(fence,new T.CylinderGeometry(.045,.06,.72,7),woodDark,x,.36,0);
    }
    for(const y of [.28,.57])add(fence,new T.BoxGeometry(length,.075,.09),woodLight,0,y,0);
  }

  // Two lightweight point clouds animate distant zones without extra draw calls per firefly.
  const fireflyPositions=[],fireflyOrigins=[];
  const fireflyCount=quality==='high'?54:quality==='mid'?32:16;
  for(let i=0;i<fireflyCount;i++){
    const atMoon=i%3===0,cx=atMoon?mx:gx,cz=atMoon?mz:gz,a=i*2.399,r=.7+(i%9)*.43;
    const point=new T.Vector3(cx+Math.sin(a)*r,.45+(i%7)*.24,cz+Math.cos(a)*r);fireflyOrigins.push(point.clone());fireflyPositions.push(point.x,point.y,point.z);
  }
  const fireflyGeometry=new T.BufferGeometry();fireflyGeometry.setAttribute('position',new T.Float32BufferAttribute(fireflyPositions,3));
  const fireflyMaterial=new T.PointsMaterial({color:'#eef1a1',size:quality==='high'?.16:.20,transparent:true,opacity:0,depthWrite:false,blending:T.AdditiveBlending});
  const fireflies=new T.Points(fireflyGeometry,fireflyMaterial);fireflies.name='garden-fireflies';fireflies.frustumCulled=false;root.add(fireflies);

  world.walkObstacles?.push(
    {x:hx,z:hz,radius:3.45},{x:bx,z:bz,radius:1.5},
    {x:px,z:pz,radius:2.65},{x:gx,z:gz,radius:2.7},
    {x:tx,z:tz,radius:2.0},{x:qx,z:qz,radius:1.2},{x:sx,z:sz,radius:2.0},{x:wx,z:wz,radius:1.7}
  );

  // Lanterns trace the existing path and bridge without changing navigation.
  [[5.2,3.5],[-10.0,-12.1]].forEach(([x,z])=>makeLantern(x,z,.62,true));
  // A loose ring of warm markers connects the outer map instead of concentrating light at the pond.
  // Keep the distant lawn open instead of outlining the entire map with lamps.

  // Small forest-floor details reuse the shipped plant assets and remain batched.
  const plant=(name,x,z,height,angle=0)=>world.place?.(name,x,z,height,angle);
  [[-9.3,-11.0],[-14.2,-10.8],[-14.8,-14.8],[-9.3,-15.2]].forEach(([x,z],i)=>plant(i%2?'Bush_Common_Flowers':'Grass_Wispy_Tall',x,z,.65+i*.08,i*.8));
  [[3.7,-6.9],[5.7,-7.2],[6.1,-4.8],[-7.3,-7.6]].forEach(([x,z],i)=>plant(i%2?'Flower_3_Group':'Flower_4_Group',x,z,.52+i*.04,i));
  [[-10.0,-10.5],[-14.0,-11.6],[3.7,-6.0]].forEach(([x,z],i)=>plant(i%2?'Rock_Medium_1':'Rock_Medium_3',x,z,.32+i*.08,i));
  // Each district receives its own underplanting rhythm; the central lawn and paths stay clear.
  const zonePlants=[
    [px,pz,6,'Flower_4_Group'],[px,pz,5,'Grass_Wispy_Tall'],
    [gx,gz,8,'Grass_Common_Tall'],[gx,gz,5,'Bush_Common_Flowers'],
    [mx,mz,8,'Flower_3_Group'],[mx,mz,7,'Grass_Wispy_Tall'],
    [ex,ez,6,'Bush_Common_Flowers']
  ];
  for(const[cx,cz,count,name]of zonePlants)for(let i=0;i<count;i++){
    const a=i*2.399+(cx+cz)*.03,r=2.7+(i%4)*.72,x=cx+Math.sin(a)*r,z=cz+Math.cos(a)*r;
    plant(name,x,z,name.startsWith('Flower')?.45+(i%3)*.08:.48+(i%4)*.09,a);
  }
  // Wide, uneven planting islands break up the remaining empty lawn while preserving traversable gaps.
  const landscapePatches=[[-25,14],[-16,18],[-5,20],[10,20],[23,15],[28,2],[25,-15],[14,-24],[-4,-25],[-18,-24],[-28,-10],[-29,5]];
  for(let p=0;p<landscapePatches.length;p++){
    const[cx,cz]=landscapePatches[p],count=quality==='high'?12:quality==='mid'?8:5;
    for(let i=0;i<count;i++){
      const a=i*2.399+p*.67,r=.65+(i%5)*.58,x=cx+Math.sin(a)*r,z=cz+Math.cos(a)*r;
      if(world.clearForScenery&&!world.clearForScenery(x,z,.34))continue;
      const names=['Grass_Common_Tall','Grass_Wispy_Tall','Bush_Common_Flowers','Flower_3_Group','Flower_4_Group'];
      const name=names[(p+i)%names.length],flower=name.startsWith('Flower');
      plant(name,x,z,flower?.38+(i%3)*.07:.42+(i%4)*.10,a);
    }
    if(p%2===0)plant(p%4?'Rock_Medium_1':'Rock_Medium_3',cx+.7,cz-.4,.32+(p%3)*.07,p);
  }
  // Denser midground ribbons are visible from home and visually connect the remote scenes.
  const visiblePatches=[[-18,3],[-14,-4],[-10,12],[0,16],[10,13],[17,5],[19,-3],[12,-14],[1,-18],[-11,-19]];
  for(let p=0;p<visiblePatches.length;p++){
    const[cx,cz]=visiblePatches[p],count=quality==='high'?18:quality==='mid'?12:7;
    for(let i=0;i<count;i++){
      const a=i*2.399+p*.41,r=.45+(i%6)*.46,x=cx+Math.sin(a)*r,z=cz+Math.cos(a)*r;
      if(world.clearForScenery&&!world.clearForScenery(x,z,.28))continue;
      const name=i%5===0?'Bush_Common_Flowers':i%3===0?'Flower_3_Group':i%3===1?'Flower_4_Group':'Grass_Wispy_Tall';
      plant(name,x,z,name.startsWith('Flower')?.40+(i%4)*.06:.38+(i%5)*.08,a);
    }
  }

  return {
    root,house,bench,entrance,pavilion,grove,moonGarden,teaNook,birdBath,swing,well,fireflies,lamps,
    update(time=0,night=0){
      const dusk=clamp((night-.12)/.62),pulse=.94+Math.sin(time*1.25)*.035;
      glowMaterials.forEach((m,i)=>{m.emissiveIntensity=dusk*(i?1.35:1.7)*pulse});
      haloMaterial.opacity=dusk*.16*pulse;
      lamps.forEach((light,i)=>{light.intensity=dusk*(i?1.15:1.35)*pulse});
      fireflyMaterial.opacity=dusk*.78;
      const positions=fireflyGeometry.attributes.position;
      for(let i=0;i<fireflyOrigins.length;i++){
        const p=fireflyOrigins[i],phase=time*(.22+(i%5)*.035)+i*.73;
        positions.setXYZ(i,p.x+Math.sin(phase)*.28,p.y+Math.sin(phase*1.7)*.18,p.z+Math.cos(phase*.83)*.24);
      }
      positions.needsUpdate=true;
    }
  };
}
