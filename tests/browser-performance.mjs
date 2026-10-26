// Compare identical builds in the same browser; these are not physical-phone FPS.
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.GARDEN_PLAYWRIGHT||'playwright');
const browser=await chromium.connectOverCDP(process.env.GARDEN_CDP||'http://127.0.0.1:9558');
const context=await browser.newContext({viewport:{width:390,height:844},screen:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:3});
const page=await context.newPage(),errors=[];
page.on('pageerror',error=>errors.push(error.message));
await page.addInitScript(()=>{
  window.performanceWorlds=[];
  for(const name of ['GardenWorld','CityWorld']){
    let Constructor;
    Object.defineProperty(window,name,{configurable:true,get:()=>Constructor,set:Value=>{
      Constructor=new Proxy(Value,{construct(Target,args,NewTarget){
        const world=Reflect.construct(Target,args,NewTarget),render=world.renderer.render.bind(world.renderer);
        world.performanceSamples=[];let depth=0;
        world.renderer.info.autoReset=false;
        world.renderer.render=function(...args){
          const outer=depth++===0,start=performance.now();if(outer)world.renderer.info.reset();
          try{return render(...args);}finally{
            depth--;if(outer&&world.measurePerformance)world.performanceSamples.push({at:start,cpu:performance.now()-start,
              calls:world.renderer.info.render.calls,triangles:world.renderer.info.render.triangles});
          }
        };
        window.performanceWorlds.push({name,world});return world;
      }});
    }});
  }
});
const results={label:process.env.GARDEN_PERF_LABEL||'current',scenarios:[],errors};
async function measure(name,orbit=false){
  await page.evaluate(({name,orbit})=>{
    const world=performanceWorlds.findLast(entry=>entry.name===name).world;
    world.controls.autoRotate=orbit;world.controls.autoRotateSpeed=2;
    world.performanceSamples=[];world.measurePerformance=true;
  },{name,orbit});
  await page.waitForTimeout(3500);
  const report=await page.evaluate(name=>{
    const world=performanceWorlds.findLast(entry=>entry.name===name).world;
    world.measurePerformance=false;world.controls.autoRotate=false;
    const samples=world.performanceSamples,mean=key=>samples.reduce((sum,sample)=>sum+sample[key],0)/Math.max(1,samples.length);
    const intervals=samples.slice(1).map((sample,i)=>sample.at-samples[i].at).sort((a,b)=>a-b);
    return {frames:samples.length,fps:samples.length>1?(samples.length-1)*1000/(samples.at(-1).at-samples[0].at):0,
      renderMs:mean('cpu'),drawCalls:mean('calls'),triangles:mean('triangles'),p95FrameMs:intervals[Math.floor(intervals.length*.95)]||0,
      pixelRatio:world.renderer.getPixelRatio(),shadows:world.renderer.shadowMap.enabled,
      reflectionSize:world.scenery?.water?.getRenderTarget().width,
      gpu:world.renderer.getContext().getParameter(world.renderer.getContext().RENDERER)};
  },name);
  const scenario={scene:name==='GardenWorld'?'garden':await page.evaluate(()=>CityPrototype.world.cityId),orbit,...report};
  results.scenarios.push(scenario);console.log(JSON.stringify(scenario));
}
try{
  await page.goto(process.env.GARDEN_URL||'http://127.0.0.1:8770/index.html');
  await page.waitForSelector('.garden-3d[data-ready="true"]',{timeout:90000});
  await page.waitForTimeout(2000);
  await measure('GardenWorld');await measure('GardenWorld',true);
  await page.locator('#cityButton').tap();await page.locator('#cityLocateButton').tap();
  await page.waitForFunction(()=>window.CityPrototype?.world?.active);
  await page.waitForTimeout(2000);
  await measure('CityWorld');await measure('CityWorld',true);
  await mkdir('build/product-qa',{recursive:true});
  await page.screenshot({path:`build/product-qa/performance-${results.label}.png`});
  await writeFile(`build/product-qa/performance-${results.label}.json`,JSON.stringify(results,null,2));
  if(errors.length)throw Error(errors.join('\n'));
}finally{await context.close();await browser.close();}
