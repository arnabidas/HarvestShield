import {useState,useMemo,useEffect} from 'react';
import type {Snapshot,Item} from '../domain/schema';
import {priority} from '../domain/policy';
import {timing} from '../domain/timing';

export function SpatialPanel({snapshot,time,selected,onSelect,mode,playing,reduced}:{snapshot:Snapshot;time:number;selected:string;onSelect:(id:string)=>void;mode:'map'|'bubble';playing:boolean;reduced:boolean}){
  const selectedItem=snapshot.items[selected]??Object.values(snapshot.items)[0];
  const items=Object.values(snapshot.items).filter(i=>i.crateId===selectedItem.crateId),layers=[...new Set(items.map(i=>i.layer))].sort((a,b)=>a-b);
  const [layer,setLayer]=useState(selectedItem.layer);useEffect(()=>setLayer(selectedItem.layer),[selectedItem.itemId,selectedItem.layer]);
  const bubbles=snapshot.bubbles.filter(b=>b.crateId===selectedItem.crateId),maps=snapshot.maps.filter(m=>m.crateId===selectedItem.crateId&&m.simTimeMs<=time);
  const mapped=maps.some(m=>m.layer===layer),latest=maps.filter(m=>m.layer===layer).at(-1),first=maps.find(m=>m.layer===layer);
  const entering=snapshot.events.find(e=>e.type==='CRATE_ENTERED'&&e.crateId===selectedItem.crateId)?.simTimeMs??0;
  const scanStart=first?.simTimeMs??entering,scanDuration=first?1400:timing.crateArrival;
  const scan=Math.min(1,Math.max(0,(time-scanStart)/scanDuration));
  const tiles=useMemo(()=>Array.from({length:192},(_,n)=>{const x=(n%16+.5)/16,y=(Math.floor(n/16)+.5)/12;const sample={...selectedItem,itemId:'HEATMAP_PROBE',origin:{x,y,confidence:1},layer} as Item;return {x,y,score:priority(sample,bubbles)};}),[snapshot.bubbles,selectedItem.crateId,layer]);
  const own=selectedItem.visualCondition,flag=selectedItem.neighborReviewFlag;
  const badge=playing?'LIVE / VIRTUAL CLOCK':'PAUSED / RECORDED STATE';
  const point=(item:Item)=>[36+item.origin.x*272,44+item.origin.y*224];
  const condition=(item:Item)=>item.visualCondition==='BAD'?'#f58167':item.neighborReviewFlag||item.visualCondition==='MODERATE'?'#e6bd57':['UNKNOWN','UNCERTAIN'].includes(item.visualCondition)?'#839b92':'#afde92';
  return <div className={`spatial-panel ${mode}`}>
    <p className="eyebrow">{badge}</p><h2>{mode==='map'?'Build the spatial map':'Trace the risk bubble'}</h2>
    <p>{mode==='map'?'Image the exposed layer. Record each item’s original X/Y position and layer before it is picked.':'A visible defect creates a field around its original position. Nearby items receive extra inspection priority.'}</p>
    <div className="layer-tabs" aria-label="Map layer">{layers.map(l=><button key={l} className={layer===l?'active':''} onClick={()=>setLayer(l)}>Layer {l}{maps.some(m=>m.layer===l)?' ✓':''}</button>)}</div>
    <svg className="spatial-canvas" viewBox="0 0 344 330" role="img" aria-label={mode==='map'?`Animated original position map, layer ${layer}`:`Animated neighbor influence field, layer ${layer}`}>
      <defs><pattern id="position-grid" width="34" height="28" patternUnits="userSpaceOnUse"><path d="M34 0H0V28" fill="none" stroke="#526f64" strokeWidth=".5"/></pattern><linearGradient id="scan-gradient"><stop stopColor="#95e1cf" stopOpacity="0"/><stop offset="1" stopColor="#95e1cf" stopOpacity=".5"/></linearGradient></defs>
      <rect x="35" y="43" width="274" height="226" rx="8" fill="#16372f" stroke="#85a899" strokeWidth="1.5"/><rect x="36" y="44" width="272" height="224" fill="url(#position-grid)"/>
      <text x="35" y="25" fill="#b6d4c4" fontSize="10">{selectedItem.crateId} / ORIGINAL COORDINATES</text><text x="309" y="293" textAnchor="end" fill="#9dc6b3" fontSize="10">X → 1.00</text><text x="17" y="268" fill="#9dc6b3" fontSize="10" transform="rotate(-90,17,268)">Y → 1.00</text>
      {mode==='map'&&scan<1&&!reduced&&<><rect x="36" y="44" width={272*scan} height="224" fill="url(#scan-gradient)"/><line x1={36+272*scan} x2={36+272*scan} y1="44" y2="268" stroke="#b7f7da" strokeWidth="2"/><text x="172" y="314" textAnchor="middle" fill="#b7f7da" fontSize="11">Scanning layer / binding IDs</text></>}
      {mode==='bubble'&&tiles.map((t,n)=><rect key={n} x={36+t.x*272-8.5} y={44+t.y*224-9.34} width="17.1" height="18.8" fill="#f3a55f" opacity={t.score*.72}/>)}
      {mode==='bubble'&&bubbles.map(b=>{const trigger=snapshot.events.find(e=>e.type==='BUBBLE_CREATED'&&e.itemId===b.itemId),elapsed=Math.max(0,time-(trigger?.simTimeMs??time));const p=reduced?1:Math.min(1,elapsed/1800),cx=36+b.origin.x*272,cy=44+b.origin.y*224;const radius=Math.sqrt(-Math.log(.2)/b.alpha)*272;return <g key={b.bubbleId}>{[.55,1].map((r,n)=><ellipse key={n} cx={cx} cy={cy} rx={radius*p*r} ry={radius*p*r*224/272} fill="none" stroke="#ffd18a" strokeDasharray={n?'5 4':undefined} strokeWidth="1.2" opacity={Math.exp(-b.beta*Math.abs(layer-b.layer))}/>)}</g>;})}
      {items.filter(i=>i.layer===layer).map(i=>{const [cx,cy]=point(i);const visible=mode==='bubble'||mapped&&(reduced||scan>=i.origin.x);return visible?<g key={i.itemId} onClick={()=>onSelect(i.itemId)} aria-label={`Map item ${i.alias}`} style={{cursor:'pointer'}}><circle cx={cx} cy={cy} r={selected===i.itemId?15:12} fill={condition(i)} stroke={selected===i.itemId?'#fff0c7':'#162e27'} strokeWidth={selected===i.itemId?3:1}/><text x={cx} y={cy+3} textAnchor="middle" fill="#172f28" fontSize="9" fontWeight="700">{i.alias}</text>{mode==='map'&&!['IN_CRATE','MAPPED'].includes(i.state)&&<path d={`M${cx-5} ${cy+19}h10`} stroke="#b5e1d1" strokeWidth="2"/>}</g>:null;})}
      {!mapped&&mode==='map'&&scan>=1&&<text x="172" y="155" textAnchor="middle" fill="#adc7bb" fontSize="12">Waiting for this layer to be exposed</text>}
      {mode==='bubble'&&!bubbles.length&&<text x="172" y="157" textAnchor="middle" fill="#adc7bb" fontSize="12">No defect field recorded yet</text>}
    </svg>
    <div className="spatial-point-controls" aria-label="Select a mapped item">{items.filter(i=>i.layer===layer).map(i=><button key={i.itemId} aria-label={`Select map item ${i.alias}`} onClick={()=>onSelect(i.itemId)}>{i.alias}</button>)}</div>
    <div className="map-stack">{layers.map(l=><div role="button" tabIndex={0} onKeyDown={e=>{if(e.key==='Enter'||e.key===' ')setLayer(l);}} key={l} className={layer===l?'chosen':''} onClick={()=>setLayer(l)}><span>L{l}</span>{items.filter(i=>i.layer===l).map(i=><i key={i.itemId} style={{background:condition(i)}}/>)}<small>{maps.some(m=>m.layer===l)?'mapped':'concealed'}</small></div>)}</div>
    {mode==='map'?<><h3>{mapped?'Original map retained':'Exposed-layer imaging'}</h3><small>Green: observed good · amber: extra scrutiny · red: defect · gray: unobserved / uncertain</small><p>{latest?`Map version ${latest.version} · ${latest.itemIds.length} items remain on the exposed layer. Original positions stay fixed after pickup.`:'Only exposed layers are mapped. Lower-layer positions become available as the crate is unloaded.'}</p>{selectedItem.inferenceRequired&&<p className="map-note">One uploaded photo is placed at the center of an illustrated single-item crate. This classifier does not detect depth or extract a crate map from the photo.</p>}</>:<><div className="heat-legend"><span>Low influence</span><i/><span>More scrutiny</span></div><p>Influence fades with X/Y distance and layer separation. It changes the review route while keeping the item’s own visual finding.</p>{bubbles.map(b=><div className="bubble-source" key={b.bubbleId}><strong>{snapshot.items[b.itemId].alias} · layer {b.layer}</strong><small>XY decay α {b.alpha} / layer decay β {b.beta}</small></div>)}<small>Inspection heuristic · not a measured infection probability</small></>}
    <div className="spatial-item-summary"><h3>{selectedItem.alias} / original layer {selectedItem.layer}</h3><dl><dt>Own visual finding</dt><dd data-testid="visual-condition">{own}</dd><dt>Neighbor review</dt><dd data-testid="neighbor-flag">{flag?'FLAGGED':'No flag'}</dd><dt>Inspection priority</dt><dd>{selectedItem.priority.toFixed(3)} / 1</dd><dt>Quality route</dt><dd data-testid="quality-route">{selectedItem.route??'Not classified'}</dd></dl></div>
  </div>;
}
