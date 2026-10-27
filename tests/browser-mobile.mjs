// GARDEN_PLAYWRIGHT=/path/to/playwright/index.mjs GARDEN_CDP=http://127.0.0.1:9558 GARDEN_URL=http://127.0.0.1:8768/index.html node tests/browser-mobile.mjs
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.GARDEN_PLAYWRIGHT||'playwright');
const browser=await chromium.connectOverCDP(process.env.GARDEN_CDP||'http://127.0.0.1:9558');
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
const page=await context.newPage(),cdp=await context.newCDPSession(page),errors=[],checks=[];
page.on('pageerror',error=>errors.push(error.message));
const check=(value,label)=>{assert.ok(value,label);checks.push(label);};
const touch=async(type,points)=>{await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(([id,x,y])=>({id,x,y,radiusX:5,radiusY:5}))});};
async function drag(points){await touch('touchStart',points[0]);for(const frame of points.slice(1)){await touch('touchMove',frame);await page.waitForTimeout(30);}await touch('touchEnd',[]);await page.waitForTimeout(500);}
const camera=()=>page.evaluate(()=>{const w=CityPrototype.world;return {position:w.camera.position.toArray(),distance:w.camera.position.distanceTo(w.controls.target),commands:window.mobileCommands};});
const shot=async name=>page.screenshot({path:'build/product-qa/mobile-'+name+'.png'});
try{
  await mkdir('build/product-qa',{recursive:true});
  await page.goto(process.env.GARDEN_URL||'http://127.0.0.1:8768/index.html');
  await page.waitForSelector('.garden-3d[data-ready="true"]',{timeout:60000});
  await page.waitForFunction(()=>document.getElementById('app').dataset.session==='idle');
  await shot('garden-390');
  check(await page.locator('.garden-3d').evaluate(c=>getComputedStyle(c).touchAction==='none'),'garden canvas owns touch gestures');
  await page.locator('#cityButton').tap();await page.locator('#cityLocateButton').tap();
  await page.waitForFunction(()=>window.CityPrototype?.world?.active);
  await page.waitForTimeout(1500);
  await page.evaluate(()=>{
    const w=CityPrototype.world;window.mobileCommands=0;
    const original=w.goTo;w.goTo=function(...args){window.mobileCommands++;return original.apply(this,args);};
  });
  const before=await camera();
  await drag([[[1,160,340]],[[1,175,345]],[[1,195,350]],[[1,220,355]],[[1,240,360]]]);
  const rotated=await camera();
  check(Math.hypot(...rotated.position.map((v,i)=>v-before.position[i]))>.2,'one finger drag rotates the camera');
  check(rotated.commands===0,'rotation does not command walking');
  await drag([[[1,130,340],[2,250,340]],[[1,115,340],[2,265,340]],[[1,100,340],[2,280,340]],[[1,85,340],[2,295,340]]]);
  const closer=await camera();check(closer.distance<rotated.distance*.9,'spreading two fingers zooms in');check(closer.commands===0,'pinch does not command walking');
  await drag([[[1,85,340],[2,295,340]],[[1,100,340],[2,280,340]],[[1,115,340],[2,265,340]],[[1,130,340],[2,250,340]]]);
  const farther=await camera();check(farther.distance>closer.distance*1.1,'closing two fingers zooms out');check(farther.commands===0,'zooming out does not command walking');
  await page.evaluate(()=>CityPrototype.world.setView('entrance',true));await page.waitForTimeout(400);
  const destination=await page.evaluate(()=>{
    const w=CityPrototype.world,point=w.actors.human.position.clone();point.x=1;point.z=4;
    const r=w.canvas.getBoundingClientRect();point.project(w.camera);
    return {x:r.left+(point.x+1)*r.width/2,y:r.top+(1-point.y)*r.height/2};
  });
  await page.touchscreen.tap(destination.x,destination.y);
  check((await camera()).commands===1,'an emulated touchscreen tap commands the visible walkable path');
  await page.waitForFunction(()=>Math.abs(CityPrototype.world.actors.human.position.z-4)<.1,{},{timeout:12000});
  check(await page.evaluate(()=>Math.abs(CityPrototype.world.actors.human.position.x-1)<.1),'person reaches the tapped destination');
  await shot('city-390');
  for(const [width,height]of [[320,640],[844,390],[1440,900]]){
    await page.setViewportSize({width,height});await page.waitForTimeout(350);
    check(await page.locator('.city-3d-canvas').evaluate(c=>{const r=c.getBoundingClientRect();return r.width>0&&r.height>0&&r.left>=-1&&r.right<=innerWidth+1;}),`city canvas fits ${width}x${height}`);
    await shot('city-'+width);
  }
  await page.setViewportSize({width:390,height:844});
  for(const city of ['guangzhou','shenzhen']){
    await page.locator('#cityBackButton').tap();
    await page.locator(`[data-city-choice="${city}"]`).tap();
    await page.locator('#cityLocateButton').tap();
    await page.waitForFunction(city=>CityPrototype.world?.active&&CityPrototype.world.cityId===city,city);
    await page.waitForFunction(()=>CityPrototype.world.canvas.dataset.nature==='textured-quaternius');
    check(await page.evaluate(()=>!CityPrototype.world.renderer.shadowMap.enabled&&CityPrototype.world.renderer.getPixelRatio()<=1),`${city} uses the phone rendering budget`);
    check(await page.evaluate(()=>CityPrototype.world.actors.goTo({x:0,z:4})),`${city} walkable path remains reachable`);
    await page.waitForFunction(()=>Math.abs(CityPrototype.world.actors.human.position.z-4)<.1,{},{timeout:12000});
    await shot(city+'-390');
  }
  check(errors.length===0,'no browser exceptions');
  await writeFile('build/product-qa/mobile-results.json',JSON.stringify({checks,errors},null,2));
  console.log(JSON.stringify({passed:checks.length,checks,errors},null,2));
}finally{await context.close();await browser.close();}
