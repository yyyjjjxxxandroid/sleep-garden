import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {createInterface} from 'node:readline';

const ROOT=fileURLToPath(new URL('.',import.meta.url));
export function createCompanionTts({root=ROOT,env=process.env}={}){
  const python=env.COMPANION_TTS_PYTHON||join(root,'.venv-tts',process.platform==='win32'?'Scripts/python.exe':'bin/python');
  const model=join(root,'models/companion-tts/kokoro-int8-multi-lang-v1_1');
  let worker=null,pending=null;
  const available=()=>env.COMPANION_TTS_ENABLED!=='false'&&existsSync(python)&&['.ready','model.int8.onnx','voices.bin','tokens.txt','lexicon-zh.txt'].every(p=>existsSync(join(model,p)));
  function close(){const child=worker;worker=null;if(child)child.kill();if(pending){const task=pending;pending=null;task.reject(Error('speech_interrupted'));}}
  function start(){
    if(worker)return;
    const child=spawn(python,['-u',join(root,'scripts/companion_tts_worker.py'),model],{stdio:['pipe','pipe','ignore'],env:{...env,PYTHONUNBUFFERED:'1'}});
    worker=child;child.stdin.on('error',()=>{if(worker===child)close();});
    const lines=createInterface({input:child.stdout});
    lines.on('line',line=>{
      if(worker!==child||!pending)return;
      const task=pending;pending=null;
      try{
        if(line.length>5_000_000)throw Error();
        const value=JSON.parse(line);if(value.error||typeof value.audio!=='string')throw Error();
        const audio=Buffer.from(value.audio,'base64');if(audio.length<44||audio.toString('ascii',0,4)!=='RIFF'||audio.length>4_000_000)throw Error();
        task.resolve(audio);
      }catch{task.reject(Error('speech_failed'));}
    });
    child.once('error',()=>{if(worker===child)close();});
    child.once('exit',()=>{lines.close();if(worker===child)close();});
  }
  async function synthesize({text,cue='none'}={},signal){
    if(typeof text!=='string'||!text.trim()||text.length>240||!['none','meow','purr'].includes(cue))throw Error('invalid_speech');
    if(signal?.aborted)throw Error('speech_interrupted');
    if(!available())throw Error('speech_unavailable');
    if(pending)throw Error('speech_busy');
    start();let task;
    const result=new Promise((resolve,reject)=>{task={resolve,reject};pending=task;});
    const abort=()=>{if(pending===task)close();};
    signal?.addEventListener('abort',abort,{once:true});
    const timeout=setTimeout(()=>{if(pending===task)close();},45000);
    try{worker.stdin.write(JSON.stringify({text:text.trim(),cue})+'\n');return await result;}
    finally{clearTimeout(timeout);signal?.removeEventListener('abort',abort);}
  }
  return {available,synthesize,close};
}
