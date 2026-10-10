import * as T from './vendor/three/build/three.module.js';
import { mergeGeometries, mergeVertices } from './vendor/three/examples/jsm/utils/BufferGeometryUtils.js';

// Thin cupped surfaces stay legible at grazing angles without sausage petals.
export function petalGeometry(rows=12,cols=8){
  const vertices=[],uv=[],index=[];
  for(let i=0;i<=rows;i++)for(let j=0;j<=cols;j++){
    const u=i/rows,v=j/cols*2-1,width=Math.sin(Math.PI*u)**.65*.34;
    vertices.push(u,.075*Math.sin(u*Math.PI)-.08*u+.32*u*u+.12*v*v*Math.sin(u*Math.PI),v*width);uv.push(u,j/cols);
    if(i<rows&&j<cols){const a=i*(cols+1)+j,b=a+cols+1;index.push(a,a+1,b,a+1,b+1,b)}
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(index);g.computeVertexNormals();return g;
}
export function flowerCluster(variant=0){
  const root=new T.Group(),parts=new Map(),dummy=new T.Object3D();root.name='meadow-flowers';
  const stem=new T.MeshStandardMaterial({color:'#839971',roughness:1,side:T.DoubleSide});
  const petal=new T.MeshPhysicalMaterial({color:variant?'#eee2c9':'#d8b6b1',roughness:1,sheen:.18,sheenColor:new T.Color('#fff3df'),side:T.DoubleSide});
  const pollen=new T.MeshStandardMaterial({color:'#bcaa77',roughness:1});
  function add(g,m,position,scale=[1,1,1],rotation=[0,0,0]){dummy.position.set(...position);dummy.scale.set(...scale);dummy.rotation.set(...rotation);dummy.updateMatrix();g.applyMatrix4(dummy.matrix);if(!parts.has(m))parts.set(m,[]);parts.get(m).push(g)}
  for(let i=0;i<3;i++){
    const a=i*2.399+variant*.7,r=.11+Math.sqrt(i)*.12,x=Math.cos(a)*r,z=Math.sin(a)*r,h=[.36,.54,.28,.44][(i+variant)%4],bend=Math.sin(i*2.3+variant)*.065;
    const path=new T.CatmullRomCurve3([new T.Vector3(x,0,z),new T.Vector3(x+bend*.3,h*.5,z+.02),new T.Vector3(x+bend,h,z+.035)]);
    add(new T.TubeGeometry(path,12,.0075,5,false),stem,[0,0,0]);
    for(let j=0;j<3;j++){const direction=a+j*2.4;add(petalGeometry(6,4),stem,[x,h*(.16+j*.15),z],[.15,.24,.18],[0,direction,-.25-j*.12])}
    const blossom=new T.Group();blossom.position.set(x+bend,h,z+.035);blossom.rotation.set(.18*Math.sin(a)+.12,0,.28*Math.cos(a));blossom.updateMatrix();
    const count=variant?7:6,flowerSize=.12+(i%3)*.015;
    for(let j=0;j<count;j++){
      const g=petalGeometry();dummy.position.set(0,0,0);dummy.scale.set(flowerSize,flowerSize,flowerSize);dummy.rotation.set(0,j/count*Math.PI*2+(i%2)*.3,0);dummy.updateMatrix();g.applyMatrix4(dummy.matrix).applyMatrix4(blossom.matrix);
      if(!parts.has(petal))parts.set(petal,[]);parts.get(petal).push(g);
    }
    const g=new T.SphereGeometry(1,16,10);g.scale(.032,.017,.032);g.applyMatrix4(blossom.matrix);if(!parts.has(pollen))parts.set(pollen,[]);parts.get(pollen).push(g);
    for(let j=0;j<3;j++)add(petalGeometry(6,4),stem,[x*.7,.015,z*.7],[.18,.27,.23],[0,a+j*2.1,-.35]);
  }
  for(const [material,geometries]of parts){const mesh=new T.Mesh(mergeGeometries(geometries),material);mesh.castShadow=mesh.receiveShadow=true;mesh.name=material===petal?'flower-petals':material===stem?'flower-foliage':'flower-centres';root.add(mesh);geometries.forEach(g=>g.dispose())}
  return root;
}

// A continuous surface wraps overlapping foliage masses. No flat decals on
// the surface: the broad silhouette and branch openings carry the detail.
export function crownGeometry(variant=0){
  const g=new T.SphereGeometry(1,48,32),p=g.attributes.position,colors=[];
  const lobes=[
    [0,.05,0,.67,.72,.67],[-.65,-.07,.13,.57,.53,.56],
    [.61,.04,.19,.60,.57,.52],[.08,.64,-.10,.50,.52,.49],
    [-.18,.17,-.64,.54,.58,.54],[-.08,-.16,.58,.50,.48,.54]
  ];
  const low=new T.Color('#69865b'),high=new T.Color(['#a4ba7b','#a2b77e','#94b389','#b0bd87'][variant%4]);
  const field=(x,y,z)=>{
    let sum=0;
    for(const [cx,cy,cz,rx,ry,rz]of lobes){const d=Math.hypot((x-cx)/rx,(y-cy)/ry,(z-cz)/rz)-1;sum+=Math.exp(-15*d)}
    return -Math.log(sum)/15;
  };
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i);let lo=0,hi=2.2;
    for(let j=0;j<22;j++){const r=(lo+hi)/2;if(field(x*r,y*r,z*r)>0)hi=r;else lo=r}
    const r=(lo+hi)/2/1.20,a=variant*.61,xx=(x*Math.cos(a)-z*Math.sin(a))*r,zz=(x*Math.sin(a)+z*Math.cos(a))*r;
    p.setXYZ(i,xx,y*r,zz);
    const c=low.clone().lerp(high,T.MathUtils.smoothstep(y,-.9,.9));colors.push(c.r,c.g,c.b);
  }
  g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.computeVertexNormals();return g;
}

