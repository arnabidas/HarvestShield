import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {Engine,preset,applyAction,hash} from './dist/engine.mjs';
const cwd=fileURLToPath(new URL('./',import.meta.url)),origin='http://127.0.0.1:4175';
const password=randomBytes(24).toString('hex'),viewer=randomBytes(24).toString('hex');
const backend=spawn(process.env.HARVESTSHIELD_PYTHON??fileURLToPath(new URL(process.platform==='win32'?'../.inference-venv/Scripts/python.exe':'../.inference-venv/bin/python',import.meta.url)),['scripts/inference_server.py','--port','4176'],{cwd:fileURLToPath(new URL('../',import.meta.url)),windowsHide:true,stdio:['ignore','ignore','pipe'],env:{...process.env,HARVESTSHIELD_PUBLIC_ORIGIN:origin}});
const child=spawn(process.execPath,['serve-build.mjs'],{cwd,windowsHide:true,stdio:['ignore','ignore','pipe'],env:{...process.env,NODE_ENV:'production',HARVESTSHIELD_PORT:'4175',HARVESTSHIELD_PUBLIC_ORIGIN:origin,HARVESTSHIELD_INFERENCE_URL:'http://127.0.0.1:4176',HARVESTSHIELD_OPERATOR_PASSWORD:password,HARVESTSHIELD_VIEWER_PASSWORD:viewer,HARVESTSHIELD_AUDIT_DIR:fileURLToPath(new URL('../../../work/access-audit/',import.meta.url))}});
const errors=[];backend.stderr.on('data',b=>errors.push(String(b)));child.stderr.on('data',b=>errors.push(String(b)));const check=(v,s)=>{if(!v)throw new Error(s);};
try{
 let ready=false;for(let n=0;n<30;n++){try{if((await fetch(origin+'/api/session')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,200));}check(ready,'Server unavailable');
 let response=await fetch(origin+'/api/inference/health');check(response.status===401,'Unauthenticated inference allowed');
 const signIn=async(role,password)=>{const r=await fetch(origin+'/api/session/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify({role,password})});check(r.ok,'Login failed');return r.headers.get('set-cookie').split(';')[0];};
 const viewerCookie=await signIn('viewer',viewer);response=await fetch(origin+'/api/operator/action',{method:'POST',headers:{Cookie:viewerCookie,'Content-Type':'application/json'},body:'{}'});check(response.status===403,'Viewer operator action allowed');
 const cookie=await signIn('operator',password);response=await fetch(origin+'/api/session');check((await response.json()).authenticated===false,'Session leaked across clients');
 const scenario=preset('Tracking loss'),engine=new Engine(scenario);engine.runAll();const item=Object.values(engine.state.items).find(i=>i.state==='HELD');const action={action:'RECOVER',itemId:item.itemId,verifiedId:item.itemId,decision:'HOLD',actor:'TEST_OPERATOR',reason:'Recorded verified carrier rescan'};applyAction(engine,action);
 response=await fetch(origin+'/api/operator/action',{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json',Origin:origin},body:JSON.stringify({scenario,journal:[],action})});const receipt=await response.json();check(response.ok&&receipt.eventHash===hash(engine.state.events),'Server/client guarded action differs');
 response=await fetch(origin+'/api/operator/action',{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json',Origin:'https://foreign.invalid'},body:'{}'});check(response.status===403,'Foreign-origin operator request allowed');
 let modelReady=false;for(let n=0;n<225;n++){try{const r=await fetch('http://127.0.0.1:4176/api/inference/health');if(r.ok&&(await r.json()).ready){modelReady=true;break;}}catch{}await new Promise(r=>setTimeout(r,200));}
 check(modelReady,'Model startup timed out: '+errors.join('').slice(-2000));
 const image=await readFile(new URL('./public/samples/red-tomato.jpg',import.meta.url));response=await fetch(origin+'/api/inference/tomato',{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json',Origin:origin},body:JSON.stringify({sourceItemId:'UPLOAD-C01-L01-I01',commodity:'tomato',mimeType:'image/jpeg',imageBase64:image.toString('base64')})});check(response.ok,'Authenticated actual model failed: '+response.status+' '+(response.ok?'':await response.text()));
 response=await fetch(origin+'/api/session/logout',{method:'POST',headers:{Cookie:cookie,Origin:origin}});check(response.ok,'Logout failed');response=await fetch(origin+'/api/inference/health',{headers:{Cookie:cookie}});check(response.status===401,'Logged-out session still accepted');
 const report={status:'PASS',checks:['Unauthenticated inference denied','Viewer actions denied','Session isolation','Server-validated recovery parity','Foreign origin denied','Authenticated real inference','Logout invalidation'],source:'LOCAL_PRODUCTION_SERVICE_TEST'};await mkdir(new URL('../docs/evidence/',import.meta.url),{recursive:true});await writeFile(new URL('../docs/evidence/access-control-test.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{child.kill();backend.kill();}
