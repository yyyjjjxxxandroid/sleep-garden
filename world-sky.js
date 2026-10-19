// An infinitely distant background: camera rotation affects the sky, but
// translation, orbit radius and the ordinary geometry far plane cannot cut it.
export function configureSkyBackground(sky){
  sky.name='infinite-garden-sky';
  sky.frustumCulled=false;
  sky.renderOrder=-1000;
  sky.material.depthWrite=false;
  sky.material.depthTest=false;
  sky.material.vertexShader=`
    varying vec3 d;
    void main(){
      d=position;
      vec4 clip=projectionMatrix*vec4(mat3(viewMatrix)*position,1.0);
      gl_Position=clip.xyww;
    }`;
  sky.material.needsUpdate=true;
}
