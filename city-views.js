import * as T from './vendor/three/build/three.module.js';
const view=(x,y,z,tx,ty,tz)=>({position:new T.Vector3(x,y,z),target:new T.Vector3(tx,ty,tz)});

export const CITY_WATERFRONT_FOV=58;
export const CITY_VIEWS={
  guangzhou:{
    entrance:view(3,7,29,0,9,-28),courtyard:view(11.5,6.2,12,0,.7,-9),
    bridge:view(6.8,4.2,-4,-6,13,-72),left:view(6.4,3.8,-9,-11,4,-60),right:view(13,23,11,-9,24,-76),
  },
  shenzhen:{
    entrance:view(3,7,29,0,9,-28),courtyard:view(11.5,6.2,12,0,.8,-7),
    bridge:view(6.6,3.6,-1,0,.6,-23),left:view(5.9,4,-8,-10,.15,-27),right:view(14,22,12,4,21,-96),
  },
};
