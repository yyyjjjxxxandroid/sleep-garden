const controls={
  clear:[['wind','风吹动效','无风','枝叶轻摆'],['light','阳光强度','树荫微光','阳光洒落']],
  rainbow:[['rainbowStrength','虹光浓淡','淡淡虹光','清晰虹光'],['light','雨后亮度','柔和','明亮']],
  rain:[['rainDensity','雨量','停雨','绵密细雨'],['cloudLight','雨天亮度','阴沉','柔亮']],
  aurora:[['auroraStrength','极光亮度','微光','明亮'],['auroraSpeed','流动速度','静止','缓缓流动']],
  meteor:[['meteorRate','流星频率','暂停','较频繁'],['nightLight','夜景明暗','深夜','月色明亮']]
};
export const defaultEffects={rainDensity:55,cloudLight:45,auroraStrength:65,auroraSpeed:35,meteorRate:40,nightLight:45,rainbowStrength:65};
export function environmentControls(weather,night=false){
  if(weather==='clear'&&night)return [['wind','风吹动效','无风','枝叶轻摆'],['nightLight','夜景明暗','深夜','月色明亮']];
  if(weather==='rain'&&night)return [controls.rain[0],['nightLight','雨夜明暗','深夜','柔和月色']];
  return controls[weather]||controls.clear;
}
export function readEnvironment(state,key){return Math.max(0,Math.min(100,Number(key==='wind'||key==='light'?state[key]:state.weatherEffects?.[key]??defaultEffects[key])||0))}
export function writeEnvironment(state,key,value){
  if(!['wind','light',...Object.keys(defaultEffects)].includes(key))return false;
  value=Math.max(0,Math.min(100,Number(value)||0));
  if(key==='wind'||key==='light')state[key]=value;else{state.weatherEffects??={...defaultEffects};state.weatherEffects[key]=value}
  return true;
}
export function weatherVisuals(state,t){
  const rain=state.weather==='rain'?readEnvironment(state,'rainDensity')/100:0,rate=readEnvironment(state,'meteorRate')/100,interval=26-rate*20,age=(t-(state.weatherAt||0))%interval;
  return {rain,cloudLight:readEnvironment(state,'cloudLight')/100,nightLight:readEnvironment(state,'nightLight')/100,rainbow:state.weather==='rainbow'?readEnvironment(state,'rainbowStrength')/100:0,aurora:state.weather==='aurora'?readEnvironment(state,'auroraStrength')/100:0,auroraSpeed:readEnvironment(state,'auroraSpeed')/100*1.8,meteor:state.weather==='meteor'&&rate>0&&age<1.4,meteorAge:age};
}
