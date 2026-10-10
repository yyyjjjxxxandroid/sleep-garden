import * as T from './vendor/three/build/three.module.js';
import { mergeGeometries } from './vendor/three/examples/jsm/utils/BufferGeometryUtils.js';

import { flowerCluster, crownGeometry as canopyGeometry, grassTuftGeometry, stoneGeometry, shrubGeometry } from './garden-botany.js';

export function sculptTrees(world){
  const barkCanvas=document.createElement('canvas');barkCanvas.width=128;barkCanvas.height=256;
  const ctx=barkCanvas.getContext('2d');ctx.fillStyle='#dbc6a7';ctx.fillRect(0,0,128,256);
  for(let i=0;i<16;i++){
    ctx.strokeStyle=i%2?'#84634b30':'#fff1d340';ctx.lineWidth=2+i%3;
    ctx.beginPath();for(let j=0;j<=16;j++){const x=i*8+Math.sin(j*.3+i)*3,y=j*16;j?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.stroke();
  }
  const bark=new T.CanvasTexture(barkCanvas);bark.colorSpace=T.SRGBColorSpace;
  ['CommonTree_1','CommonTree_2','CommonTree_3','CommonTree_5'].forEach((name,v)=>{
    if(!world.models[name])return;
    const root=new T.Group(),trunkMat=new T.MeshStandardMaterial({color:'#b6a185',map:bark,roughness:.92});
    const trunkGeo=new T.CylinderGeometry(.12,.29,2.8,28,16),p=trunkGeo.attributes.position;
    for(let i=0;i<p.count;i++){
      const y=p.getY(i)+1.4,flare=Math.pow(Math.max(0,1-y/.8),2);
      p.setXYZ(i,p.getX(i)*(1+flare*.30)+Math.sin(y*.75+v)*.07,y,p.getZ(i)*(1+flare*.30));
    }
    trunkGeo.computeVertexNormals();const trunk=new T.Mesh(trunkGeo,trunkMat);trunk.castShadow=trunk.receiveShadow=true;root.add(trunk);
    for(const side of [-1,1]){
      const path=new T.CatmullRomCurve3([new T.Vector3(0,1.4,0),new T.Vector3(side*.22,2.1,.03),new T.Vector3(side*.64,2.75,.06)]);
      const branchGeo=new T.TubeGeometry(path,18,.105,10,false),vertices=branchGeo.attributes.position;
      for(let i=0;i<vertices.count;i++){const t=Math.floor(i/11)/18,c=path.getPointAt(t),point=new T.Vector3().fromBufferAttribute(vertices,i).sub(c).multiplyScalar(1-t*.55).add(c);vertices.setXYZ(i,point.x,point.y,point.z)}branchGeo.computeVertexNormals();
      const b=new T.Mesh(branchGeo,trunkMat);b.rotation.y=v*.41+side*.18;b.castShadow=true;root.add(b);
    }
    const geo=canopyGeometry(v);geo.scale(v===1?1.95:1.75+(v%2)*.12,v===1?1.05:v===2?1.65:1.37,1.65);geo.translate(0,v===1?3.45:3.40,0);
    // A willow has a continuous dome and tapered leaf curtains, not another
    // copy of the round orchard tree. Merge the curtains into one wind surface.
    let crownGeo=geo;
    if(v===1){
      const parts=[geo];
      const leafShape=new T.Shape();leafShape.moveTo(0,.015);leafShape.quadraticCurveTo(-.035,-.08,-.016,-.19);leafShape.lineTo(0,-.28);leafShape.quadraticCurveTo(.048,-.12,0,.015);
      const tint=(g,c)=>{const colors=[];for(let k=0;k<g.attributes.position.count;k++)colors.push(c.r,c.g,c.b);g.setAttribute('color',new T.Float32BufferAttribute(colors,3));return g};
      for(let i=0;i<28;i++){
        const a=i/28*Math.PI*2+.06*Math.sin(i*2.7),r=1.36+.20*Math.sin(i*2.4),length=1.25+.55*Math.sin(i*1.7);
        const path=new T.CatmullRomCurve3([new T.Vector3(Math.cos(a)*r,3.52,Math.sin(a)*r*.80),new T.Vector3(Math.cos(a)*(r+.25),3.0,Math.sin(a)*(r+.25)*.80),new T.Vector3(Math.cos(a)*(r+.12),3.52-length,Math.sin(a)*(r+.12)*.80)]);
        parts.push(tint(new T.TubeGeometry(path,12,.007,3,false),new T.Color('#82946a')));
        for(let j=0;j<9;j++)for(const side of [-1,1]){
          const t=.10+j*.095,c=path.getPoint(t),leaf=new T.ShapeGeometry(leafShape,5),scale=(1-t*.5)*(.85+.10*Math.sin(i));
          leaf.scale(scale,scale,scale);leaf.rotateY(a+side*.65);leaf.rotateZ(side*.20);leaf.translate(c.x+Math.cos(a)*side*.045,c.y,c.z+Math.sin(a)*side*.045);
          const col=new T.Color('#9db980').lerp(new T.Color('#759366'),t*.5),colors=[];for(let k=0;k<leaf.attributes.position.count;k++)colors.push(col.r,col.g,col.b);
          leaf.setAttribute('color',new T.Float32BufferAttribute(colors,3));parts.push(leaf);
        }
      }
      crownGeo=mergeGeometries(parts);parts.forEach(g=>g.dispose());
    }
    const mat=world.windMaterial(new T.MeshStandardMaterial({vertexColors:true,roughness:1,side:T.DoubleSide}),5,0,.055);
    const crown=new T.Mesh(crownGeo,mat);crown.castShadow=crown.receiveShadow=true;
    crown.customDepthMaterial=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking});
    crown.customDepthMaterial.onBeforeCompile=mat.userData.windPatch;crown.customDepthMaterial.customProgramCacheKey=mat.customProgramCacheKey;
    root.add(crown);world.models[name].scene=root;
  });
  for(const [name,v]of [['Grass_Common_Tall',0],['Grass_Wispy_Tall',1]]){
    if(!world.models[name])continue;const root=new T.Group(),g=grassTuftGeometry(v);
    const mesh=new T.Mesh(g,world.windMaterial(new T.MeshStandardMaterial({vertexColors:true,roughness:1,side:T.DoubleSide}),1,0,.06));mesh.receiveShadow=true;root.add(mesh);world.models[name].scene=root;
  }
  ['Rock_Medium_1','Rock_Medium_3'].forEach((name,v)=>{
    const root=new T.Group(),mesh=new T.Mesh(stoneGeometry(v),new T.MeshStandardMaterial({vertexColors:true,roughness:1}));mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);world.models[name].scene=root;
  });
  // Irregular small groups, curved stems, thin cupped petals and basal leaves.
  for(const [name,v]of [['Flower_3_Group',0],['Flower_4_Group',1]])world.models[name].scene=flowerCluster(v);
  const bush=new T.Group(),shrub=shrubGeometry();
  const bm=world.windMaterial(new T.MeshStandardMaterial({vertexColors:true,roughness:1,side:T.DoubleSide}),.7,0,.025);
  const leaves=new T.Mesh(shrub.leaves,bm),stems=new T.Mesh(shrub.stems,new T.MeshStandardMaterial({color:'#84715c',roughness:1}));
  leaves.castShadow=leaves.receiveShadow=stems.castShadow=stems.receiveShadow=true;bush.add(leaves,stems);world.models.Bush_Common_Flowers.scene=bush;
}