// Long, arching blades with a shallow central rib, instead of rigid spikes.
export function grassTuftGeometry(variant=0){
  const positions=[],colors=[],indices=[],base=new T.Color('#6f8d54'),tip=new T.Color('#9cb471'),blades=variant===2?3:7,rows=variant===2?4:7;
  for(let blade=0;blade<blades;blade++){
    const a=blade*2.399+variant*.6,h=.55+.45*(.5+.5*Math.sin(blade*2.1+variant)),bend=.25+.30*(.5+.5*Math.cos(blade*1.7)),offset=positions.length/3;
    for(let row=0;row<=rows;row++){
      const t=row/rows,r=.045+bend*t*t,y=h*(t-.18*t*t*t),width=.032*Math.sin(Math.PI*(.12+t*.88))*(1-t)+.0015;
      for(let col=0;col<3;col++){
        const side=col-1;positions.push(Math.cos(a)*r-Math.sin(a)*side*width,y,Math.sin(a)*r+Math.cos(a)*side*width+(col===1?.008*Math.sin(t*Math.PI):0));
        const c=base.clone().lerp(tip,t*.75);colors.push(c.r,c.g,c.b);
      }
      if(row<rows)for(let col=0;col<2;col++){const k=offset+row*3+col;indices.push(k,k+1,k+3,k+1,k+4,k+3)}
    }
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();return g;
}

// Broad sloping faces and rounded edges make weathered stones, not pebbles
// inflated from a sphere. The buried base is deliberately flat.
export function stoneGeometry(variant=0){
  let g=new T.IcosahedronGeometry(1,2);const p=g.attributes.position;
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i),a=Math.atan2(z,x),r=1+.09*Math.sin(a*3+variant)+.035*Math.cos(a*5);
    const roof=Math.min(.38+x*.16-z*.10,.43-x*.20,.40+z*.20);
    p.setXYZ(i,x*r,Math.max(-.41,Math.min(y*(variant?.59:.54),roof)),z*r*(variant?.87:1.03));
  }
  // Weld before computing normals, keeping the beveled planes soft rather
  // than showing the tessellation of the underlying sphere.
  g.deleteAttribute('normal');g.deleteAttribute('uv');const welded=mergeVertices(g);g.dispose();g=welded;g.computeVertexNormals();
  const colors=[],low=new T.Color('#89847f'),high=new T.Color(variant?'#b6aaa0':'#a9a7a4');
  for(let i=0;i<g.attributes.position.count;i++){
    const y=g.attributes.position.getY(i),c=low.clone().lerp(high,T.MathUtils.smoothstep(y,-.4,.22));colors.push(c.r,c.g,c.b);
  }
  g.setAttribute('color',new T.Float32BufferAttribute(colors,3));return g;
}

// Leaf pairs and visible twig gaps distinguish a shrub from a solid boulder.
export function shrubGeometry(){
  const foliage=[],twigs=[],dummy=new T.Object3D(),low=new T.Color('#567344'),high=new T.Color('#8da66a');
  for(let branch=0;branch<7;branch++){
    const a=branch*2.399,r=.20+.12*Math.sin(branch*1.8)**2,h=.48+.18*Math.cos(branch*1.7)**2;
    const path=new T.CatmullRomCurve3([new T.Vector3(0,.01,0),new T.Vector3(Math.cos(a)*r*.45,h*.54,Math.sin(a)*r*.45),new T.Vector3(Math.cos(a)*r,h,Math.sin(a)*r)]);
    twigs.push(new T.TubeGeometry(path,8,.009,4,false));
    for(let j=1;j<=4;j++)for(const side of [-1,1]){
      const t=.16+j*.18,point=path.getPoint(t),leaf=petalGeometry(6,4),size=.21*(1-t*.24),angle=a+side*(.70+j*.09);
      dummy.position.copy(point);dummy.scale.set(size,size*.55,size*.82);dummy.rotation.set(.10*Math.sin(a),-angle,.25+(1-t)*.25);dummy.updateMatrix();leaf.applyMatrix4(dummy.matrix);
      const c=low.clone().lerp(high,t*.7+(branch%2)*.10),colors=[];for(let i=0;i<leaf.attributes.position.count;i++)colors.push(c.r,c.g,c.b);leaf.setAttribute('color',new T.Float32BufferAttribute(colors,3));foliage.push(leaf);
    }
  }
  const leaves=mergeGeometries(foliage),stems=mergeGeometries(twigs);foliage.forEach(g=>g.dispose());twigs.forEach(g=>g.dispose());return {leaves,stems};
}
