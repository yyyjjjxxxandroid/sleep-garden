const {test}=require('node:test'),assert=require('node:assert/strict');

test('sky is drawn first without depth writes or world-space frustum culling',async()=>{
  const T=await import('../vendor/three/build/three.module.js'),{configureSkyBackground}=await import('../world-sky.js');
  const sky=new T.Mesh(new T.SphereGeometry(150,16,8),new T.ShaderMaterial());configureSkyBackground(sky);
  assert.equal(sky.frustumCulled,false);assert.equal(sky.renderOrder,-1000);
  assert.equal(sky.material.depthWrite,false);assert.equal(sky.material.depthTest,false);
  assert.match(sky.material.vertexShader,/mat3\(viewMatrix\)/);
  assert.match(sky.material.vertexShader,/gl_Position=clip.xyww/);
});

test('0.5x plus allowed panning can clip the old sky; infinite sky remains inside clip space',async()=>{
  const T=await import('../vendor/three/build/three.module.js');
  let oldClipped=0;
  for(const aspect of [390/844,1280/800])for(const [x,z]of [[0,0],[42,42],[-42,-42]]){
    const camera=new T.PerspectiveCamera(44,aspect,.1,220),target=new T.Vector3(x,2.4,z);
    const offset=new T.Vector3(x||10,11.6,z||31).normalize().multiplyScalar(70);
    camera.position.copy(target).add(offset);camera.lookAt(target);camera.updateMatrixWorld(true);
    for(const sx of [-.8,0,.8])for(const sy of [0,.5,.9]){
      const ray=new T.Vector3(sx,sy,1).unproject(camera).sub(camera.position).normalize();
      const b=camera.position.dot(ray),c=camera.position.lengthSq()-150*150;
      const distance=-b+Math.sqrt(b*b-c),oldPoint=camera.position.clone().addScaledVector(ray,distance);
      if(oldPoint.clone().project(camera).z>1)oldClipped++;
      // The shader uses view rotation only and pins depth to w. Its NDC
      // position cannot change with a pan or exceed the camera's far plane.
      const direction=ray.clone().multiplyScalar(150).applyMatrix3(new T.Matrix3().setFromMatrix4(camera.matrixWorldInverse));
      const clip=new T.Vector4(direction.x,direction.y,direction.z,1).applyMatrix4(camera.projectionMatrix);
      clip.z=clip.w;
      assert.ok(Math.abs(clip.x/clip.w-sx)<1e-6);assert.ok(Math.abs(clip.y/clip.w-sy)<1e-6);assert.equal(clip.z/clip.w,1);
    }
  }
  assert.ok(oldClipped>0,'fixture must reproduce the finite-sky far-plane hole');
});