export function installGardenCraft(world){
  const root=new T.Group();world.scene.add(root);
  const wood=new T.MeshStandardMaterial({color:'#b69770',map:woodGrain(),roughness:.89});
  const edge=new T.MeshStandardMaterial({color:'#78644e',roughness:.92});
  const ceramic=new T.MeshStandardMaterial({color:'#e5d6b7',roughness:.82});
  const glass=new T.MeshStandardMaterial({color:'#fff0cb',emissive:'#ffc66f',emissiveIntensity:.08,roughness:.5});
  const mesh=(geometry,material,parent,x,y,z)=>{const o=new T.Mesh(geometry,material);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;parent.add(o);return o};
  const bench=new T.Group();bench.position.set(2.7,world.groundHeight(2.7,-2.8),-2.8);bench.rotation.y=-.38;root.add(bench);
  // Soft bevelled slats keep the seat legible without razor-thin edges.
  const slat=(w,h,d)=>{const shape=new T.Shape(),r=.045;shape.moveTo(-w/2+r,-h/2);shape.lineTo(w/2-r,-h/2);shape.quadraticCurveTo(w/2,-h/2,w/2,-h/2+r);shape.lineTo(w/2,h/2-r);shape.quadraticCurveTo(w/2,h/2,w/2-r,h/2);shape.lineTo(-w/2+r,h/2);shape.quadraticCurveTo(-w/2,h/2,-w/2,h/2-r);shape.lineTo(-w/2,-h/2+r);shape.quadraticCurveTo(-w/2,-h/2,-w/2+r,-h/2);const g=new T.ExtrudeGeometry(shape,{depth:d-.04,bevelEnabled:true,bevelSize:.02,bevelThickness:.02,bevelSegments:2,steps:1});g.translate(0,0,-d/2+.02);return g};
  for(let i=0;i<4;i++)mesh(slat(2.7,.13,.22),wood,bench,0,.62,(i-1.5)*.24);
  for(let i=0;i<3;i++)mesh(slat(2.7,.20,.13),wood,bench,0,.97+i*.24,-.51);
  for(const side of [-1,1]){mesh(new T.BoxGeometry(.13,.64,.76),edge,bench,side*.96,.3,0);mesh(new T.BoxGeometry(.12,1.4,.12),edge,bench,side*.96,.70,-.51)}
  // Small joinery and a folded linen cushion give the listening corner a scale.
  const metal=new T.MeshStandardMaterial({color:'#776d59',roughness:.8});
  for(const side of [-1,1])for(let i=0;i<3;i++)mesh(new T.SphereGeometry(.026,8,6),metal,bench,side*.96,.97+i*.24,-.435);
  const cloth=new T.MeshStandardMaterial({color:'#cbd1ad',roughness:1});
  const cushion=mesh(slat(.70,.12,.61),cloth,bench,.58,.74,.03);cushion.rotation.y=.12;
  // The listening object belongs in the world: a little wooden radio, not a
  // floating action label. Its meshes remain pickable after scenery batching.
  const table=new T.Group();table.position.set(2.15,world.groundHeight(2.15,-.8),-.8);table.rotation.y=-.15;root.add(table);
  mesh(slat(1.22,.12,.72),wood,table,0,.58,0);
  for(const side of [-1,1])mesh(new T.BoxGeometry(.085,.54,.52),edge,table,side*.43,.28,0);
  const radio=new T.Group();radio.position.set(0,.66,0);table.add(radio);
  const caseMat=new T.MeshStandardMaterial({color:'#769994',roughness:.91});
  const panelMat=new T.MeshStandardMaterial({color:'#e9d9b4',roughness:.97});
  const grillMat=new T.MeshStandardMaterial({color:'#67746a',roughness:.95});
  mesh(slat(1.00,.56,.30),caseMat,radio,0,.29,0);
  mesh(slat(.84,.41,.025),panelMat,radio,0,.29,.162);
  const speakerParts=[];
  for(let i=0;i<9;i++){const g=new T.CylinderGeometry(.012,.012,.28,5);g.rotateZ(Math.PI/2);g.translate(-.18,.15+i*.032,.183);speakerParts.push(g)}
  const speaker=new T.Mesh(mergeGeometries(speakerParts),grillMat);speakerParts.forEach(g=>g.dispose());radio.add(speaker);
  mesh(new T.CylinderGeometry(.073,.073,.048,16),wood,radio,.26,.23,.196).rotation.x=Math.PI/2;
  mesh(slat(.21,.06,.015),edge,radio,.23,.39,.183);
  const handle=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3([new T.Vector3(-.25,.56,0),new T.Vector3(-.20,.73,0),new T.Vector3(.20,.73,0),new T.Vector3(.25,.56,0)]),16,.025,6,false),edge);radio.add(handle);
  radio.traverse(o=>{if(o.isMesh){o.userData.soundControl=true;o.castShadow=o.receiveShadow=true}});
  const powerMaterial=new T.MeshStandardMaterial({color:'#d9c58f',emissive:'#e3c17a',emissiveIntensity:0,roughness:1});
  const power=mesh(new T.SphereGeometry(.020,10,8),powerMaterial,radio,.335,.39,.195);power.userData.soundControl=true;
  const lanterns=[];
  for(const[x,z]of [[-7.2,-.4],[4.0,1.3],[-4.3,-12.9]]){
    const g=new T.Group();g.position.set(x,world.groundHeight(x,z),z);root.add(g);
    mesh(new T.CylinderGeometry(.27,.32,.13,16),ceramic,g,0,.065,0);
    mesh(new T.CylinderGeometry(.11,.16,.50,12),edge,g,0,.38,0);
    mesh(new T.CylinderGeometry(.27,.27,.43,12),glass,g,0,.84,0);
    mesh(new T.ConeGeometry(.40,.25,12),edge,g,0,1.18,0);
    for(let i=0;i<4;i++)mesh(new T.BoxGeometry(.04,.47,.04),edge,g,Math.cos(i*Math.PI/2)*.26,.84,Math.sin(i*Math.PI/2)*.26);
    const halo=new T.Mesh(new T.CircleGeometry(1.45,24),new T.MeshBasicMaterial({color:'#f5d5a1',transparent:true,opacity:0,depthWrite:false}));halo.rotation.x=-Math.PI/2;halo.position.y=.025;g.add(halo);lanterns.push(halo);
  }
  root.updateMatrixWorld(true);const buckets=new Map();root.traverse(o=>{if(!o.isMesh||o.material.transparent||o.userData.soundControl)return;if(!buckets.has(o.material))buckets.set(o.material,[]);buckets.get(o.material).push(o.geometry.clone().applyMatrix4(o.matrixWorld));o.visible=false});
  for(const[m,gs]of buckets){const o=new T.Mesh(mergeGeometries(gs),m);o.castShadow=o.receiveShadow=true;world.scene.add(o);gs.forEach(g=>g.dispose())}
  return {radio,update(night,listening=false){powerMaterial.emissiveIntensity=listening?.8:0;glass.emissiveIntensity=.08+night*1.7;lanterns.forEach(h=>h.material.opacity=night*.07)}};
}

