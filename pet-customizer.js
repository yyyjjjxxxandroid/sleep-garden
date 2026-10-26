import {PET_PATTERNS,PET_PRESETS,normalizePetProfile,readPetProfile,savePetProfile,preparePetPhoto} from './pet-photo-profile.mjs';
import {capturePetPortrait} from './pet-portrait.js';

const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text)node.textContent=text;return node};
const vanilla={name:'我的小猫',base:'#fff4e6',accent:'#fff7ee',pattern:'solid',photo:''};

export class PetCustomizer{
  constructor(care){
    this.care=care;this.saved=readPetProfile(care.storage);this.version=0;
    care.w.storyCat.setAppearance(this.saved);
  }
  enter(){this.leave();this.active=true;this.draft=this.saved?{...this.saved}:null;this.busy=false}
  leave(){
    this.version++;if(!this.active)return;
    this.active=false;this.busy=false;this.care.w.storyCat.setAppearance(this.saved);this.invalidate();
  }
  invalidate(){this.care.lookThumbnails=[];this.care.demoPhotos={};this.care.legacyPortrait=null}
  get value(){return this.draft||vanilla}
  render(){
    const {body,footer}=this.care;
    const intro=el('div','pet-custom-intro');intro.append(el('small',null,'照片换肤 · DEMO'),el('h3',null,'把熟悉的它，带进花园'),el('p',null,'用照片里的毛色，试着还原你的小猫。'));
    body.append(intro);
    const compare=el('div','pet-custom-compare');
    const source=el('div','pet-custom-reference');this.reference=el('img');this.reference.alt='你的宠物照片';
    this.empty=el('span','pet-custom-empty','一张正面近照\n让它来到你身边');source.append(this.reference,this.empty,el('small',null,'你的照片'));
    const model=el('div','pet-custom-model');this.preview=el('img');this.preview.alt='当前三维小猫的毛色预览';this.caption=el('small',null,'花园里的它');model.append(this.preview,this.caption);compare.append(source,model);body.append(compare);
    const picker=el('input');picker.type='file';picker.accept='image/jpeg,image/png,image/webp';picker.hidden=true;picker.id='petPhotoInput';
    const upload=el('button','pet-photo-upload','选择宠物照片');upload.type='button';upload.onclick=()=>picker.click();
    picker.onchange=()=>{const file=picker.files?.[0];picker.value='';if(file)this.upload(file)};body.append(picker,upload);
    this.status=el('p','pet-custom-status');this.status.setAttribute('role','status');this.status.setAttribute('aria-live','polite');body.append(this.status);
    const presets=el('div','pet-custom-presets');presets.setAttribute('aria-label','试试示例毛色');presets.append(el('span',null,'先试试'));
    PET_PRESETS.forEach(p=>{const b=el('button',null,p.name);b.type='button';b.onclick=()=>{this.draft={...this.value,...p,name:this.value.name,photo:''};this.refresh('这是示例毛色，也可以上传自己的照片。')};presets.append(b)});body.append(presets);
    const fields=el('div','pet-custom-fields');
    const field=(label,input)=>{const wrap=el('label');wrap.append(el('span',null,label),input);fields.append(wrap);return input};
    this.name=field('它的名字',el('input'));this.name.type='text';this.name.maxLength=16;this.name.placeholder='想怎么称呼它';this.name.autocomplete='off';this.name.id='petPhotoName';
    this.name.oninput=()=>{this.draft={...this.value,name:this.name.value};this.updateSave()};
    this.pattern=field('花纹',el('select'));this.pattern.id='petPhotoPattern';
    Object.entries(PET_PATTERNS).forEach(([key,label])=>{const o=el('option',null,label);o.value=key;this.pattern.append(o)});
    this.pattern.onchange=()=>{this.draft={...this.value,pattern:this.pattern.value};this.refresh('花纹已调整，保存后会留在花园里。')};
    for(const [key,label]of [['base','主要毛色'],['accent','胸口 / 花纹色']]){
      this[key]=field(label,el('input'));this[key].type='color';this[key].id='petPhoto'+(key==='base'?'Base':'Accent');
      this[key].onchange=()=>{this.draft={...this.value,[key]:this[key].value};this.refresh('毛色已调整，可以继续微调。')};
    }
    body.append(fields,el('p','pet-custom-note','照片只在本机处理，保存时仅保留小缩略图。演示版从照片中央提取颜色，背景可能影响结果，可手动微调。体型与动作沿用现有小猫，暂不支持照片生成完整 3D 模型。'));
    this.confirm=el('button','pet-save-outfit','保存并带进花园');this.confirm.id='petPhotoApply';this.confirm.onclick=()=>this.apply();
    this.reset=el('button','pet-custom-reset','恢复原来的小猫');this.reset.id='petPhotoReset';this.reset.onclick=()=>{this.draft=null;this.refresh('已预览原来的小猫，点击保存即可恢复。')};footer.append(this.confirm,this.reset);
    this.refresh(this.saved?'已经记住它的毛色了，随时可以换一张照片。':'支持 JPG / PNG / WebP，最大 8 MB。');
  }
  updateSave(){
    this.confirm.disabled=this.busy||JSON.stringify(normalizePetProfile(this.draft))===JSON.stringify(this.saved);
    this.reset.disabled=this.busy||!this.draft;
  }
  refresh(message){
    if(!this.active)return;
    const value=this.value;
    this.reference.hidden=!value.photo;if(value.photo)this.reference.src=value.photo;else this.reference.removeAttribute('src');this.empty.hidden=!!value.photo;
    this.name.value=value.name;this.pattern.value=value.pattern;this.base.value=value.base;this.accent.value=value.accent;
    this.care.w.storyCat.setAppearance(this.draft);
    try{this.preview.src=capturePetPortrait(this.care.w,{studio:true,width:400,height:460,pose:'wardrobe'})}catch{this.preview.removeAttribute('src');this.preview.alt='近照暂不可用，保存后可在花园查看小猫';}
    this.caption.textContent=this.draft?'毛色预览 · '+(value.name.trim()||'我的小猫'):'原来的小猫';
    this.status.textContent=message;this.status.dataset.error='false';this.updateSave();
  }
  async upload(file){
    if(this.busy||!this.active)return;
    const version=++this.version;this.busy=true;this.updateSave();
    this.care.body.querySelectorAll('input,select,.pet-photo-upload,.pet-custom-presets button').forEach(n=>n.disabled=true);
    this.status.textContent='正在本机提取毛色…';this.status.dataset.error='false';
    try{
      const result=await preparePetPhoto(file);
      if(!this.active||version!==this.version)return;
      this.draft={...this.value,...result};this.refresh('毛色已提取。选个相近的花纹，再给它起个名字吧。');
    }catch(error){if(this.active&&version===this.version){this.status.textContent=error.message;this.status.dataset.error='true'}}
    finally{if(this.active&&version===this.version){this.busy=false;this.care.body.querySelectorAll('input,select,.pet-photo-upload,.pet-custom-presets button').forEach(n=>n.disabled=false);this.updateSave()}}
  }
  apply(){
    if(this.busy||!this.active)return;
    const next=normalizePetProfile(this.draft),stored=savePetProfile(this.care.storage,next);
    this.saved=next;this.invalidate();this.care.w.storyCat.setAppearance(next);
    this.care.services.closeModal();
    this.care.services.toast(stored?(next?`${next.name}已经来到花园，试着摸摸它吧。`:'已经恢复原来的小猫。'):'已应用到本次花园，浏览器暂时无法保存，请勿刷新。');
  }
}
