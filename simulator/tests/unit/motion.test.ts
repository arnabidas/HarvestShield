import {it,expect} from 'vitest';
import {Engine} from '../../src/domain/engine';
import {judgeScenario,preset} from '../../src/data/scenarios';
import {itemPose} from '../../src/scene/motion';

it('keeps produce continuous across pickup, inspection, waiting, sorting and packing checkpoints',()=>{
  const scenario=judgeScenario(),snapshot=new Engine(scenario).runAll();
  for(const item of Object.values(snapshot.items)){
    for(const event of snapshot.events.filter(e=>e.itemId===item.itemId&&['PICK_SUCCEEDED','ITEM_ENTERED_CARRIER','IDENTITY_VERIFIED','ITEM_BUFFERED','ITEM_ROUTE_FINALIZED','ITEM_PACKAGED','SECONDARY_RESULT','ITEM_REJECTED'].includes(e.type))){
      const before=itemPose(item,snapshot,event.simTimeMs-.01,scenario.machine.serviceMs).position;
      const after=itemPose(item,snapshot,event.simTimeMs,scenario.machine.serviceMs).position;
      expect(Math.hypot(...before.map((v,n)=>v-after[n])),`${item.alias}: ${event.type}`).toBeLessThan(.01);
    }
  }
});
it('uses virtual time for sideways motion and preserves A2 waiting slot after sorting',()=>{
  const scenario=judgeScenario(),snapshot=new Engine(scenario).runAll(),item=Object.values(snapshot.items).find(i=>i.alias==='A2')!;
  expect(item.holdingSlot).toBe(12);
  const event=snapshot.events.find(e=>e.itemId===item.itemId&&e.type==='IDENTITY_VERIFIED')!;
  const pose=(p:number)=>itemPose(item,snapshot,event.simTimeMs+item.imagingDurationMs*p,scenario.machine.serviceMs);
  expect(Math.abs(pose(.3).position[2]-pose(.45).position[2])).toBeGreaterThan(.2);
  expect(pose(.4)).toEqual(pose(.4));
});
it('freezes held produce at its checkpoint',()=>{
  const scenario=preset('Tracking loss'),snapshot=new Engine(scenario).runAll();
  for(const item of Object.values(snapshot.items).filter(i=>i.state==='HELD'))expect(itemPose(item,snapshot,item.stateSince+500,scenario.machine.serviceMs).position).toEqual(itemPose(item,snapshot,item.stateSince+5000,scenario.machine.serviceMs).position);
});