export function woodGrain(){
  const c=document.createElement('canvas');c.width=512;c.height=128;const x=c.getContext('2d');x.fillStyle='#f5e5c7';x.fillRect(0,0,512,128);
  for(let i=0;i<28;i++){
    x.strokeStyle=i%3?'#8f6d4d25':'#fff7de60';x.lineWidth=i%4===0?1.6:.8;x.beginPath();
    for(let j=0;j<=64;j++){const px=j*8,y=i*4.4+Math.sin(j*.14+i)*1.8+Math.sin(j*.05+i*3)*.9;j?x.lineTo(px,y):x.moveTo(px,y)}x.stroke();
  }
  const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;tex.wrapS=tex.wrapT=T.RepeatWrapping;return tex;
}

// Shore plants grow in a few authored groups, leaving the cat's path and
// the open water clear. The geometry shares the bank's world coordinates.
export function installShoreLife(w){
  const greens=[],heads=[],leafParts=[],dirt=[],reedColor=new T.Color('#769167');
  for(const[a,count]of [[2.5,8],[3.85,9],[5.1,7]])for(let i=0;i<count;i++){
    const angle=a+i*.043,r=(1+.055*Math.sin(angle*3)+.038*Math.cos(angle*5))*1.13;
    const x=-2.3+Math.cos(angle)*3.8*r,z=-2.5+Math.sin(angle)*2.8*r,y=w.groundHeight(x,z)+.02,h=.47+(i%4)*.10;
    const stem=new T.CylinderGeometry(.017,.022,h,6);stem.translate(x,y+h/2,z);greens.push(stem);
    if(i%3===0){const g=new T.CapsuleGeometry(.043,.19,3,8);g.translate(x,y+h+.055,z);heads.push(g)}
    for(let j=0;j<3;j++){
      const b=angle+j*2.1,tip=.25+(i%3)*.06;
      const p=[new T.Vector3(x,y,z),new T.Vector3(x+Math.cos(b)*tip*.55,y+h*.64,z+Math.sin(b)*tip*.55),new T.Vector3(x+Math.cos(b)*tip,y+h*.51,z+Math.sin(b)*tip)];
      const path=new T.CatmullRomCurve3(p),g=new T.TubeGeometry(path,8,.026,4,false),pos=g.attributes.position;
      for(let k=0;k<pos.count;k++){const t=Math.floor(k/5)/8,c=path.getPointAt(t),v=new T.Vector3().fromBufferAttribute(pos,k).sub(c).multiplyScalar(1-t*.95).add(c);pos.setXYZ(k,v.x,v.y,v.z)}g.computeVertexNormals();leafParts.push(g);
    }
  }
  // Broad hosta leaves and low soil patches anchor the two hero tree roots.
  for(const[cx,cz]of [[-7.4,-6.4],[5.8,-8.8],[-6.1,.9]]){
    const y=w.groundHeight(cx,cz);
    const soil=new T.SphereGeometry(1,20,10);soil.scale(.73,.018,.58);soil.translate(cx,y+.012,cz);dirt.push(soil);
    for(let i=0;i<9;i++){
      const a=i*2.4,leaf=new T.SphereGeometry(1,12,8);leaf.scale(.10,.035,.33);leaf.rotateX(-.48);leaf.rotateY(a);leaf.translate(cx+Math.sin(a)*.26,y+.15+(i%3)*.035,cz+Math.cos(a)*.26);leafParts.push(leaf);
    }
  }
  for(const[parts,color,wind]of [[greens,reedColor,.04],[heads,'#87785d',.04],[leafParts,'#88a171',.06],[dirt,'#7b835c',0]]){
    if(!parts.length)continue;let mat=new T.MeshStandardMaterial({color,roughness:.94});if(wind)mat=w.windMaterial(mat,1,0,wind);
    const o=new T.Mesh(mergeGeometries(parts),mat);o.castShadow=o.receiveShadow=true;
    if(wind){o.customDepthMaterial=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking});o.customDepthMaterial.onBeforeCompile=mat.userData.windPatch;o.customDepthMaterial.customProgramCacheKey=mat.customProgramCacheKey}
    w.scene.add(o);parts.forEach(g=>g.dispose());
  }
}

