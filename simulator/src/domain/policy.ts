import {batchRisk} from './environment';
import type { Bubble, Item, Profile, Snapshot, Scenario, Route, ResourcePlan } from './schema';

export function influence(item:Item,bubble:Bubble):number {
  if(item.crateId!==bubble.crateId||item.itemId===bubble.itemId)return 0;
  const d=(item.origin.x-bubble.origin.x)**2+(item.origin.y-bubble.origin.y)**2;
  return Math.min(1,bubble.severity*Math.exp(-bubble.alpha*d)*Math.exp(-bubble.beta*Math.abs(item.layer-bubble.layer))*Math.min(item.origin.confidence,bubble.origin.confidence));
}
export function priority(item:Item,bubbles:Bubble[]){return 1-bubbles.reduce((p,b)=>p*(1-influence(item,b)),1);}
export function qualityRoute(item:Item,profile:Profile):Route {
  if(item.visualCondition==='BAD'||item.leaking)return 'ISOLATE_REJECT';
  if(item.visualCondition==='UNKNOWN'||item.visualCondition==='UNCERTAIN'||item.coverage<.8)return 'HUMAN_REVIEW';
  if(item.visualCondition==='MODERATE'||item.neighborReviewFlag||item.priority>=profile.threshold)return 'SECONDARY_SCREENING';
  return 'APPROVED';
}
export function reconciles(state:Snapshot,scenario:Scenario,crateId:string,manifest?:{expectedCount:number;expectedMassGrams:number}):{ok:boolean;reason:string} {
  const original=scenario.crates.find(c=>c.crateId===crateId)!;const crate={...original,...manifest};
  const items=Object.values(state.items).filter(i=>i.crateId===crateId);
  if(items.length!==crate.expectedCount||items.reduce((n,i)=>n+i.massGrams,0)!==crate.expectedMassGrams)return {ok:false,reason:'Declared count or mass does not match accountable records'};
  if(state.faults.some(f=>f.crateId===crateId&&!f.resolved))return {ok:false,reason:'Unresolved tracking, pickup or equipment fault'};
  if(items.some(i=>!(manifest?['BUFFERED','ISOLATED','PACKAGED']:['BUFFERED','ISOLATED']).includes(i.state)))return {ok:false,reason:'Every item must be inspected and buffered or explicitly isolated'};
  const layers=new Set(crate.items.map(i=>i.layer));
  if([...layers].some(l=>!state.maps.some(m=>m.crateId===crateId&&m.layer===l)))return {ok:false,reason:'Missing layer mapping'};
  if(items.some(i=>i.observationIds.length<(i.modelEvidence?1:4)))return {ok:false,reason:'Missing imaging records'};
  return {ok:true,reason:`Reconciled ${items.length} IDs and ${crate.expectedMassGrams}g; all original layers mapped`};
}
export function planResources(state:Snapshot,scenario:Scenario):ResourcePlan {
  let truck=scenario.capacities.truckGrams,storage=scenario.capacities.storageGrams;
  const plan:ResourcePlan={allocations:[],dispatchGrams:0,storageGrams:0,holdGrams:0,excludedGrams:0};
  const batch=(id:string)=>scenario.batches.find(b=>b.batchId===id)!;
  const riskScores=new Map(scenario.batches.map(b=>[b.batchId,batchRisk(b,Object.values(state.items)).score??b.urgency]));
  const approved=Object.values(state.items).filter(i=>i.state==='PACKAGED'&&i.marketability==='APPROVED').sort((a,b)=>(riskScores.get(b.batchId)!-riskScores.get(a.batchId)!)||a.itemId.localeCompare(b.itemId));
  for(const item of approved){
    const b=batch(item.batchId);const profile=scenario.profiles.find(p=>p.commodity===b.commodity)!;
    const lot=state.lots.find(l=>l.itemIds.includes(item.itemId));if(!lot)throw new Error('Packaged item missing lineage');
    const feasible=b.handlingWindowHours!==null&&b.windowSource!=='UNKNOWN'&&scenario.capacities.transitHours+scenario.capacities.safetyHours<=b.handlingWindowHours;
    let action:'DISPATCH'|'STORE'|'HOLD'='HOLD',reason='No eligible capacity; hold approved output for operator review';
    if(feasible&&truck>=item.massGrams){action='DISPATCH';truck-=item.massGrams;plan.dispatchGrams+=item.massGrams;reason=`Approved; scenario transit ${scenario.capacities.transitHours}h + buffer ${scenario.capacities.safetyHours}h within ${b.handlingWindowHours}h ${b.windowSource} window; truck capacity reserved`;
    }else if(profile.storageSuitable&&scenario.capacities.storageCompatible&&storage>=item.massGrams){action='STORE';storage-=item.massGrams;plan.storageGrams+=item.massGrams;reason=`Approved; ${feasible?'truck capacity constrained':'transit window unknown/infeasible'}; scenario-compatible storage reserved`;
    }else{plan.holdGrams+=item.massGrams;if(!feasible)reason='Unknown or infeasible handling window; no compatible storage capacity';}
    reason+=`; priority ${riskScores.get(b.batchId)} (${batchRisk(b,Object.values(state.items)).score===null?'operator/scenario urgency; environmental risk UNKNOWN':'tomato environmental heuristic'}); observed condition preserved`;
    plan.allocations.push({itemId:item.itemId,lotId:lot.lotId,massGrams:item.massGrams,action,reason,source:'HEURISTIC'});
  }
  const approvedIds=new Set(approved.map(i=>i.itemId));plan.excludedGrams=Object.values(state.items).filter(i=>!approvedIds.has(i.itemId)).reduce((n,i)=>n+i.massGrams,0);
  return plan;
}
export function assertInvariants(state:Snapshot,scenario:Scenario){
  const items=Object.values(state.items);const inputs=scenario.crates.flatMap(c=>c.items);
  if(items.length!==inputs.length||items.reduce((n,i)=>n+i.massGrams,0)!==inputs.reduce((n,i)=>n+i.massGrams,0))throw new Error('Count/mass conservation violated');
  for(const input of inputs){const i=state.items[input.itemId];if(!i||JSON.stringify(i.origin)!==JSON.stringify(input.origin)||i.massGrams!==input.massGrams)throw new Error('Origin identity changed');}
  const slots=items.filter(i=>i.slot!==null).map(i=>i.slot);if(new Set(slots).size!==slots.length||slots.length>scenario.machine.bufferCapacity)throw new Error('Buffer overbooked');
  if(items.filter(i=>i.state==='SECONDARY').length>scenario.machine.secondaryCapacity)throw new Error('Secondary station overbooked');
  if(items.filter(i=>i.state==='HUMAN').length>scenario.machine.humanCapacity)throw new Error('Expert station overbooked');
  const packed=items.filter(i=>i.state==='PACKAGED');if(packed.some(i=>i.marketability!=='APPROVED'||!state.crates[i.crateId].reconciled))throw new Error('Unsafe packaging');
  const lineage=state.lots.flatMap(l=>l.itemIds);if(new Set(lineage).size!==lineage.length||lineage.some(id=>state.items[id].state!=='PACKAGED'))throw new Error('Invalid output lineage');
  if(state.plan){if(state.plan.dispatchGrams>scenario.capacities.truckGrams||state.plan.storageGrams>scenario.capacities.storageGrams)throw new Error('Capacity exceeded');if(state.plan.allocations.some(a=>state.items[a.itemId].marketability!=='APPROVED'))throw new Error('Ineligible allocation');}
}
