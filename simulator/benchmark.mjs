import {Engine,preset} from './dist/engine.mjs';
import {writeFile} from 'node:fs/promises';
const result=[];
for(const count of [100,500,1000]){const config=preset('1000 item stress');config.crates=config.crates.slice(0,count/10);const begin=performance.now(),e=new Engine(config);const state=e.runAll();result.push({count,durationMs:Math.round(performance.now()-begin),events:state.events.length,maxBuffer:state.maxBuffer,approvedGrams:state.plan.dispatchGrams+state.plan.storageGrams,rssMB:Math.round(process.memoryUsage().rss/1048576)});}
console.log(JSON.stringify(result,null,2));await writeFile(new URL('../docs/evidence/engine-benchmark.json',import.meta.url),JSON.stringify({measuredAt:new Date().toISOString(),node:process.version,platform:process.platform,measurements:result,meaning:'Local CPU engine benchmark; no physical throughput claim'},null,2));
