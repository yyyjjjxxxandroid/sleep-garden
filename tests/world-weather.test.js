const {test}=require('node:test'),assert=require('node:assert/strict');
const E=require('../garden-environment.js');

test('eight time periods have distinct continuous lighting, with a neutral noon and darker midnight',()=>{
  const samples=[[5.5,'黎明'],[7,'清晨'],[9,'上午'],[12,'正午'],[15,'午后'],[18,'黄昏'],[20,'入夜'],[0,'深夜']];
  const at=hour=>E.daylight(Date.parse('2026-10-24T00:00:00Z')+hour*3600000,'UTC');
  for(const [hour,phase]of samples)assert.equal(at(hour).phase,phase);
  assert.ok(at(12).noon>.99);assert.ok(at(12).altitude>at(9).altitude);assert.ok(at(12).warmth<at(18).warmth);
  assert.ok(at(0).deepNight>at(20).deepNight);assert.ok(at(6).dawn>.99);
  for(let minute=1;minute<1440;minute++){
    const a=at((minute-1)/60),b=at(minute/60);
    for(const key of ['night','warmth','noon','dawn','deepNight','altitude']){
      assert.ok(Number.isFinite(b[key])&&b[key]>=0&&b[key]<=1,key);
      assert.ok(Math.abs(a[key]-b[key])<.04,`${key} should not jump at ${minute}`);
    }
  }
});

test('every time period combines with rain, snow and fog without mutating music or session state',async()=>{
  const {environmentTargets}=await import('../world-environment.js');
  for(const hour of [0,5.5,7,9,12,15,18,20])for(const code of [0,2,3,45,61,75,95]){
    const localSky=E.daylight(Date.parse('2026-10-24T00:00:00Z')+hour*3600000,'UTC'),localWeather=E.weatherForCode(code);
    const state={localSky,localWeather,night:localSky.night>=.5,weather:localWeather.kind,playing:false,elapsed:42,mix:{rain:0,music:35},records:[{id:1}]};
    const before=structuredClone(state),target=environmentTargets(state);
    assert.equal(target.night,localSky.night);assert.deepEqual(state,before);
    if(code===75){assert.ok(target.snow>0);assert.equal(target.rain,0)}
    if(code===45){assert.equal(target.fog,1);assert.equal(target.snow,0)}
  }
});

test('snowfall is actual bounded 3D geometry at every quality, fades out and respects reduced motion',async()=>{
  const {createSnowfall,updateSnowfall}=await import('../world-weather.js');
  for(const quality of ['low','mid','high']){
    const snow=createSnowfall(quality,(x,z)=>Math.sin(x*.1)*Math.cos(z*.1));
    const count=snow.geometry.attributes.position.count;assert.ok(count>=240&&count<=720);assert.equal(snow.visible,false);assert.equal(snow.material.depthWrite,false);
    for(const t of [1,100,10000]){
      updateSnowfall(snow,1,t,{snow:.8,night:1},1);
      assert.equal(snow.visible,true);
      const positions=snow.geometry.attributes.position;
      for(let i=0;i<count;i++){
        assert.ok(Number.isFinite(positions.getX(i)));assert.ok(positions.getY(i)>-1&&positions.getY(i)<26);assert.ok(Math.abs(positions.getZ(i))<30);
      }
    }
    updateSnowfall(snow,1,100,{snow:.8},0,true);const frozen=[...snow.geometry.attributes.position.array];
    updateSnowfall(snow,1,200,{snow:.8},0,true);assert.deepEqual([...snow.geometry.attributes.position.array],frozen);
    for(let i=0;i<20;i++)updateSnowfall(snow,1,201+i,{snow:0});assert.equal(snow.visible,false);
    snow.geometry.dispose();snow.material.dispose();
  }
});
test('snow remains around the view after 0.5x zoom and large panning, without stale geometry culling',async()=>{
  const {createSnowfall,updateSnowfall}=await import('../world-weather.js');
  const snow=createSnowfall('low',(x,z)=>x*.01+z*.02);
  for(const centre of [{x:42,z:70},{x:-42,z:-70}]){
    updateSnowfall(snow,1,3,{snow:1},.5,false,centre);
    assert.equal(snow.position.x,centre.x);assert.equal(snow.position.z,centre.z);assert.equal(snow.frustumCulled,false);
    const first=snow.userData.base[0];assert.ok(Math.abs(first.ground-((first.x+centre.x)*.01+(first.z+centre.z)*.02))<1e-9);
  }
  snow.geometry.dispose();snow.material.dispose();
});

test('the shipped world adds thin ground snow and restores normal ground and fog after weather changes',async()=>{
  globalThis.window??={};const T=await import('../vendor/three/build/three.module.js');await import('../story-world.js');
  const state={night:false,weather:'snow',wind:35,light:65,reduced:false,records:[],localWeather:E.weatherForCode(75)};
  const world=Object.assign(Object.create(window.GardenWorld.prototype),{scene:new T.Scene(),quality:'low',state,canvas:{dataset:{}},hemi:new T.HemisphereLight(),sun:new T.DirectionalLight(),renderer:{},t:0});
  world.scene.fog=new T.FogExp2('#c5dcd3',.007);world.buildTerrain();world.buildSky();
  const shader={uniforms:{},vertexShader:'#include <begin_vertex>',fragmentShader:'#include <color_fragment>'};world.terrain.material.onBeforeCompile(shader);
  assert.equal(shader.uniforms.gardenSnow,world.snowCover);assert.match(shader.fragmentShader,/diffuseColor.rgb=mix/);
  const {createSnowfall}=await import('../world-weather.js');world.snowfall=createSnowfall('low');
  for(let i=0;i<60;i++){world.t+=.1;world.beforeRender(.1)}assert.ok(world.snowCover.value>.7);assert.equal(world.snowfall.visible,true);
  state.weather='fog';state.localWeather=E.weatherForCode(45);
  for(let i=0;i<100;i++)world.beforeRender(.1);assert.ok(world.scene.fog.density>.02);assert.ok(world.snowCover.value<.02);assert.equal(world.snowfall.visible,false);
  state.weather='clear';state.localWeather=E.weatherForCode(0);
  for(let i=0;i<100;i++)world.beforeRender(.1);assert.ok(Math.abs(world.scene.fog.density-.007)<.001);assert.ok(world.snowCover.value<.001);
  state.localSky=E.daylight(Date.parse('2026-10-24T00:00:00Z'),'UTC');state.night=true;world.skyMat.uniforms.night.value=1;
  for(let i=0;i<100;i++)world.beforeRender(.1);
  assert.ok(world.hemi.intensity<.55);assert.ok(world.sun.intensity<.4);assert.ok(world.scene.environmentIntensity<.1,'automatic midnight dims ambient fill as well as the sky');
  state.localSky=null;for(let i=0;i<100;i++)world.beforeRender(.1);
  assert.ok(Math.abs(world.hemi.intensity-.68)<.001);assert.equal(world.scene.environmentIntensity,.22,'manual night keeps its existing fill lighting');
  world.scene.traverse(node=>{node.geometry?.dispose();node.material?.dispose()});
});
