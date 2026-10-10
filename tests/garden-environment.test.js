const {test}=require('node:test'),assert=require('node:assert/strict'),{readFileSync}=require('node:fs'),vm=require('node:vm');
test('weather controls represent real per-scene parameters and preserve sound and daylight',async()=>{
  const E=await import('../garden-environment.js'),state={weather:'aurora',night:true,light:60,wind:35,mix:{rain:0,wind:0},playing:false,elapsed:42,weatherEffects:{...E.defaultEffects}},before=structuredClone(state);
  assert.deepEqual(E.environmentControls('rain').map(x=>x[0]),['rainDensity','cloudLight']);assert.deepEqual(E.environmentControls('aurora').map(x=>x[0]),['auroraStrength','auroraSpeed']);assert.deepEqual(E.environmentControls('meteor').map(x=>x[0]),['meteorRate','nightLight']);assert.equal(E.environmentControls('clear',true)[1][0],'nightLight');
  E.writeEnvironment(state,'auroraStrength',90);E.writeEnvironment(state,'auroraSpeed',0);E.writeEnvironment(state,'nightLight',70);assert.equal(E.writeEnvironment(state,'__proto__',5),false);
  assert.deepEqual(state.mix,before.mix);assert.equal(state.night,true);assert.equal(state.light,60);assert.equal(state.wind,35);assert.equal(state.elapsed,42);assert.equal(state.playing,false);
  const visual=E.weatherVisuals(state,12);assert.equal(visual.aurora,.9);assert.equal(visual.auroraSpeed,0);assert.equal(visual.rain,0);
  state.weather='meteor';E.writeEnvironment(state,'meteorRate',0);assert.equal(E.weatherVisuals(state,0).meteor,false);E.writeEnvironment(state,'meteorRate',100);assert.equal(E.weatherVisuals(state,6.2).meteor,true);E.writeEnvironment(state,'meteorRate',10);assert.equal(E.weatherVisuals(state,6.2).meteor,false);
  state.weather='rain';E.writeEnvironment(state,'rainDensity',0);assert.equal(E.weatherVisuals(state,0).rain,0);E.writeEnvironment(state,'rainDensity',100);assert.equal(E.weatherVisuals(state,0).rain,1);
});
test('production weather slider dispatch does not switch night off or overwrite muted sound',async()=>{
 const E=await import('../garden-environment.js'),source=readFileSync(require.resolve('../source.html'),'utf8'),code=source.split('\n').find(line=>line.startsWith('function changeEnvironment('));
 const state={weather:'aurora',night:true,light:60,wind:35,windLink:true,mix:{wind:0,rain:0},playing:false,elapsed:9,weatherEffects:{...E.defaultEffects}};let updates=0;
 const scope={environment:E,state,updateEnvironment(){updates++},changedMix(){throw Error('weather effect must not touch sound')}};vm.createContext(scope);vm.runInContext(code,scope);scope.changeEnvironment({dataset:{setting:'auroraStrength'},value:'80'});scope.changeEnvironment({dataset:{setting:'nightLight'},value:'20'});
 assert.equal(state.night,true);assert.equal(state.weather,'aurora');assert.equal(state.weatherEffects.auroraStrength,80);assert.equal(state.weatherEffects.nightLight,20);assert.deepEqual(state.mix,{wind:0,rain:0});assert.equal(updates,2);
});

test('production panel updates labels, values and relevant settings across weather and night',async()=>{
 const E=await import('../garden-environment.js'),source=readFileSync(require.resolve('../source.html'),'utf8'),start=source.indexOf('function updateEnvironment(){'),end=source.indexOf('\nfunction changeEnvironment',start),elements=new Map(),get=id=>{if(!elements.has(id))elements.set(id,{dataset:{},style:{},row:{},setAttribute(k,v){this[k]=v},closest(){return this.row}});return elements.get(id)};
 const state={weather:'rain',night:false,wind:35,light:60,fireflies:true,windLink:true,reduced:false,weatherEffects:{...E.defaultEffects}};
 const scope={environment:E,state,$:get,app:{dataset:{},classList:{toggle(){}}}};vm.createContext(scope);vm.runInContext(source.slice(start,end),scope);
 scope.updateEnvironment();assert.equal(get('environmentPrimary').textContent,'雨量');assert.equal(get('windMotion').dataset.setting,'rainDensity');assert.equal(get('sunLight').dataset.setting,'cloudLight');assert.equal(get('windLink').row.hidden,true);assert.equal(get('fireflyToggle').row.hidden,true);
 state.weather='aurora';state.night=true;scope.updateEnvironment();assert.equal(get('environmentSecondary').textContent,'流动速度');assert.equal(get('sunLight').dataset.setting,'auroraSpeed');assert.equal(get('fireflyToggle').row.hidden,false);
 state.weather='clear';scope.updateEnvironment();assert.equal(get('sunLight').dataset.setting,'nightLight');assert.equal(get('windLink').row.hidden,false);
});
