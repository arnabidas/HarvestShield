import { scenarioSchema, itemSchema, eventSchema, observationSchema, bubbleSchema, layerSnapshotSchema, outputLotSchema, resourcePlanSchema, type Scenario, type Snapshot, type Item, type EventType, type Route } from './schema';
import { Queue, seeded, hash } from './queue';
import {timing} from './timing';
import { assertInvariants, influence, priority, qualityRoute, reconciles, planResources } from './policy';

interface Job {at:number;order:number;type:EventType;itemId?:string;crateId?:string;layer?:number;view?:'TOP'|'FRONT'|'REAR'|'REVERSE';attempt?:number;decision?:'APPROVE'|'REJECT'|'HOLD';actor?:string;note?:string;lane?:number;references?:string[];}
export const ENGINE_VERSION='hs-event-1.3.0';
export class Engine {
  readonly scenario:Scenario;
  state:Snapshot;
  private queue=new Queue<Job>();private order=0;private rng:()=>number;private completed=false;private recovered=new Set<string>();private pendingSort=new Map<string,Job>();private served=new Map<string,number>();private serveCounter=0;private sorterWake=false;private activeCrates=new Set<string>();private warehouseQueue:Job[]=[];private manifests=new Map<string,{expectedCount:number;expectedMassGrams:number}>();
  constructor(input:unknown){
    this.scenario=scenarioSchema.parse(input);this.rng=seeded(this.scenario.seed);
    this.state={runId:`RUN-${this.scenario.seed}-${hash(this.scenario)}`,engineVersion:ENGINE_VERSION,configHash:hash(this.scenario),seed:this.scenario.seed,simTimeMs:0,status:'READY',items:{},crates:{},lanes:Array.from({length:this.scenario.machine.lanes},(_,n)=>({laneId:n+1,batchId:null,itemId:null,clear:true,availableAt:0,pendingBatchId:null})),observations:[],maps:[],bubbles:[],faults:[],events:[],lots:[],plan:null,maxBuffer:0,equipmentHold:false};
    for(const c of this.scenario.crates){this.state.crates[c.crateId]={crateId:c.crateId,batchId:c.batchId,reconciled:false,held:false,reason:'Waiting for whole-crate inspection'};for(const i of c.items)this.state.items[i.itemId]=itemSchema.parse({...i,batchId:c.batchId,crateId:c.crateId,commodity:this.scenario.batches.find(b=>b.batchId===c.batchId)!.commodity,visualCondition:'UNKNOWN',state:'IN_CRATE',stateSince:0,carrierId:null,slot:null,holdingSlot:null,heldFromState:null,lane:null,route:null,neighborReviewFlag:false,priority:0,bubbleIds:[],observationIds:[],marketability:'PENDING',disposition:null,reason:'Not observed; hidden layers are not approved'});}
    this.scenario.batches.forEach(b=>this.schedule('BATCH_REGISTERED',b.arrivalMs));
    this.scenario.crates.forEach((c,n)=>this.schedule('CRATE_ENTERED',this.scenario.batches.find(b=>b.batchId===c.batchId)!.arrivalMs+n*350,{crateId:c.crateId}));
  }
  private schedule(type:EventType,at:number,fields:Omit<Partial<Job>,'type'|'at'|'order'>={}){if(type==='SORTER_DISPATCH'){if(this.sorterWake||!this.pendingSort.size)return;this.sorterWake=true;}this.queue.push({...fields,type,at:Math.round(at),order:++this.order});}
  get nextTime(){return this.queue.peek()?.at??this.state.simTimeMs;}
  snapshot():Snapshot{return structuredClone(this.state);}
  advance(to:number,maxEvents=500){let n=0;while(this.queue.peek()&&this.nextTime<=to&&n++<maxEvents)this.step(false);return this.snapshot();}
  runAll(limit=100000){let n=0;while(this.queue.size&&n++<limit)this.step(false);if(this.queue.size)throw new Error('Event budget exceeded');if(!this.completed)this.finish();assertInvariants(this.state,this.scenario);return this.snapshot();}
  private emit(job:Job,reason:string,before?:string,after?:string,source:'SYNTHETIC_FIXTURE'|'HEURISTIC'|'HUMAN'|'REAL_TOMATO_MODEL'='SYNTHETIC_FIXTURE'){
    const seq=this.state.events.length+1;const e=eventSchema.parse({eventId:`EV-${String(seq).padStart(6,'0')}`,seq,simTimeMs:job.at,type:job.type,itemId:job.itemId,crateId:job.crateId,source,reason,references:job.references??[],before,after});this.state.events.push(e);return e.eventId;
  }
  private move(item:Item,state:Item['state'],at:number){item.state=state;item.stateSince=at;}
  private fault(job:Job,type:string,reason:string){const item=this.state.items[job.itemId!];const crate=this.state.crates[item.crateId];this.state.faults.push({faultId:`FAULT-${this.state.faults.length+1}`,type,itemId:item.itemId,crateId:item.crateId,simTimeMs:job.at,resolved:false,reason});crate.held=true;crate.reason=reason;item.marketability='HELD';item.reason=reason;item.heldFromState=item.state;this.move(item,'HELD',job.at);item.slot=null;this.releaseUpstream(item.crateId,job.at);}
  private blockCrate(crateId:string,reason:string,at:number){const c=this.state.crates[crateId];c.held=true;c.reason=reason;for(const i of Object.values(this.state.items).filter(i=>i.crateId===crateId&&!['ISOLATED','PACKAGED'].includes(i.state))){i.heldFromState=i.state;this.move(i,'HELD',at);i.marketability='HELD';i.reason=reason;i.slot=null;}this.releaseUpstream(crateId,at);this.schedule('CRATE_RELEASE_BLOCKED',at,{crateId,note:reason});}
  private profile(item:Item){return this.scenario.profiles.find(p=>p.commodity===item.commodity)!;}
  private nextPick(crateId:string,at:number){const next=Object.values(this.state.items).filter(i=>i.crateId===crateId&&['IN_CRATE','MAPPED'].includes(i.state)).sort((a,b)=>a.layer-b.layer||a.index-b.index)[0];if(next){if(next.state==='IN_CRATE')this.schedule('LAYER_MAPPED',at+400,{crateId,layer:next.layer});else this.schedule('PICK_ATTEMPTED',at+200,{crateId,itemId:next.itemId});}else this.schedule('CRATE_ALL_ITEMS_ACCOUNTED',at+350,{crateId});}
  step(copy=true):Snapshot {
    const job=this.queue.pop();if(!job){if(!this.completed)this.finish();return this.result(copy);}
    if(job.type==='SORTER_DISPATCH')this.sorterWake=false;this.state.simTimeMs=job.at;this.state.status='RUNNING';
    const item=job.itemId?this.state.items[job.itemId]:undefined;
    const crate=job.crateId?this.state.crates[job.crateId]:item?this.state.crates[item.crateId]:undefined;
    const before=item?.state;let reason=job.note??job.type.replaceAll('_',' ').toLowerCase();let source:'SYNTHETIC_FIXTURE'|'HEURISTIC'|'HUMAN'|'REAL_TOMATO_MODEL'='SYNTHETIC_FIXTURE';
    // Cancel outstanding work for a held crate; records remain conserved.
    if(crate?.held&&!['CRATE_RELEASE_BLOCKED','EQUIPMENT_HOLD','CLEANING_STARTED','CLEANING_VERIFIED','LANE_CHANGEOVER','LANE_ASSIGNED','RECOVERY_VERIFIED','SECONDARY_RETEST','ALTERNATE_GRADE_ASSIGNED','RESOURCE_PLAN_GENERATED'].includes(job.type)) {if(!this.queue.size&&!this.completed)this.finish();return this.result(copy);}
    switch(job.type){
      case 'BATCH_REGISTERED':reason='One commodity per batch; manifest/profile and environment are scenario inputs';break;
      case 'CRATE_ENTERED':{if(!this.activeCrates.has(job.crateId!)){if(this.activeCrates.size>=this.scenario.machine.upstreamCapacity){this.warehouseQueue.push(job);this.schedule('BUFFER_BACKPRESSURE',job.at,{crateId:job.crateId,note:'Warehouse feeder waits for an upstream inspection slot'});return this.result(copy);}this.activeCrates.add(job.crateId!);}
        const items=Object.values(this.state.items).filter(i=>i.crateId===job.crateId);
        if(items.filter(i=>!i.leaking).length>this.scenario.machine.bufferCapacity){this.blockCrate(job.crateId!,'Whole-crate buffer requirement exceeds configured capacity; back-pressure / configuration HOLD',job.at);this.schedule('BUFFER_BACKPRESSURE',job.at,{crateId:job.crateId,note:'No premature sort to free space'});break;}
        this.schedule('LAYER_MAPPED',job.at+timing.crateArrival,{crateId:job.crateId,layer:Math.min(...items.map(i=>i.layer))});reason='Warehouse crate registered; original IDs established before transfer';break;}
      case 'LAYER_MAPPED':{
        const items=Object.values(this.state.items).filter(i=>i.crateId===job.crateId&&i.layer===job.layer&&['IN_CRATE','MAPPED'].includes(i.state));
        this.state.maps.push(layerSnapshotSchema.parse({snapshotId:`MAP-${this.state.maps.length+1}`,crateId:job.crateId,layer:job.layer,itemIds:items.map(i=>i.itemId),simTimeMs:job.at,version:1,shiftFlag:false,uncertainty:.1}));
        items.forEach(i=>this.move(i,'MAPPED',job.at));this.nextPick(job.crateId!,job.at);reason=`Exposed layer ${job.layer} mapped BEFORE removal; ${items.length} permanent IDs`;break;}
      case 'PICK_ATTEMPTED':{
        if(!item)break;
        if(this.state.equipmentHold){if((job.attempt??0)>80){this.blockCrate(item.crateId,'Equipment sanitation remains unresolved',job.at);break;}this.schedule('PICK_ATTEMPTED',job.at+500,{...job,attempt:(job.attempt??0)+1});return this.result(copy);}
        if(Object.values(this.state.items).filter(i=>i.slot!==null).length>=this.scenario.machine.bufferCapacity){
          if((job.attempt??0)>80){this.blockCrate(item.crateId,'Buffer congestion did not clear; source crate held',job.at);break;}
          this.schedule('BUFFER_BACKPRESSURE',job.at,{crateId:item.crateId,note:'Indexed buffer full; feeder waiting'});this.schedule('PICK_ATTEMPTED',job.at+500,{...job,attempt:(job.attempt??0)+1});return this.result(copy);
        }
        if(this.scenario.faultInjections.some(f=>f.itemId===item.itemId&&f.type==='PICK_FAILED'&&!this.recovered.has(`${f.type}:${f.itemId}`))){this.fault(job,'PICK_FAILED','Simulated suction verification failed; source identity retained');this.schedule('FAULT_RAISED',job.at,{itemId:item.itemId,crateId:item.crateId,note:item.reason});break;}
        this.move(item,'PICKING',job.at);this.schedule('PICK_SUCCEEDED',job.at+timing.pick,{itemId:item.itemId,crateId:item.crateId});reason=`${this.profile(item).handling} concept; padded pickup verification pending`;break;}
      case 'PICK_SUCCEEDED':this.move(item!,'PICKED',job.at);this.schedule('ITEM_ENTERED_CARRIER',job.at+timing.liftTransfer,{itemId:job.itemId,crateId:item!.crateId});this.schedule('LAYER_REMAPPED',job.at,{crateId:item!.crateId,layer:item!.layer});reason='Synthetic pressure/count check confirms exactly one transfer';break;
      case 'LAYER_REMAPPED':{
        const prev=this.state.maps.filter(m=>m.crateId===job.crateId&&m.layer===job.layer).at(-1)!;
        this.state.maps.push({...prev,snapshotId:`MAP-${this.state.maps.length+1}`,itemIds:Object.values(this.state.items).filter(i=>i.crateId===job.crateId&&i.layer===job.layer&&i.state==='MAPPED').map(i=>i.itemId),version:prev.version+1,simTimeMs:job.at,shiftFlag:true,uncertainty:.15});reason='Active exposed map updated after pickup; original coordinates remain immutable';break;}
      case 'ITEM_ENTERED_CARRIER':this.move(item!,'CARRIER',job.at);item!.carrierId=`CARRIER-${item!.itemId}`;this.schedule('IDENTITY_VERIFIED',job.at+timing.carrierVerification,{itemId:job.itemId,crateId:item!.crateId});break;
      case 'IDENTITY_VERIFIED':{
        if(this.scenario.faultInjections.some(f=>f.itemId===item!.itemId&&f.type==='IDENTITY_LOST'&&!this.recovered.has(`${f.type}:${f.itemId}`))){this.fault(job,'IDENTITY_LOST','Carrier identity lost; no guessed reassignment or approval');this.schedule('FAULT_RAISED',job.at,{itemId:job.itemId,crateId:item!.crateId,note:item!.reason});break;}
        this.move(item!,'IMAGING',job.at);const duration=timing.rollerInspection+Math.floor(this.rng()*100);item!.imagingDurationMs=duration;(['TOP','FRONT','REAR','REVERSE'] as const).forEach((view,n)=>this.schedule('ROLLER_VIEW_CAPTURED',job.at+duration*(n+1)/4,{itemId:job.itemId,crateId:item!.crateId,view}));this.schedule('ITEM_VISUAL_CLASSIFIED',job.at+duration+timing.classification,{itemId:job.itemId,crateId:item!.crateId});reason='Synthetic optical checkpoint binds original ID to indexed carrier';break;}
      case 'ROLLER_VIEW_CAPTURED':{
        if(item!.inferenceRequired){reason='Illustrated roller checkpoint; no additional photo was captured';break;}
        const incomplete=this.scenario.faultInjections.some(f=>f.itemId===job.itemId&&f.type==='COVERAGE_INCOMPLETE'&&!this.recovered.has(`${f.type}:${f.itemId}`));if(incomplete)item!.coverage=.45;
        const observation=observationSchema.parse({observationId:`OBS-${this.state.observations.length+1}`,itemId:job.itemId,view:job.view,visual:item!.rearDefect&&['TOP','FRONT'].includes(job.view!)?'GOOD':item!.visual,coverage:item!.coverage,simTimeMs:job.at,source:'SYNTHETIC_FIXTURE'});
        this.state.observations.push(observation);item!.observationIds.push(observation.observationId);reason=`Synthetic ${job.view} view; ${Math.round(item!.coverage*100)}% conceptual surface coverage`;break;}
      case 'ITEM_VISUAL_CLASSIFIED':{
        if(item!.inferenceRequired){if(!item!.modelEvidence)throw new Error('Awaiting actual tomato inference; no fixture value substituted');source='REAL_TOMATO_MODEL';const evidence=item!.modelEvidence;for(const view of item!.modelViews??[evidence]){const observation=observationSchema.parse({observationId:`OBS-${this.state.observations.length+1}`,itemId:item!.itemId,view:'UPLOAD',visual:view.sourceLabel==='Fresh'?'GOOD':'BAD',coverage:0,simTimeMs:job.at,source:'REAL_TOMATO_MODEL'});this.state.observations.push(observation);item!.observationIds.push(observation.observationId);}reason=`${evidence.sourceLabel} · confidence ${evidence.confidence} · ${evidence.modelVersion} · image ${evidence.imageSha256}`;}
        item!.visualCondition=item!.modelEvidence?item!.visual:item!.coverage<.8?'UNCERTAIN':item!.visual;item!.route=qualityRoute(item!,this.profile(item!));item!.reason='Source observation recorded; route remains provisional until crate reconciliation';
        if(item!.visualCondition==='BAD')this.schedule('DEFECT_FLAGGED',job.at,{itemId:job.itemId,crateId:item!.crateId});
        if(item!.leaking){this.schedule('EARLY_ISOLATED',job.at+150,{itemId:job.itemId,crateId:item!.crateId});}else this.schedule('ITEM_BUFFERED',job.at+timing.toWaiting,{itemId:job.itemId,crateId:item!.crateId});if(!item!.modelEvidence)reason=`${item!.visualCondition} · SYNTHETIC_FIXTURE; not a trained four-class model`;break;}
      case 'DEFECT_FLAGGED':this.schedule('BUBBLE_CREATED',job.at,{itemId:job.itemId,crateId:item!.crateId,references:[`EV-${String(this.state.events.length+1).padStart(6,'0')}`]});reason='Visible fixture defect; original crate position retained';break;
      case 'BUBBLE_CREATED':{
        source='HEURISTIC';if(this.state.bubbles.some(b=>b.itemId===item!.itemId)){reason='Existing original-coordinate defect field retained after rescan; no duplicate influence';break;}if(!this.scenario.bubbleEnabled){reason='Visual-only baseline: bubble policy disabled';break;}
        const p=this.profile(item!);const b=bubbleSchema.parse({bubbleId:`BUBBLE-${this.state.bubbles.length+1}`,itemId:job.itemId,crateId:item!.crateId,triggerEventId:job.references![0],origin:item!.origin,layer:item!.layer,alpha:p.alpha,beta:p.beta,severity:1,policyVersion:p.version});this.state.bubbles.push(b);
        for(const neighbor of Object.values(this.state.items).filter(i=>i.crateId===item!.crateId&&i.itemId!==item!.itemId)){
          const score=priority(neighbor,this.state.bubbles);if(score!==neighbor.priority)this.schedule('NEIGHBOR_PRIORITY_UPDATED',job.at,{itemId:neighbor.itemId,crateId:neighbor.crateId,references:[b.bubbleId,`EV-${String(this.state.events.length+1).padStart(6,'0')}`]});
        }reason=`${b.bubbleId}; original XY/layer field; priority heuristic, NOT contamination probability`;break;}
      case 'NEIGHBOR_PRIORITY_UPDATED':{
        source='HEURISTIC';item!.priority=priority(item!,this.state.bubbles);item!.bubbleIds=this.state.bubbles.filter(b=>influence(item!,b)>0).map(b=>b.bubbleId);item!.neighborReviewFlag=item!.priority>=this.profile(item!).threshold;item!.route=qualityRoute(item!,this.profile(item!));item!.reason=`Original crate neighbor influence ${item!.priority.toFixed(3)}; visual finding preserved`;reason=`${item!.alias}: visual ${item!.visualCondition} preserved; ${item!.neighborReviewFlag?'SECONDARY_SCREENING required':'below review threshold'}; contributing ${item!.bubbleIds.join(', ')}`;break;}
      case 'EARLY_ISOLATED':this.move(item!,'ISOLATED',job.at);item!.marketability='REJECTED';item!.route='ISOLATE_REJECT';this.schedule('EQUIPMENT_HOLD',job.at,{itemId:job.itemId,crateId:item!.crateId});this.nextPick(item!.crateId,job.at);reason='Leaking item segregated early; ID and bubble remain in crate ledger';break;
      case 'EQUIPMENT_HOLD':this.state.equipmentHold=true;this.state.faults.push({faultId:`FAULT-${this.state.faults.length+1}`,type:'SANITATION_HOLD',itemId:job.itemId!,crateId:job.crateId!,simTimeMs:job.at,resolved:false,reason:'Contact-zone sanitation verification required'});if(this.scenario.machine.autoCleaning)this.schedule('CLEANING_STARTED',job.at+300,{itemId:job.itemId,crateId:job.crateId});break;
      case 'CLEANING_STARTED':this.schedule('CLEANING_VERIFIED',job.at+2000,{itemId:job.itemId,crateId:job.crateId});reason='Synthetic cleaning cycle; no disinfection certification';break;
      case 'CLEANING_VERIFIED':this.state.equipmentHold=false;this.state.faults.filter(f=>f.type==='SANITATION_HOLD').forEach(f=>f.resolved=true);reason='Scenario verification clears equipment hold; physical efficacy unverified';break;
      case 'ITEM_BUFFERED':{
        const used=new Set(Object.values(this.state.items).flatMap(i=>i.slot===null?[]:[i.slot]));let slot=item!.alias==='A2'&&this.scenario.machine.bufferCapacity>12&&!used.has(12)?12:0;while(used.has(slot)||(slot===12&&item!.alias!=='A2'&&this.scenario.machine.bufferCapacity>12))slot++;
        if(slot>=this.scenario.machine.bufferCapacity){if((job.attempt??0)>80){this.blockCrate(item!.crateId,'Concurrent in-flight carriers cannot enter full buffer; controlled HOLD',job.at);break;}this.schedule('ITEM_BUFFERED',job.at+500,{itemId:job.itemId,crateId:item!.crateId,attempt:(job.attempt??0)+1});return this.result(copy);}
        item!.slot=slot;item!.holdingSlot=slot;this.move(item!,'BUFFERED',job.at);this.state.maxBuffer=Math.max(this.state.maxBuffer,used.size+1);this.nextPick(item!.crateId,job.at);reason=`${item!.alias} → indexed holding slot ${slot}; original layer ${item!.layer}; no normal sorting yet`;break;}
      case 'CRATE_ALL_ITEMS_ACCOUNTED':this.schedule('CRATE_RECONCILED',job.at+600,{crateId:job.crateId});break;
      case 'CRATE_RECONCILED':{
        const gate=reconciles(this.state,this.scenario,job.crateId!,this.manifests.get(job.crateId!));if(!gate.ok){this.blockCrate(job.crateId!,gate.reason,job.at);return this.result(copy);}this.releaseUpstream(job.crateId!,job.at);crate!.reconciled=true;crate!.reason=gate.reason;reason=gate.reason;
        Object.values(this.state.items).filter(i=>i.crateId===job.crateId&&i.state==='BUFFERED').forEach((i,n)=>this.schedule('ITEM_ROUTE_FINALIZED',job.at+500+n*60,{itemId:i.itemId,crateId:i.crateId}));break;}
      case 'ITEM_ROUTE_FINALIZED':{if(item!.state!=='BUFFERED')return this.result(copy);
        if(!crate!.reconciled)throw new Error('Premature normal sorting');const route=qualityRoute(item!,this.profile(item!));const humanCount=Object.values(this.state.items).filter(i=>i.state==='HUMAN'||i.state==='SORTING'&&i.route==='HUMAN_REVIEW').length;const secondaryCount=Object.values(this.state.items).filter(i=>i.state==='SECONDARY'||i.state==='SORTING'&&i.route==='SECONDARY_SCREENING').length;
        const available=(l:Snapshot['lanes'][number])=>l.itemId===null&&l.clear&&l.availableAt<=job.at;const own=this.scenario.machine.laneGroups.find(g=>g.batchId===item!.batchId);const compatible=(l:Snapshot['lanes'][number])=>{const owner=this.scenario.machine.laneGroups.find(g=>g.lanes.includes(l.laneId));return !owner||owner.batchId===item!.batchId||!Object.values(this.state.items).some(i=>i.batchId===owner.batchId&&!['PACKAGED','ISOLATED','HELD'].includes(i.state));};const candidates=this.state.lanes.filter(l=>available(l)&&compatible(l));const lane=candidates.find(l=>l.batchId===item!.batchId)||candidates.find(l=>own?.lanes.includes(l.laneId))||candidates[0];
        if(!lane||(route==='HUMAN_REVIEW'&&humanCount>=this.scenario.machine.humanCapacity)||(route==='SECONDARY_SCREENING'&&secondaryCount>=this.scenario.machine.secondaryCapacity)){
          this.pendingSort.set(item!.itemId,job);if((job.attempt??0)===0)this.schedule('BUFFER_BACKPRESSURE',job.at,{crateId:item!.crateId,note:'Sorter waits for free compatible lane / bounded review capacity'});return this.result(copy);
        }
        if(lane.batchId!==item!.batchId){if(lane.batchId){lane.clear=false;lane.availableAt=job.at+this.scenario.machine.changeoverMs;lane.pendingBatchId=item!.batchId;this.schedule('LANE_CHANGEOVER',lane.availableAt,{lane:lane.laneId,itemId:job.itemId,crateId:item!.crateId,note:`Empty lane ${lane.laneId}: ${lane.batchId} → ${item!.batchId}; ${this.scenario.machine.changeoverMs}ms clearance completed`});this.schedule('ITEM_ROUTE_FINALIZED',lane.availableAt+1,{...job});return this.result(copy);}lane.batchId=item!.batchId;this.schedule('LANE_ASSIGNED',job.at,{lane:lane.laneId,itemId:job.itemId,crateId:item!.crateId});}
        this.served.set(item!.batchId,++this.serveCounter);this.pendingSort.delete(item!.itemId);lane.itemId=item!.itemId;lane.clear=false;item!.lane=lane.laneId;item!.slot=null;item!.route=route;this.move(item!,'SORTING',job.at);
        this.schedule(route==='APPROVED'?'ITEM_PACKAGED':route==='ISOLATE_REJECT'?'ITEM_REJECTED':route==='SECONDARY_SCREENING'?'SECONDARY_RESULT':'EXPERT_DECISION',job.at+this.scenario.machine.serviceMs,{itemId:job.itemId,crateId:item!.crateId});reason=`${item!.alias} → ${route}; lane ${lane.laneId}; whole-crate gate passed`;break;}
      case 'SORTER_DISPATCH':{
        const all=Object.values(this.state.items),waiting=[...this.pendingSort.values()].filter(j=>this.state.items[j.itemId!].state==='BUFFERED').sort((a,b)=>(this.served.get(this.state.items[a.itemId!].batchId)??0)-(this.served.get(this.state.items[b.itemId!].batchId)??0)||a.order-b.order);
        const ready=waiting.find(j=>{const i=this.state.items[j.itemId!],route=qualityRoute(i,this.profile(i));if(route==='HUMAN_REVIEW'&&all.filter(x=>x.state==='HUMAN'||x.state==='SORTING'&&x.route==='HUMAN_REVIEW').length>=this.scenario.machine.humanCapacity)return false;if(route==='SECONDARY_SCREENING'&&all.filter(x=>x.state==='SECONDARY'||x.state==='SORTING'&&x.route==='SECONDARY_SCREENING').length>=this.scenario.machine.secondaryCapacity)return false;return this.state.lanes.some(l=>{if(l.itemId!==null||!l.clear||l.availableAt>job.at)return false;const owner=this.scenario.machine.laneGroups.find(g=>g.lanes.includes(l.laneId));return !owner||owner.batchId===i.batchId||!all.some(x=>x.batchId===owner.batchId&&!['PACKAGED','ISOLATED','HELD'].includes(x.state));});});
        if(ready){this.pendingSort.delete(ready.itemId!);this.schedule('ITEM_ROUTE_FINALIZED',job.at+1,{...ready,attempt:1});this.schedule('SORTER_DISPATCH',job.at+2);}reason='Fair bounded wakeup; one compatible item, capacity rechecked';break;}

      case 'LANE_ASSIGNED':reason=`Lane ${job.lane} batch ${item!.batchId}; known ID and commodity ${item!.commodity}`;break;
      case 'LANE_CHANGEOVER':{const lane=this.state.lanes.find(l=>l.laneId===job.lane)!;if(lane.itemId!==null)throw new Error('Occupied lane changeover');lane.batchId=lane.pendingBatchId;lane.pendingBatchId=null;lane.clear=true;this.schedule('SORTER_DISPATCH',job.at+2);this.schedule('LANE_ASSIGNED',job.at,{lane:job.lane,itemId:job.itemId,crateId:job.crateId});break;}
      case 'SECONDARY_RESULT':{
        if(item!.state==='SORTING'){this.move(item!,'SECONDARY',job.at);this.clearLane(item!,job.at);if(this.scenario.machine.autoSecondary)this.schedule('SECONDARY_RESULT',job.at+1600,{itemId:job.itemId,crateId:item!.crateId});reason='Synthetic additional screening started; pending evidence';break;}
        if(item!.secondary==='APPROVE'){this.schedule('ITEM_PACKAGED',job.at+timing.reviewTransfer,{itemId:job.itemId,crateId:item!.crateId});reason='Synthetic secondary evidence clears item; original review route retained';}
        else if(item!.secondary==='REJECT')this.schedule('ITEM_REJECTED',job.at+timing.reviewTransfer,{itemId:job.itemId,crateId:item!.crateId});
        else if(item!.secondary==='HUMAN')this.schedule('EXPERT_DECISION',job.at+500,{itemId:job.itemId,crateId:item!.crateId});
        else{item!.heldFromState=item!.state;this.move(item!,'HELD',job.at);item!.marketability='HELD';this.clearLane(item!,job.at);reason='Secondary unresolved; held and excluded from market';}break;}
      case 'EXPERT_DECISION':{
        if(item!.state!=='HUMAN'){
          if(Object.values(this.state.items).filter(i=>i.state==='HUMAN').length>=this.scenario.machine.humanCapacity){if((job.attempt??0)>120){item!.heldFromState=item!.state;this.move(item!,'HELD',job.at);item!.marketability='HELD';item!.reason='Human-review backlog did not clear; held without approval';this.clearLane(item!,job.at);reason=item!.reason;break;}this.schedule('EXPERT_DECISION',job.at+500,{...job,attempt:(job.attempt??0)+1});return this.result(copy);}
          this.move(item!,'HUMAN',job.at);this.clearLane(item!,job.at);if(this.scenario.machine.autoExpert)this.schedule('EXPERT_DECISION',job.at+3000,{itemId:job.itemId,crateId:item!.crateId,decision:item!.expert,actor:'SYNTHETIC_DEMO_INSPECTOR',note:'Fixture inspector decision; all four views reviewed'});reason='Human review pending; demo role, no production authentication';break;
        }
        if(!job.decision){reason='Awaiting logged demo inspector action';break;}
        if(!job.actor||!job.note)throw new Error('Expert decision requires actor and reason');source=job.actor==='SYNTHETIC_DEMO_INSPECTOR'?'SYNTHETIC_FIXTURE':'HUMAN';reason=`${job.actor}: ${job.decision}. ${job.note}`;
        if(job.decision==='APPROVE'&&item!.coverage>=.8&&!this.state.faults.some(f=>f.itemId===item!.itemId&&!f.resolved))this.schedule('ITEM_PACKAGED',job.at+timing.reviewTransfer,{itemId:job.itemId,crateId:item!.crateId});
        else if(job.decision==='REJECT')this.schedule('ITEM_REJECTED',job.at+timing.reviewTransfer,{itemId:job.itemId,crateId:item!.crateId});
        else{item!.heldFromState=item!.state;this.move(item!,'HELD',job.at);item!.marketability='HELD';reason+='; evidence/coverage guard keeps item held';}this.schedule('SORTER_DISPATCH',job.at+1);break;}
      case 'ITEM_PACKAGED':{
        if(!crate!.reconciled||item!.visualCondition==='BAD'||item!.leaking||item!.coverage<.8||this.state.faults.some(f=>f.itemId===item!.itemId&&!f.resolved))throw new Error('Unsafe packaging request');
        const permitted=item!.route==='APPROVED'||(item!.route==='SECONDARY_SCREENING'&&item!.secondary==='APPROVE')||item!.state==='HUMAN';if(!permitted)throw new Error('Uncleared review item');
        if(this.scenario.machine.simulatedWashing&&this.profile(item!).washPermitted&&!item!.simulatedWashed){this.schedule('WASH_STARTED',job.at,{itemId:item!.itemId,crateId:item!.crateId});return this.result(copy);}
        this.move(item!,'PACKAGED',job.at);item!.marketability='APPROVED';this.clearLane(item!,job.at);this.schedule('OUTPUT_LOT_CREATED',job.at,{itemId:job.itemId,crateId:item!.crateId});reason='Verified policy clearance; packed with original source lineage';break;}
      case 'WASH_STARTED':this.schedule('WASH_VERIFIED',job.at+2000,{itemId:job.itemId,crateId:item!.crateId});reason='Conceptual rinse for operator-permitted profile; no change to visual finding, coverage or safety clearance';break;
      case 'WASH_VERIFIED':item!.simulatedWashed=true;this.schedule('ITEM_PACKAGED',job.at+1,{itemId:job.itemId,crateId:item!.crateId});reason='Synthetic wash cycle complete; physical sanitation efficacy unverified';break;
      case 'ITEM_REJECTED':this.move(item!,'ISOLATED',job.at);item!.marketability='REJECTED';this.clearLane(item!,job.at);reason='Rejection verified; excluded from packaging and dispatch';break;
      case 'OUTPUT_LOT_CREATED':{
        const lotId=`OUT-${item!.batchId}-${item!.crateId}`;let lot=this.state.lots.find(l=>l.lotId===lotId);if(!lot){lot=outputLotSchema.parse({lotId,batchId:item!.batchId,crateId:item!.crateId,sourceLot:this.scenario.batches.find(b=>b.batchId===item!.batchId)!.sourceLot,itemIds:[],massGrams:0,approved:true});this.state.lots.push(lot);}if(!lot.itemIds.includes(item!.itemId)){lot.itemIds.push(item!.itemId);lot.massGrams+=item!.massGrams;}reason=`${lotId}: retained ${item!.itemId}, ${item!.massGrams}g`;break;}
      case 'RECOVERY_VERIFIED':case 'SECONDARY_RETEST':case 'ALTERNATE_GRADE_ASSIGNED':source='HUMAN';break;
      case 'LANE_CLEARED':reason='Carrier empty and lineage recorded; lane eligible for batch changeover';break;
      case 'CRATE_RELEASE_BLOCKED':reason=crate!.reason;break;
      case 'FAULT_RAISED':reason=item!.reason;break;
      case 'BUFFER_BACKPRESSURE':break;
      case 'RESOURCE_PLAN_GENERATED':this.state.plan=resourcePlanSchema.parse(planResources(this.state,this.scenario));source='HEURISTIC';reason='Legacy resource-priority concept gated by approved-only output, provenance, transit and whole-item capacity';for(const a of this.state.plan.allocations){this.state.items[a.itemId].disposition=a.action;this.state.items[a.itemId].reason=a.reason;if(a.action!=='HOLD')this.schedule(a.action==='DISPATCH'?'TRUCK_LOADED':'STORAGE_ALLOCATED',job.at+timing.outputTransfer,{itemId:a.itemId,crateId:this.state.items[a.itemId].crateId,note:a.reason});}this.schedule('RUN_COMPLETE',job.at+timing.outputTransfer+800);break;
      case 'TRUCK_LOADED':case 'STORAGE_ALLOCATED':source='HEURISTIC';break;
      case 'RUN_COMPLETE':this.state.status='COMPLETE';this.completed=true;reason='Processing complete; unresolved/held quantities remain excluded from market';break;
    }
    this.emit(job,reason,before,item?.state,source);if(copy||['CRATE_RECONCILED','ITEM_PACKAGED','RESOURCE_PLAN_GENERATED','RUN_COMPLETE'].includes(job.type))assertInvariants(this.state,this.scenario);
    if(!this.queue.size&&!this.completed)this.finish();return this.result(copy);
  }
  private releaseUpstream(crateId:string,at:number){if(this.activeCrates.delete(crateId)){const next=this.warehouseQueue.shift();if(next)this.schedule('CRATE_ENTERED',at+1000,{crateId:next.crateId});}}
  private result(copy:boolean){if(!this.queue.size&&!this.completed)this.finish();return copy?this.snapshot():this.state;}
  private clearLane(item:Item,at:number){const lane=this.state.lanes.find(l=>l.itemId===item.itemId);if(lane){lane.itemId=null;lane.clear=true;this.schedule('SORTER_DISPATCH',at+1);this.schedule('LANE_CLEARED',at,{lane:lane.laneId,itemId:item.itemId,crateId:item.crateId});}}
  private finish(){if(this.state.events.at(-1)?.type!=='RUN_COMPLETE'&&!this.queue.size)this.schedule('RESOURCE_PLAN_GENERATED',this.state.simTimeMs+600);}
  recover(itemId:string,verifiedId:string,actor:string,reason:string){
    const item=this.state.items[itemId];if(!item||verifiedId!==itemId||!actor.trim()||!reason.trim())throw new Error('Recovery requires matching original ID, actor and evidence note');
    if(this.state.status!=='COMPLETE')throw new Error('Pause at completed processing before recovery');
    if(item.modelEvidence||item.inferenceRequired)throw new Error('A photo requires actual additional imagery; synthetic recovery cannot supply hidden views');
    const crate=this.state.crates[item.crateId];const members=Object.values(this.state.items).filter(i=>i.crateId===item.crateId);
    if(!crate.held&&!members.some(i=>i.state==='HELD'||i.state==='HUMAN'&&i.coverage<.8))throw new Error('No held crate or incomplete coverage to rescan');
    if(members.filter(i=>!i.leaking).length>this.scenario.machine.bufferCapacity)throw new Error('Increase buffer capacity in a new run before retrying');
    for(const f of this.state.faults.filter(f=>f.crateId===crate.crateId&&!f.resolved)){f.resolved=true;f.reason+=`; verified by ${actor}: ${reason}`;this.recovered.add(`${f.type}:${f.itemId}`);}
    for(const i of members){this.recovered.add(`COVERAGE_INCOMPLETE:${i.itemId}`);if(!['PACKAGED','ISOLATED'].includes(i.state)){i.coverage=this.scenario.crates.flatMap(c=>c.items).find(x=>x.itemId===i.itemId)!.coverage;i.slot=null;i.observationIds=[];i.marketability='PENDING';this.move(i,'IN_CRATE',this.state.simTimeMs);}}
    this.manifests.set(crate.crateId,{expectedCount:members.length,expectedMassGrams:members.reduce((n,i)=>n+i.massGrams,0)});crate.held=false;crate.reconciled=false;this.activeCrates.add(crate.crateId);this.state.equipmentHold=this.state.faults.some(f=>f.type==='SANITATION_HOLD'&&!f.resolved);this.completed=false;this.state.plan=null;
    this.schedule('RECOVERY_VERIFIED',this.state.simTimeMs+1,{itemId,crateId:crate.crateId,note:`${actor}: ${reason}. Verified source ${verifiedId}; manifest ${members.length} IDs / ${members.reduce((n,i)=>n+i.massGrams,0)}g; synthetic rescan only`});this.nextPick(crate.crateId,this.state.simTimeMs+1);
  }
  retest(itemId:string,decision:'APPROVE'|'REJECT'|'HUMAN'|'HOLD'|'ALTERNATE',actor:string,reason:string,permittedUse=''){
    const item=this.state.items[itemId];if(!item||item.state!=='SECONDARY'||this.state.status!=='COMPLETE'||!actor.trim()||!reason.trim())throw new Error('Retest requires pending secondary item, actor and evidence note');
    if(decision==='ALTERNATE'&&(!permittedUse.trim()||item.visualCondition==='BAD'||item.leaking||item.coverage<.8))throw new Error('Alternate use requires complete non-rejected evidence and explicit permitted use');
    this.completed=false;this.state.plan=null;this.schedule('SECONDARY_RETEST',this.state.simTimeMs+1,{itemId,crateId:item.crateId,note:`${actor}: ${decision}. ${reason}`});
    if(decision==='ALTERNATE'){if(item.visualCondition==='BAD'||item.leaking||item.coverage<.8)throw new Error('Alternate grade requires complete non-rejected evidence');item.alternateUse=permittedUse.trim();item.marketability='HELD';this.move(item,'ISOLATED',this.state.simTimeMs+1);this.schedule('ALTERNATE_GRADE_ASSIGNED',this.state.simTimeMs+1,{itemId,crateId:item.crateId,note:`${actor}: permitted ${permittedUse}; excluded from fresh-market dispatch`});}
    else{item.secondary=decision;this.schedule('SECONDARY_RESULT',this.state.simTimeMs+2,{itemId,crateId:item.crateId});}this.schedule('SORTER_DISPATCH',this.state.simTimeMs+3);
  }
  review(itemId:string,decision:'APPROVE'|'REJECT'|'HOLD',reason:string){const item=this.state.items[itemId];if(!item||item.state!=='HUMAN')throw new Error('Only pending human-review items can be resolved');if(!reason.trim())throw new Error('A reason is required');this.completed=false;this.state.status='RUNNING';this.schedule('EXPERT_DECISION',this.state.simTimeMs+100,{itemId,crateId:item.crateId,decision,actor:'LOCAL_DEMO_INSPECTOR',note:reason.trim()});}
}
