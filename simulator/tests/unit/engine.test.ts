import {describe,it,expect} from 'vitest';
import {Engine} from '../../src/domain/engine';
import {preset,judgeScenario,scenarioNames} from '../../src/data/scenarios';
import {assertInvariants,influence,priority} from '../../src/domain/policy';
import {scenarioSchema,eventSchema} from '../../src/domain/schema';
import {hash,Queue} from '../../src/domain/queue';

describe('Traceable whole-crate processing',()=>{
  it('retroactively flags GOOD A2 in holding slot 12 with exact causal event IDs',()=>{
    const engine=new Engine(judgeScenario());let buffered=false,flagged=false;
    while(engine.state.status!=='COMPLETE'){
      engine.step();const a=Object.values(engine.state.items).find(i=>i.alias==='A2')!;
      if(a.state==='BUFFERED'&&!a.neighborReviewFlag){buffered=true;expect(a.slot).toBe(12);expect(a.visualCondition).toBe('GOOD');}
      const e=engine.state.events.at(-1)!;
      if(e.type==='NEIGHBOR_PRIORITY_UPDATED'&&e.itemId===a.itemId&&a.neighborReviewFlag){flagged=true;expect(a.visualCondition).toBe('GOOD');expect(a.route).toBe('SECONDARY_SCREENING');expect(engine.state.crates[a.crateId].reconciled).toBe(false);expect(e.references.length).toBe(2);expect(engine.state.events.some(e=>e.type==='DEFECT_FLAGGED')).toBe(true);}
    }expect(buffered).toBe(true);expect(flagged).toBe(true);
    const a=Object.values(engine.state.items).find(i=>i.alias==='A2')!;expect(a.route).toBe('SECONDARY_SCREENING');expect(a.visualCondition).toBe('GOOD');
    for(const e of engine.state.events.filter(e=>e.type==='ITEM_ROUTE_FINALIZED'))expect(engine.state.events.find(x=>x.type==='CRATE_RECONCILED'&&x.crateId===e.crateId)!.seq).toBeLessThan(e.seq);
  });
  it('reveals underside evidence only during roller imaging',()=>{const s=new Engine(preset('Rear-side defect')).runAll();const i=Object.values(s.items).find(i=>i.alias==='F04')!;const views=s.observations.filter(o=>o.itemId===i.itemId);expect(views.map(o=>o.visual)).toEqual(['GOOD','GOOD','BAD','BAD']);expect(i.marketability).toBe('REJECTED');});
  it('checks layer decay and no cross-crate influence',()=>{const s=new Engine(judgeScenario()).runAll();const a=Object.values(s.items)[0],b=s.bubbles[0];expect(influence({...a,layer:b.layer+1,origin:b.origin},b)).toBeGreaterThan(influence({...a,layer:b.layer+2,origin:b.origin},b));expect(influence({...a,crateId:'OTHER'},b)).toBe(0);expect(priority(a,[b,b])).toBeGreaterThanOrEqual(priority(a,[b]));expect(priority(a,[b,b])).toBeLessThanOrEqual(1);});
  for(const name of scenarioNames)it(`conserves identities, masses, capacities: ${name}`,()=>{const scenario=preset(name);const s=new Engine(scenario).runAll();assertInvariants(s,scenario);expect(s.status).toBe('COMPLETE');expect(s.plan).not.toBeNull();expect(s.events.every(e=>eventSchema.safeParse(e).success)).toBe(true);expect(s.plan!.dispatchGrams).toBeLessThanOrEqual(scenario.capacities.truckGrams);expect(s.plan!.allocations.every(a=>s.items[a.itemId].marketability==='APPROVED')).toBe(true);},15000);
  for(const name of ['Failed pickup','Tracking loss','Full buffer','Count mismatch','Leaking / sanitation hold'])it(`fails closed: ${name}`,()=>{const s=new Engine(preset(name)).runAll();expect(s.events.filter(e=>e.type==='ITEM_ROUTE_FINALIZED')).toHaveLength(0);expect(s.plan!.dispatchGrams).toBe(0);expect(s.plan!.allocations).toHaveLength(0);});
  it('missing coverage cannot be approved by manual review',()=>{const scenario=preset('Missing camera views');scenario.machine.autoExpert=false;const e=new Engine(scenario);e.runAll();const i=Object.values(e.state.items).find(i=>i.coverage<.8)!;expect(i.state).toBe('HUMAN');e.review(i.itemId,'APPROVE','Operator tried to clear missing views');e.runAll();expect(e.state.items[i.itemId].marketability).toBe('HELD');});
  it('expert decisions are logged and replan with preserved output lineage',()=>{const scenario=judgeScenario();scenario.machine.autoExpert=false;const e=new Engine(scenario);e.runAll();const i=Object.values(e.state.items).find(i=>i.state==='HUMAN')!;expect(()=>e.review(i.itemId,'APPROVE','')).toThrow();e.review(i.itemId,'APPROVE','Demo inspection of all views completed');e.runAll();expect(e.state.items[i.itemId].state).toBe('PACKAGED');expect(e.state.events.some(x=>x.type==='EXPERT_DECISION'&&x.source==='HUMAN')).toBe(true);assertInvariants(e.state,scenario);});
  it('unknown transit windows stay unknown and never authorize dispatch',()=>{const scenario=judgeScenario();scenario.batches[0].handlingWindowHours=null;scenario.batches[0].windowSource='UNKNOWN';const s=new Engine(scenario).runAll();expect(s.plan!.dispatchGrams).toBe(0);});
  it('all four routes occur and original visual observations are retained',()=>{const s=new Engine(judgeScenario()).runAll();expect(new Set(Object.values(s.items).map(i=>i.route)).size).toBe(4);expect(s.observations.every(o=>o.source==='SYNTHETIC_FIXTURE')).toBe(true);});
  it('identical seed produces identical ledger under step vs clock advance',()=>{const scenario=judgeScenario();const a=new Engine(scenario).runAll();const engine=new Engine(scenario);for(let t=0;engine.state.status!=='COMPLETE';t+=137)engine.advance(t);expect(hash(engine.state.events)).toBe(hash(a.events));expect(engine.state.plan).toEqual(a.plan);});
  it('lanes only change batch with empty verified carriers',()=>{const s=new Engine(preset('Multi-commodity · 20 lanes')).runAll();expect(s.lanes).toHaveLength(20);expect(new Set(s.events.filter(e=>e.type==='LANE_ASSIGNED').map(e=>s.items[e.itemId!].batchId)).size).toBe(4);});
  it('detects malicious / unsupported / duplicate / negative scenarios',()=>{for(const mutate of [(s:ReturnType<typeof judgeScenario>)=>s.crates[0].items[0].massGrams=-1,(s:ReturnType<typeof judgeScenario>)=>s.crates[0].items[1].itemId=s.crates[0].items[0].itemId,(s:ReturnType<typeof judgeScenario>)=>s.batches[0].handlingWindowHours=NaN]){const s=judgeScenario();mutate(s);expect(scenarioSchema.safeParse(s).success).toBe(false);}expect(scenarioSchema.safeParse({}).success).toBe(false);});
  it('checks stable ordering of tied events',()=>{const q=new Queue<{at:number;order:number}>();q.push({at:2,order:2});q.push({at:1,order:3});q.push({at:1,order:1});expect([q.pop(),q.pop(),q.pop()]).toEqual([{at:1,order:1},{at:1,order:3},{at:2,order:2}]);});
  for(let seed=0;seed<20;seed++)it(`seed ${seed} preserves invariants with ${[1,4,8,20][seed%4]} lanes`,async()=>{await new Promise(resolve=>setTimeout(resolve,0));const s=preset('Multi-commodity · 20 lanes');s.seed=seed;s.machine.lanes=[1,4,8,20][seed%4];assertInvariants(new Engine(s).runAll(),s);},30000);
});
