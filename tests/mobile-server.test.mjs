import {test} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {request} from 'node:http';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createGardenServer,localNetworkHosts} from '../server.mjs';

test('phone links contain only private IPv4 interfaces, without duplicate or loopback addresses',()=>{
  const address=(value,internal=false)=>({address:value,family:'IPv4',internal});
  assert.deepEqual(localNetworkHosts({lo:[address('127.0.0.1',true)],wifi:[address('192.168.1.20'),address('192.168.1.20')],ethernet:[address('10.0.0.4'),address('172.16.0.2'),address('172.31.0.2')],other:[address('172.32.0.1'),address('8.8.8.8'),{address:'fe80::1',family:'IPv6',internal:false}]}),['192.168.1.20','10.0.0.4','172.16.0.2','172.31.0.2']);
});

test('LAN preview serves the page and AI to the allowed phone origin while retaining access boundaries',async t=>{
  const root=await mkdtemp(join(tmpdir(),'garden-mobile-'));
  await writeFile(join(root,'index.html'),'phone garden');await writeFile(join(root,'.env'),'PRIVATE_KEY');
  const server=createGardenServer({root,lanHosts:['192.168.1.20'],settings:async()=>({configured:false,model:null})});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await rm(root,{recursive:true,force:true});});
  const host='192.168.1.20:'+server.address().port;
  const get=(path,headers={})=>new Promise((resolve,reject)=>{
    const req=request({hostname:'127.0.0.1',port:server.address().port,path,headers:{Host:host,...headers}},res=>{let body='';res.setEncoding('utf8');res.on('data',chunk=>body+=chunk);res.on('end',()=>resolve({status:res.statusCode,body}));});req.on('error',reject);req.end();
  });
  assert.deepEqual(await get('/index.html'),{status:200,body:'phone garden'});
  assert.equal((await get('/api/companion/status',{Origin:'http://'+host})).status,200);
  for(const path of ['/.env','/.env.example','/server.mjs','/ai-service.mjs'])assert.equal((await get(path)).status,404);
  for(const Host of ['evil.example','192.168.1.21:8766','0.0.0.0:8766','192.168.1.20.evil.example'])assert.equal((await get('/',{Host})).status,403);
  for(const Origin of ['http://evil.example','http://192.168.1.21:8766','null'])assert.equal((await get('/',{Origin})).status,403);
});
