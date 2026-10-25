import * as T from './vendor/three/build/three.module.js';
import { configureSkyBackground } from './world-sky.js';

// Deliberately lit twilight: the deck and companion remain readable at night.
export const CITY_ATMOSPHERES = {
  dusk: {top:'#53687d',horizon:'#e1ae88',fog:'#aa9e94',water:'#486f70',sky:'#e6c8ad',ground:'#695b51',sun:'#ffd0a1',hemi:1.5,key:1.35,exposure:.95},
  night: {top:'#172b4b',horizon:'#667f9e',fog:'#617c91',water:'#284f68',sky:'#adc8e5',ground:'#475562',sun:'#bbd8ef',hemi:1.35,key:.65,exposure:.9},
};
export const defaultCityMood = city => city==='shenzhen'?'night':'dusk';

export function createCitySky(mood){
  const palette=CITY_ATMOSPHERES[mood];
  const material=new T.ShaderMaterial({side:T.BackSide,depthWrite:false,depthTest:false,
    uniforms:{time:{value:0},top:{value:new T.Color(palette.top)},horizon:{value:new T.Color(palette.horizon)}},
    vertexShader:'',fragmentShader:`
      varying vec3 d;
      uniform float time;
      uniform vec3 top, horizon;
      void main(){
        vec3 direction=normalize(d);
        float h=clamp(direction.y,0.,1.);
        vec3 color=mix(horizon,top,pow(h,.48));
        float veil=sin(direction.x*8.+direction.z*4.+time*.006)*sin(direction.z*11.-time*.004);
        color+=vec3(.014)*veil*smoothstep(.03,.3,h);
        gl_FragColor=vec4(color,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`});
  const sky=new T.Mesh(new T.SphereGeometry(100,32,16),material);
  configureSkyBackground(sky);
  return sky;
}
