import * as T from './vendor/three/build/three.module.js';

// Shared small-scale materials: washed linen, glazed stoneware and pale oak.
let weave;
export function linen(color){
  if(!weave){const n=64,data=new Uint8Array(n*n*4);for(let y=0;y<n;y++)for(let x=0;x<n;x++){const i=(y*n+x)*4,v=128+26*Math.sin(x*Math.PI/2)*Math.cos(y*Math.PI/2);data[i]=data[i+1]=data[i+2]=v;data[i+3]=255}weave=new T.DataTexture(data,n,n);weave.wrapS=weave.wrapT=T.RepeatWrapping;weave.repeat.set(4,4);weave.needsUpdate=true}
  return new T.MeshPhysicalMaterial({color,roughness:.92,sheen:.7,sheenColor:'#fff7e8',sheenRoughness:.8,bumpMap:weave,bumpScale:.003,side:T.DoubleSide});
}
export function softBoxGeometry(w,h,d,r=.06){
  const g=new T.BoxGeometry(w,h,d,6,6,6),p=g.attributes.position,v=new T.Vector3(),inner=new T.Vector3();r=Math.min(r,w/2,h/2,d/2);
  for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i);inner.set(T.MathUtils.clamp(v.x,-w/2+r,w/2-r),T.MathUtils.clamp(v.y,-h/2+r,h/2-r),T.MathUtils.clamp(v.z,-d/2+r,d/2-r));v.sub(inner).normalize().multiplyScalar(r).add(inner);p.setXYZ(i,v.x,v.y,v.z)}g.computeVertexNormals();return g;
}
export function ceramicBowlGeometry(){
  return new T.LatheGeometry([[0,.025],[.27,.025],[.32,.04],[.39,.17],[.40,.20],[.39,.23],[.36,.23],[.34,.19],[.28,.085],[0,.085]].map(([r,y])=>new T.Vector2(r,y)),48);
}
function ribbonGeometry(side){
  const s=new T.Shape();s.moveTo(0,0);s.bezierCurveTo(.05,.10,.19,.17,.23,.12);s.bezierCurveTo(.28,.06,.25,-.07,.20,-.08);s.bezierCurveTo(.12,-.09,.05,-.02,0,0);
  const g=new T.ExtrudeGeometry(s,{depth:.018,bevelEnabled:true,bevelSize:.009,bevelThickness:.009,bevelSegments:3,steps:1,curveSegments:16});g.scale(side,1,1);if(side<0){const idx=g.index;if(idx){for(let i=0;i<idx.count;i+=3){const a=idx.getX(i);idx.setX(i,idx.getX(i+2));idx.setX(i+2,a)}}else{const attrs=Object.values(g.attributes);for(let i=0;i<g.attributes.position.count;i+=3)for(const a of attrs)for(let k=0;k<a.itemSize;k++){const j=i*a.itemSize+k,l=(i+2)*a.itemSize+k,t=a.array[j];a.array[j]=a.array[l];a.array[l]=t}}}g.computeVertexNormals();return g;
}
export function buildTailoredClothes(care){
  const body=care.w.cat.getObjectByName('companion-body'),head=care.w.storyCat.head;
  const oak=care.mat('#bda77e'),thread=linen('#eee7d5');
  care.collar=new T.Group();care.collar.position.set(0,.76,.36);body.add(care.collar);
  care.collarBand=care.mesh(care.collar,new T.CylinderGeometry(.335,.37,.095,48,1,true),linen('#90a38c'));
  care.collarBand.scale.z=.88;
  const charm=care.mesh(care.collar,new T.TorusGeometry(.043,.011,8,24),oak,[0,-.075,.34]);charm.name='collar-charm';
  care.rounded(care.collar,care.mat('#e7dab7'),[0,-.088,.345],[.028,.028,.012]);
  care.scarf=new T.Group();care.scarf.position.set(0,.78,.38);body.add(care.scarf);
  care.scarfBand=care.mesh(care.scarf,new T.CylinderGeometry(.34,.38,.11,48,1,true),linen('#e1d4b5'));care.scarfBand.scale.z=.93;
  const g=new T.PlaneGeometry(.62,.32,24,16),p=g.attributes.position;
  for(let i=0;i<p.count;i++){const u=p.getX(i)/.31,v=(.16-p.getY(i))/.32;p.setXYZ(i,u*.31*(1-v*.88),-v*.32,.35+Math.sin(v*Math.PI)*.035-Math.abs(u)*.055+Math.sin(u*9)*.008*(1-v))}g.computeVertexNormals();
  care.scarfEnd=care.mesh(care.scarf,g,care.scarfBand.material);care.scarfEnd.name='tailored-bandana';
  // Tiny stitched hem follows the fabric edge, not a flat triangle sticker.
  for(const side of [-1,1])for(let i=0;i<9;i++){const v=i/10;care.rounded(care.scarf,thread,[side*(.285*(1-v*.88)),-v*.30,.355+Math.sin(v*Math.PI)*.035-.04*(1-v)],[.007,.010,.004])}
  care.hair=new T.Group();care.hair.position.set(-.39,.26,.32);care.hair.rotation.z=.28;head.add(care.hair);
  care.flower=new T.Group();care.hair.add(care.flower);
  const petal=linen('#fff1cd');for(let i=0;i<9;i++){const a=i*Math.PI*2/9,m=care.rounded(care.flower,petal,[Math.sin(a)*.095,Math.cos(a)*.095,0],[.038,.077,.019]);m.rotation.z=-a;m.rotation.x=.14}
  care.rounded(care.flower,care.mat('#d4b260'),[0,0,.03],[.047,.047,.025]);
  // A cupped rose: overlapping spiral petals, not a radial daisy with a yellow centre.
  care.rose=new T.Group();care.rose.name='layered-rose';care.hair.add(care.rose);
  for(const side of [-1,1]){
    const leaf=care.rounded(care.rose,care.mat('#829779'),[side*.105,-.075,-.018],[.045,.096,.014]);leaf.rotation.z=side*-.75;
  }
  for(let layer=0;layer<3;layer++){
    const count=7-layer,r=.083-layer*.027,height=.025+layer*.025;
    const material=new T.MeshStandardMaterial({color:['#d99caa','#ca8095','#b76980'][layer],roughness:.78,side:T.DoubleSide});
    for(let i=0;i<count;i++){
      const g=new T.PlaneGeometry(1,1,16,12),p=g.attributes.position,a=i/count*Math.PI*2+layer*.64;
      for(let k=0;k<p.count;k++){
        const u=p.getX(k)*2,v=p.getY(k)+.5,theta=a+u*.73,rad=r*(.55+v*.95);
        p.setXYZ(k,Math.sin(theta)*rad,Math.cos(theta)*rad,height+(1-v)*.055+Math.sin(v*Math.PI)*.023-u*u*.012);
      }
      g.computeVertexNormals();const m=care.mesh(care.rose,g,material);m.name=`rose-petal-${layer}-${i}`;
    }
  }
  care.rounded(care.rose,care.mat('#af627a'),[0,0,.105],[.018,.026,.023]);
  care.bow=new T.Group();care.hair.add(care.bow);care.bowMaterial=linen('#98b4bd');
  for(const side of [-1,1]){care.mesh(care.bow,ribbonGeometry(side),care.bowMaterial);const tail=care.mesh(care.bow,softBoxGeometry(.065,.15,.018,.008),care.bowMaterial,[side*.075,-.095,.004]);tail.rotation.z=side*-.3}
  care.mesh(care.bow,softBoxGeometry(.065,.08,.04,.018),care.bowMaterial,[0,0,.025]);
}
