import type {Item,Snapshot,MachineEvent,ItemState} from '../domain/schema';
import {timing} from '../domain/timing';
import {along,layout,rollerPath,sortPath,waitingPosition,routeDestination,clearedPath,type Point} from './layout';


const indexes=new WeakMap<Snapshot,ReturnType<typeof makeIndex>>();
function makeIndex(snapshot:Snapshot){const items=Object.values(snapshot.items),events=new Map<string,MachineEvent[]>(),observations=new Map<string,Snapshot['observations']>(),crates=new Map<string,Item[]>(),ordinal=new Map<string,number>(),entered=new Map<string,MachineEvent>(),maps=new Map<string,Snapshot['maps']>(),plans:MachineEvent[]=[];items.forEach((i,n)=>{ordinal.set(i.itemId,n);const c=crates.get(i.crateId)??[];c.push(i);crates.set(i.crateId,c);});for(const m of snapshot.maps){const list=maps.get(m.crateId)??[];list.push(m);maps.set(m.crateId,list);}for(const e of snapshot.events){if(e.type==='CRATE_ENTERED'&&!entered.has(e.crateId!))entered.set(e.crateId!,e);if(e.type==='RESOURCE_PLAN_GENERATED')plans.push(e);}for(const e of snapshot.events)if(e.itemId){const list=events.get(e.itemId)??[];list.push(e);events.set(e.itemId,list);}for(const o of snapshot.observations){const list=observations.get(o.itemId)??[];list.push(o);observations.set(o.itemId,list);}return {items,events,observations,crates,ordinal,entered,maps,plans,used:new Set(items.flatMap(i=>i.slot===null?[]:[i.slot]))};}
function index(snapshot:Snapshot){let data=indexes.get(snapshot);if(!data){data=makeIndex(snapshot);indexes.set(snapshot,data);}return data;}
export function observationsFor(snapshot:Snapshot,id:string){return index(snapshot).observations.get(id)??[];}
export function sourcePosition(item:Item,snapshot:Snapshot,time:number,mapped=false):Point {
  const entered=index(snapshot).entered.get(item.crateId);
  const progress=mapped?1:entered?Math.min(1,Math.max(0,(time-entered.simTimeMs)/timing.crateArrival)):0;
  const layers=Math.max(...(index(snapshot).crates.get(item.crateId)??[]).map(i=>i.layer));
  return [layout.warehouse+(layout.mapper-layout.warehouse)*progress+(item.origin.x-.5)*1.6,1.08+(layers-item.layer)*.22,(item.origin.y-.5)*1.4];
}
function last(events:MachineEvent[],type:string){return events.findLast(e=>e.type===type);}
export function rememberedSlot(item:Item,snapshot:Snapshot){if(item.holdingSlot!==null)return item.holdingSlot;if(item.alias==='A2')return 12;const used=index(snapshot).used;let n=0;while(used.has(n)||n===12)n++;return n;}
function pickupPath(item:Item,snapshot:Snapshot):Point[]{const origin=sourcePosition(item,snapshot,0,true);return [origin,[origin[0],2.25,origin[2]],[-7,2.25,0],[-6.55,1.16,0]];}
function heldPosition(item:Item,snapshot:Snapshot,time:number,from:ItemState|null):Point {if(from==='BUFFERED')return waitingPosition(rememberedSlot(item,snapshot));if(from==='HUMAN'||from==='SECONDARY'||from==='SORTING')return routeDestination(item.route);if(from==='IMAGING')return [layout.rollerEnd,1.16,0];if(from==='CARRIER'||from==='PICKED')return [-6.55,1.16,0];return sourcePosition(item,snapshot,time);}

