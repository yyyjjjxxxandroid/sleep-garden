import * as T from './vendor/three/build/three.module.js';
import { Reflector } from './vendor/three/examples/jsm/objects/Reflector.js';

export const CITY_WATER_LEVEL=-1.18;

// Reference 07: dark grey-green tidal water, fine horizontal wavelets and
// broken silver reflections beside the granite piers. No external textures.
const shader={
  name:'LuoyangTidalWater',
  uniforms:{
    color:{value:new T.Color('#284c43')},
    tDiffuse:{value:null},textureMatrix:{value:new T.Matrix4()},
    time:{value:0},sunDirection:{value:new T.Vector3(-12,22,9).normalize()},
  },
  vertexShader:`
    uniform mat4 textureMatrix;
    uniform float time;
    varying vec4 reflectionCoord;
    varying vec3 worldP;
    #include <common>
    #include <fog_pars_vertex>
    void main(){
      vec3 p=position;
      // A small vertical swell; the water stays calm around the historic bridge.
      vec4 baseWorld=modelMatrix*vec4(p,1.);
      p.z+=sin(baseWorld.x*.72+baseWorld.z*1.08-time*.48)*.010
        +sin(baseWorld.x*1.6-baseWorld.z*.53+time*.37)*.006;
      worldP=(modelMatrix*vec4(p,1.)).xyz;
      reflectionCoord=textureMatrix*vec4(p,1.);
      vec4 mvPosition=modelViewMatrix*vec4(p,1.);
      gl_Position=projectionMatrix*mvPosition;
      #include <fog_vertex>
    }`,
  fragmentShader:`
    uniform vec3 color;
    uniform sampler2D tDiffuse;
    uniform float time;
    uniform vec3 sunDirection;
    varying vec4 reflectionCoord;
    varying vec3 worldP;
    #include <common>
    #include <fog_pars_fragment>

    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float noise(vec2 p){
      vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
      return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);
    }
    vec2 noiseGradient(vec2 p){
      vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f),du=6.*f*(1.-f);
      float a=hash(i),b=hash(i+vec2(1.,0.));
      float c=hash(i+vec2(0.,1.)),d=hash(i+1.);
      return vec2(mix(b-a,d-c,u.y)*du.x,mix(c-a,d-b,u.x)*du.y);
    }
    // Short, stretched noise gradients break up wind waves into uneven facets.
    // Independent scales and drifting domains avoid long coherent sine stripes.
    vec2 waveSlope(vec2 p,float t){
      vec2 drift=vec2(t*.07,-t*.10);
      vec2 q=p+vec2(noise(p*.62+drift*.23),noise(p*.73-drift*.31))*.12;
      vec2 facets=noiseGradient(q*vec2(2.4,9.1)+drift)*vec2(.075,.24);
      facets+=noiseGradient(q*vec2(5.7,16.3)-drift*1.6+12.3)*vec2(.055,.17);
      facets+=noiseGradient(p*vec2(12.8,37.2)+drift*2.1+28.7)*vec2(.03,.09);
      return facets;
    }
    void main(){
      vec2 p=worldP.xz;
      vec3 view=normalize(cameraPosition-worldP);
      float distanceToEye=length(cameraPosition-worldP);
      // Fade the smallest wavelets before their projected size causes aliasing.
      float detail=1.-smoothstep(28.,85.,distanceToEye);
      vec2 slope=waveSlope(p,time);
      slope+=waveSlope(p*2.17+vec2(7.2,11.3),time*.73)*(.14*detail);
      vec3 normal=normalize(vec3(-slope.x,1.,-slope.y));
      float fresnel=.045+.60*pow(1.-max(0.,dot(normal,view)),3.);
      vec2 uv=reflectionCoord.xy/reflectionCoord.w;
      vec2 distortion=slope*(.003+min(.035,.25/max(3.,distanceToEye)));
      uv=clamp(uv+distortion,vec2(.002),vec2(.998));
      // The HDR reflection contains the real bridge, stone towers, banyan and
      // sky. It is tone mapped only once, when mixed with the water body.
      vec3 reflected=texture2D(tDiffuse,uv).rgb;
      float patches=noise(p*.24+vec2(time*.012,-time*.009));
      vec3 body=color*mix(.65,1.08,patches);
      float beneathBridge=(1.-smoothstep(1.8,3.7,abs(p.x)))
        *smoothstep(-43.,-39.,p.y)*(1.-smoothstep(-4.,-1.,p.y));
      float byPier=(1.-smoothstep(2.15,4.3,abs(p.x)))
        *(1.-smoothstep(.45,1.6,abs(mod(p.y+6.+3.9,7.8)-3.9)))
        *smoothstep(-41.,-37.,p.y)*(1.-smoothstep(-4.,-1.,p.y));
      body*=1.-beneathBridge*.42-byPier*.16;
      vec3 water=mix(body,reflected*.64,fresnel);
      // A broad, faint sky sheen plus small broken highlights, as seen on
      // overcast estuary water. Avoid the white, opaque sheet of the old shader.
      vec3 halfSky=normalize(view+vec3(-.18,.85,.38));
      float skyGlint=pow(max(0.,dot(normal,halfSky)),34.);
      float sunGlint=pow(max(0.,dot(normal,normalize(view+sunDirection))),110.);
      float broken=.30+.70*noise(p*vec2(4.7,8.3)+vec2(-time*.12,time*.08));
      water+=vec3(.26,.31,.29)*skyGlint*broken*.40*(1.-beneathBridge*.70);
      water+=vec3(.70,.72,.60)*sunGlint*.16;
      // Alternating bright and dark facets are directional and change with
      // the orbit camera, so water still reads correctly in both side views.
      water*=.78+.32*max(0.,dot(normal,normalize(vec3(-.25,1.,.6))));
      gl_FragColor=vec4(water,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      #include <fog_fragment>
    }`,
};

export function createCityWater({resolution=512}={}){
  const water=new Reflector(new T.PlaneGeometry(200,200,100,100),{
    shader,color:'#284c43',textureWidth:resolution,textureHeight:resolution,
    multisample:0,clipBias:.003,
  });
  water.name='moving-estuary-water';water.rotation.x=-Math.PI/2;
  water.position.set(0,CITY_WATER_LEVEL,-38);water.receiveShadow=false;water.castShadow=false;
  water.material.fog=true;
  Object.assign(water.material.uniforms,T.UniformsUtils.clone(T.UniformsLib.fog));
  water.userData.waterStyle='reference-07-grey-green-tidal-reflections';
  const reflect=water.onBeforeRender,previousCamera=new T.Matrix4();
  let reflectedAt=-Infinity,disposed=false;
  water.onBeforeRender=function(renderer,scene,camera){
    const time=water.material.uniforms.time.value;
    const moved=!camera.matrixWorld.equals(previousCamera);
    // Static views refresh the reflection at 10 Hz while the normal field
    // continues every frame. Orbiting refreshes immediately for correct parallax.
    if(!moved&&time-reflectedAt<.10)return;
    const hidden=[];
    scene.traverse(o=>{if(o.visible&&o.userData.skipWaterReflection){hidden.push(o);o.visible=false;}});
    try{reflect.call(water,renderer,scene,camera);previousCamera.copy(camera.matrixWorld);reflectedAt=time;}
    finally{hidden.forEach(o=>{o.visible=true;});}
  };
  const dispose=water.dispose;
  water.dispose=()=>{if(disposed)return;disposed=true;dispose();};
  return water;
}