export function installWoodlandRest(w){
  const root=new T.Group();root.position.set(-4,w.groundHeight(-4,-20),-20);root.rotation.y=-.25;
  const bark=new T.MeshStandardMaterial({color:'#8f7758',map:woodGrain(),roughness:1});
  const endMat=new T.MeshStandardMaterial({color:'#c1a77b',roughness:1});
  const moss=new T.MeshStandardMaterial({color:'#718951',roughness:1});
  const leaves=new T.MeshStandardMaterial({color:'#91ab73',roughness:1});
  const add=(g,m,x,y,z,rx=0,ry=0,rz=0)=>{const o=new T.Mesh(g,m);o.position.set(x,y,z);o.rotation.set(rx,ry,rz);root.add(o);return o};
  add(new T.CylinderGeometry(.27,.32,2.5,20),bark,0,.30,0,0,0,Math.PI/2);
  for(const side of [-1,1]){
    add(new T.CircleGeometry(.26,28),endMat,side*1.256,.30,0,0,side*Math.PI/2,0);
    for(const r of [.07,.14,.21])add(new T.TorusGeometry(r,.007,4,28),bark,side*1.26,.30,0,0,side*Math.PI/2,0);
  }
  for(let i=0;i<5;i++){const m=add(new T.SphereGeometry(1,16,10),moss,(i-2)*.39,.54,.01);m.scale.set(.29,.035,.20)}
  // Each fern frond is curved and its leaflets face upward. Bake the small
  // shapes once; the woodland adds four draw calls rather than hundreds.
  for(const[x,z,scale]of [[-1.6,-.5,1],[1.1,.65,.8],[-.4,.75,.65],[1.7,-.7,.72]])for(let i=0;i<7;i++){
    const a=i*2.4,pts=[new T.Vector3(x,0,z),new T.Vector3(x+Math.sin(a)*.26*scale,.60*scale,z+Math.cos(a)*.26*scale),new T.Vector3(x+Math.sin(a)*.67*scale,.46*scale,z+Math.cos(a)*.67*scale)],path=new T.CatmullRomCurve3(pts);
    add(new T.TubeGeometry(path,10,.012*scale,4,false),moss,0,0,0);
    for(let j=2;j<9;j++)for(const side of [-1,1]){
      const t=j/10,p=path.getPoint(t),size=Math.sin(t*Math.PI)*scale;
      const g=new T.SphereGeometry(1,8,6);g.scale(.095*size,.018*size,.15*size);
      add(g,leaves,p.x+Math.cos(a)*side*.07*size,p.y,p.z-Math.sin(a)*side*.07*size,.12,a+side*.85,0);
    }
  }
  root.updateMatrixWorld(true);const parts=new Map();
  root.traverse(o=>{if(!o.isMesh)return;if(!parts.has(o.material))parts.set(o.material,[]);parts.get(o.material).push(o.geometry.clone().applyMatrix4(o.matrixWorld));o.geometry.dispose()});
  for(const[material,geometries]of parts){const o=new T.Mesh(mergeGeometries(geometries),material);o.castShadow=o.receiveShadow=true;w.scene.add(o);geometries.forEach(g=>g.dispose())}
}

