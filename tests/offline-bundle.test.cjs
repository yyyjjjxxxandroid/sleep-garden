const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

test('offline HTML has a complete local module graph and initializes its six-plot world class',async()=>{
  const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
  for(const script of scripts)new vm.Script(script);
  let imports;
  const context=vm.createContext({window:{},console,AbortController,document:{createElement:()=>({}),head:{append:node=>{assert.equal(node.type,'importmap');imports=JSON.parse(node.textContent).imports;}}}});
  const modules=new Map();
  const get=key=>{if(!modules.has(key)){assert.ok(imports[key]?.startsWith('data:text/javascript;base64,'),key);const code=Buffer.from(imports[key].split(',')[1],'base64').toString();modules.set(key,new vm.SourceTextModule(code,{context,identifier:key}));}return modules.get(key);};
  const bundle=fs.readFileSync(path.join(root,'world3d.bundle.js'),'utf8');
  if(!bundle.includes("map.type='importmap'")){new vm.Script(bundle).runInContext(context);assert.equal(context.window.GARDEN_PLOT_COUNT,6);assert.equal(typeof context.window.GardenWorld,'function');return;}
  const compiled=new vm.Script(bundle,{importModuleDynamically:async key=>{const entry=get(key);await entry.link(name=>get(name));await entry.evaluate();return entry;}});
  compiled.runInContext(context);await context.window.GARDEN_READY;
  assert.equal(context.window.GARDEN_PLOT_COUNT,6);assert.equal(typeof context.window.GardenWorld,'function');
  assert.ok(modules.has('garden/garden-companion.js'));assert.ok(modules.has('garden/garden-navigation.mjs'));
  assert.ok(html.includes('Promise.resolve(window.GARDEN_READY).then('));
});
