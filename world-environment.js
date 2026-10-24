// Rendering targets are independent of music, camera, and pet controls.
export function environmentTargets(state){
  const sky=state.localSky;
  const night=sky?.night??(state.night?1:0);
  const cloud=state.localWeather?.cloud??(['cloudy','rain','snow','fog'].includes(state.weather)?1:0);
  return {night,cloud,warmth:(sky?.warmth||0)*(1-cloud*.8),dawn:(sky?.dawn||0)*(1-cloud*.7),noon:sky?.noon||0,deepNight:sky?.deepNight||0,altitude:sky?.altitude??1,sunX:sky?.sunX??-15,
    rain:state.weather==='rain'?(state.localWeather?.rain??1):0,
    snow:state.weather==='snow'?(state.localWeather?.snow??.7):0,
    fog:state.weather==='fog'?(state.localWeather?.fog??1):0};
}

export function approach(current,target,dt,rate=.8){
  return current+(target-current)*(1-Math.exp(-Math.max(0,dt)*rate));
}
