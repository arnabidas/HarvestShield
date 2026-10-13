import {judgeScenario} from './scenarios';
import {scenarioSchema,type Scenario} from '../domain/schema';
import {UPLOAD_ITEM_ID,type ModelEvidence} from '../domain/model';
export function imageScenario(evidence?:ModelEvidence,views?:ModelEvidence[]):Scenario{
  const scenario=judgeScenario();scenario.scenarioId='HS-UPLOADED-TOMATO';scenario.title='Your tomato image · real model';
  scenario.batches[0]={...scenario.batches[0],batchId:'UPLOAD',sourceLot:'UPLOADED-PHOTO',handlingWindowHours:null,windowSource:'UNKNOWN',environmentalHistory:{temperatureC:[],humidityPct:[],ethylene:null,source:'UNKNOWN'}};
  const item={...scenario.crates[0].items[0],itemId:UPLOAD_ITEM_ID,alias:'PHOTO',origin:{x:.5,y:.5,confidence:1},index:1,layer:1,visual:evidence?(evidence.sourceLabel==='Fresh'?'GOOD':'BAD') as 'GOOD'|'BAD':'UNCERTAIN' as const,coverage:0,rearDefect:false,leaking:false,secondary:'HOLD' as const,expert:'HOLD' as const,inferenceRequired:true,...(evidence?{modelEvidence:evidence,modelViews:views??[evidence]}:{})};
  scenario.crates=[{crateId:'C01',batchId:'UPLOAD',expectedCount:1,expectedMassGrams:150,items:[item]}];scenario.machine.autoExpert=false;scenario.capacities.truckGrams=0;scenario.capacities.storageGrams=0;
  return scenarioSchema.parse(scenario);
}
