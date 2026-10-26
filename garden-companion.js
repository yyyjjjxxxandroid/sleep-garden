import * as T from './vendor/three/build/three.module.js';
import { findRoute } from './garden-navigation.mjs';

export class GardenCompanion{
  constructor(world){this.world=world;this.route=[];this.managed=false;this.phase='roaming';this.elapsed=0;this.flower=null;this.action=null;this.autonomous=false;this.showMarker=false;}
  walkable(x,z){
    const w=this.world;
    // One connected activity area covers the pond, bridge, lower creek and
    // flower hill. Every route segment uses it, preventing cumulative drift.
    const inArea=((x-1)/14)**2+((z-2)/13)**2<=1
      ||((x-14)/9)**2+((z+9)/9)**2<=1
      ||((x+2)/7)**2+((z+10)/7)**2<=1;
    if(!inArea||z<-18||w.inPond(x,z))return false;
    // The narrow decorative bridge has no walk surface; keep the cat on the banks.
    if(w.onStream?w.onStream(x,z,.48):z<-5.5&&z>-34.5&&Math.abs(x-(-2.5+Math.sin(z*.18)*1.2))<1.12)return false;
    return !(w.walkObstacles||[]).some(o=>Math.hypot(x-o.x,z-o.z)<o.radius+.32);
  }
  resetFlower(){this.flower?.userData.sway?.(0);this.flower=null;this.action=null;}
  stop(){this.quiet=false;this.resetFlower();this.route=[];this.managed=true;this.phase='idle';this.elapsed=0;this.autonomous=false;this.showMarker=false;if(this.marker)this.marker.visible=false;}
  rest(){this.stop();this.quiet=true;}
  routeTo(point){return findRoute(this.world.cat.position,point,(x,z)=>this.walkable(x,z));}
  goTo(point){
    const route=this.routeTo(point);
    if(!route){this.world.onCatInteraction?.('unreachable');return false;}
    this.begin(route,null);return true;
  }
  visit(flower){
    const center=flower.position,radius=flower.userData.approachRadius||.8,cat=this.world.cat.position;
    const base=Math.atan2(cat.x-center.x,cat.z-center.z);
    // Try near-side standing spots first. Never place the body at the flower's centre.
    for(let i=0;i<12;i++){
      const a=base+(i%2?1:-1)*Math.ceil(i/2)*Math.PI/6;
      const destination={x:center.x+Math.sin(a)*radius,z:center.z+Math.cos(a)*radius};
      const route=this.routeTo(destination);
      if(route){this.begin(route,flower);return true;}
    }
    this.world.onCatInteraction?.('unreachable');return false;
  }
  begin(route,flower){
    this.quiet=false;this.resetFlower();this.route=route;this.flower=flower;this.action=flower?(Math.random()<.5?'bite':'rub'):null;
    this.managed=true;this.phase='walking';this.elapsed=0;this.autonomous=false;this.showMarker=true;
    const w=this.world;w.storyCat?.release();w.follow=false;w.transition=null;w.onExplore();
    this.target=route[route.length-1];
    if(!this.marker){this.marker=new T.Mesh(new T.RingGeometry(.25,.31,32),new T.MeshBasicMaterial({color:'#fff0b7',transparent:true,opacity:.8,depthWrite:false,side:T.DoubleSide}));this.marker.rotation.x=-Math.PI/2;w.scene.add(this.marker);}
    this.marker.position.set(this.target.x,w.groundHeight(this.target.x,this.target.z)+.04,this.target.z);this.marker.visible=true;
    w.canvas.dataset.catTarget=`${this.target.x.toFixed(2)},${this.target.z.toFixed(2)}`;
    w.canvas.dataset.catCommand=String(Number(w.canvas.dataset.catCommand||0)+1);
    w.onCatInteraction?.(flower?'flower':'destination');
  }
  startRoaming(){
    const origin=this.world.cat.position,angle=Math.random()*Math.PI*2;
    // Start a fresh safe route from here, never jump back onto the old patrol curve.
    for(let i=0;i<12;i++){
      const heading=angle+i*Math.PI/6,radius=2+Math.random()*2;
      const target={x:origin.x+Math.sin(heading)*radius,z:origin.z+Math.cos(heading)*radius};
      const route=this.routeTo(target);
      if(!route)continue;
      this.route=route;this.target=target;this.phase='roaming';this.autonomous=true;this.elapsed=0;this.showMarker=false;
      if(this.marker)this.marker.visible=false;
      return;
    }
    // A confined spot is a resting place; retry later instead of searching every frame.
    this.elapsed=0;
  }
  update(dt,hold=false){
    if(!this.managed)return false;
    const w=this.world,cat=w.cat;
    w.catMoving=false;
    if(hold)return true;
    this.elapsed+=dt;
    if(this.phase==='idle'&&!this.quiet&&this.elapsed>=5&&!w.state.reduced)this.startRoaming();
    if(this.phase==='walking'||this.phase==='roaming'){
      let budget=dt*(this.autonomous?(w.state.reduced?0:.64):1.65);
      while(budget>0&&this.route.length){
        const next=this.route[0],dx=next.x-cat.position.x,dz=next.z-cat.position.z,distance=Math.hypot(dx,dz);
        if(distance<.001){this.route.shift();continue;}
        const step=Math.min(distance,budget),x=cat.position.x+dx/distance*step,z=cat.position.z+dz/distance*step;
        if(!this.walkable(x,z)){this.route=[];this.resetFlower();budget=0;break;}
        cat.position.x=x;cat.position.z=z;budget-=step;
        const yaw=Math.atan2(dx,dz),difference=Math.atan2(Math.sin(yaw-cat.rotation.y),Math.cos(yaw-cat.rotation.y));cat.rotation.y+=difference*Math.min(1,dt*12);
        w.catMoving=true;if(step>=distance)this.route.shift();
      }
      cat.position.y=w.groundHeight(cat.position.x,cat.position.z);
      if(!this.route.length){this.phase=this.flower?'interacting':'idle';this.elapsed=0;w.catMoving=false;if(this.flower)w.onCatInteraction?.(this.action);}
    }
    if(this.phase==='interacting'){
      const dx=this.flower.position.x-cat.position.x,dz=this.flower.position.z-cat.position.z;
      cat.rotation.y=Math.atan2(dx,dz)+(this.action==='rub'?.28:0);
      const envelope=Math.min(1,this.elapsed/.5,Math.max(0,(3.6-this.elapsed)/.5));
      this.flower.userData.sway?.(w.state.reduced?0:Math.sin(this.elapsed*7)*.10*envelope);
      if(this.elapsed>=3.6){this.resetFlower();this.phase='idle';this.elapsed=0;}
    }
    if(this.marker){this.marker.visible=this.showMarker&&(this.phase==='walking'||this.elapsed<1);this.marker.material.opacity=w.state.reduced?.65:.55+Math.sin(this.elapsed*4)*.15;}
    w.canvas.dataset.catState=this.phase==='interacting'?this.action:this.phase;
    return true;
  }
  get pose(){return this.phase==='interacting'?{action:this.action,time:this.elapsed}:null;}
}
