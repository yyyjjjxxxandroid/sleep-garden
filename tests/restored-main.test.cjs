const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');

test('restored main keeps city experiences, local weather and plant persistence',()=>{
 const html=read('source.html'),world=read('story-world.js');
 for(const feature of ['id="cityButton"','GardenEnvironment.create(','restorePendingPlant(','persistGrowingPlant(','plantGrowthCue','id="plantedCount"'])assert.ok(html.includes(feature),feature);
 for(const feature of ['installGardenContent','installGardenOutskirts','window.CityWorld=CityWorld'])assert.ok(world.includes(feature),feature);
});

test('approved simplified UI and foldable panels coexist with newer garden stats',()=>{
 const html=read('source.html'),css=read('garden-polish.css');
 assert.match(html,/id="dockToggle"/);
 assert.match(html,/expandSoundSheet\(expanded\)/);
 assert.match(html,/worldEngine\.focusGarden\(\)/);
 assert.doesNotMatch(html,/id="inviteCatButton"/);
 const result=html.match(/id="resultOverlay"[\s\S]*?<\/section>/)[0];
 assert.doesNotMatch(result,/有让你放松|这一刻，被花园|不需要每天/);
 assert.match(result,/<div hidden><button id="skipFeedback"/);
 assert.match(css,/#resetButton\{display:none!important\}/);
 assert.match(css,/\.quick-actions,\.asset-credits/);
 assert.match(html,/id="plantedCount"/);
});

test('all nine sound layers have distinct groups and motion-linked source state',()=>{
 const html=read('source.html');
 const groups=html.match(/const soundCategories=(\[.*?\]);/)[1];
 const parsed=Function('return '+groups)(),keys=parsed.flatMap(([,keys])=>keys);
 assert.equal(keys.length,9);assert.equal(new Set(keys).size,9);
 assert.deepEqual(parsed.map(([name])=>name),['自然声','小猫声','花园物件声','背景音乐']);
 assert.match(html,/catMoving:!!worldEngine\?\.catMoving/);
 assert.match(html,/chimeContact:worldEngine\?\.chimeContact/);
 assert.match(read('story-world.js'),/buildWindChime\(\)/);
 assert.match(read('garden-audio.js'),/plantGrowthCue\(stage=0\)/);
});

test('companionship defaults to unlimited time and need changes preserve explicit timers',()=>{
 const source=read('garden-experience.js');
 assert.match(source,/context\.need=b\.dataset\.need;refresh\(false\)/);
 assert.match(source,/refresh\(false\);pending\(\);/);
 assert.doesNotMatch(source,/refresh\(!Number\.isInteger\(hooks\.savedTimer\)\)/);
});

test('all stream ribbons, including the new wetland, receive the pond reflection',()=>{
 const detail=read('story-detail.js'),world=read('story-world.js');
 assert.match(detail,/w\.scene\.traverse\(o=>\{if\(o\.isMesh&&o!==w\.water&&o\.material===w\.waterMat\)streams\.push\(o\)/);
 assert.match(detail,/for\(const stream of streams\)/);
 assert.ok(world.indexOf('this.outskirts=installGardenOutskirts')<world.indexOf('this.details=installDetails'));
});
