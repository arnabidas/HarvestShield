import { profiles, scenarioSchema, type Scenario, type ItemInput, type Commodity } from '../domain/schema';
import reference from '../../../docs/reference-fixtures/A2_B4_retroactive_bubble_demo.json';
import laneReference from '../../../docs/reference-fixtures/twenty_lane_batch_groups.json';

function item(batch:string,crate:string,layer:number,index:number,alias:string,x:number,y:number,visual:ItemInput['visual']='GOOD'):ItemInput {
  return {itemId:`${batch}-${crate}-L${String(layer).padStart(2,'0')}-I${String(index).padStart(2,'0')}`, alias,layer,index,origin:{x,y,confidence:1},massGrams:150,visual,coverage:.92,leaking:false,rearDefect:false,secondary:'APPROVE',expert:'APPROVE'};
}
export function judgeScenario():Scenario {
  const src=reference.batches[0]; const crate=src.crates[0];
  const items=crate.layers.flatMap(l=>l.items.map((i,index)=>item(src.batchId,crate.crateId,l.layerIndex,index+1,i.alias,i.x,i.y,i.sourceVisualLabel as ItemInput['visual'])));
  items.push(item('B101','C01',3,1,'C1',.05,.95,'MODERATE'),item('B101','C01',3,2,'C2',.98,.05,'UNCERTAIN'),item('B101','C01',3,3,'F04',.95,.95));
  items[8].rearDefect=true;items[8].visual='BAD';
  items.push(item('B101','C01',3,4,'C4',.02,.9),item('B101','C01',2,4,'B6',.99,.01),item('B101','C01',1,4,'A4',.01,.99));
  // The supplied 2kg tomatoes are conceptual quantity placeholders; actual demo uses explicitly synthetic 150g items.
  return scenarioSchema.parse({schemaVersion:'1.1',scenarioId:'HS-JUDGE-A2-B4',title:'The complete machine · A2 / B4',seed:102026,
    batches:[{batchId:'B101',commodity:'tomato',sourceLot:'FPO-LOT-01',arrivalMs:0,handlingWindowHours:24,windowSource:'SCENARIO_FIXTURE',urgency:80,environmentalHistory:{temperatureC:[15,15.5,16],humidityPct:[88,90,91],ethylene:null,source:'SCENARIO_FIXTURE'}}],
    crates:[{crateId:'C01',batchId:'B101',expectedCount:items.length,expectedMassGrams:items.length*150,items}],profiles:[profiles.tomato],machine:{lanes:20,bufferCapacity:128,humanCapacity:4,serviceMs:1200,autoExpert:true,autoCleaning:true},capacities:{truckGrams:600,storageGrams:900,transitHours:4,safetyHours:2,storageCompatible:true},faultInjections:[],bubbleEnabled:true});
}
export const scenarioNames=['Complete machine','Three-layer happy path','Rear-side defect','Multiple bubbles','Leaking / sanitation hold','Failed pickup','Tracking loss','Full buffer','Count mismatch','Missing camera views','Limited truck','Multi-commodity · 20 lanes','Human backlog','120 kg eligibility validation','Environmental risk comparison','1000 item stress'] as const;
export function preset(name:string):Scenario {
  const s=judgeScenario();s.title=name;s.scenarioId=`HS-${scenarioNames.indexOf(name as typeof scenarioNames[number])}`;
  const first=s.crates[0].items[0];
  if(name==='Three-layer happy path') { s.crates[0].items.forEach(i=>{i.visual='GOOD';i.rearDefect=false;}); }
  if(name==='Rear-side defect') s.crates[0].items.forEach(i=>{i.visual=i.rearDefect?'BAD':'GOOD';});
  if(name==='Multiple bubbles') s.crates[0].items[2].visual='BAD';
  if(name==='Failed pickup') s.faultInjections=[{type:'PICK_FAILED',itemId:first.itemId}];
  if(name==='Tracking loss') s.faultInjections=[{type:'IDENTITY_LOST',itemId:first.itemId}];
  if(name==='Full buffer') s.machine.bufferCapacity=3;
  if(name==='Count mismatch') {s.crates[0].expectedCount++;s.crates[0].expectedMassGrams+=150;}
  if(name==='Missing camera views') s.faultInjections=[{type:'COVERAGE_INCOMPLETE',itemId:first.itemId}];
  if(name==='Leaking / sanitation hold') {s.crates[0].items.find(i=>i.alias==='B4')!.leaking=true;s.machine.autoCleaning=false;}
  if(name==='Limited truck') {s.capacities.truckGrams=150;s.capacities.storageGrams=150;}
  if(name==='Human backlog') {s.machine.autoExpert=false;s.machine.humanCapacity=1;s.crates[0].items.forEach(i=>i.visual='UNCERTAIN');}
  if(name==='Multi-commodity · 20 lanes') {
    const kinds=laneReference.batches.map(b=>b.commodityId as Commodity);s.batches=[];s.crates=[];s.profiles=Object.values(profiles);
    kinds.forEach((commodity,b)=>{const batchId=`B${b+1}`;const crateId=`C${b+1}`;const base=judgeScenario().batches[0];s.batches.push({...base,batchId,commodity,sourceLot:`LOT-${b+1}`,arrivalMs:b*700,urgency:90-b*10}); const items=Array.from({length:12},(_,n)=>item(batchId,crateId,Math.floor(n/4)+1,n%4+1,`${String.fromCharCode(65+b)}${n+1}`,(n%4)/4+.1,Math.floor(n/4)/3+.1,n===5?'BAD':n===10?'UNCERTAIN':'GOOD'));s.crates.push({crateId,batchId,expectedCount:12,expectedMassGrams:1800,items});});
    s.machine.laneGroups=[{batchId:'B1',lanes:[1,2,3,4,5]},{batchId:'B2',lanes:[6,7,8,9,10,11]},{batchId:'B3',lanes:[12,13,14,15,16]},{batchId:'B4',lanes:[17,18,19,20]}];s.capacities.truckGrams=2100;s.capacities.storageGrams=3000;
  }
  if(name==='120 kg eligibility validation'){
    s.bubbleEnabled=false;s.machine.autoExpert=false;s.machine.autoSecondary=false;s.capacities.truckGrams=50000;s.capacities.storageGrams=35000;
    const rows=[...Array.from({length:85},(_,n)=>item('B101','C01',1,n+1,`A${n+1}`,n%10/10,Math.floor(n/10)/10)),...Array.from({length:20},(_,n)=>item('B101','C01',2,n+1,`S${n+1}`,n%10/10,Math.floor(n/10)/10,'MODERATE')),...Array.from({length:10},(_,n)=>item('B101','C01',3,n+1,`R${n+1}`,n/10,.5,'BAD')),...Array.from({length:5},(_,n)=>item('B101','C01',4,n+1,`H${n+1}`,n/5,.5,'UNCERTAIN'))];
    rows.forEach(i=>i.massGrams=1000);s.crates[0]={...s.crates[0],items:rows,expectedCount:120,expectedMassGrams:120000};s.machine.secondaryCapacity=20;s.machine.humanCapacity=5;s.machine.bufferCapacity=128;
  }
  if(name==='Environmental risk comparison'){
    const base=structuredClone(s.batches[0]);base.daysSinceHarvest=2;const rows=Array.from({length:4},(_,n)=>item('B101','C01',1,n+1,`E${n+1}`,.15+n*.2,.5));
    s.bubbleEnabled=false;s.batches=[base,{...structuredClone(base),batchId:'B102',sourceLot:'WARM-LOT',daysSinceHarvest:9,environmentalHistory:{temperatureC:[30],humidityPct:[70],ethylene:null,source:'SCENARIO_FIXTURE'}}];
    s.crates=[{crateId:'C01',batchId:'B101',items:rows,expectedCount:4,expectedMassGrams:600},{crateId:'C02',batchId:'B102',items:rows.map(i=>({...i,itemId:i.itemId.replace('B101-C01','B102-C02'),alias:`W${i.index}`})),expectedCount:4,expectedMassGrams:600}];s.capacities.truckGrams=600;s.capacities.storageGrams=600;
  }
  if(name==='1000 item stress'){
    s.bubbleEnabled=false;s.crates=Array.from({length:100},(_,c)=>{const crateId=`C${String(c+1).padStart(3,'0')}`,rows=Array.from({length:10},(_,n)=>item('B101',crateId,1,n+1,`T${c*10+n+1}`,n/10,.5));return {crateId,batchId:'B101',items:rows,expectedCount:10,expectedMassGrams:1500};});s.machine.bufferCapacity=2000;s.capacities.truckGrams=75000;s.capacities.storageGrams=75000;
  }
  return scenarioSchema.parse(s);
}