// Position is a pure projection of the ledger + virtual time. No frame-rate lerps,
// independently random trajectories, hidden teleport destinations or business rules.
export function itemPose(item:Item,snapshot:Snapshot,time:number,serviceMs:number):{position:Point;rotation:Point;visible:boolean;state:ItemState} {
  if(item.state==='HELD'&&time>=item.stateSince){const frozen=itemPose(item,snapshot,item.stateSince-.01,serviceMs);return {...frozen,state:'HELD'};}
  const events=(index(snapshot).events.get(item.itemId)??[]).filter(e=>e.simTimeMs<=time);
  const state=(events.findLast(e=>e.after)?.after??'IN_CRATE') as ItemState;
  const pick=last(events,'PICK_ATTEMPTED'),picked=last(events,'PICK_SUCCEEDED'),carrier=last(events,'ITEM_ENTERED_CARRIER'),imaging=last(events,'IDENTITY_VERIFIED'),classified=last(events,'ITEM_VISUAL_CLASSIFIED'),buffered=last(events,'ITEM_BUFFERED'),sort=last(events,'ITEM_ROUTE_FINALIZED'),packed=last(events,'ITEM_PACKAGED');
  let position=sourcePosition(item,snapshot,time),rotation:Point=[0,0,0];
  const slot=rememberedSlot(item,snapshot);const waiting=waitingPosition(slot);
  const n=index(snapshot).ordinal.get(item.itemId)??0,offset:Point=[((n%5)-2)*.27,Math.floor(n/25)*.22,((Math.floor(n/5)%5)-2)*.27];
  const placed=(p:Point):Point=>p.map((v,k)=>v+offset[k]) as Point;
  const destination=placed(routeDestination(state==='HUMAN'?'HUMAN_REVIEW':item.route));
  const packing=placed([layout.pack,1.16,0]);
  if(state==='PICKING'&&pick){const origin=sourcePosition(item,snapshot,time,true);position=along([origin,origin,[origin[0],2.25,origin[2]]],(time-pick.simTimeMs)/timing.pick);}
  else if(state==='PICKED'&&picked){const path=pickupPath(item,snapshot);position=along(path.slice(1),(time-picked.simTimeMs)/timing.liftTransfer);}
  else if(state==='CARRIER'&&carrier)position=along([[-6.55,1.16,0],rollerPath[0]],(time-carrier.simTimeMs)/timing.carrierVerification);
  else if(state==='IMAGING'&&imaging){const observations=observationsFor(snapshot,item.itemId);const first=observations[0];const duration=item.imagingDurationMs||(first?(first.simTimeMs-imaging.simTimeMs)*4:serviceMs);const p=Math.min(1,Math.max(0,(time-imaging.simTimeMs)/duration));position=along(rollerPath,p);const group=Math.min(3,Math.floor(p*4));rotation=group%2===0?[0,0,(time-imaging.simTimeMs)/220]:[(time-imaging.simTimeMs)/220,0,0];if(classified&&!item.leaking)position=along([[layout.rollerEnd,1.16,0],[2.3,1.16,0],[2.3,1.16,waiting[2]],waiting],(time-classified.simTimeMs)/timing.toWaiting);}
  else if(state==='BUFFERED'&&buffered)position=waiting;
  else if(state==='SORTING'&&sort){const path=sortPath(slot,Number(sort.reason.match(/lane (\d+)/)?.[1]??item.lane??1),item.route);path[path.length-1]=destination;position=along(path,(time-sort.simTimeMs)/serviceMs);}
  else if(state==='SECONDARY'||state==='HUMAN'){
    position=placed(routeDestination(state==='SECONDARY'?'SECONDARY_SCREENING':'HUMAN_REVIEW'));
    const clear=events.findLast(e=>(e.type==='SECONDARY_RESULT'&&e.reason.includes('clears item'))||(e.type==='EXPERT_DECISION'&&e.before==='HUMAN'&&e.reason.includes(': APPROVE.')));
    if(clear&&item.coverage>=.8){const path=clearedPath(state==='SECONDARY'?'SECONDARY_SCREENING':'HUMAN_REVIEW');path[0]=position;path[path.length-1]=packing;position=along(path,(time-clear.simTimeMs)/timing.reviewTransfer);}
    const reject=events.findLast(e=>(e.type==='SECONDARY_RESULT'&&e.before==='SECONDARY'&&item.secondary==='REJECT')||(e.type==='EXPERT_DECISION'&&e.before==='HUMAN'&&e.reason.includes(': REJECT.')));if(reject)position=along([position,[16.8,1.16,position[2]],[16.8,1.16,-7],placed(routeDestination('ISOLATE_REJECT'))],(time-reject.simTimeMs)/timing.reviewTransfer);
  }else if(state==='ISOLATED'){
    const early=last(events,'EARLY_ISOLATED');position=early?along([[layout.rollerEnd,1.16,0],[2.3,1.16,0],[2.3,1.16,-3]],(time-early.simTimeMs)/1800):placed(routeDestination('ISOLATE_REJECT'));
  }else if(state==='PACKAGED'&&packed){position=packing;const plan=index(snapshot).plans.findLast(e=>e.simTimeMs<=time);if(plan&&item.disposition&&item.disposition!=='HOLD'){const dest:Point=item.disposition==='DISPATCH'?placed([24.2,1.16,0]):placed([24.2,1.16,5.5]);position=along([packing,[19.3,1.16,0],[20.3,1.16,dest[2]],dest],(time-plan.simTimeMs)/timing.outputTransfer);}}
  else if(state==='HELD')position=heldPosition(item,snapshot,time,item.heldFromState);
  const mappedLayers=(index(snapshot).maps.get(item.crateId)??[]).filter(m=>m.simTimeMs<=time).map(m=>m.layer);
  const exposed=Math.max(1,...mappedLayers);const visible=!(state==='IN_CRATE'&&item.layer>exposed);
  return {position,rotation,visible,state};
}
