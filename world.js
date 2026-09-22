/* A hand-painted world on a deformable WebGL plane. Camera and SVG actors share
   world coordinates. No third-party dependencies; gracefully falls back to SVG. */
window.GardenWorld=class GardenWorld{
 constructor({svg,scene,state,onExplore}){
  this.svg=svg;this.scene=scene;this.state=state;this.onExplore=onExplore;
  this.camera={x:535,y:500,zoom:1};this.target={...this.camera};this.last=0;this.moved=false;this.pointers=new Map();this.velocity={x:0,y:0};this.phase=0;
  svg.querySelector(':scope > rect').style.display='none';
  const layer=document.getElementById('camera');
  [...layer.children].forEach(n=>{if(!['cat','plots','fireflies','waterMarks'].includes(n.id))n.style.display='none'});
  layer.style.transform='none';layer.style.transition='none';
  document.getElementById('cat').setAttribute('transform','translate(-50 -80)');
  document.getElementById('cat').setAttribute('filter','url(#soft-edge)');
  const kitty=document.createElementNS('http://www.w3.org/2000/svg','image');kitty.setAttribute('href','assets/kitten.png');kitty.setAttribute('x',481);kitty.setAttribute('y',555);kitty.setAttribute('width',138);kitty.setAttribute('height',145);document.querySelector('.cat-body').replaceChildren(kitty);
  this.catBody=document.querySelector('.cat-body');this.catBody.style.animation='none';this.catBody.style.transformOrigin='0 0';
  const ns='http://www.w3.org/2000/svg',filter=document.createElementNS(ns,'filter');filter.id='fur-wind';filter.setAttribute('x','-8%');filter.setAttribute('y','-8%');filter.setAttribute('width','116%');filter.setAttribute('height','116%');
  this.furNoise=document.createElementNS(ns,'feTurbulence');this.furNoise.setAttribute('type','fractalNoise');this.furNoise.setAttribute('baseFrequency','.025 .065');this.furNoise.setAttribute('numOctaves','2');this.furNoise.setAttribute('seed','9');this.furNoise.setAttribute('result','fur');
  this.furDisplacement=document.createElementNS(ns,'feDisplacementMap');this.furDisplacement.setAttribute('in','SourceGraphic');this.furDisplacement.setAttribute('in2','fur');this.furDisplacement.setAttribute('scale','0');this.furDisplacement.setAttribute('xChannelSelector','R');this.furDisplacement.setAttribute('yChannelSelector','G');filter.append(this.furNoise,this.furDisplacement);svg.querySelector('defs').append(filter);kitty.setAttribute('filter','url(#fur-wind)');
  this.canvas=document.createElement('canvas');this.canvas.className='world-canvas';this.canvas.setAttribute('aria-hidden','true');scene.prepend(this.canvas);
  this.gl=this.canvas.getContext('webgl',{alpha:false,antialias:false,powerPreference:'low-power'});
  if(this.gl){try{this.initGL()}catch(e){console.warn('World renderer fallback',e);this.gl=null}}
  if(!this.gl){this.canvas.hidden=true;this.fallback=document.createElementNS('http://www.w3.org/2000/svg','image');this.fallback.setAttribute('width',1000);this.fallback.setAttribute('height',1000);this.fallback.setAttribute('href','assets/garden-world.png');layer.prepend(this.fallback)}
  this.effects=document.createElement('canvas');this.effects.className='world-weather';this.effects.setAttribute('aria-hidden','true');scene.append(this.effects);this.fx=this.effects.getContext('2d');
  this.particles=Array.from({length:130},(_,i)=>({x:((i*137.31)%1000),y:((i*91.7)%1000),p:i*2.399,speed:85+(i%9)*12}));this.weatherStart=0;
  this.events();this.resize();this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(scene);
 }
 initGL(){const gl=this.gl;
  const vertex=`precision mediump float; attribute vec2 point; varying vec2 uv; uniform vec2 center; uniform vec2 view; uniform float time; uniform float wind;
  void main(){uv=point;vec2 p=point*1000.0;
   float willow=smoothstep(515.0,590.0,p.x)*(1.0-smoothstep(885.0,952.0,p.x))*smoothstep(100.0,160.0,p.y)*(1.0-smoothstep(455.0,520.0,p.y));
   float tempo=.55+wind*.85;float ends=smoothstep(170.0,455.0,p.y);p.x+=willow*wind*(sin(time*tempo+point.y*9.0)*9.0+sin(time*tempo*1.65+point.x*20.0)*3.5)*(0.5+ends);p.y+=willow*wind*sin(time*tempo+point.x*16.0)*2.6;
   float edgeTrees=(1.0-smoothstep(160.0,320.0,p.x)+smoothstep(830.0,975.0,p.x))*(1.0-smoothstep(500.0,655.0,p.y));
   p.x+=edgeTrees*wind*sin(time*tempo*.7+point.y*8.0+point.x*11.0)*6.5;
   float foreground=smoothstep(730.0,870.0,p.y);float borderFlowers=smoothstep(465.0,545.0,p.y)*(1.0-smoothstep(660.0,700.0,p.y))*(smoothstep(580.0,645.0,p.x)+1.0-smoothstep(240.0,325.0,p.x));
   p.x+=(foreground+borderFlowers)*wind*sin(time*tempo*1.3+point.x*29.0)*4.8;
   p.y+=foreground*wind*sin(time*tempo+point.x*30.0)*1.6;
   vec2 clip=(p-center)/view*2.0;gl_Position=vec4(clip.x,-clip.y,0.0,1.0);
  }`;
  const fragment=`precision mediump float; varying vec2 uv; uniform sampler2D art; uniform float night; uniform float light; uniform float time; uniform float wind; uniform float cloud;
   void main(){vec2 waterPos=(uv-vec2(.372,.417))/vec2(.19,.095);float pond=1.0-smoothstep(.62,1.0,length(waterPos));vec2 sampleUV=uv;sampleUV.x+=pond*sin(uv.y*260.0+time*(.7+wind))*wind*.0018;sampleUV.y+=pond*sin(uv.x*210.0+time*.75)*wind*.0008;
    vec3 base=texture2D(art,sampleUV).rgb;
    vec3 daylight=base*mix(.62,1.19,light)+mix(vec3(-.015,.002,.026),vec3(.057,.029,-.011),light);
    float dapple=sin(uv.x*60.0+time*.22)*sin(uv.y*75.0-time*.15);daylight+=vec3(.036,.029,.014)*dapple*light*smoothstep(.38,.7,uv.y);
    daylight=mix(daylight,daylight*vec3(.83,.88,.94),cloud);
    vec3 evening=base*vec3(.29,.40,.59)+vec3(.009,.017,.032);vec3 color=mix(daylight,evening,night);
    gl_FragColor=vec4(clamp(color,0.0,1.0),1.0);}`;
  const compile=(type,text)=>{const s=gl.createShader(type);gl.shaderSource(s,text);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s};
  this.program=gl.createProgram();gl.attachShader(this.program,compile(gl.VERTEX_SHADER,vertex));gl.attachShader(this.program,compile(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(this.program);if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(this.program));gl.useProgram(this.program);
  const points=[],cells=70;for(let y=0;y<cells;y++)for(let x=0;x<cells;x++){const x0=x/cells,x1=(x+1)/cells,y0=y/cells,y1=(y+1)/cells;points.push(x0,y0,x1,y0,x0,y1,x0,y1,x1,y0,x1,y1)}this.count=points.length/2;
  const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(points),gl.STATIC_DRAW);const p=gl.getAttribLocation(this.program,'point');gl.enableVertexAttribArray(p);gl.vertexAttribPointer(p,2,gl.FLOAT,false,0,0);
  this.uniform={};['center','view','time','wind','night','light','cloud'].forEach(k=>this.uniform[k]=gl.getUniformLocation(this.program,k));
  const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([169,185,148,255]));gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  const image=new Image();image.onload=()=>{gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);this.loaded=true;document.getElementById('app').classList.add('world-ready')};image.onerror=()=>{document.getElementById('app').classList.add('world-ready');console.error('Garden illustration could not be loaded')};image.src='assets/garden-world.png';
 }
 resize(){const r=this.scene.getBoundingClientRect();this.width=r.width;this.height=r.height;const d=Math.min(devicePixelRatio||1,2);this.pixelRatio=d;this.canvas.width=Math.round(r.width*d);this.canvas.height=Math.round(r.height*d);if(this.effects){this.effects.width=this.canvas.width;this.effects.height=this.canvas.height}if(this.gl)this.gl.viewport(0,0,this.canvas.width,this.canvas.height);this.clamp(this.target);this.render(0)}
 view(c=this.camera){const h=1000/c.zoom;return {w:h*this.width/this.height,h}}
 clamp(c){c.zoom=Math.min(2.8,Math.max(1,c.zoom));const v=this.view(c);c.x=Math.min(1000-v.w/2,Math.max(v.w/2,c.x));c.y=Math.min(1000-v.h/2,Math.max(v.h/2,c.y));return c}
 set(x,y,zoom){this.target=this.clamp({x,y,zoom});this.velocity={x:0,y:0}}
 home(){this.set(535,500,1)}
 focus(){this.set(500,594,2.45)}
 zoomBy(factor){this.target.zoom*=factor;this.clamp(this.target)}
 weatherChanged(){this.weatherStart=this.phase;this.previousWeather=null}
 events(){const s=this.svg;s.style.touchAction='none';
  s.addEventListener('pointerdown',e=>{if(e.button&&e.button!==0)return;this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});this.origin={x:e.clientX,y:e.clientY};this.moved=false;this.velocity={x:0,y:0};if(this.pointers.size===2){const p=[...this.pointers.values()];this.pinch={distance:Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y),zoom:this.target.zoom}}});
  s.addEventListener('pointermove',e=>{if(!this.pointers.has(e.pointerId))return;const old=this.pointers.get(e.pointerId);this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(this.pointers.size===2){const p=[...this.pointers.values()];this.target.zoom=this.pinch.zoom*Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y)/Math.max(1,this.pinch.distance);this.clamp(this.target);this.moved=true;this.onExplore();return}if(Math.hypot(e.clientX-this.origin.x,e.clientY-this.origin.y)>5)this.moved=true;if(!this.moved)return;if(!s.hasPointerCapture(e.pointerId))s.setPointerCapture(e.pointerId);const v=this.view(this.target),dx=-(e.clientX-old.x)*v.w/this.width,dy=-(e.clientY-old.y)*v.h/this.height;this.target.x+=dx;this.target.y+=dy;this.velocity={x:dx*.55,y:dy*.55};this.clamp(this.target);this.onExplore()});
  const up=e=>{this.pointers.delete(e.pointerId);if(s.hasPointerCapture(e.pointerId))s.releasePointerCapture(e.pointerId)};s.addEventListener('pointerup',up);s.addEventListener('pointercancel',up);
  s.addEventListener('click',e=>{if(this.moved){e.preventDefault();e.stopImmediatePropagation();this.moved=false}},true);
  s.addEventListener('wheel',e=>{e.preventDefault();this.zoomBy(Math.exp(-e.deltaY*.0015));this.onExplore()},{passive:false});
  s.setAttribute('tabindex','0');s.setAttribute('aria-label','可探索花园：拖动移动，双指或滚轮缩放，也可使用方向键和加减键');
  s.addEventListener('keydown',e=>{const keys={ArrowLeft:[-35,0],ArrowRight:[35,0],ArrowUp:[0,-35],ArrowDown:[0,35]};if(keys[e.key]){e.preventDefault();this.target.x+=keys[e.key][0];this.target.y+=keys[e.key][1];this.clamp(this.target);this.onExplore()}else if(e.key==='+'||e.key==='=')this.zoomBy(1.16);else if(e.key==='-')this.zoomBy(.86)});
 }
 update(time){const dt=this.last?Math.min((time-this.last)/1000,.05):0;this.last=time;const c=this.camera,t=this.target;if(!this.pointers.size){t.x+=this.velocity.x;t.y+=this.velocity.y;this.velocity.x*=.86;this.velocity.y*=.86;this.clamp(t)}const f=this.state.reduced?1:1-Math.exp(-dt*9);['x','y','zoom'].forEach(k=>c[k]+=(t[k]-c[k])*f);if(!(this.state.mode==='session'&&!this.state.playing))this.phase+=dt;this.night=(this.night||0)+((this.state.night?1:0)-(this.night||0))*Math.min(1,dt*1.4);this.render(time)}
 render(){if(!this.width)return;const c=this.camera,v=this.view();this.svg.setAttribute('viewBox',`${c.x-v.w/2} ${c.y-v.h/2} ${v.w} ${v.h}`);this.svg.setAttribute('preserveAspectRatio','none');this.svg.dataset.cameraX=c.x.toFixed(1);this.svg.dataset.cameraY=c.y.toFixed(1);this.svg.dataset.zoom=c.zoom.toFixed(2);
  const wind=this.state.reduced?0:this.state.wind/100,t=this.state.reduced?0:this.phase;
  const gl=this.gl;if(gl){gl.useProgram(this.program);gl.uniform2f(this.uniform.center,c.x,c.y);gl.uniform2f(this.uniform.view,v.w,v.h);gl.uniform1f(this.uniform.time,t);gl.uniform1f(this.uniform.wind,wind);gl.uniform1f(this.uniform.night,this.night||0);gl.uniform1f(this.uniform.light,this.state.light/100);gl.uniform1f(this.uniform.cloud,this.state.weather==='rain'?1:0);gl.drawArrays(gl.TRIANGLES,0,this.count)}else if(this.fallback)this.fallback.style.filter=this.state.night?'brightness(.43) saturate(.7) hue-rotate(15deg)':`brightness(${.62+this.state.light*.0062}) saturate(.9)`;
  const breathe=Math.sin(t*1.05),lean=Math.sin(t*(.65+wind*.65))*wind*1.25;
  this.catBody.setAttribute('transform',`translate(550 697) rotate(${lean.toFixed(3)}) scale(${(1+breathe*.011).toFixed(4)} ${(1+breathe*.035).toFixed(4)}) translate(-550 -697)`);
  this.catBody.style.filter=`brightness(${this.state.night?.65:.72+this.state.light*.005}) saturate(.86)`;
  this.furDisplacement.setAttribute('scale',(wind*(2.2+Math.sin(t*1.8)*.9)).toFixed(2));this.furNoise.setAttribute('baseFrequency',`${(.023+Math.sin(t*.7)*.003).toFixed(4)} .065`);
  this.drawWeather(t,wind,v);
  this.svg.dataset.weather=this.state.weather;this.svg.dataset.sunlight=this.state.light;this.svg.dataset.wind=this.state.wind;
  const meter=document.getElementById('zoomMeter');if(meter)meter.textContent=c.zoom.toFixed(1)+'×';
 }
 drawWeather(t,wind,v){const ctx=this.fx;if(!ctx)return;const s=this.state,kind=s.weather||'clear',scale=this.width/v.w,ox=this.camera.x-v.w/2,oy=this.camera.y-v.h/2;ctx.setTransform(this.pixelRatio,0,0,this.pixelRatio,0,0);ctx.clearRect(0,0,this.width,this.height);ctx.save();ctx.scale(scale,scale);ctx.translate(-ox,-oy);
  // The sky, weather, pollen and pond share the same world coordinates as the actors.
  if(!s.night&&s.light>12){const intensity=s.light/100,halo=ctx.createRadialGradient(725,18,8,725,18,435);halo.addColorStop(0,`rgba(255,243,184,${intensity*.46})`);halo.addColorStop(.5,`rgba(255,240,184,${intensity*.11})`);halo.addColorStop(1,'rgba(255,240,184,0)');ctx.fillStyle=halo;ctx.fillRect(200,0,800,550);
   for(let i=0;i<4;i++){const drift=Math.sin(t*.13+i)*9;ctx.beginPath();ctx.moveTo(725+i*7,0);ctx.lineTo(360+i*130+drift,890);ctx.lineTo(405+i*130+drift,890);ctx.closePath();const ray=ctx.createLinearGradient(0,20,0,900);ray.addColorStop(0,`rgba(255,247,211,${Math.pow(intensity,1.6)*.2})`);ray.addColorStop(1,'rgba(255,247,211,0)');ctx.fillStyle=ray;ctx.fill()}}
  if(kind==='rainbow'){const colors=['221,132,136','231,166,111','232,209,143','160,192,145','136,185,197','155,157,191','185,156,191'];ctx.save();ctx.lineWidth=9;ctx.lineCap='round';ctx.shadowBlur=5*scale;colors.forEach((color,i)=>{ctx.strokeStyle=`rgba(${color},${.40+s.light*.002})`;ctx.shadowColor=`rgba(${color},.2)`;ctx.beginPath();ctx.arc(515,359,302-i*9,Math.PI,Math.PI*2);ctx.stroke()});ctx.restore()}
  if(s.night){for(let i=0;i<48;i++){const p=this.particles[i],x=(p.x*.93+30)%1000,y=18+(p.y*.23);ctx.globalAlpha=.20+.45*(.5+.5*Math.sin(t*.4+p.p));ctx.fillStyle='#e6eedf';ctx.beginPath();ctx.arc(x,y,i%5===0?1.2:.65,0,Math.PI*2);ctx.fill()}ctx.globalAlpha=1}
  if(kind==='aurora'){ctx.save();ctx.globalCompositeOperation='screen';for(let band=0;band<3;band++){const path=[];for(let x=0;x<=1000;x+=10)path.push([x,78+band*31+Math.sin(x*.006+t*.24+band)*36+Math.sin(x*.014-t*.18)*14]);ctx.beginPath();path.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));for(let i=path.length-1;i>=0;i--)ctx.lineTo(path[i][0],path[i][1]+87+Math.sin(path[i][0]*.009+t*.3)*18);ctx.closePath();const g=ctx.createLinearGradient(0,35+band*30,0,270+band*20);g.addColorStop(0,'rgba(95,191,171,0)');g.addColorStop(.22,band===1?'rgba(168,142,216,.33)':'rgba(105,213,167,.42)');g.addColorStop(.53,'rgba(110,181,186,.14)');g.addColorStop(1,'rgba(129,136,205,0)');ctx.fillStyle=g;ctx.fill()}
   ctx.strokeStyle='rgba(158,235,190,.1)';ctx.lineWidth=1;for(let i=0;i<46;i++){const x=i*23,y=97+Math.sin(x*.006+t*.24)*36;ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(x+10,y+35,x+18,y+91);ctx.stroke()}ctx.restore()}
  if(kind==='meteor'){const elapsed=s.reduced?1.1:t-this.weatherStart;for(let j=0;j<2;j++){const cycle=(elapsed+j*4)%9;if(cycle>2.4)continue;const x=730-j*150-cycle*107,y=28+j*25+cycle*54,alpha=Math.sin(Math.PI*cycle/2.4)*.85;ctx.save();ctx.globalAlpha=Math.max(0,alpha);const trail=ctx.createLinearGradient(x+105,y-52,x,y);trail.addColorStop(0,'rgba(220,235,231,0)');trail.addColorStop(1,'rgba(241,240,217,.94)');ctx.strokeStyle=trail;ctx.lineWidth=1.8;ctx.beginPath();ctx.moveTo(x+105,y-52);ctx.lineTo(x,y);ctx.stroke();ctx.fillStyle='#f4f2d7';ctx.shadowColor='#dbe8e3';ctx.shadowBlur=5;ctx.beginPath();ctx.arc(x,y,1.8,0,Math.PI*2);ctx.fill();ctx.restore()}}
  if(kind==='rain'){const amount=Math.max(.35,s.mix.rain/100);ctx.strokeStyle='rgba(221,237,236,.43)';ctx.lineWidth=.8;const count=Math.round(65+amount*65);for(let i=0;i<count;i++){const p=this.particles[i],y=(p.y+t*p.speed*(.8+wind*.3))%1000,x=(p.x+t*wind*30)%1000;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+wind*7,y+9+amount*5);ctx.stroke()}
   for(let i=0;i<12;i++){const p=this.particles[i],x=290+(p.x%210),y=355+(p.y%105),f=(t*.7+i*.17)%1;ctx.strokeStyle=`rgba(220,237,234,${(1-f)*.32})`;ctx.beginPath();ctx.ellipse(x,y,2+f*11,1+f*3,0,0,Math.PI*2);ctx.stroke()}}
  if(wind>.02){const count=Math.ceil(wind*16);for(let i=0;i<count;i++){const p=this.particles[i],x=(p.x+t*(10+wind*30))%1000,y=335+(p.y%500)+Math.sin(t*.8+p.p)*14;ctx.save();ctx.translate(x,y);ctx.rotate(Math.sin(t*.9+p.p)*.9+t*.15);ctx.fillStyle=i%3?'rgba(201,213,154,.49)':'rgba(221,192,190,.53)';ctx.beginPath();ctx.ellipse(0,0,2.2+(i%3),1.25,0,0,Math.PI*2);ctx.fill();ctx.restore()}}
  ctx.restore();this.effects.dataset.scene=kind;this.effects.dataset.phase=t.toFixed(2);
 }
};
