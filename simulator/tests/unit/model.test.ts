import {it,expect} from 'vitest';
import {Engine} from '../../src/domain/engine';
import {imageScenario} from '../../src/data/imageScenario';
import {UPLOAD_ITEM_ID,type ModelEvidence} from '../../src/domain/model';
import {hash} from '../../src/domain/queue';
import {scenarioSchema} from '../../src/domain/schema';
const evidence=(label:'Fresh'|'Rotten'):ModelEvidence=>({sourceItemId:UPLOAD_ITEM_ID,sourceType:'REAL_TOMATO_MODEL',sourceLabel:label,condition:'Unit test adapter evidence',confidence:.91,freshScore:label==='Fresh'?.91:.09,deteriorationScore:label==='Rotten'?.91:.09,modelVersion:'TEST-EVIDENCE-ONLY',checkpointSha256:'a'.repeat(64),imageSha256:'b'.repeat(64),imageWidth:300,imageHeight:300,inferredAtUtc:'2026-10-11T00:00:00Z'});
it('never substitutes a synthetic prediction for pending inference',()=>{expect(()=>new Engine(imageScenario()).runAll()).toThrow('Awaiting actual tomato inference');});
it('records one actual photo without inventing four real camera observations',()=>{
  const scenario=imageScenario(evidence('Fresh')),snapshot=new Engine(scenario).runAll(),item=snapshot.items[UPLOAD_ITEM_ID];
  expect(snapshot.observations).toHaveLength(1);expect(snapshot.observations[0]).toMatchObject({view:'UPLOAD',source:'REAL_TOMATO_MODEL',coverage:0,visual:'GOOD'});
  expect(item.modelEvidence).toEqual(evidence('Fresh'));expect(item.state).toBe('HUMAN');expect(item.marketability).toBe('PENDING');expect(snapshot.plan!.allocations).toHaveLength(0);
  expect(snapshot.events.find(e=>e.type==='ITEM_VISUAL_CLASSIFIED')?.source).toBe('REAL_TOMATO_MODEL');
  expect(hash(new Engine(scenario).runAll().events)).toBe(hash(snapshot.events));
});
it('uses the model Rotten label for rejection and original-position bubble creation',()=>{
  const snapshot=new Engine(imageScenario(evidence('Rotten'))).runAll(),item=snapshot.items[UPLOAD_ITEM_ID];
  expect(item.visualCondition).toBe('BAD');expect(item.route).toBe('ISOLATE_REJECT');expect(item.marketability).toBe('REJECTED');expect(snapshot.bubbles[0].origin).toEqual(item.origin);
});
it('rejects mismatched item evidence, class mapping and invented photo coverage',()=>{
  for(const mutate of [(s:ReturnType<typeof imageScenario>)=>s.crates[0].items[0].modelEvidence!.sourceItemId='ANOTHER', (s:ReturnType<typeof imageScenario>)=>s.crates[0].items[0].visual='BAD',(s:ReturnType<typeof imageScenario>)=>s.crates[0].items[0].coverage=.92]){const scenario=imageScenario(evidence('Fresh'));mutate(scenario);expect(scenarioSchema.safeParse(scenario).success).toBe(false);}
});
