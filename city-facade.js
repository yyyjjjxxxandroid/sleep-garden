import * as T from './vendor/three/build/three.module.js';

// A small deterministic texture adds real facade rhythm without external files.
// It is deliberately subtle so distant towers retain depth instead of reading
// as luminous grids pasted onto flat boxes.
export function createFacadeMaterial({base='#72817e',glass='#536a6a',mullion='#a5aaa1',warm='#c9aa77'}={}){
  const width=64,height=128,data=new Uint8Array(width*height*4),glassColor=new T.Color(glass),mullionColor=new T.Color(mullion),warmColor=new T.Color(warm);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const floor=y%12,column=x%16,lit=((x*17+y*11)%71)<3;
    const color=floor===0||column===0?mullionColor:lit?warmColor:glassColor;
    const shade=.88+.12*(y/height)+(((x*7+y*3)%9)-4)*.006;
    const i=(y*width+x)*4;data[i]=Math.round(color.r*255*shade);data[i+1]=Math.round(color.g*255*shade);data[i+2]=Math.round(color.b*255*shade);data[i+3]=255;
  }
  const texture=new T.DataTexture(data,width,height,T.RGBAFormat);texture.colorSpace=T.SRGBColorSpace;texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.magFilter=T.NearestFilter;texture.minFilter=T.LinearMipmapLinearFilter;texture.needsUpdate=true;
  const material=new T.MeshStandardMaterial({color:'#ffffff',map:texture,emissive:glass,emissiveIntensity:.13,roughness:.58,metalness:.08});material.userData.cityTextures=[texture];return material;
}
