// Shared by both worlds: keep input and animation at display refresh speed,
// and spend less GPU time on pixels, shadows and reflection passes instead.
export function renderProfile({touch=false,width=1280,height=800,memory=8,cores=8,dpr=1,reduced=false}={}){
  const mobile=touch&&Math.min(width,height)<920;
  const low=memory<=2||cores<=2;
  const quality=reduced||low?'low':mobile||memory<=4||dpr>=2.5?'mid':'high';
  return {mobile,quality,antialias:quality==='high',
    pixelRatio:Math.min(dpr,mobile?1:quality==='high'?1.5:quality==='mid'?1.25:1),
    minPixelRatio:mobile?.65:.8,shadows:!mobile&&quality!=='low',
    shadowSize:quality==='high'?1024:512,shadowInterval:mobile?100:50,
    reflectionSize:mobile||quality!=='high'?256:512,
    reflectionInterval:mobile?100:50};
}

export function deviceRenderProfile(reduced=false){
  return renderProfile({touch:navigator.maxTouchPoints>0,width:screen.width,height:screen.height,
    memory:navigator.deviceMemory||8,cores:navigator.hardwareConcurrency||8,
    dpr:window.devicePixelRatio||1,reduced});
}

export class AdaptiveResolution{
  constructor(profile){
    this.max=profile.pixelRatio;this.min=Math.min(this.max,profile.minPixelRatio);
    this.ratio=this.max;this.reset();
  }
  reset(){this.last=0;this.elapsed=0;this.frames=0;this.slow=0;this.fast=0;this.warmup=1200;}
  sample(now){
    const elapsed=this.last?now-this.last:0;this.last=now;
    // Returning from a background tab is not evidence of a slow GPU.
    if(elapsed<=0)return null;
    if(elapsed>2000){this.elapsed=0;this.frames=0;this.slow=0;this.fast=0;return null;}
    if(this.warmup>0){this.warmup-=elapsed;return null;}
    this.elapsed+=elapsed;this.frames++;
    if(this.elapsed<1000)return null;
    const frameTime=this.elapsed/this.frames;this.elapsed=0;this.frames=0;
    this.slow=frameTime>22?this.slow+1:0;
    this.fast=frameTime<18?this.fast+1:0;
    let next=this.ratio;
    if(this.slow>=2){next=Math.max(this.min,this.ratio-.15);this.slow=0;this.fast=0;}
    else if(this.fast>=8){next=Math.min(this.max,this.ratio+.1);this.fast=0;}
    if(Math.abs(next-this.ratio)<.01)return null;
    this.ratio=Math.round(next*100)/100;return this.ratio;
  }
}

export function updateRenderBudget(world,now){
  const ratio=world.adaptiveResolution.sample(now);
  if(ratio!==null){world.renderer.setPixelRatio(ratio);world.canvas.dataset.pixelRatio=String(ratio);}
  if(world.renderer.shadowMap.enabled&&now-(world.lastShadowAt??-Infinity)>=world.renderProfile.shadowInterval){
    world.renderer.shadowMap.needsUpdate=true;world.lastShadowAt=now;
  }
}
