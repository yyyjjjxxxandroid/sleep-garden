// Run after a trusted start with a legacy all-muted recipe containing an
// obsolete music value. Removing the composition must preserve that silence.
(async()=>{
  const $=id=>document.getElementById(id),app=$('app'),results=[];
  const assert=(ok,label)=>{if(!ok)throw Error(label);results.push(label)};
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const saved=()=>JSON.parse(localStorage.getItem('sleepGarden.v1')||'{}');
  const keys=['sun','wind','rain','bugs','cat','water'];
  const records=saved().records?.length||0;
  assert(app.dataset.audio==='running','a trusted start still activates ambient playback');
  assert(typeof GardenScore==='undefined'&&!$('volume-music')&&!$('musicRetry'),'the removed composition has no renderer or controls');
  assert(document.querySelectorAll('.sound-slider').length===6,'the six existing sound channels remain available');
  assert(keys.every(k=>$('volume-'+k).value==='0')&&$('soundState').textContent==='已静音','an all-muted legacy recipe stays silent despite its obsolete music value');
  $('soundButton').click();$('mute-rain').click();
  assert(Number($('volume-rain').value)>0&&keys.filter(k=>Number($('volume-'+k).value)>0).length===1,'enabling rain changes only the rain channel');
  $('volume-rain').value='47';$('volume-rain').dispatchEvent(new Event('input',{bubbles:true}));
  assert(saved().mix.rain===47&&!('music' in saved().mix),'saving a sound preference keeps its value and discards the obsolete music key');
  $('mute-rain').click();$('mute-rain').click();
  assert($('volume-rain').value==='47','muting and restoring rain retains the chosen volume');
  $('soundOverlay').querySelector('.close-sheet').click();$('playButton').click();
  const originalResume=AudioContext.prototype.resume;let resumes=0;
  AudioContext.prototype.resume=function(...args){resumes++;return originalResume.apply(this,args)};
  try{
    const elapsed=$('elapsed').textContent;
    $('soundButton').click();$('mute-wind').click();await wait(1100);
    assert(app.dataset.audio==='paused'&&resumes===0&&$('elapsed').textContent===elapsed,'changing sound while paused does not resume audio or the timer');
    assert((saved().records?.length||0)===records,'sound adjustments create no completion record');
    for(const k of keys)if($('mute-'+k).getAttribute('aria-pressed')==='true')$('mute-'+k).click();
    assert(keys.every(k=>saved().mix[k]===0)&&$('soundState').textContent==='已静音','muting all existing channels leaves a fully silent recipe');
    $('soundOverlay').querySelector('.close-sheet').click();$('finishButton').click();$('finishButton').click();
    assert(saved().records.length===records+1&&!('music' in saved().records.at(-1).mix),'ending stores one record with only the existing sound channels');
  }finally{AudioContext.prototype.resume=originalResume}
  return {passed:results.length,results};
})();
