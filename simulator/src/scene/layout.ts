import type {Route} from '../domain/schema';
export type Point=[number,number,number];
export const layout={warehouse:-13,mapper:-9,rollerStart:-5.9,rollerEnd:1.9,waitingStart:2.4,waitingEnd:5.8,sortStart:6.8,sortEnd:12.1,pack:18,truck:24.2,storage:24.2};
export const stations=[
  {name:'Overview',x:4,z:0,caption:'Stored produce → layer map → full-length roller inspection → crate-completion wait → four-way sorting → approved output.'},
  {name:'Warehouse',x:-14,z:0,caption:'The produce has been stored here. A source crate now leaves storage for pre-dispatch screening.'},
  {name:'First imaging / layer map',x:-9,z:0,caption:'Image the exposed layer in its crate, save original positions, then lift one identified item onto the roller line.'},
  {name:'Gentle transfer',x:-7.6,z:0,caption:'Padded pickup follows a fixed lift-and-transfer path. The source ID follows the same item.'},
  {name:'Roller inspection',x:-2,z:0,caption:'Twenty rollers: 5 forward, 5 sideways on a slope, 5 forward, then 5 sideways on a slope. Cameras capture the reoriented item.'},
  {name:'Wait before sorting',x:4,z:0,caption:'Inspected items wait beside the sorter until every layer is checked. A later defect may change an earlier item’s review route.'},
  {name:'Original-crate risk overlay',x:-9,z:0,caption:'This is an algorithm drawn on the saved crate map—not another machine. B4 flags nearby GOOD A2 for additional screening.'},
  {name:'Lane sorter',x:9.5,z:0,caption:'The gate opens after crate reconciliation. Tracked lanes feed approved, additional-screening, expert and reject outputs.'},
  {name:'Additional screening',x:15.3,z:-4.5,caption:'Synthetic additional evidence resolves flagged items. A cleared item rejoins the approved packing conveyor.'},
  {name:'Expert review',x:15.3,z:4.5,caption:'Unclear items stay here until an explicit demo inspector decision; unresolved evidence stays held.'},
  {name:'Approved packing',x:18,z:0,caption:'Only cleared items enter output crates, with every original source ID retained.'},
  {name:'Truck / storage',x:24.2,z:0,caption:'Approved output travels along the loading conveyor to eligible truck or storage allocation.'}
];
export const routeColors:Record<Route,string>={APPROVED:'#a9da73',SECONDARY_SCREENING:'#eab950',ISOLATE_REJECT:'#d97666',HUMAN_REVIEW:'#a79ccd'};
export const routeDestination=(route:Route|null):Point=>route==='SECONDARY_SCREENING'?[15.3,1.16,-4.5]:route==='HUMAN_REVIEW'?[15.3,1.16,4.5]:route==='ISOLATE_REJECT'?[15.3,1.16,-7]:[18,1.16,0];
export const laneZ=(lane:number)=>((lane-1)%20-9.5)*.34;
export const waitingPosition=(slot:number):Point=>[2.5+(slot%8)*.4,1.16,-1.4+Math.floor(slot/8)*.4];
export const rollerPath:Point[]=[[-5.9,1.16,0],[-3.95,1.16,0],[-3.7,1.25,-.48],[-2.25,1.07,.48],[-2,1.16,0],[-.05,1.16,0],[.2,1.25,-.48],[1.65,1.07,.48],[1.9,1.16,0]];
export function along(points:Point[],progress:number):Point {
  const p=Math.min(1,Math.max(0,progress));const distances=points.slice(1).map((v,n)=>Math.hypot(v[0]-points[n][0],v[1]-points[n][1],v[2]-points[n][2]));let remaining=p*distances.reduce((a,b)=>a+b,0);
  for(let n=0;n<distances.length;n++){if(remaining<=distances[n]||n===distances.length-1){const f=distances[n]?remaining/distances[n]:0;return points[n].map((v,k)=>v+(points[n+1][k]-v)*f) as Point;}remaining-=distances[n];}return points[0];
}
export function sortPath(slot:number,lane:number,route:Route|null):Point[]{const start=waitingPosition(slot),z=laneZ(lane);return [start,[5.6,1.16,start[2]],[6.1,1.16,0],[6.8,1.16,z],[12.1,1.16,z],[12.55,1.16,z],[12.6,1.16,route==='SECONDARY_SCREENING'?-2.4:route==='HUMAN_REVIEW'?2.4:route==='ISOLATE_REJECT'?-3.4:0],[14,1.16,routeDestination(route)[2]],routeDestination(route)];}
export function clearedPath(route:Route|null):Point[]{const from=routeDestination(route);return [from,[16.5,1.16,from[2]],[17.2,1.16,from[2]],[17.2,1.16,0],[18,1.16,0]];}