// Continuous soil-to-grass shoreline; inner edge follows the water silhouette.
export function installPondBank(w){
  const positions=[],colors=[],indices=[],segments=128,rows=6;
  const sand=new T.Color('#dbc6a0'),soil=new T.Color('#bbb28c'),grass=new T.Color('#85ac70');
  for(let j=0;j<=rows;j++)for(let i=0;i<=segments;i++){
    const a=i/segments*Math.PI*2,t=j/rows,shape=1+.055*Math.sin(a*3)+.038*Math.cos(a*5),r=shape*(.99+t*.20);
    const x=-2.3+Math.cos(a)*3.8*r,z=-2.5+Math.sin(a)*2.8*r;
    const outer=w.groundHeight(x,z)+.016,y=T.MathUtils.lerp(-.14,outer,T.MathUtils.smoothstep(t,0,.85))+.10*Math.sin(t*Math.PI);
    positions.push(x,y,z);const c=sand.clone().lerp(soil,Math.min(1,t*2)).lerp(grass,T.MathUtils.smoothstep(t,.45,1));colors.push(c.r,c.g,c.b);
    if(j<rows&&i<segments){const p=j*(segments+1)+i;indices.push(p,p+segments+1,p+1,p+1,p+segments+1,p+segments+2)}
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();
  const bank=new T.Mesh(g,new T.MeshStandardMaterial({vertexColors:true,roughness:1,side:T.DoubleSide}));bank.receiveShadow=true;w.scene.add(bank);
  // Stones are grouped into small resting points, leaving long stretches of soft bank.
  for(const[angle,count]of [[.4,4],[2.1,3],[3.4,5],[5.4,3]])for(let j=0;j<count;j++){
    const a=angle+j*.09,shape=1+.055*Math.sin(a*3)+.038*Math.cos(a*5),x=-2.3+Math.cos(a)*3.8*shape*1.08,z=-2.5+Math.sin(a)*2.8*shape*1.08;
    w.place(j%2?'Rock_Medium_1':'Rock_Medium_3',x,z,.19+(j%3)*.07,a,{lift:-.035,width:1.15});
  }
}
