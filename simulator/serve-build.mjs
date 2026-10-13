import {session,login,logout,sameOrigin,protectedMode} from './access.mjs';
import {Engine,applyAction,hash,scenarioSchema} from './dist/engine.mjs';
// Dependency-free local server for the packaged production build.
import {createServer} from 'node:http';
import {readFile,stat,mkdir,appendFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,sep,extname} from 'node:path';
const root=fileURLToPath(new URL('./dist/',import.meta.url));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.wasm':'application/wasm'};
const predictions=new Map();const inferenceBase=process.env.HARVESTSHIELD_INFERENCE_URL??'http://127.0.0.1:4174';if(!/^http:\/\/127\.0\.0\.1:[0-9]+$/.test(inferenceBase))throw new Error('Inference service must remain on loopback');
const port=Number(process.env.HARVESTSHIELD_PORT??4173);
const json=(res,status,body)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(body));};
const readBody=async(req,max=12*1024*1024)=>{const chunks=[];let size=0;for await(const part of req){size+=part.length;if(size>max)throw new Error('Request body too large');chunks.push(part);}return Buffer.concat(chunks);};
createServer({requestTimeout:30000,headersTimeout:10000},async(req,res)=>{try{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; worker-src 'self' blob:; connect-src 'self'; frame-ancestors 'self'; object-src 'none'; base-uri 'self'");
  const current=session(req);
  if(req.url?.startsWith('/api/')&&req.method==='POST'&&!sameOrigin(req)){await readBody(req).catch(()=>{});json(res,403,{error:'Foreign-origin request rejected'});return;}
  if(req.url==='/api/session'&&req.method==='GET'){json(res,200,{mode:protectedMode?'PROTECTED':'LOCAL_DEMO',authenticated:!!current,role:current?.role??null});return;}
  if(req.url==='/api/session/login'&&req.method==='POST'){const body=JSON.parse((await readBody(req,4096)).toString());const token=login(req,body);if(!token){json(res,401,{error:'Invalid role or password'});return;}res.setHeader('Set-Cookie',`hs_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${process.env.HARVESTSHIELD_PUBLIC_ORIGIN?.startsWith('https://')?'; Secure':''}`);json(res,200,{authenticated:true,role:body.role});return;}
  if(req.url==='/api/session/logout'&&req.method==='POST'){logout(req);res.setHeader('Set-Cookie','hs_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');json(res,200,{authenticated:false});return;}
  if(req.url==='/api/operator/action'&&req.method==='POST'){
    if(!current||current.role!=='operator'){await readBody(req).catch(()=>{});json(res,403,{error:'Operator session required'});return;}
    const data=JSON.parse((await readBody(req,8*1024*1024)).toString()),scenario=scenarioSchema.parse(data.scenario);if(scenario.crates.reduce((n,c)=>n+c.items.length,0)>1000)throw new Error('Server action validation is limited to 1000 items');
    for(const item of scenario.crates.flatMap(c=>c.items))for(const evidence of item.modelViews??(item.modelEvidence?[item.modelEvidence]:[])){const known=predictions.get(`${current.id}:${evidence.imageSha256}`);if(!known||JSON.stringify(known)!==JSON.stringify(evidence))throw new Error('Model evidence must come from this authenticated service session');}
    if(!Array.isArray(data.journal)||data.journal.length>200)throw new Error('Invalid operator action journal');const engine=new Engine(scenario);engine.runAll();for(const a of data.journal)applyAction(engine,a);applyAction(engine,data.action);const receipt={recordedAtUtc:new Date().toISOString(),role:current.role,scenarioHash:engine.state.configHash,eventHash:hash(engine.state.events),action:data.action,engineVersion:engine.state.engineVersion,source:'SERVER_VALIDATED_SIMULATION'};const logPath=resolve(process.env.HARVESTSHIELD_AUDIT_DIR??fileURLToPath(new URL('../runtime/audit/',import.meta.url)));await mkdir(logPath,{recursive:true});await appendFile(resolve(logPath,'operator-actions.jsonl'),JSON.stringify(receipt)+'\n');json(res,200,receipt);return;
  }
  if(req.url?.startsWith('/api/inference/')){if(!current){await readBody(req).catch(()=>{});json(res,401,{error:'Sign in to run real image inference'});return;}
    if(!['GET','POST'].includes(req.method??'')){res.writeHead(405);res.end();return;}
    const chunks=[];let size=0;for await(const part of req){size+=part.length;if(size>12*1024*1024){res.writeHead(413);res.end(JSON.stringify({error:'Image request exceeds 12 MB'}));return;}chunks.push(part);}
    try{const upstream=await fetch(`${inferenceBase}${req.url}`,{method:req.method,headers:{'Content-Type':req.headers['content-type']??'application/json',...(req.headers.origin?{Origin:req.headers.origin}:{})},body:req.method==='POST'?Buffer.concat(chunks):undefined,signal:AbortSignal.timeout(45000)});res.writeHead(upstream.status,{'Content-Type':'application/json','Cache-Control':'no-store'});const body=await upstream.text();if(upstream.ok&&req.method==='POST'){const evidence=JSON.parse(body);if(evidence.imageSha256){if(predictions.size>=10000)predictions.delete(predictions.keys().next().value);predictions.set(`${current.id}:${evidence.imageSha256}`,evidence);}}res.end(body);}
    catch{res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Tomato inference is offline. Run SetupInference.cmd, then LaunchSimulator.cmd.'}));}return;
  }
  if(!['GET','HEAD'].includes(req.method??'')){res.writeHead(405);res.end();return;}
  const pathname=decodeURIComponent(new URL(req.url??'/',`http://127.0.0.1:${port}`).pathname);
  let path=resolve(root,`.${pathname}`);if(path!==resolve(root)&&!path.startsWith(resolve(root)+sep)){res.writeHead(403);res.end();return;}
  if((await stat(path)).isDirectory())path=resolve(path,'index.html');
  const body=await readFile(path);res.writeHead(200,{'Content-Type':mime[extname(path)]??'application/octet-stream','Content-Length':body.length,'Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:body);
}catch(error){if(req.url?.startsWith('/api/')){json(res,400,{error:error instanceof Error?error.message:'Invalid request'});return;}res.writeHead(404,{'Content-Type':'text/plain'});res.end('Not found. Build the simulator first with npm run build.');}}).listen(port,process.env.HARVESTSHIELD_HOST??'127.0.0.1',()=>console.log(`HarvestShield production build: http://127.0.0.1:${port}/`));
