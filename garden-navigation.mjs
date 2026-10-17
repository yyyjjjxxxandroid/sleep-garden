// The same tap classifier is used by the canvas and the gesture regression tests.
export class TapGesture {
  constructor(){this.active=new Set();this.tap=null;}
  down(e,now){this.active.add(e.pointerId);if(this.active.size!==1||e.button>0){this.tap=null;return;}this.tap={id:e.pointerId,x:e.clientX,y:e.clientY,time:now,dragged:false,limit:e.pointerType==='touch'?10:6};}
  move(e){const t=this.tap;if(t&&t.id===e.pointerId&&Math.hypot(e.clientX-t.x,e.clientY-t.y)>t.limit)t.dragged=true;return !t||t.dragged;}
  up(e,now){const t=this.tap;this.move(e);this.active.delete(e.pointerId);this.tap=null;return !!t&&t.id===e.pointerId&&!t.dragged&&this.active.size===0&&now-t.time<550&&e.button===0;}
  cancel(id){this.active.delete(id);this.tap=null;}
}

export function clearSegment(a,b,walkable){
  const n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.15));
  for(let i=0;i<=n;i++)if(!walkable(a.x+(b.x-a.x)*i/n,a.z+(b.z-a.z)*i/n))return false;
  return true;
}

// Small bounded A* grid; every final segment is checked against the same clearance mask.
export function findRoute(start,end,walkable,{bound=36,step=.6}={}){
  if(!walkable(start.x,start.z)||!walkable(end.x,end.z))return null;
  if(clearSegment(start,end,walkable))return [{x:end.x,z:end.z}];
  const size=Math.round(bound*2/step)+1,point=id=>({x:(id%size)*step-bound,z:Math.floor(id/size)*step-bound});
  const memo=new Map(),valid=id=>{if(!memo.has(id)){const p=point(id);memo.set(id,walkable(p.x,p.z));}return memo.get(id);};
  const nearby=p=>{const x=Math.round((p.x+bound)/step),z=Math.round((p.z+bound)/step),out=[];for(let dz=-2;dz<=2;dz++)for(let dx=-2;dx<=2;dx++){const xx=x+dx,zz=z+dz;if(xx<0||zz<0||xx>=size||zz>=size)continue;const id=zz*size+xx,q=point(id);if(valid(id)&&clearSegment(p,q,walkable))out.push(id);}return out.sort((a,b)=>Math.hypot(point(a).x-p.x,point(a).z-p.z)-Math.hypot(point(b).x-p.x,point(b).z-p.z));};
  const starts=nearby(start),ends=new Set(nearby(end));if(!starts.length||!ends.size)return null;
  const g=new Map(),parent=new Map(),open=[],closed=new Set();
  const heuristic=id=>{const p=point(id);return Math.hypot(p.x-end.x,p.z-end.z);};
  const push=(id,cost)=>{open.push({id,f:cost+heuristic(id)});let i=open.length-1;while(i>0){const p=(i-1)>>1;if(open[p].f<=open[i].f)break;[open[p],open[i]]=[open[i],open[p]];i=p;}};
  const pop=()=>{const top=open[0],last=open.pop();if(open.length){open[0]=last;let i=0;for(;;){let c=i*2+1;if(c>=open.length)break;if(c+1<open.length&&open[c+1].f<open[c].f)c++;if(open[i].f<=open[c].f)break;[open[i],open[c]]=[open[c],open[i]];i=c;}}return top.id;};
  for(const id of starts){const p=point(id),cost=Math.hypot(p.x-start.x,p.z-start.z);g.set(id,cost);push(id,cost);}
  while(open.length){const id=pop();if(closed.has(id))continue;closed.add(id);
    if(ends.has(id)){const raw=[end];let current=id;while(current!==undefined){raw.unshift(point(current));current=parent.get(current);}raw.unshift(start);const route=[];for(let i=0;i<raw.length-1;){let j=raw.length-1;while(j>i+1&&!clearSegment(raw[i],raw[j],walkable))j--;route.push(raw[j]);i=j;}return route;}
    const x=id%size,z=Math.floor(id/size),p=point(id);
    for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dz)continue;const xx=x+dx,zz=z+dz;if(xx<0||zz<0||xx>=size||zz>=size)continue;const next=zz*size+xx;if(closed.has(next)||!valid(next)||!clearSegment(p,point(next),walkable))continue;const cost=g.get(id)+Math.hypot(dx,dz)*step;if(cost>=(g.get(next)??Infinity))continue;g.set(next,cost);parent.set(next,id);push(next,cost);}
  }
  return null;
}
