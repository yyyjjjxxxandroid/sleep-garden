const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const {execFileSync}=require('node:child_process');

async function validateBundle(bundle,html){
  const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
  for(const script of scripts)new vm.Script(script);
  let imports;
  const context=vm.createContext({window:{},console,AbortController,document:{createElement:()=>({}),head:{append:node=>{assert.equal(node.type,'importmap');imports=JSON.parse(node.textContent).imports;}}}});
  const modules=new Map();
  const get=key=>{if(!modules.has(key)){assert.ok(imports[key]?.startsWith('data:text/javascript;base64,'),key);const code=Buffer.from(imports[key].split(',')[1],'base64').toString();modules.set(key,new vm.SourceTextModule(code,{context,identifier:key}));}return modules.get(key);};
  if(!bundle.includes("map.type='importmap'")){new vm.Script(bundle).runInContext(context);assert.equal(context.window.GARDEN_PLOT_COUNT,6);assert.equal(typeof context.window.GardenWorld,'function');assert.equal(typeof context.window.CityWorld,'function');return;}
  const compiled=new vm.Script(bundle,{importModuleDynamically:async key=>{const entry=get(key);await entry.link(name=>get(name));await entry.evaluate();return entry;}});
  compiled.runInContext(context);await context.window.GARDEN_READY;
  assert.equal(context.window.GARDEN_PLOT_COUNT,6);assert.equal(typeof context.window.GardenWorld,'function');assert.equal(typeof context.window.CityWorld,'function');
  assert.ok(modules.has('garden/garden-companion.js'));assert.ok(modules.has('garden/garden-navigation.mjs'));
  assert.ok(modules.has('garden/city-world.js'));assert.ok(modules.has('garden/world-environment.js'));assert.ok(modules.has('garden/world-weather.js'));
  assert.ok(html.includes('Promise.resolve(window.GARDEN_READY).then('));
}

test('offline HTML has a complete local module graph and initializes its six-plot world class',async()=>{
  const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  await validateBundle(fs.readFileSync(path.join(root,'world3d.bundle.js'),'utf8'),html);
});

test('native offline fallback resolves new weather modules without esbuild or network downloads',async()=>{
  const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const bundle=execFileSync('python3',['-c','from pathlib import Path; from offline_modules import bundle_modules; print(bundle_modules(Path.cwd()))'],{cwd:root,encoding:'utf8',maxBuffer:16*1024*1024});
  await validateBundle(bundle,html);
});

test('the shipped page retains original credits without adding weather implementation copy to the panel',()=>{
  const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const panel=html.match(/<details class="asset-credits">([\s\S]*?)<\/details>/)?.[1];
  assert.ok(panel);assert.match(panel,/Quaternius/);assert.match(panel,/Three.js/);assert.match(panel,/Freesound/);
  assert.doesNotMatch(panel,/Open-Meteo|BigDataCloud/);
  assert.match(html,/<!--\s*Third-party notices[\s\S]*?Weather data by Open-Meteo[\s\S]*?-->/);
});
