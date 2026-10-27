import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,extname,sep} from 'node:path';
import {networkInterfaces} from 'node:os';
import {readSettings,askCompanion} from './ai-service.mjs';

const ROOT=fileURLToPath(new URL('.',import.meta.url));
export function localNetworkHosts(interfaces=networkInterfaces()){
  return [...new Set(Object.values(interfaces).flat().filter(address=>address&&!address.internal&&address.family==='IPv4'&&/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(address.address)).map(address=>address.address))];
}
export async function loadEnv(path=resolve(ROOT,'.env'),env=process.env){
  try{for(const line of (await readFile(path,'utf8')).split(/\r?\n/)){
    const match=line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);if(!match||env[match[1]]!==undefined)continue;
    env[match[1]]=match[2].replace(/^(['"])(.*)\1$/,'$2');
  }}catch(error){if(error.code!=='ENOENT')throw error;}
}
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.mp3':'audio/mpeg','.wav':'audio/wav','.glb':'model/gltf-binary','.gltf':'model/gltf+json','.bin':'application/octet-stream','.json':'application/json'};
const errors={not_configured:'小猫还没有连接 AI 服务，请先配置本地服务。',invalid_request:'这句话太长了，试着缩短到 600 字以内。',credentials_rejected:'AI 服务凭证未通过，请检查本机配置。',provider_busy:'AI 服务有点忙，稍后再试试。',provider_error:'AI 服务暂时没有回应，原来的声音会继续。',invalid_response:'这次没有收到可用的安排，原来的声音保持不变。',timeout:'小猫这次没能及时收到回应，请稍后再试。',busy:'小猫正在听上一句话，请稍等。'};
export function createGardenServer({root=ROOT,settings=()=>readSettings(),fetcher=fetch,lanHosts=[]}={}){
  let active=0;
  const allowedHosts=new Set(['127.0.0.1','localhost','[::1]',...lanHosts]);
  const server=createServer(async(req,res)=>{
    const send=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));};
    const host=req.headers.host;
    // LAN mode allows only this computer's explicit interface addresses.
    // Keep Host and same-origin checks in both modes to prevent DNS rebinding.
    const hostname=/^(\[[\da-f:]+\]|[\w.-]+)(?::\d+)?$/i.exec(host||'')?.[1].toLowerCase();
    if(!allowedHosts.has(hostname)){send(403,{error:'forbidden'});return;}
    if(req.headers.origin&&req.headers.origin!==`http://${host}`){send(403,{error:'forbidden'});return;}
    let path;try{path=decodeURIComponent(new URL(req.url,`http://${host}`).pathname);}catch{send(400,{error:'invalid_path'});return;}
    if(path==='/api/companion/status'&&req.method==='GET'){
      try{const config=await settings();send(200,{configured:config.configured,model:config.model});}catch{send(200,{configured:false,model:null});}return;
    }
    if(path==='/api/companion'&&req.method==='POST'){
      if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||'')){send(415,{error:'json_required'});return;}
      if(Number(req.headers['content-length'])>16000){send(400,{error:'invalid_request',message:errors.invalid_request});return;}
      if(active>=2){send(429,{error:'busy',message:errors.busy});return;}
      active++;const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),45000);
      res.on('close',()=>{if(!res.writableEnded)controller.abort();});
      try{
        const config=await settings();if(!config.configured)throw Error('not_configured');
        let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>16000)throw Error('invalid_request');chunks.push(chunk);}
        let body;try{body=JSON.parse(Buffer.concat(chunks).toString())}catch{throw Error('invalid_request')}
        const result=await askCompanion(body,config,{fetcher,signal:controller.signal});send(200,result);
      }catch(error){const code=controller.signal.aborted?'timeout':Object.hasOwn(errors,error.message)?error.message:'provider_error';if(!res.destroyed)send(code==='invalid_request'?400:code==='not_configured'?503:502,{error:code,message:errors[code]});}
      finally{clearTimeout(timer);active--;}return;
    }
    if(!['GET','HEAD'].includes(req.method)){send(405,{error:'method_not_allowed'});return;}
    if(path==='/')path='/index.html';
    // Secrets, backend sources and local artifacts are never static resources.
    const parts=path.split('/'),file=resolve(root,'.'+path),extension=extname(file);
    if(parts.some(p=>p.startsWith('.')||['node_modules','tests','docs','scripts','models'].includes(p))||!file.startsWith(resolve(root)+sep)||!mime[extension]||['server.mjs','ai-service.mjs','companion-tts.mjs','package.json','package-lock.json'].includes(parts.at(-1))){send(404,{error:'not_found'});return;}
    try{const info=await stat(file);if(!info.isFile())throw Error();const content=await readFile(file);res.writeHead(200,{'Content-Type':mime[extension],'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:content);}catch{send(404,{error:'not_found'});}
  });
  return server;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  await loadEnv();const port=Number(process.env.PORT||8766);
  const lan=process.argv.includes('--lan'),lanHosts=lan?localNetworkHosts():[];
  createGardenServer({lanHosts}).listen(port,lan?'0.0.0.0':'127.0.0.1',()=>{
    console.log(`眠境花园：http://127.0.0.1:${port}/index.html（AI 凭证仅在服务端读取）`);
    if(lan){
      for(const host of lanHosts)console.log(`手机访问：http://${host}:${port}/index.html（手机与电脑连接同一 Wi-Fi）`);
      if(!lanHosts.length)console.log('未找到局域网 IPv4 地址，请连接 Wi-Fi 后重启。');
      console.log('局域网预览已开启，仅用于可信 Wi-Fi；按 Ctrl+C 停止共享。');
    }
  });
}
