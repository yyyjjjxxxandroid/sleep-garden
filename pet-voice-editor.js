import {readPetVoice,savePetVoice,preparePetVoice,MAX_PET_VOICE_SECONDS} from './pet-voice.mjs';
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n};
export class PetVoiceEditor{
  constructor(care){
    this.care=care;this.saved=readPetVoice(care.storage);this.version=0;
    document.addEventListener('visibilitychange',()=>{if(document.hidden&&this.active){this.cancelRecording();this.stopPreview();this.message('录音已取消，回到页面后可以重新录制。')}});
    window.addEventListener('pagehide',()=>this.leave());
    window.addEventListener('garden:session-ended',()=>this.leave());
  }
  enter(){this.leave();this.active=true;this.draft=this.saved;this.busy=false;this.recording=false;this.waiting=false}
  leave(){this.active=false;this.version++;this.cancelRecording();this.stopPreview()}
  message(text,error=false){if(!this.status?.isConnected)return;this.status.textContent=text;this.status.dataset.error=String(error)}
  render(){
    const {body,footer}=this.care,intro=el('div','pet-custom-intro');intro.append(el('small',null,'熟悉的声音 · DEMO'),el('h3',null,'让这一声喵，也属于它'),el('p',null,'录下真实叫声，摸摸花园里的小猫时就能听见。'));body.append(intro);
    const stage=el('div','pet-voice-stage');stage.append(el('span','pet-voice-symbol','♪'),el('strong',null,'把它的声音带进花园'));
    this.counter=el('span','pet-voice-counter','最多录制 8 秒');stage.append(this.counter);body.append(stage);
    this.record=el('button','pet-photo-upload','开始录音');this.record.id='petVoiceRecord';this.record.onclick=()=>this.recording?this.stopRecording():this.startRecording();body.append(this.record);
    this.status=el('p','pet-custom-status');this.status.id='petVoiceStatus';this.status.setAttribute('role','status');this.status.setAttribute('aria-live','polite');body.append(this.status);
    const actions=el('div','pet-voice-actions');
    this.listen=el('button',null,'试听');this.listen.id='petVoicePreview';this.listen.onclick=()=>this.preview();
    this.cancel=el('button',null,'取消这次录音');this.cancel.id='petVoiceCancel';this.cancel.onclick=()=>{this.cancelRecording();this.message('已取消，原来的声音保留。');this.refresh()};actions.append(this.listen,this.cancel);body.append(actions);
    const input=el('input');input.type='file';input.accept='audio/*';input.hidden=true;input.id='petVoiceInput';input.onchange=()=>{const file=input.files?.[0];input.value='';if(file)this.process(file)};
    this.upload=el('button','pet-voice-upload','已有录音？选择音频文件');this.upload.onclick=()=>input.click();body.append(input,this.upload,el('p','pet-custom-note','安静环境下，录一声完整叫声即可。首次使用需允许麦克风；8 秒后自动停止，也可提前结束。导入音频使用前 8 秒，最大 10 MB。\n录音只保存在这台浏览器，不上传。Demo 直接播放这段录音，不做声音克隆，也不会改变 AI 说话的人声音色。'));
    this.apply=el('button','pet-save-outfit','用作猫叫');this.apply.id='petVoiceApply';this.apply.onclick=()=>this.save();
    this.reset=el('button','pet-custom-reset','恢复默认猫声');this.reset.id='petVoiceReset';this.reset.onclick=()=>{this.stopPreview();this.draft=null;this.message('点击保存，恢复默认猫声。');this.refresh()};footer.append(this.apply,this.reset);
    this.message(this.saved?'已经记住这段叫声了，播放陪伴声音后摸摸小猫试试。':'准备好后点击录音，让宠物叫一声。');this.refresh();
  }
  refresh(){
    if(!this.active||!this.record)return;
    const locked=this.busy||this.waiting||this.recording;
    this.record.textContent=this.recording?'停止录音':this.waiting?'等待麦克风授权…':this.busy?'正在处理声音…':'开始录音';this.record.disabled=this.busy||this.waiting;
    this.record.setAttribute('aria-pressed',String(!!this.recording));
    this.cancel.hidden=!this.recording&&!this.waiting;this.listen.disabled=!this.draft||locked;this.upload.disabled=locked;this.reset.disabled=!this.draft||locked;
    this.apply.disabled=locked||this.draft?.data===this.saved?.data;
    if(!this.recording)this.counter.textContent=this.draft?`已准备好 ${this.draft.duration.toFixed(1)} 秒的叫声`:'最多录制 8 秒';
  }
  cancelRecording(){
    this.version++;this.recording=false;this.waiting=false;this.busy=false;clearInterval(this.tick);clearTimeout(this.limit);
    const recorder=this.recorder;this.recorder=null;
    if(recorder&&recorder.state!=='inactive'){recorder.onstop=null;try{recorder.stop()}catch{}}
    this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;this.refresh();
  }
  async startRecording(){
    if(this.busy||this.waiting||!this.active)return;
    if(!navigator.mediaDevices?.getUserMedia||!globalThis.MediaRecorder){this.message('当前浏览器无法录音，可选择已有音频，或用 HTTPS / localhost 下的 Chrome、Safari。',true);return}
    this.care.services.preparePetRecording?.();
    this.stopPreview();this.waiting=true;const version=++this.version;this.refresh();this.message('请允许麦克风。授权后立即开始录音。');
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});
      if(!this.active||version!==this.version){stream.getTracks().forEach(t=>t.stop());return}
      this.stream=stream;
      const mimeType=['audio/webm;codecs=opus','audio/mp4','audio/webm'].find(t=>MediaRecorder.isTypeSupported?.(t));
      const recorder=new MediaRecorder(stream,mimeType?{mimeType}:undefined),chunks=[];this.recorder=recorder;
      recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
      recorder.onerror=()=>{if(version===this.version){this.cancelRecording();this.message('录音中断了，请重新录制。',true)}};
      recorder.onstop=()=>{if(!this.active||version!==this.version)return;stream.getTracks().forEach(t=>t.stop());this.stream=null;this.recorder=null;this.recording=false;clearInterval(this.tick);clearTimeout(this.limit);this.process(new Blob(chunks,{type:recorder.mimeType}));};
      recorder.start();this.waiting=false;this.recording=true;const start=performance.now();
      this.counter.textContent='录音中 0.0 / 8 秒';this.tick=setInterval(()=>{this.counter.textContent=`录音中 ${Math.min(8,(performance.now()-start)/1000).toFixed(1)} / 8 秒`},100);
      this.limit=setTimeout(()=>this.stopRecording(),MAX_PET_VOICE_SECONDS*1000);this.message('正在录音…录到一声叫声后，点击停止。');this.refresh();
    }catch(error){if(version!==this.version)return;this.cancelRecording();this.message(error.name==='NotAllowedError'?'麦克风权限未开启，可在浏览器设置中允许，或直接选择音频文件。':'没能打开麦克风，请检查设备或选择音频文件。',true)}
  }
  stopRecording(){if(this.recorder?.state==='recording'){this.record.disabled=true;this.recorder.stop();clearInterval(this.tick);clearTimeout(this.limit)}}
  async process(blob){
    if(!this.active||this.recording||this.waiting||this.busy)return;this.stopPreview();this.busy=true;const version=++this.version;this.refresh();this.message('正在整理叫声、淡化开头和结尾…');
    try{const value=await preparePetVoice(blob);if(!this.active||version!==this.version)return;this.draft=value;this.message('录好了！先试听，再点「用作猫叫」。')}
    catch(error){if(this.active&&version===this.version)this.message(error.message,true)}
    finally{if(this.active&&version===this.version){this.busy=false;this.refresh()}}
  }
  stopPreview(){if(this.player){this.player.pause();this.player.removeAttribute('src');this.player.load();this.player=null}if(this.listen)this.listen.textContent='试听'}
  async preview(){
    if(!this.draft||this.busy||this.recording)return;
    if(this.player){this.stopPreview();return}
    const player=new Audio(this.draft.data);this.player=player;player.volume=.6;this.listen.textContent='停止试听';player.onended=()=>{if(this.player===player)this.stopPreview()};
    try{await player.play()}catch{if(this.player===player){this.stopPreview();this.message('声音未能播放，请再点一次试听。',true)}}
  }
  save(){
    if(!this.active||this.busy||this.recording||this.waiting)return;
    const ok=savePetVoice(this.care.storage,this.draft);this.saved=this.draft;this.stopPreview();this.care.services.closeModal();
    this.care.services.toast(ok?(this.saved?'已经换成它的叫声，继续播放后摸摸小猫试试。':'已恢复默认猫声。'):'本次叫声已应用，浏览器暂时无法保存，刷新后会丢失。');
  }
}
