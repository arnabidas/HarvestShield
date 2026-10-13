import type {Batch, Item, Scenario, Snapshot} from './schema';

export interface EnvironmentalRisk {score:number|null;level:'LOW'|'MEDIUM'|'HIGH'|'UNKNOWN';reasons:string[];source:string;}
// Python round uses ties-to-even. Preserve the original tomato heuristic exactly.
export function roundEven(n:number){const f=Math.floor(n),d=n-f;return d===.5?(f%2?f+1:f):Math.round(n);}
export function tomatoRisk(label:'Fresh'|'Rotten',confidence:number,temp:number,rh:number,age:number):EnvironmentalRisk {
  if(![confidence,temp,rh,age].every(Number.isFinite)||confidence<0||confidence>1||temp< -10||temp>60||rh<0||rh>100||age<0)throw new Error('Invalid environmental risk input');
  const visual=roundEven((label==='Rotten'?confidence:1-confidence)*55);
  const temperature=temp<0?20:temp<7?15:temp<10?7:temp<=21?0:temp<=25?8:20;
  const humidity=rh<75?10:rh<90?5:rh<=95?0:4;
  const ageing=age<=2?0:age<=5?5:age<=8?10:15;
  let score=Math.min(100,visual+temperature+humidity+ageing);if(label==='Rotten'&&confidence>=.8)score=Math.max(60,score);
  return {score,level:score>=60?'HIGH':score>=30?'MEDIUM':'LOW',reasons:[`Visual ${visual}`,`Temperature ${temperature}`,`Humidity ${humidity}`,`Age ${ageing}`],source:'V0.1 TOMATO HEURISTIC / NOT SHELF LIFE'};
}
export function batchRisk(batch:Batch,items:Item[]):EnvironmentalRisk {
  const env=batch.environmentalHistory;
  if(batch.commodity!=='tomato'||env.source==='UNKNOWN'||!env.temperatureC.length||!env.humidityPct.length||batch.daysSinceHarvest===null)return {score:null,level:'UNKNOWN',reasons:['Known tomato environment and harvest age required; no value imputed'],source:'UNKNOWN'};
  const relevant=items.filter(i=>i.batchId===batch.batchId&&i.visualCondition!=='UNKNOWN');
  if(!relevant.length)return {score:null,level:'UNKNOWN',reasons:['No observed image/fixture condition yet'],source:'UNKNOWN'};
  // Conservative maximum observed sample; history is assessed point by point, not averaged away.
  const worstTemperature=env.temperatureC.reduce((a,b)=>(tomatoRisk('Fresh',1,b,92,0).score??0)>(tomatoRisk('Fresh',1,a,92,0).score??0)?b:a);const worstHumidity=env.humidityPct.reduce((a,b)=>(tomatoRisk('Fresh',1,15,b,0).score??0)>(tomatoRisk('Fresh',1,15,a,0).score??0)?b:a);
  const risks=relevant.map(i=>tomatoRisk(i.modelEvidence?.sourceLabel??(i.visualCondition==='BAD'?'Rotten':'Fresh'),i.modelEvidence?.confidence??.9,worstTemperature,worstHumidity,batch.daysSinceHarvest!));
  return risks.reduce((a,b)=>(b.score??0)>(a.score??0)?b:a);
}
export function environmentalComparison(state:Snapshot,scenario:Scenario){return scenario.batches.map(batch=>({batchId:batch.batchId,ownVisualFindings:Object.values(state.items).filter(i=>i.batchId===batch.batchId).map(i=>({itemId:i.itemId,visual:i.visualCondition})),observed:batchRisk(batch,Object.values(state.items)),coolStorage:batchRisk({...batch,daysSinceHarvest:2,environmentalHistory:{...batch.environmentalHistory,temperatureC:[15],humidityPct:[92],source:'SCENARIO_FIXTURE'}},Object.values(state.items)),warmDelay:batchRisk({...batch,daysSinceHarvest:9,environmentalHistory:{...batch.environmentalHistory,temperatureC:[30],humidityPct:[70],source:'SCENARIO_FIXTURE'}},Object.values(state.items)),meaning:'Counterfactual heuristic comparison, never changes visual eligibility or predicts shelf life'}));}
